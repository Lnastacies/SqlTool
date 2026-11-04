import type { DatabaseType } from '../types'

/**
 * MySQL 协议兼容类型判断（前端版）
 *
 * TDSQL（腾讯分布式数据库）完全兼容 MySQL 协议，连接/查询/表管理/
 * 字符集/用户管理/备份恢复等功能均可复用 MySQL 的实现。
 * 此 helper 集中表达"MySQL 协议兼容"的判断，避免在各组件中
 * 重复书写 `type === 'MySQL' || type === 'TDSQL'`。
 *
 * 与后端 src/main/database/mysqlCompat.ts 保持语义一致。
 */

/**
 * 判断给定的数据库类型是否为 MySQL 协议兼容类型。
 * 兼容类型：MySQL、TDSQL
 */
export function isMySQLCompatible(type: DatabaseType | string): boolean {
  return type === 'MySQL' || type === 'TDSQL'
}
