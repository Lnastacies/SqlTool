import { logger } from '../logger'
import type { TableMetadata } from './adapters'
import { loadAllTableRows, splitMutationBatch } from './databaseToolData'
import { orderTablesByForeignKeys } from './databaseToolDependencies'
import type { DatabaseToolGateway } from './databaseToolGateway'
import { buildTargetTableDefinition } from './databaseToolStructure'
import type {
  DataTransferPreview,
  DataTransferRequest,
  DataTransferResult,
} from './databaseToolTypes'
import {
  buildClearTableSql,
  commonColumnNames,
  validateToolScope,
} from './databaseToolValidation'
import { quoteIdentifier } from './mutationSqlUtils'

export class DataTransferService {
  constructor(private readonly gateway: DatabaseToolGateway) {}

  async preview(request: DataTransferRequest): Promise<DataTransferPreview> {
    const scope = await validateToolScope(this.gateway, request)
    const targetTables = await this.gateway.getTables(
      scope.target.connId,
      scope.target.database,
    )
    const items: DataTransferPreview['items'] = []
    for (const table of scope.tables) {
      const sourceMetadata = await this.gateway.getTableMetadata(
        scope.source.connId, scope.source.database, table,
      )
      const sourcePage = await this.gateway.getTableData(
        scope.source.connId, scope.source.database, table, 1, 20,
      )
      const targetExists = targetTables.includes(table)
      const warnings: string[] = []
      if (!targetExists && !request.createMissing) {
        warnings.push('目标表不存在，且未启用“自动创建缺失表”')
      }
      let targetRows = 0
      let commonColumns = sourceMetadata.fields.map(field => field.name)
      if (targetExists) {
        const targetMetadata = await this.gateway.getTableMetadata(
          scope.target.connId, scope.target.database, table,
        )
        const targetPage = await this.gateway.getTableData(
          scope.target.connId, scope.target.database, table, 1, 20,
        )
        targetRows = targetPage.total
        commonColumns = commonColumnNames(
          sourceMetadata.fields.map(field => field.name),
          targetMetadata.fields.map(field => field.name),
        )
        const skipped = sourceMetadata.fields.length - commonColumns.length
        if (skipped > 0) warnings.push(`${skipped} 个源字段在目标表中不存在，将跳过`)
        if (commonColumns.length === 0) warnings.push('源表和目标表没有同名字段')
      }
      const blocked = (
        (!targetExists && !request.createMissing)
        || commonColumns.length === 0
      )
      items.push({
        table,
        sourceRows: sourcePage.total,
        targetRows,
        targetExists,
        commonColumns,
        status: blocked ? 'blocked' as const
          : warnings.length > 0 ? 'warning' as const : 'ready' as const,
        warnings,
      })
    }
    const warnings = ['数据按批次提交，单张大表不保证整表原子回滚']
    if (request.strategy === 'replace') {
      warnings.push('覆盖模式会先清空目标表，请确保目标数据库已备份')
    }
    if (scope.sourceType !== scope.targetType) {
      warnings.push(`跨数据库类型传输: ${scope.sourceType} → ${scope.targetType}，缺失表将使用兼容类型映射`)
    }
    logger.info(
      'DataTransfer',
      `传输预检查完成: 源=${scope.source.connId}/${scope.source.database}, 目标=${scope.target.connId}/${scope.target.database}, 表数=${items.length}, 阻断=${items.filter(item => item.status === 'blocked').length}`,
    )
    return {
      items,
      sourceType: scope.sourceType,
      targetType: scope.targetType,
      warnings,
    }
  }

  async execute(request: DataTransferRequest): Promise<DataTransferResult> {
    const scope = await validateToolScope(this.gateway, request)
    const preview = await this.preview(request)
    const blocked = preview.items.filter(item => item.status === 'blocked')
    if (blocked.length > 0) {
      throw new Error(`以下表未通过传输预检查: ${blocked.map(item => item.table).join(', ')}`)
    }
    const metadata = new Map<string, TableMetadata>()
    for (const table of scope.tables) {
      metadata.set(table, await this.gateway.getTableMetadata(
        scope.source.connId, scope.source.database, table,
      ))
    }
    const dependencyOrder = orderTablesByForeignKeys(scope.tables, metadata)
    const result: DataTransferResult = {
      tableCount: 0,
      transferredRows: 0,
      createdTables: [],
      warnings: [...preview.warnings],
    }
    if (dependencyOrder.hasCycle) {
      result.warnings.push('检测到循环外键，缺失表将按选择顺序创建')
    }
    logger.info(
      'DataTransfer',
      `开始数据传输: 策略=${request.strategy}, 自动建表=${request.createMissing ? '是' : '否'}, 表数=${scope.tables.length}`,
    )

    if (request.strategy === 'replace') {
      // 覆盖模式必须先清子表再清父表，避免旧数据触发外键约束。
      for (const table of [...dependencyOrder.tables].reverse()) {
        const item = preview.items.find(candidate => candidate.table === table)!
        if (!item.targetExists) continue
        const clearResult = await this.gateway.executeSQL(
          scope.target.connId,
          scope.target.database,
          buildClearTableSql(scope.targetType, scope.target.database, table),
        )
        if (!clearResult.success) {
          throw new Error(`清空目标表“${table}”失败: ${clearResult.message}`)
        }
        logger.info('DataTransfer', `覆盖传输已清空目标表: 表=${table}`)
      }
    }

    for (const table of dependencyOrder.tables) {
      const item = preview.items.find(candidate => candidate.table === table)!
      const sourceMetadata = metadata.get(item.table)!
      let targetMetadata = item.targetExists
        ? await this.gateway.getTableMetadata(
          scope.target.connId, scope.target.database, item.table,
        )
        : undefined
      if (!targetMetadata) {
        const mapped = buildTargetTableDefinition(
          item.table,
          sourceMetadata,
          scope.sourceType,
          scope.targetType,
        )
        await this.gateway.saveTableStructure(
          scope.target.connId,
          scope.target.database,
          { definition: mapped.definition },
        )
        result.createdTables.push(item.table)
        result.warnings.push(...mapped.warnings.map(warning => `${item.table}: ${warning}`))
        targetMetadata = await this.gateway.getTableMetadata(
          scope.target.connId, scope.target.database, item.table,
        )
      }

      const columns = commonColumnNames(
        sourceMetadata.fields.map(field => field.name),
        targetMetadata.fields.map(field => field.name),
      )
      const sourceRows = await loadAllTableRows(
        this.gateway, scope.source, item.table,
      )
      const inserts = sourceRows.map(row => ({
        values: Object.fromEntries(columns.map(column => [column, row[column]])),
      }))
      const chunks = splitMutationBatch(
        { inserts, updates: [], deletes: [] },
        request.batchSize || 200,
      )
      const identityField = targetMetadata.fields.find(
        field => field.auto_increment && columns.includes(field.name),
      )
      if (scope.targetType === 'SQL Server' && identityField && chunks.length > 0) {
        await this.setSqlServerIdentity(scope.target, item.table, true)
      }
      try {
        for (const chunk of chunks) {
          await this.gateway.mutateTableRows(
            scope.target.connId, scope.target.database, item.table, chunk,
          )
        }
      } finally {
        if (scope.targetType === 'SQL Server' && identityField && chunks.length > 0) {
          await this.setSqlServerIdentity(scope.target, item.table, false)
        }
      }
      result.tableCount += 1
      result.transferredRows += sourceRows.length
      logger.info(
        'DataTransfer',
        `表传输完成: 表=${item.table}, 行数=${sourceRows.length}, 批次=${chunks.length}`,
      )
    }
    logger.info(
      'DataTransfer',
      `数据传输完成: 表数=${result.tableCount}, 行数=${result.transferredRows}, 建表=${result.createdTables.length}`,
    )
    return result
  }

  private async setSqlServerIdentity(
    endpoint: DataTransferRequest['target'],
    tableName: string,
    enabled: boolean,
  ): Promise<void> {
    const table = `${quoteIdentifier(endpoint.database, '[')}.[dbo].${quoteIdentifier(tableName, '[')}`
    const response = await this.gateway.executeSQL(
      endpoint.connId,
      endpoint.database,
      `SET IDENTITY_INSERT ${table} ${enabled ? 'ON' : 'OFF'}`,
    )
    if (!response.success) throw new Error(response.message)
  }
}
