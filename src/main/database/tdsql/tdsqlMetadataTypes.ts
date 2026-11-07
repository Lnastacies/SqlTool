/**
 * TDSQL 分布式数据库元数据类型定义
 *
 * TDSQL（腾讯分布式数据库）兼容 MySQL 协议，但具备分布式专有特性：
 * - 三种表类型：分表（shard）、单表（noshard）、广播表（broadcast）
 * - SHARDKEY 分片键
 * - 扩展的 PROCESSLIST 字段（TIME_MS/ROWS_SENT/TID）
 */

/** TDSQL 表类型 */
export type TDSQLTableType = 'shard' | 'noshard' | 'broadcast' | 'unknown'

/** SHARDKEY 分片键信息 */
export interface TDSQLShardKeyInfo {
  /** 分片键字段名，未指定时为 null */
  fieldName: string
  /** 来源：SHOW CREATE TABLE 解析 */
  source: 'showCreateTable'
}

/** 表的分布式元数据 */
export interface TDSQLTableMetadata {
  /** 表名 */
  tableName: string
  /** 表类型（shard/noshard/broadcast/unknown） */
  tableType: TDSQLTableType
  /** SHARDKEY 信息，非分表时为 null */
  shardKey: TDSQLShardKeyInfo | null
  /** 存储引擎 */
  engine: string
  /** 分区分布信息（来自 information_schema.PARTITIONS） */
  partitions: TDSQLPartitionInfo[]
}

/** 分区信息 */
export interface TDSQLPartitionInfo {
  /** 分区名 */
  partitionName: string
  /** 子分区名 */
  subpartitionName: string | null
  /** 分区方法（HASH/RANGE/LIST 等） */
  partitionMethod: string | null
  /** 分区表达式 */
  partitionExpression: string | null
  /** 行数（估算值） */
  tableRows: number
  /** 数据长度（字节） */
  dataLength: number
  /** 索引长度（字节） */
  indexLength: number
  /** 所属数据库 */
  tableSchema: string
}

/** 数据库级分布式概览 */
export interface TDSQLDatabaseOverview {
  /** 数据库名 */
  database: string
  /** 分表数量 */
  shardedCount: number
  /** 单表数量 */
  noshardCount: number
  /** 广播表数量 */
  broadcastCount: number
  /** 未知类型表数量 */
  unknownCount: number
  /** 各表元数据列表 */
  tables: TDSQLTableMetadata[]
}

/** TDSQL 会话行（扩展 PROCESSLIST） */
export interface TDSQLSessionRow {
  /** 会话连接 ID */
  id: number
  /** 用户名 */
  user: string
  /** 客户端主机:端口 */
  host: string
  /** 当前数据库 */
  db: string | null
  /** 命令类型（Sleep/Query 等） */
  command: string
  /** 持续时间（秒） */
  time: number
  /** 持续时间（毫秒，TDSQL 扩展字段） */
  timeMs: number | null
  /** 执行状态 */
  state: string | null
  /** 已返回行数（TDSQL 扩展字段） */
  rowsSent: number | null
  /** 协程 ID（TDSQL 扩展字段） */
  tid: number | null
  /** 当前执行的 SQL 语句 */
  info: string | null
}
