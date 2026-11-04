/**
 * TDSQL 集群监控服务
 *
 * 通过 TDSQL 扩展的 information_schema 视图和管理命令查询集群状态：
 * - 会话列表（含 TIME_MS/ROWS_SENT/TID 扩展字段）
 * - DDL 任务（SHOW DDL）
 * - 透传查询（proxy 透传前缀，绕过中间件路由）
 */

import { logger } from '../../logger'
import type { DatabaseAdapter } from '../adapters'
import type { ExecuteResult } from '../adapters'
import {
  TDSQL_DDL_TASKS_SQL,
  TDSQL_PROCESSLIST_SQL,
  TDSQL_PROXY_PREFIX,
} from './tdsqlMetadataSql'
import type { TDSQLSessionRow } from './tdsqlMetadataTypes'

/** 数字字段安全转整数或 null */
function toIntOrNull(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** 从查询结果行提取字符串或 null */
function toStrOrNull(value: unknown): string | null {
  return value == null ? null : String(value)
}

export class TDSQLMonitorService {
  constructor(
    private readonly adapter: DatabaseAdapter,
    private readonly connection: unknown,
  ) {}

  /**
   * 查询会话列表
   *
   * TDSQL 在标准 MySQL PROCESSLIST 基础上扩展了 TIME_MS、ROWS_SENT、TID 字段，
   * 可用于定位慢查询、排查长事务。
   */
  async getSessions(): Promise<TDSQLSessionRow[]> {
    logger.info('TDSQLMonitor', '查询会话列表 PROCESSLIST')
    const result = await this.adapter.executeSQL(
      this.connection,
      '',
      TDSQL_PROCESSLIST_SQL,
    )
    if (!result.success || !result.rows) {
      logger.warn('TDSQLMonitor', '会话查询无结果')
      return []
    }
    const sessions = result.rows.map(row => this.mapSessionRow(row))
    logger.info(
      'TDSQLMonitor',
      `会话查询完成, 共 ${sessions.length} 条`,
    )
    return sessions
  }

  /** 将查询行映射为会话信息 */
  private mapSessionRow(row: unknown): TDSQLSessionRow {
    const r = row as Record<string, unknown>
    return {
      id: toIntOrNull(r.id) ?? 0,
      user: toStrOrNull(r.user) ?? '',
      host: toStrOrNull(r.host) ?? '',
      db: toStrOrNull(r.db),
      command: toStrOrNull(r.command) ?? '',
      time: toIntOrNull(r.time) ?? 0,
      timeMs: toIntOrNull(r.time_ms),
      state: toStrOrNull(r.state),
      rowsSent: toIntOrNull(r.rows_sent),
      tid: toIntOrNull(r.tid),
      info: toStrOrNull(r.info),
    }
  }

  /**
   * 查询 DDL 任务
   *
   * TDSQL 提供 SHOW DDL 命令展示集群中正在执行或已完成的 DDL 任务，
   * 可观察任务状态、进度等。返回原始行数据，字段因内核版本可能不同。
   */
  async getDdlTasks(): Promise<Record<string, unknown>[]> {
    logger.info('TDSQLMonitor', '查询 DDL 任务 SHOW DDL')
    const result = await this.adapter.executeSQL(
      this.connection,
      '',
      TDSQL_DDL_TASKS_SQL,
    )
    if (!result.success || !result.rows) {
      logger.warn('TDSQLMonitor', 'DDL 任务查询无结果')
      return []
    }
    logger.info(
      'TDSQLMonitor',
      `DDL 任务查询完成, 共 ${result.rows.length} 条`,
    )
    return result.rows as Record<string, unknown>[]
  }

  /**
   * 透传查询（当前未接入 IPC，谨慎启用）
   *
   * 使用 proxy 透传前缀绕过 TDSQL 中间件路由，直连分片执行 SQL。
   * 可获取真实分片执行计划或执行分片级管理操作。
   *
   * 安全提示：透传查询直接操作分片，可执行任意写语句、影响数据一致性。
   * 当前 preload/IPC 未暴露本方法；如需开放，必须先增加语句类型/只读校验
   * 与权限控制，禁止直接对渲染层透传任意 SQL。
   */
  async proxyQuery(sql: string): Promise<ExecuteResult> {
    const trimmed = sql.trim()
    const proxySql = `${TDSQL_PROXY_PREFIX}${trimmed}`
    logger.info(
      'TDSQLMonitor',
      `透传查询: ${trimmed.slice(0, 80)}`,
    )
    return this.adapter.executeSQL(this.connection, '', proxySql)
  }
}
