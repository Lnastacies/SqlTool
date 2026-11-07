/**
 * TDSQL 元数据查询服务
 *
 * 通过 DatabaseAdapter 执行 TDSQL 分布式专有元数据查询：
 * - 表类型识别（shard/noshard/broadcast）
 * - SHARDKEY 分片键解析
 * - 分区分布查询
 * - 数据库级分布式概览
 */

import { logger } from '../../logger'
import type { DatabaseAdapter } from '../adapters'
import type { ExecuteResult } from '../adapters'
import {
  extractDDLFromRow,
  parseShardKeyFromDDL,
  parseTableTypeFromDDL,
} from './tdsqlMetadataParser'
import {
  TDSQL_PARTITIONS_SQL,
  buildShowCreateTableSql,
} from './tdsqlMetadataSql'
import type {
  TDSQLPartitionInfo,
  TDSQLTableMetadata,
  TDSQLTableType,
} from './tdsqlMetadataTypes'

/** 数字字段安全转整数 */
function toInt(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** 从查询结果行提取字符串 */
function toStr(value: unknown): string {
  return value == null ? '' : String(value)
}

export class TDSQLMetadataService {
  constructor(
    private readonly adapter: DatabaseAdapter,
    private readonly connection: unknown,
  ) {}

  /**
   * 查询表的分布式元数据
   *
   * 综合 SHOW CREATE TABLE 解析与分区信息查询，返回表类型、
   * SHARDKEY 和分区分布。
   */
  async getTableMetadata(
    database: string,
    tableName: string,
  ): Promise<TDSQLTableMetadata> {
    logger.info(
      'TDSQLMetadata',
      `查询表元数据: ${database}.${tableName}`,
    )
    const [ddlResult, partitions] = await Promise.all([
      this.executeShowCreateTable(database, tableName),
      this.getPartitions(database, tableName),
    ])
    const ddl = extractDDLFromRow(ddlResult.rows?.[0])
    const tableType = parseTableTypeFromDDL(ddl)
    const shardKey = parseShardKeyFromDDL(ddl)
    const engine = this.parseEngineFromDDL(ddl)
    logger.info(
      'TDSQLMetadata',
      `表元数据解析完成: ${tableName}, 类型=${tableType}, SHARDKEY=${shardKey?.fieldName ?? '无'}`,
    )
    return {
      tableName,
      tableType,
      shardKey,
      engine,
      partitions,
    }
  }

  /** 执行 SHOW CREATE TABLE 并返回原始结果 */
  private async executeShowCreateTable(
    database: string,
    tableName: string,
  ): Promise<ExecuteResult> {
    const sql = buildShowCreateTableSql(database, tableName)
    return this.adapter.executeSQL(this.connection, database, sql)
  }

  /**
   * 查询表的分区分布信息
   *
   * 通过 information_schema.PARTITIONS 视图获取分表在各分片的数据分布。
   */
  async getPartitions(
    database: string,
    tableName: string,
  ): Promise<TDSQLPartitionInfo[]> {
    logger.info(
      'TDSQLMetadata',
      `查询分区信息: ${database}.${tableName}`,
    )
    const result = await this.adapter.executeSQL(
      this.connection,
      database,
      TDSQL_PARTITIONS_SQL,
      [database, tableName],
    )
    if (!result.success || !result.rows) {
      logger.warn(
        'TDSQLMetadata',
        `分区查询无结果: ${database}.${tableName}`,
      )
      return []
    }
    return result.rows.map(row => this.mapPartitionRow(row))
  }

  /** 将查询行映射为分区信息 */
  private mapPartitionRow(row: unknown): TDSQLPartitionInfo {
    const r = row as Record<string, unknown>
    return {
      partitionName: toStr(r.partition_name) || '(自动)',
      subpartitionName: r.subpartition_name == null ? null : toStr(r.subpartition_name),
      partitionMethod: r.partition_method == null ? null : toStr(r.partition_method),
      partitionExpression: r.partition_expression == null ? null : toStr(r.partition_expression),
      tableRows: toInt(r.table_rows),
      dataLength: toInt(r.data_length),
      indexLength: toInt(r.index_length),
      tableSchema: toStr(r.table_schema),
    }
  }

  /**
   * 识别表类型（shard/noshard/broadcast）
   */
  async getTableType(
    database: string,
    tableName: string,
  ): Promise<TDSQLTableType> {
    const result = await this.executeShowCreateTable(database, tableName)
    const ddl = extractDDLFromRow(result.rows?.[0])
    return parseTableTypeFromDDL(ddl)
  }

  /** 从 DDL 解析存储引擎 */
  private parseEngineFromDDL(ddl: string): string {
    const match = /\bENGINE\s*=\s*(\w+)/i.exec(ddl)
    return match ? match[1] : ''
  }
}
