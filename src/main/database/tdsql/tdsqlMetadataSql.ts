/**
 * TDSQL 元数据查询 SQL 常量
 *
 * 集中管理 TDSQL 分布式元数据查询的 SQL 语句，便于维护和排查问题。
 * TDSQL 兼容 MySQL 协议，可使用 information_schema 系统视图。
 */

/**
 * 查询表的分区信息
 *
 * TDSQL 兼容 MySQL information_schema.PARTITIONS 视图，
 * 通过分区信息可了解分表在各分片（set）的数据分布。
 */
export const TDSQL_PARTITIONS_SQL = `
  SELECT
    TABLE_SCHEMA AS table_schema,
    TABLE_NAME AS table_name,
    PARTITION_NAME AS partition_name,
    SUBPARTITION_NAME AS subpartition_name,
    PARTITION_METHOD AS partition_method,
    PARTITION_EXPRESSION AS partition_expression,
    TABLE_ROWS AS table_rows,
    DATA_LENGTH AS data_length,
    INDEX_LENGTH AS index_length
  FROM information_schema.PARTITIONS
  WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
  ORDER BY PARTITION_ORDINAL_POSITION
`

/**
 * 查询会话列表
 *
 * TDSQL 在标准 MySQL PROCESSLIST 基础上扩展了以下字段：
 * - TIME_MS：毫秒级持续时间
 * - ROWS_SENT：已返回行数
 * - ROWS_EXAMINED：已扫描行数
 * - TID：协程 ID（bthread ID）
 */
export const TDSQL_PROCESSLIST_SQL = `
  SELECT
    ID AS id,
    USER AS user,
    HOST AS host,
    DB AS db,
    COMMAND AS command,
    TIME AS time,
    TIME_MS AS time_ms,
    STATE AS state,
    ROWS_SENT AS rows_sent,
    TID AS tid,
    INFO AS info
  FROM information_schema.PROCESSLIST
  ORDER BY TIME DESC
`

/**
 * 查看集群 DDL 任务
 *
 * TDSQL 提供 SHOW DDL 命令展示当前集群中正在执行或已完成的所有 DDL 任务，
 * 可观察任务当前执行状态、进度等。
 */
export const TDSQL_DDL_TASKS_SQL = 'SHOW DDL'

/**
 * 透传查询前缀
 *
 * TDSQL 的 proxy 透传前缀（格式为斜杠星号proxy星号斜杠）用于直连分片执行 SQL，
 * 绕过中间件路由，可获取真实分片执行计划或执行分片级管理操作。
 */
export const TDSQL_PROXY_PREFIX = '/*proxy*/'

/**
 * 查看 SHOW CREATE TABLE 语句
 *
 * 用于解析 SHARDKEY 分片键信息。TDSQL 建表语句形如：
 * CREATE TABLE ... SHARDKEY=user_id
 */
export function buildShowCreateTableSql(database: string, tableName: string): string {
  // 使用反引号引用标识符，与 MySQL 语法一致
  const safeDb = database.replace(/`/g, '``')
  const safeTable = tableName.replace(/`/g, '``')
  return `SHOW CREATE TABLE \`${safeDb}\`.\`${safeTable}\``
}
