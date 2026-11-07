/**
 * 数据库对象内存缓存
 *
 * 设计目标：解决 800+ 表数据库切换/重选时反复走 IPC + 全量重建树的卡顿问题。
 * 缓存策略（用户选择）：内存缓存 + 手动刷新，无 TTL。
 *
 * 缓存维度：
 *  - 表清单：key = `${connId}:${database}` → TableSummary[]
 *  - 表元数据：key = `${connId}:${database}:${tableName}` → TableMetadata
 *
 * 失效时机：
 *  - 右键"刷新"数据库：clearDatabase(connId, database)
 *  - 单表结构变更（保存设计/删除/重命名）：clearTableMetadata(connId, database, tableName)
 *  - 断开连接：clearConnection(connId)
 *
 * 模块级 Map，不入 React state（避免无谓渲染）；所有读写均通过纯函数 API。
 */

import type { TableSummary, TableMetadata } from '../../types'

const LOG_TAG_OBJECT = 'ObjectCache'
const LOG_TAG_METADATA = 'TableStructureCache'

/** 表清单缓存：键 `${connId}:${database}` */
const tableSummariesCache = new Map<string, TableSummary[]>()
/** 表元数据缓存：键 `${connId}:${database}:${tableName}` */
const tableMetadataCache = new Map<string, TableMetadata>()

function summariesKey(connId: string, database: string): string {
  return `${connId}:${database}`
}

function metadataKey(connId: string, database: string, tableName: string): string {
  return `${connId}:${database}:${tableName}`
}

/** 读取表清单缓存；未命中返回 undefined */
export function getTableSummaries(
  connId: string,
  database: string,
): TableSummary[] | undefined {
  const cached = tableSummariesCache.get(summariesKey(connId, database))
  if (cached) {
    void window.logger.write(
      'info',
      LOG_TAG_OBJECT,
      `表清单缓存命中: 连接=${connId}, 数据库=${database}, 数量=${cached.length}`,
    )
  }
  return cached
}

/** 写入表清单缓存 */
export function setTableSummaries(
  connId: string,
  database: string,
  summaries: TableSummary[],
): void {
  tableSummariesCache.set(summariesKey(connId, database), summaries)
  void window.logger.write(
    'info',
    LOG_TAG_OBJECT,
    `表清单缓存写入: 连接=${connId}, 数据库=${database}, 数量=${summaries.length}`,
  )
}

/** 读取表元数据缓存；未命中返回 undefined */
export function getTableMetadata(
  connId: string,
  database: string,
  tableName: string,
): TableMetadata | undefined {
  const cached = tableMetadataCache.get(metadataKey(connId, database, tableName))
  if (cached) {
    void window.logger.write(
      'info',
      LOG_TAG_METADATA,
      `表元数据缓存命中: 连接=${connId}, 数据库=${database}, 表=${tableName}`,
    )
  }
  return cached
}

/** 写入表元数据缓存 */
export function setTableMetadata(
  connId: string,
  database: string,
  tableName: string,
  metadata: TableMetadata,
): void {
  tableMetadataCache.set(metadataKey(connId, database, tableName), metadata)
  void window.logger.write(
    'info',
    LOG_TAG_METADATA,
    `表元数据缓存写入: 连接=${connId}, 数据库=${database}, 表=${tableName}, 字段=${metadata.fields.length}`,
  )
}

/** 失效单表元数据（保存设计/删除/重命名表后调用） */
export function clearTableMetadata(
  connId: string,
  database: string,
  tableName: string,
): void {
  const key = metadataKey(connId, database, tableName)
  if (tableMetadataCache.delete(key)) {
    void window.logger.write(
      'info',
      LOG_TAG_METADATA,
      `表元数据缓存清理: 连接=${connId}, 数据库=${database}, 表=${tableName}`,
    )
  }
}

/** 失效整库缓存（右键刷新/库结构变更后调用） */
export function clearDatabase(connId: string, database: string): void {
  const summariesDeleted = tableSummariesCache.delete(summariesKey(connId, database))
  let metadataDeleted = 0
  const prefix = `${connId}:${database}:`
  for (const key of tableMetadataCache.keys()) {
    if (key.startsWith(prefix)) {
      tableMetadataCache.delete(key)
      metadataDeleted += 1
    }
  }
  if (summariesDeleted || metadataDeleted > 0) {
    void window.logger.write(
      'info',
      LOG_TAG_OBJECT,
      `整库缓存清理: 连接=${connId}, 数据库=${database}, 表清单=${summariesDeleted ? '已清' : '无'}, 表元数据=${metadataDeleted}`,
    )
  }
}

/** 失效整连接缓存（断开连接时调用） */
export function clearConnection(connId: string): void {
  let summariesDeleted = 0
  let metadataDeleted = 0
  const summariesPrefix = `${connId}:`
  for (const key of tableSummariesCache.keys()) {
    if (key.startsWith(summariesPrefix)) {
      tableSummariesCache.delete(key)
      summariesDeleted += 1
    }
  }
  for (const key of tableMetadataCache.keys()) {
    if (key.startsWith(summariesPrefix)) {
      tableMetadataCache.delete(key)
      metadataDeleted += 1
    }
  }
  if (summariesDeleted > 0 || metadataDeleted > 0) {
    void window.logger.write(
      'info',
      LOG_TAG_OBJECT,
      `整连接缓存清理: 连接=${connId}, 表清单库数=${summariesDeleted}, 表元数据数=${metadataDeleted}`,
    )
  }
}

/** 清空全部缓存（一般用于开发调试或全局重置） */
export function clearAll(): void {
  const totalSummaries = tableSummariesCache.size
  const totalMetadata = tableMetadataCache.size
  tableSummariesCache.clear()
  tableMetadataCache.clear()
  if (totalSummaries > 0 || totalMetadata > 0) {
    void window.logger.write(
      'info',
      LOG_TAG_OBJECT,
      `全部缓存清理: 表清单库数=${totalSummaries}, 表元数据数=${totalMetadata}`,
    )
  }
}
