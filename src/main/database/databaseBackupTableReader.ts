import { logger } from '../logger'
import type { ActiveConnection } from './databaseConnectionRegistry'
import type { DatabaseModelTable } from './databaseManagementTypes'
import type { ConnectionData } from './adapters'
import {
  quoteSqlString,
  quoteTableIdentifier,
  tableReference,
} from './tableStructureSqlCommon'

// 备份数据读取批量：相比 UI 表格分页(500)放大 10 倍，显著减少数据库往返次数。
// 单批 5000 行的内存占用对常规业务表可控，同时避免单行流式读取的回调开销。
export const BACKUP_READ_BATCH_SIZE = 5000

// 数值型主键可走主键范围翻页(WHERE pk > last)，避免 OFFSET 深分页的 O(n²) 扫描。
// 覆盖各库写法：MySQL int(11)/bigint unsigned、PostgreSQL integer/double precision、
// SQL Server decimal(18,2)、SQLite INTEGER，类型串统一按前缀词匹配。
const NUMERIC_PRIMARY_KEY_PATTERN = /^(?:tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real|serial|bigserial|number)\b/i

export interface BackupTableReader {
  // 表的总行数（打开时一次性 COUNT，用于进度展示）
  total: number
  // 读取下一批数据；返回空数组表示读取完毕
  readNext: () => Promise<Record<string, unknown>[]>
}

interface ReaderStrategy {
  kind: 'keyset' | 'offset'
  primaryKey?: string
}

// 仅单列数值主键使用 keyset 翻页；复合主键、非数值主键、无主键回退 OFFSET
function resolveStrategy(table: DatabaseModelTable): ReaderStrategy {
  const primaryFields = table.fields.filter(field => field.primary)
  if (
    primaryFields.length === 1
    && NUMERIC_PRIMARY_KEY_PATTERN.test(primaryFields[0].type.trim())
  ) {
    return { kind: 'keyset', primaryKey: primaryFields[0].name }
  }
  return { kind: 'offset' }
}

function buildReaderOrderClause(
  databaseType: ConnectionData['type'],
  table: DatabaseModelTable,
  strategy: ReaderStrategy,
): string {
  const quote = (value: string) => quoteTableIdentifier(value, databaseType)
  if (strategy.kind === 'keyset') {
    return ` ORDER BY ${quote(strategy.primaryKey!)} ASC`
  }
  // OFFSET 翻页必须有稳定排序，否则跨页可能重复或丢行
  const primaryFields = table.fields.filter(field => field.primary)
  if (primaryFields.length === 0) {
    return databaseType === 'SQL Server' ? ' ORDER BY (SELECT NULL)' : ''
  }
  return ` ORDER BY ${primaryFields
    .map(field => `${quote(field.name)} ASC`)
    .join(', ')}`
}

function buildBatchSql(
  databaseType: ConnectionData['type'],
  tableRef: string,
  strategy: ReaderStrategy,
  orderClause: string,
  batchSize: number,
  offset: number,
  lastPk: unknown,
): string {
  const isSqlServer = databaseType === 'SQL Server'
  if (strategy.kind === 'keyset') {
    const pkColumn = quoteTableIdentifier(strategy.primaryKey!, databaseType)
    // 主键值来自数据库本身而非用户输入；字符串形式内联以兼容 bigint 精度
    const whereClause = lastPk === undefined
      ? ''
      : ` WHERE ${pkColumn} > ${quoteSqlString(String(lastPk))}`
    return isSqlServer
      ? `SELECT TOP ${batchSize} * FROM ${tableRef}${whereClause}${orderClause}`
      : `SELECT * FROM ${tableRef}${whereClause}${orderClause} LIMIT ${batchSize}`
  }
  return isSqlServer
    ? `SELECT * FROM ${tableRef}${orderClause} OFFSET ${offset} ROWS FETCH NEXT ${batchSize} ROWS ONLY`
    : `SELECT * FROM ${tableRef}${orderClause} LIMIT ${batchSize} OFFSET ${offset}`
}

/**
 * 备份专用表数据读取器。
 * 与 UI 表格分页接口(getTableData)的区别：
 * - 打开时只执行 1 次 COUNT，之后每批仅 1 条数据 SQL；
 * - 不重复校验数据库/表存在性、不重复读取字段元数据(备份开始前模型已加载);
 * - 数值主键走 keyset 翻页，消除 OFFSET 深分页。
 */
export async function createBackupTableReader(
  active: ActiveConnection,
  database: string,
  table: DatabaseModelTable,
  batchSize = BACKUP_READ_BATCH_SIZE,
): Promise<BackupTableReader> {
  const startedAt = Date.now()
  const databaseType = active.connData.type
  const tableRef = tableReference(databaseType, database, table.name)
  const strategy = resolveStrategy(table)
  const orderClause = buildReaderOrderClause(databaseType, table, strategy)
  // PostgreSQL 的数据库由连接会话决定，executeSQL 的数据库参数必须置空
  const executionDatabase = databaseType === 'PostgreSQL' ? '' : database

  const execute = async (sql: string): Promise<Record<string, unknown>[]> => {
    const result = await active.adapter.executeSQL(
      active.connection,
      executionDatabase,
      sql,
    )
    if (!result.success) throw new Error(result.message)
    return (result.rows || []) as Record<string, unknown>[]
  }

  // COUNT 只执行一次，供进度展示；读取循环以“读到空批”作为结束条件
  const countRows = await execute(
    `SELECT COUNT(*) AS __sqltool_total FROM ${tableRef}`,
  )
  const total = Number(countRows[0]?.__sqltool_total || 0)
  logger.debug(
    'DatabaseBackup',
    `备份数据读取器就绪: 表=${table.name}, 策略=${strategy.kind === 'keyset' ? `主键范围(${strategy.primaryKey})` : 'OFFSET'}, 行数=${total}, 批量=${batchSize}`,
  )

  let offset = 0
  let lastPk: unknown
  let exhausted = false

  return {
    total,
    readNext: async () => {
      if (exhausted) return []
      const rows = await execute(buildBatchSql(
        databaseType,
        tableRef,
        strategy,
        orderClause,
        batchSize,
        offset,
        lastPk,
      ))
      if (rows.length === 0) {
        exhausted = true
        logger.debug(
          'DatabaseBackup',
          `备份数据读取完毕: 表=${table.name}, 累计=${offset}, 耗时=${Date.now() - startedAt}ms`,
        )
        return []
      }
      offset += rows.length
      if (strategy.kind === 'keyset') {
        lastPk = rows[rows.length - 1][strategy.primaryKey!]
      }
      if (rows.length < batchSize) exhausted = true
      return rows
    },
  }
}
