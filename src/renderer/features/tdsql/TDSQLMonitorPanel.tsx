/**
 * TDSQL 集群监控主面板
 *
 * 使用 Tabs 切换三个子面板：会话列表、DDL 任务、分片分布。
 * 顶部工具栏提供手动刷新、自动刷新开关（间隔 ≥10s，默认关闭）。
 * 通过 useTDSQLMonitor hook 统一管理监控状态。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, InputNumber, Spin, Switch, Tabs, Tag, Tooltip, message } from 'antd'
import ReloadOutlined from '@ant-design/icons/ReloadOutlined'
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined'
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined'
import ClusterOutlined from '@ant-design/icons/ClusterOutlined'
import {
  TDSQL_MONITOR_MIN_INTERVAL_MS,
  useTDSQLMonitor,
} from './tdsqlMonitorModel'
import TDSQLSessionList from './TDSQLSessionList'
import TDSQLDdlTasks from './TDSQLDdlTasks'
import TDSQLShardDistribution from './TDSQLShardDistribution'
import type { ConnectionData } from '../../types'

interface TDSQLMonitorPanelProps {
  /** TDSQL 连接对象 */
  connection: ConnectionData
  /** 连接下可选数据库列表（用于分片分布子面板） */
  databases: string[]
  /** 当前数据库下表名列表（用于分片分布子面板） */
  tables: string[]
  /** 表列表加载态 */
  tablesLoading: boolean
  /** 切换数据库时通知外部加载表列表 */
  onLoadTables?: (database: string) => void
  /** 关闭面板回调 */
  onClose: () => void
}

export default function TDSQLMonitorPanel({
  connection,
  databases,
  tables,
  tablesLoading,
  onLoadTables,
  onClose,
}: TDSQLMonitorPanelProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'ddl' | 'shards'>(
    'sessions',
  )
  // 初始数据库：优先使用连接配置默认数据库
  const initialDatabase = connection.database || ''
  const monitor = useTDSQLMonitor(connection.id, initialDatabase)

  // 切换数据库时触发外部加载表列表（仅分片分布需要）。
  // 记录上一次已触发加载的库名做防重：即使回调引用意外变化，
  // 同一数据库也不会重复发起请求。
  const lastTablesLoadRef = useRef('')
  useEffect(() => {
    if (
      monitor.database
      && onLoadTables
      && lastTablesLoadRef.current !== monitor.database
    ) {
      lastTablesLoadRef.current = monitor.database
      onLoadTables(monitor.database)
    }
  }, [monitor.database, onLoadTables])

  const handleDatabaseChange = (database: string) => {
    monitor.setDatabase(database)
    void window.logger.write(
      'info',
      'TDSQLMonitor',
      `切换数据库: 连接=${connection.id}, 数据库=${database}`,
    )
  }

  const handleRefresh = async () => {
    await monitor.refresh()
    if (!monitor.error) {
      message.success('已刷新集群监控数据')
    }
  }

  // 顶部工具栏
  const toolbar = useMemo(() => (
    <div className="tdsql-monitor__toolbar">
      <div className="tdsql-monitor__toolbar-left">
        <ClusterOutlined className="tdsql-monitor__icon" />
        <span className="tdsql-monitor__title">
          {connection.name} · 集群监控
        </span>
        {monitor.database && (
          <Tag icon={<DatabaseOutlined />} color="blue">
            {monitor.database}
          </Tag>
        )}
      </div>
      <div className="tdsql-monitor__toolbar-right">
        <Tooltip title="立即刷新所有监控数据">
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={monitor.loading}
            onClick={() => void handleRefresh()}
          >
            刷新
          </Button>
        </Tooltip>
        <span className="tdsql-monitor__auto-refresh">
          <ClockCircleOutlined />
          <span>自动刷新</span>
          <Switch
            size="small"
            checked={monitor.autoRefresh}
            onChange={monitor.setAutoRefresh}
          />
          {monitor.autoRefresh && (
            <Tooltip
              title={`自动刷新间隔，最小 ${TDSQL_MONITOR_MIN_INTERVAL_MS / 1000} 秒，避免压垮集群`}
            >
              <InputNumber
                size="small"
                min={TDSQL_MONITOR_MIN_INTERVAL_MS / 1000}
                max={3600}
                value={Math.round(monitor.autoRefreshIntervalMs / 1000)}
                style={{ width: 88 }}
                addonAfter="秒"
                onChange={value => {
                  if (typeof value === 'number') {
                    monitor.setAutoRefreshIntervalMs(value * 1000)
                  }
                }}
              />
            </Tooltip>
          )}
        </span>
        <Button size="small" onClick={onClose}>关闭面板</Button>
      </div>
    </div>
  ), [
    connection.id,
    connection.name,
    monitor.database,
    monitor.loading,
    monitor.autoRefresh,
    monitor.autoRefreshIntervalMs,
  ])

  return (
    <div className="tdsql-monitor tdsql-monitor--panel">
      {toolbar}
      {monitor.error && (
        <Alert
          type="error"
          showIcon
          message="监控数据加载失败"
          description={monitor.error}
          action={
            <Button size="small" onClick={() => void handleRefresh()}>
              重试
            </Button>
          }
          style={{ margin: '0 16px 8px' }}
        />
      )}
      <Spin spinning={monitor.loading && !monitor.error}>
        <Tabs
          className="tdsql-monitor__tabs"
          size="small"
          activeKey={activeTab}
          onChange={key => setActiveTab(key as typeof activeTab)}
          items={[
            {
              key: 'sessions',
              label: `会话列表 (${monitor.sessions.length})`,
              children: (
                <TDSQLSessionList
                  connId={connection.id}
                  database={monitor.database || connection.database || ''}
                  sessions={monitor.sessions}
                  loading={monitor.loading}
                  onKilled={() => void monitor.refresh()}
                />
              ),
            },
            {
              key: 'ddl',
              label: `DDL 任务 (${monitor.ddlTasks.length})`,
              children: (
                <TDSQLDdlTasks
                  ddlTasks={monitor.ddlTasks}
                  loading={monitor.loading}
                />
              ),
            },
            {
              key: 'shards',
              label: '分片分布',
              children: (
                <TDSQLShardDistribution
                  connId={connection.id}
                  databases={databases}
                  database={monitor.database}
                  tables={tables}
                  tablesLoading={tablesLoading}
                  onDatabaseChange={handleDatabaseChange}
                />
              ),
            },
          ]}
        />
      </Spin>
    </div>
  )
}
