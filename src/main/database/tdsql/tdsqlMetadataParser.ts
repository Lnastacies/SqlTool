/**
 * TDSQL DDL 解析纯函数
 *
 * 从 SHOW CREATE TABLE 的 DDL 文本中解析 TDSQL 分布式专有信息：
 * - SHARDKEY 分片键
 * - 表类型识别（shard/noshard/broadcast）
 */

import type {
  TDSQLShardKeyInfo,
  TDSQLTableType,
} from './tdsqlMetadataTypes'

/**
 * SHARDKEY 正则匹配模式
 *
 * TDSQL 建表语句中 SHARDKEY 子句的常见形式：
 * - SHARDKEY=user_id
 * - SHARDKEY = user_id
 * - SHARDKEY=`user_id`
 *
 * 注意：TDSQL 不区分大小写，使用 i 标志。
 */
const SHARDKEY_PATTERN = /SHARDKEY\s*=\s*`?(\w+)`?/i

/**
 * BROADCAST 关键字正则
 *
 * 广播表在建表语句末尾使用 BROADCAST 关键字标识。
 */
const BROADCAST_PATTERN = /\bBROADCAST\b/i

/**
 * 从 DDL 文本解析 SHARDKEY 分片键
 *
 * @param ddl SHOW CREATE TABLE 返回的建表语句
 * @returns 分片键信息，未指定时返回 null
 */
export function parseShardKeyFromDDL(ddl: string): TDSQLShardKeyInfo | null {
  if (!ddl) return null
  const match = SHARDKEY_PATTERN.exec(ddl)
  if (!match) return null
  return {
    fieldName: match[1],
    source: 'showCreateTable',
  }
}

/**
 * 从 DDL 文本识别 TDSQL 表类型
 *
 * 识别规则：
 * - 含 SHARDKEY 子句 → 分表（shard）
 * - 含 BROADCAST 关键字 → 广播表（broadcast）
 * - 其他 → 单表（noshard）
 *
 * @param ddl SHOW CREATE TABLE 返回的建表语句
 * @returns 表类型
 */
export function parseTableTypeFromDDL(ddl: string): TDSQLTableType {
  if (!ddl) return 'unknown'
  if (SHARDKEY_PATTERN.test(ddl)) return 'shard'
  if (BROADCAST_PATTERN.test(ddl)) return 'broadcast'
  return 'noshard'
}

/**
 * 从 mysql2 查询结果行提取 DDL 文本
 *
 * mysql2 执行 SHOW CREATE TABLE 返回的字段名可能因版本差异
 * 为 'Create Table' 或 'Create View' 等，此处做容错处理。
 *
 * @param row 查询结果行
 * @returns DDL 文本
 */
export function extractDDLFromRow(row: unknown): string {
  if (!row || typeof row !== 'object') return ''
  const record = row as Record<string, unknown>
  // 兼容 mysql2 返回的常见字段名
  const ddl =
    record['Create Table']
    ?? record['Create View']
    ?? record['Create Table ']
    ?? Object.values(record).find(
      value => typeof value === 'string' && /CREATE TABLE/i.test(value),
    )
  return typeof ddl === 'string' ? ddl : ''
}
