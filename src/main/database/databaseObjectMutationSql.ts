import type { ConnectionData } from './adapters'
import type { DatabaseBackupObjectKind } from './databaseBackupTypes'
import { quoteTableIdentifier } from './tableStructureSqlCommon'

/**
 * 可被删除的数据库对象类型。
 * 视图、函数、存储过程、事件均支持通过 DROP 语句删除。
 */
export type DroppableObjectKind = Extract<
  DatabaseBackupObjectKind,
  'view' | 'function' | 'procedure' | 'event'
>

const OBJECT_KEYWORDS: Record<DroppableObjectKind, string> = {
  view: 'VIEW',
  function: 'FUNCTION',
  procedure: 'PROCEDURE',
  event: 'EVENT',
}

/**
 * 对象类型的中文标签，用于日志和用户提示。
 */
export function objectKindLabel(kind: DroppableObjectKind): string {
  if (kind === 'view') return '视图'
  if (kind === 'function') return '函数'
  if (kind === 'procedure') return '存储过程'
  return '事件'
}

/**
 * 校验对象名称，防止空名称或异常字符进入 SQL。
 * 对象名称允许字母、数字、下划线、点、空格、中文、连字符等常见字符，
 * 但禁止分号、引号、反引号等可能破坏 SQL 结构的字符。
 */
function assertObjectNameSafe(name: string, label: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error(`${label}名称不能为空`)
  if (trimmed.length > 128) {
    throw new Error(`${label}名称过长，请使用 128 字符以内的名称`)
  }
  if (/[;`"'\[\]]/.test(trimmed)) {
    throw new Error(`${label}名称包含非法字符`)
  }
  return trimmed
}

/**
 * 构建删除数据库对象的 SQL 语句。
 * - PostgreSQL 函数/存储过程由于可能存在重载，需要参数签名才能精确删除，
 *   此处返回空字符串，交由调用方处理（提示用户手动编写 DROP 语句）。
 * - 其余类型按标准 DROP ... IF EXISTS 语法生成。
 */
export function buildDropDatabaseObjectSql(
  type: ConnectionData['type'],
  kind: DroppableObjectKind,
  name: string,
): string {
  const objectName = assertObjectNameSafe(name, OBJECT_KEYWORDS[kind])
  const quoted = quoteTableIdentifier(objectName, type)
  const keyword = OBJECT_KEYWORDS[kind]

  if (type === 'SQL Server') {
    return `DROP ${keyword} IF EXISTS [dbo].${quoted};`
  }
  if (type === 'PostgreSQL' && kind === 'view') {
    return `DROP VIEW IF EXISTS "public".${quoted} CASCADE;`
  }
  if (
    type === 'PostgreSQL'
    && (kind === 'function' || kind === 'procedure')
  ) {
    // PostgreSQL 重载例程需要参数签名才能精确删除，无法自动生成安全的 DROP 语句。
    return ''
  }
  return `DROP ${keyword} IF EXISTS ${quoted};`
}

/**
 * 构建启用/停用 MySQL 事件的 SQL 语句。
 * - 仅 MySQL 支持 ALTER EVENT ... ENABLE/DISABLE 语法。
 * - 其他数据库类型不支持，抛出错误。
 */
export function buildToggleEventSql(
  type: ConnectionData['type'],
  eventName: string,
  enable: boolean,
): string {
  if (type !== 'MySQL') {
    throw new Error('仅 MySQL 支持「启用/停用事件」操作')
  }
  const objectName = assertObjectNameSafe(eventName, '事件')
  const quoted = quoteTableIdentifier(objectName, type)
  const action = enable ? 'ENABLE' : 'DISABLE'
  return `ALTER EVENT ${quoted} ${action};`
}

/**
 * 构建运行函数/存储过程的 SQL 语句。
 * - 函数：使用 SELECT 调用，返回值以结果集形式展示。
 * - 存储过程：使用 CALL 语句调用（MySQL/PostgreSQL）。
 * - SQL Server 存储过程使用 EXEC 语句。
 * - SQLite 不支持通过 SQL 创建函数，直接抛出错误。
 */
export function buildExecuteRoutineSql(
  type: ConnectionData['type'],
  kind: 'function' | 'procedure',
  name: string,
): string {
  if (type === 'SQLite') {
    throw new Error('SQLite 不支持通过 SQL 运行函数或存储过程')
  }
  const objectName = assertObjectNameSafe(name, OBJECT_KEYWORDS[kind])
  const quoted = quoteTableIdentifier(objectName, type)

  if (kind === 'function') {
    if (type === 'SQL Server') {
      return `SELECT [dbo].${quoted}();`
    }
    return `SELECT ${quoted}();`
  }

  // 存储过程
  if (type === 'SQL Server') {
    return `EXEC ${quoted};`
  }
  return `CALL ${quoted}();`
}
