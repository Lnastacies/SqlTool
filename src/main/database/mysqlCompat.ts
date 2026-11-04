/**
 * MySQL 协议兼容类型判断
 *
 * TDSQL（腾讯分布式数据库）完全兼容 MySQL 协议，可直接复用 MySQL 的
 * 适配器、查询执行器、SQL 语法（反引号引用、AUTO_INCREMENT 等）。
 * 此 helper 集中表达"MySQL 协议兼容"的判断，避免在各 switch/case
 * 中重复书写 `case 'MySQL': case 'TDSQL':`，并为未来扩展（如 MariaDB）
 * 提供统一入口。
 */

/**
 * 判断给定的数据库类型是否为 MySQL 协议兼容类型。
 *
 * 兼容类型包括：
 * - MySQL：原生 MySQL
 * - TDSQL：腾讯分布式数据库，完全兼容 MySQL 协议
 *
 * @param type 数据库类型字符串（对应 ConnectionData.type 或 sqlBuilder DatabaseType）
 * @returns 是否为 MySQL 协议兼容类型
 */
export function isMySQLCompatible(type: string): boolean {
  return type === 'MySQL' || type === 'TDSQL'
}
