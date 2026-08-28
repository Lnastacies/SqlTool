import { logger } from '../logger'
import type { ConnectionData, TableMetadata } from './adapters'
import type { DatabaseToolGateway } from './databaseToolGateway'
import type { DatabaseToolEndpoint } from './databaseToolTypes'
import {
  quoteTableIdentifier,
  tableReference,
} from './tableStructureSqlCommon'
import type { TableDefinition } from './tableStructureTypes'

type DatabaseType = ConnectionData['type']

interface LengthCheck {
  field: string
  limit: number
  alias: string
}

interface NullCheck {
  field: string
  alias: string
}

export interface StructureSyncSafetyResult {
  blockers: string[]
  checkCount: number
}

function characterLimit(type: string): number | undefined {
  const normalized = type.trim().toUpperCase()
  if (/\(\s*MAX\s*\)/.test(normalized)) return undefined
  const match = normalized.match(
    /\b(?:N?VAR)?CHAR(?:ACTER\s+VARYING)?\s*\(\s*(\d+)\s*\)/,
  )
  if (!match) return undefined
  const limit = Number(match[1])
  return Number.isFinite(limit) && limit > 0 ? limit : undefined
}

function lengthExpression(
  databaseType: DatabaseType,
  field: string,
): string {
  const quoted = quoteTableIdentifier(field, databaseType)
  if (databaseType === 'SQLite') {
    return `LENGTH(CAST(${quoted} AS TEXT))`
  }
  if (databaseType === 'SQL Server') return `LEN(${quoted})`
  return `CHAR_LENGTH(${quoted})`
}

function numericValue(value: unknown): number {
  if (value === null || value === undefined) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function inspectStructureSyncSafety(
  gateway: DatabaseToolGateway,
  target: DatabaseToolEndpoint,
  targetType: DatabaseType,
  table: string,
  targetMetadata: TableMetadata,
  desired: TableDefinition,
): Promise<StructureSyncSafetyResult> {
  const targetFields = new Map(
    targetMetadata.fields.map(field => [field.name, field]),
  )
  const lengthChecks: LengthCheck[] = []
  const nullChecks: NullCheck[] = []

  desired.fields.forEach(field => {
    const originalName = field.originalName || field.name
    const targetField = targetFields.get(originalName)
    if (!targetField) return
    const desiredLimit = characterLimit(field.type)
    const currentLimit = characterLimit(targetField.type)
    if (
      desiredLimit !== undefined
      && (currentLimit === undefined || desiredLimit < currentLimit)
    ) {
      lengthChecks.push({
        field: originalName,
        limit: desiredLimit,
        alias: `__sqltool_length_${lengthChecks.length}`,
      })
    }
    if (field.notNull && !targetField.not_null) {
      nullChecks.push({
        field: originalName,
        alias: `__sqltool_null_${nullChecks.length}`,
      })
    }
  })

  const checkCount = lengthChecks.length + nullChecks.length
  if (checkCount === 0) return { blockers: [], checkCount }

  const quote = (value: string) => quoteTableIdentifier(value, targetType)
  const projections = [
    ...lengthChecks.map(check => (
      `MAX(${lengthExpression(targetType, check.field)}) AS ${quote(check.alias)}`
    )),
    ...nullChecks.map(check => (
      `SUM(CASE WHEN ${quote(check.field)} IS NULL THEN 1 ELSE 0 END) AS ${quote(check.alias)}`
    )),
  ]
  const sql = (
    `SELECT ${projections.join(', ')} `
    + `FROM ${tableReference(targetType, target.database, table)}`
  )
  logger.info(
    'StructureSync',
    `检查目标数据结构兼容性: 表=${table}, 检查项=${checkCount}`,
  )
  const result = await gateway.executeSQL(
    target.connId,
    target.database,
    sql,
  )
  if (!result.success || !result.rows?.[0]) {
    const detail = result.message || '未返回检测结果'
    return {
      blockers: [`无法验证目标表现有数据是否兼容: ${detail}`],
      checkCount,
    }
  }

  const row = result.rows[0] as Record<string, unknown>
  const blockers = [
    ...lengthChecks
      .map(check => ({
        check,
        actual: numericValue(row[check.alias]),
      }))
      .filter(item => item.actual > item.check.limit)
      .map(item => (
        `字段“${item.check.field}”现有最大长度 ${item.actual}，`
        + `目标长度 ${item.check.limit}，缩短字段会截断数据`
      )),
    ...nullChecks
      .map(check => ({
        check,
        actual: numericValue(row[check.alias]),
      }))
      .filter(item => item.actual > 0)
      .map(item => (
        `字段“${item.check.field}”存在 ${item.actual} 个 NULL，`
        + '不能直接改为 NOT NULL'
      )),
  ]
  if (blockers.length > 0) {
    logger.warn(
      'StructureSync',
      `目标数据不兼容，阻断结构同步: 表=${table}, 原因=${blockers.join('；')}`,
    )
  }
  return { blockers, checkCount }
}
