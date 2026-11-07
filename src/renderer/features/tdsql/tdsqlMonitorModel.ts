/**
 * TDSQL 集群监控面板 - 状态管理 Hook
 *
 * 集中管理会话列表、DDL 任务、数据库概览三类监控数据，
 * 统一处理 loading/error 状态，并支持手动刷新与可选的自动刷新。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  IPCResponse,
} from '../../types'

/** TDSQL 会话行（与后端 TDSQLSessionRow 对应） */
export interface TDSQLSessionRow {
  id: number
  user: string
  host: string
  db: string | null
  command: string
  time: number
  timeMs: number | null
  state: string | null
  rowsSent: number | null
  tid: number | null
  info: string | null
}

/** DDL 任务行（字段因 TDSQL 内核版本不同而异） */
export type TDSQLDdlTaskRow = Record<string, unknown>

/**
 * 数据库概览行类型（与后端 TDSQLDatabaseOverview 对应）。
 *
 * 注意：监控面板不再在刷新流程中全量拉取概览（会对每张表 fan-out 2N 个查询），
 * 分片分布改为按需查询单表元数据。此处仅保留行类型供表格列定义复用。
 */
export interface TDSQLDatabaseOverview {
  database: string
  shardedCount: number
  noshardCount: number
  broadcastCount: number
  unknownCount: number
  tables: Array<{
    tableName: string
    tableType: string
    shardKey: { fieldName: string } | null
    engine: string
    partitions: Array<{
      partitionName: string
      tableRows: number
      dataLength: number
      indexLength: number
      tableSchema: string
    }>
  }>
}

/** 自动刷新最小间隔（毫秒），强制下限避免压垮集群 */
const MIN_AUTO_REFRESH_INTERVAL_MS = 10_000

/** 将 IPCResponse 转换为可抛出的错误消息 */
function extractError<T>(response: IPCResponse<T>, fallback: string): Error {
  const detail = response.error?.detail || response.error?.message
  return new Error(detail || fallback)
}

/** 安全写入日志，避免日志失败影响主流程 */
function safeLog(
  level: 'info' | 'warn' | 'error',
  message: string,
): void {
  try {
    void window.logger?.write(level, 'TDSQLMonitor', message)
  } catch (error) {
    console.warn('TDSQL 监控日志写入失败:', error)
  }
}

export interface UseTDSQLMonitorResult {
  /** 会话列表 */
  sessions: TDSQLSessionRow[]
  /** DDL 任务原始行 */
  ddlTasks: TDSQLDdlTaskRow[]
  /** 全局加载态 */
  loading: boolean
  /** 全局错误信息 */
  error: string
  /** 手动刷新所有数据 */
  refresh: () => Promise<void>
  /** 自动刷新开关 */
  autoRefresh: boolean
  /** 切换自动刷新 */
  setAutoRefresh: (value: boolean) => void
  /** 自动刷新间隔（毫秒） */
  autoRefreshIntervalMs: number
  /** 修改自动刷新间隔（小于下限将被截断） */
  setAutoRefreshIntervalMs: (ms: number) => void
  /** 当前选中数据库（用于概览查询） */
  database: string
  /** 切换当前数据库 */
  setDatabase: (database: string) => void
}

/**
 * TDSQL 监控面板状态管理 Hook
 *
 * @param connId TDSQL 连接 ID
 * @param initialDatabase 初始数据库，用于查询概览
 */
export function useTDSQLMonitor(
  connId: string,
  initialDatabase = '',
): UseTDSQLMonitorResult {
  const [sessions, setSessions] = useState<TDSQLSessionRow[]>([])
  const [ddlTasks, setDdlTasks] = useState<TDSQLDdlTaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [database, setDatabase] = useState(initialDatabase)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [autoRefreshIntervalMs, setAutoRefreshIntervalMs] = useState(
    MIN_AUTO_REFRESH_INTERVAL_MS,
  )

  // 防止并发刷新与组件卸载后 setState
  const inFlightRef = useRef(false)
  const activeRef = useRef(true)

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (inFlightRef.current) {
      safeLog('warn', `刷新被跳过：已有进行中请求，连接=${connId}`)
      return
    }
    inFlightRef.current = true
    setLoading(true)
    setError('')
    safeLog('info', `开始刷新监控数据：连接=${connId}, 数据库=${database || '未指定'}`)
    try {
      // 并发拉取三类监控数据，缩短整体加载时间
      const [sessionRes, ddlRes] = await Promise.all([
        window.tdsql.getSessions(connId),
        window.tdsql.getDdlTasks(connId),
      ])
      if (!activeRef.current) return
      if (!sessionRes.success || !sessionRes.data) {
        throw extractError(sessionRes, '会话列表查询失败')
      }
      if (!ddlRes.success || !ddlRes.data) {
        throw extractError(ddlRes, 'DDL 任务查询失败')
      }
      setSessions(sessionRes.data)
      setDdlTasks(ddlRes.data)
      // 数据库概览（全库每张表 fan-out 查询）无 UI 消费方，不再随监控刷新拉取；
      // 分片分布子面板在用户选表时按需调用 getTableMetadata 单表查询。
      safeLog(
        'info',
        `监控数据刷新完成：会话=${sessionRes.data.length}, DDL=${ddlRes.data.length}`,
      )
    } catch (err) {
      if (!activeRef.current) return
      const detail = err instanceof Error ? err.message : String(err)
      setError(detail)
      safeLog('error', `监控数据刷新失败：${detail}`)
    } finally {
      if (activeRef.current) setLoading(false)
      inFlightRef.current = false
    }
  }, [connId, database])

  // 首次挂载或连接/数据库变化时自动加载一次
  useEffect(() => {
    void refresh()
  }, [refresh])

  // 自动刷新定时器，间隔低于下限时自动校正
  useEffect(() => {
    if (!autoRefresh) return
    const safeInterval = Math.max(
      autoRefreshIntervalMs,
      MIN_AUTO_REFRESH_INTERVAL_MS,
    )
    const timer = window.setInterval(() => {
      safeLog('info', `触发自动刷新：间隔=${safeInterval}ms`)
      void refresh()
    }, safeInterval)
    return () => window.clearInterval(timer)
  }, [autoRefresh, autoRefreshIntervalMs, refresh])

  const safeSetAutoRefreshIntervalMs = useCallback((ms: number) => {
    setAutoRefreshIntervalMs(
      Math.max(ms, MIN_AUTO_REFRESH_INTERVAL_MS),
    )
  }, [])

  return {
    sessions,
    ddlTasks,
    loading,
    error,
    refresh,
    autoRefresh,
    setAutoRefresh,
    autoRefreshIntervalMs,
    setAutoRefreshIntervalMs: safeSetAutoRefreshIntervalMs,
    database,
    setDatabase,
  }
}

export const TDSQL_MONITOR_MIN_INTERVAL_MS = MIN_AUTO_REFRESH_INTERVAL_MS
