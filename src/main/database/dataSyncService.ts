import { logger } from '../logger'
import type { TableMetadata } from './adapters'
import {
  compareTableRows,
  loadAllTableRows,
  splitMutationBatch,
} from './databaseToolData'
import { orderTablesByForeignKeys } from './databaseToolDependencies'
import type { DatabaseToolGateway } from './databaseToolGateway'
import type {
  DataSyncPreview,
  DataSyncRequest,
  DataSyncResult,
} from './databaseToolTypes'
import {
  commonColumnNames,
  validateToolScope,
} from './databaseToolValidation'
import { quoteIdentifier } from './mutationSqlUtils'

interface PreparedSyncBatch {
  targetMetadata: TableMetadata
  batch: ReturnType<typeof compareTableRows>['batch']
}

export class DataSyncService {
  constructor(private readonly gateway: DatabaseToolGateway) {}

  async preview(request: DataSyncRequest): Promise<DataSyncPreview> {
    const scope = await validateToolScope(this.gateway, request)
    const targetTables = await this.gateway.getTables(
      scope.target.connId,
      scope.target.database,
    )
    const items: DataSyncPreview['items'] = []

    for (const table of scope.tables) {
      const warnings: string[] = []
      const sourceMetadata = await this.gateway.getTableMetadata(
        scope.source.connId, scope.source.database, table,
      )
      const sourcePage = await this.gateway.getTableData(
        scope.source.connId, scope.source.database, table, 1, 20,
      )
      const primaryKeys = sourceMetadata.fields
        .filter(field => field.primary)
        .map(field => field.name)
      if (!targetTables.includes(table)) {
        items.push(this.blockedItem(
          table, sourcePage.total, 0, primaryKeys, '目标表不存在',
        ))
        continue
      }
      const targetMetadata = await this.gateway.getTableMetadata(
        scope.target.connId, scope.target.database, table,
      )
      const targetPage = await this.gateway.getTableData(
        scope.target.connId, scope.target.database, table, 1, 20,
      )
      const targetPrimaryKeys = new Set(
        targetMetadata.fields.filter(field => field.primary).map(field => field.name),
      )
      if (primaryKeys.length === 0) {
        items.push(this.blockedItem(
          table, sourcePage.total, targetPage.total, [], '源表没有主键，无法定位同步行',
        ))
        continue
      }
      if (!primaryKeys.every(key => targetPrimaryKeys.has(key))) {
        items.push(this.blockedItem(
          table,
          sourcePage.total,
          targetPage.total,
          primaryKeys,
          '目标表主键与源表不一致',
        ))
        continue
      }
      const commonColumns = commonColumnNames(
        sourceMetadata.fields.map(field => field.name),
        targetMetadata.fields.map(field => field.name),
      )
      if (commonColumns.length < sourceMetadata.fields.length) {
        warnings.push('部分源字段在目标表中不存在，这些字段不会参与同步')
      }
      if (sourcePage.total > 100000 || targetPage.total > 100000) {
        warnings.push('表数据超过 10 万行，预览和执行可能需要较长时间')
      }
      try {
        const [sourceRows, targetRows] = await this.loadPair(scope, table)
        const compared = compareTableRows(
          sourceRows, targetRows, primaryKeys, commonColumns,
        )
        items.push({
          table,
          sourceRows: compared.sourceRows,
          targetRows: compared.targetRows,
          primaryKeys,
          insertedRows: compared.batch.inserts.length,
          updatedRows: compared.batch.updates.length,
          deletedRows: compared.batch.deletes.length,
          unchangedRows: compared.unchangedRows,
          status: warnings.length > 0 ? 'warning' : 'ready',
          warnings,
        })
      } catch (error) {
        items.push(this.blockedItem(
          table,
          sourcePage.total,
          targetPage.total,
          primaryKeys,
          error instanceof Error ? error.message : String(error),
        ))
      }
    }
    const totals = items.reduce((sum, item) => ({
      insertedRows: sum.insertedRows + item.insertedRows,
      updatedRows: sum.updatedRows + item.updatedRows,
      deletedRows: sum.deletedRows + item.deletedRows,
    }), { insertedRows: 0, updatedRows: 0, deletedRows: 0 })
    logger.info(
      'DataSync',
      `数据同步预检查完成: 表数=${items.length}, 新增=${totals.insertedRows}, 更新=${totals.updatedRows}, 删除=${totals.deletedRows}`,
    )
    return {
      items,
      totals,
      warnings: ['执行时会重新比较最新数据，并以每批最多 500 行的事务提交'],
    }
  }

  async execute(request: DataSyncRequest): Promise<DataSyncResult> {
    if (!request.options.insert && !request.options.update && !request.options.delete) {
      throw new Error('请至少选择一种同步操作')
    }
    const scope = await validateToolScope(this.gateway, request)
    const preview = await this.preview(request)
    const blocked = preview.items.filter(item => item.status === 'blocked')
    if (blocked.length > 0) {
      throw new Error(`以下表未通过同步预检查: ${blocked.map(item => item.table).join(', ')}`)
    }
    const result: DataSyncResult = {
      tableCount: 0,
      insertedRows: 0,
      updatedRows: 0,
      deletedRows: 0,
      warnings: [...preview.warnings],
    }
    logger.info(
      'DataSync',
      `开始数据同步: 新增=${request.options.insert}, 更新=${request.options.update}, 删除=${request.options.delete}, 表数=${scope.tables.length}`,
    )
    const sourceMetadataMap = new Map<string, TableMetadata>()
    const prepared = new Map<string, PreparedSyncBatch>()
    for (const item of preview.items) {
      const sourceMetadata = await this.gateway.getTableMetadata(
        scope.source.connId, scope.source.database, item.table,
      )
      sourceMetadataMap.set(item.table, sourceMetadata)
      const targetMetadata = await this.gateway.getTableMetadata(
        scope.target.connId, scope.target.database, item.table,
      )
      const columns = commonColumnNames(
        sourceMetadata.fields.map(field => field.name),
        targetMetadata.fields.map(field => field.name),
      )
      const [sourceRows, targetRows] = await this.loadPair(scope, item.table)
      const compared = compareTableRows(
        sourceRows, targetRows, item.primaryKeys, columns,
      )
      const batch = {
        inserts: request.options.insert ? compared.batch.inserts : [],
        updates: request.options.update ? compared.batch.updates : [],
        deletes: request.options.delete ? compared.batch.deletes : [],
      }
      prepared.set(item.table, { targetMetadata, batch })
    }

    const dependencyOrder = orderTablesByForeignKeys(
      scope.tables,
      sourceMetadataMap,
    )
    if (dependencyOrder.hasCycle) {
      result.warnings.push(
        '检测到循环外键，已按所选顺序分阶段执行；数据库仍可能拒绝无法延迟的循环约束变更',
      )
    }
    const phases = [
      {
        name: '新增',
        tables: dependencyOrder.tables,
        select: (batch: PreparedSyncBatch['batch']) => ({
          inserts: batch.inserts,
          updates: [],
          deletes: [],
        }),
      },
      {
        name: '更新',
        tables: dependencyOrder.tables,
        select: (batch: PreparedSyncBatch['batch']) => ({
          inserts: [],
          updates: batch.updates,
          deletes: [],
        }),
      },
      {
        name: '删除',
        tables: [...dependencyOrder.tables].reverse(),
        select: (batch: PreparedSyncBatch['batch']) => ({
          inserts: [],
          updates: [],
          deletes: batch.deletes,
        }),
      },
    ]

    // 新增和更新按父表到子表执行，删除按相反顺序执行。
    for (const phase of phases) {
      logger.info(
        'DataSync',
        `开始数据同步阶段: 阶段=${phase.name}, 顺序=${phase.tables.join(',')}`,
      )
      for (const table of phase.tables) {
        const tableTask = prepared.get(table)!
        const chunks = splitMutationBatch(
          phase.select(tableTask.batch),
          request.batchSize || 200,
        )
        if (chunks.length === 0) continue
        const identity = (
          phase.name === '新增'
          && scope.targetType === 'SQL Server'
          && tableTask.targetMetadata.fields.some(
            field => field.auto_increment,
          )
        )
        if (identity) await this.setIdentity(scope.target, table, true)
        try {
          for (const chunk of chunks) {
            const changed = await this.gateway.mutateTableRows(
              scope.target.connId,
              scope.target.database,
              table,
              chunk,
            )
            result.insertedRows += changed.insertedRows
            result.updatedRows += changed.updatedRows
            result.deletedRows += changed.deletedRows
          }
        } finally {
          if (identity) await this.setIdentity(scope.target, table, false)
        }
        logger.info(
          'DataSync',
          `数据同步阶段完成: 阶段=${phase.name}, 表=${table}, 批次=${chunks.length}`,
        )
      }
    }
    result.tableCount = prepared.size
    logger.info(
      'DataSync',
      `数据同步完成: 表数=${result.tableCount}, 新增=${result.insertedRows}, 更新=${result.updatedRows}, 删除=${result.deletedRows}`,
    )
    return result
  }

  private async loadPair(
    scope: Awaited<ReturnType<typeof validateToolScope>>,
    table: string,
  ) {
    // 同一连接可能不支持并发请求，因此源、目标按顺序读取。
    const sourceRows = await loadAllTableRows(this.gateway, scope.source, table)
    const targetRows = await loadAllTableRows(this.gateway, scope.target, table)
    return [sourceRows, targetRows] as const
  }

  private blockedItem(
    table: string,
    sourceRows: number,
    targetRows: number,
    primaryKeys: string[],
    warning: string,
  ): DataSyncPreview['items'][number] {
    return {
      table, sourceRows, targetRows, primaryKeys,
      insertedRows: 0, updatedRows: 0, deletedRows: 0, unchangedRows: 0,
      status: 'blocked', warnings: [warning],
    }
  }

  private async setIdentity(
    endpoint: DataSyncRequest['target'],
    tableName: string,
    enabled: boolean,
  ): Promise<void> {
    const table = `${quoteIdentifier(endpoint.database, '[')}.[dbo].${quoteIdentifier(tableName, '[')}`
    const response = await this.gateway.executeSQL(
      endpoint.connId, endpoint.database,
      `SET IDENTITY_INSERT ${table} ${enabled ? 'ON' : 'OFF'}`,
    )
    if (!response.success) throw new Error(response.message)
  }
}
