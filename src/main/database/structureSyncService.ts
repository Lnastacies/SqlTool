import { logger } from '../logger'
import type { TableMetadata } from './adapters'
import { orderTablesByForeignKeys } from './databaseToolDependencies'
import type { DatabaseToolGateway } from './databaseToolGateway'
import {
  buildTargetTableDefinition,
  tableStructureMatches,
} from './databaseToolStructure'
import type {
  StructureSyncPreview,
  StructureSyncRequest,
  StructureSyncResult,
} from './databaseToolTypes'
import { validateToolScope } from './databaseToolValidation'
import { inspectStructureSyncSafety } from './structureSyncSafety'

export class StructureSyncService {
  constructor(private readonly gateway: DatabaseToolGateway) {}

  async preview(request: StructureSyncRequest): Promise<StructureSyncPreview> {
    const scope = await validateToolScope(this.gateway, request)
    const targetTables = await this.gateway.getTables(
      scope.target.connId,
      scope.target.database,
    )
    const sourceMetadataMap = new Map<string, TableMetadata>()
    const items: StructureSyncPreview['items'] = []
    for (const table of scope.tables) {
      const sourceMetadata = await this.gateway.getTableMetadata(
        scope.source.connId, scope.source.database, table,
      )
      sourceMetadataMap.set(table, sourceMetadata)
      const targetExists = targetTables.includes(table)
      const targetMetadata = targetExists
        ? await this.gateway.getTableMetadata(
          scope.target.connId, scope.target.database, table,
        )
        : undefined
      try {
        const mapped = buildTargetTableDefinition(
          table,
          sourceMetadata,
          scope.sourceType,
          scope.targetType,
          targetMetadata,
        )
        if (
          targetMetadata
          && tableStructureMatches(mapped.definition, targetMetadata)
        ) {
          items.push({
            table,
            targetExists,
            status: 'same',
            plan: {
              mode: 'alter',
              statements: [],
              warnings: [],
            },
            warnings: mapped.warnings,
          })
          continue
        }
        const plan = await this.gateway.previewTableStructure(
          scope.target.connId,
          scope.target.database,
          {
            originalName: targetExists ? table : undefined,
            definition: mapped.definition,
          },
        )
        const warnings = [...mapped.warnings, ...plan.warnings]
        if (plan.statements.some(statement => /\bDROP\b/i.test(statement))) {
          warnings.push('计划包含 DROP 操作，请确认目标端数据兼容性')
        }
        const safety = targetMetadata
          ? await inspectStructureSyncSafety(
            this.gateway,
            scope.target,
            scope.targetType,
            table,
            targetMetadata,
            mapped.definition,
          )
          : { blockers: [], checkCount: 0 }
        warnings.push(...safety.blockers)
        items.push({
          table,
          targetExists,
          status: safety.blockers.length > 0
            ? 'blocked'
            : plan.statements.length === 0
            ? 'same'
            : warnings.length > 0 ? 'warning' : 'ready',
          plan,
          warnings,
        })
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        items.push({
          table,
          targetExists,
          status: 'blocked',
          plan: {
            mode: targetExists ? 'alter' : 'create',
            statements: [],
            warnings: [],
          },
          warnings: [detail],
        })
      }
    }
    const warnings = [
      '结构同步会修改目标数据库，请先核对每张表的 SQL 预览',
    ]
    if (scope.sourceType !== scope.targetType) {
      warnings.push(`跨数据库类型同步: ${scope.sourceType} → ${scope.targetType}，已转换字段类型`)
    }
    if (orderTablesByForeignKeys(scope.tables, sourceMetadataMap).hasCycle) {
      warnings.push('检测到循环外键，缺失表将先创建基础结构，再补充外键约束')
    }
    logger.info(
      'StructureSync',
      `结构同步预检查完成: 表数=${items.length}, 变更=${items.filter(item => item.status !== 'same').length}, 阻断=${items.filter(item => item.status === 'blocked').length}`,
    )
    return {
      items,
      sourceType: scope.sourceType,
      targetType: scope.targetType,
      warnings,
    }
  }

  async execute(request: StructureSyncRequest): Promise<StructureSyncResult> {
    const scope = await validateToolScope(this.gateway, request)
    const preview = await this.preview(request)
    const blocked = preview.items.filter(item => item.status === 'blocked')
    if (blocked.length > 0) {
      throw new Error(
        `以下表未通过结构预检查: ${blocked.map(item => (
          `${item.table}（${item.warnings[0] || '存在不兼容变更'}）`
        )).join(', ')}`,
      )
    }
    const targetTables = await this.gateway.getTables(
      scope.target.connId,
      scope.target.database,
    )
    const targetTableSet = new Set(targetTables)
    const metadata = new Map<string, TableMetadata>()
    for (const table of scope.tables) {
      metadata.set(table, await this.gateway.getTableMetadata(
        scope.source.connId, scope.source.database, table,
      ))
    }
    const dependencyOrder = orderTablesByForeignKeys(scope.tables, metadata)
    const orderedTables = dependencyOrder.tables
    const result: StructureSyncResult = {
      tableCount: 0,
      statementCount: 0,
      createdTables: [],
      alteredTables: [],
      warnings: [...preview.warnings],
    }
    if (dependencyOrder.hasCycle) {
      result.warnings.push('检测到循环外键，已启用分阶段建表')
    }
    logger.info(
      'StructureSync',
      `开始结构同步: 表数=${orderedTables.length}, 顺序=${orderedTables.join(',')}`,
    )
    const stagedTables = new Set<string>()
    if (dependencyOrder.hasCycle) {
      // 循环引用无法通过排序解决，先创建不带外键的基础表，待全部表存在后再补约束。
      for (const table of orderedTables) {
        if (targetTableSet.has(table)) continue
        const mapped = buildTargetTableDefinition(
          table,
          metadata.get(table)!,
          scope.sourceType,
          scope.targetType,
        )
        const saved = await this.gateway.saveTableStructure(
          scope.target.connId,
          scope.target.database,
          {
            definition: {
              ...mapped.definition,
              foreignKeys: [],
            },
          },
        )
        stagedTables.add(table)
        targetTableSet.add(table)
        result.tableCount += 1
        result.statementCount += saved.statementCount
        result.createdTables.push(table)
        result.warnings.push(...mapped.warnings.map(
          warning => `${table}: ${warning}`,
        ))
        logger.info(
          'StructureSync',
          `循环外键基础表创建完成: 表=${table}, 语句=${saved.statementCount}`,
        )
      }
    }
    for (const table of orderedTables) {
      const previewItem = preview.items.find(item => item.table === table)
      if (!previewItem || previewItem.status === 'same') continue
      const targetExists = targetTableSet.has(table)
      const targetMetadata = targetExists
        ? await this.gateway.getTableMetadata(
          scope.target.connId, scope.target.database, table,
        )
        : undefined
      const mapped = buildTargetTableDefinition(
        table,
        metadata.get(table)!,
        scope.sourceType,
        scope.targetType,
        targetMetadata,
      )
      const saved = await this.gateway.saveTableStructure(
        scope.target.connId,
        scope.target.database,
        {
          originalName: targetExists ? table : undefined,
          definition: mapped.definition,
        },
      )
      if (!stagedTables.has(table)) result.tableCount += 1
      result.statementCount += saved.statementCount
      result.warnings.push(...saved.warnings.map(warning => `${table}: ${warning}`))
      if (targetTables.includes(table)) result.alteredTables.push(table)
      else if (!stagedTables.has(table)) result.createdTables.push(table)
      logger.info(
        'StructureSync',
        `表结构同步完成: 表=${table}, 模式=${saved.mode}, 语句=${saved.statementCount}`,
      )
    }
    logger.info(
      'StructureSync',
      `结构同步完成: 表数=${result.tableCount}, 语句=${result.statementCount}`,
    )
    return result
  }

}
