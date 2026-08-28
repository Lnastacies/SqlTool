import React, { useMemo } from 'react'
import { Button, Divider, Select, Tag, Tooltip } from 'antd'
import CheckOutlined from '@ant-design/icons/CheckOutlined'
import DownloadOutlined from '@ant-design/icons/DownloadOutlined'
import PlayCircleOutlined from '@ant-design/icons/PlayCircleOutlined'
import PlaySquareOutlined from '@ant-design/icons/PlaySquareOutlined'
import RollbackOutlined from '@ant-design/icons/RollbackOutlined'
import StopOutlined from '@ant-design/icons/StopOutlined'
import SwapOutlined from '@ant-design/icons/SwapOutlined'
import type { ConnectionData } from '../types'
import type { QueryExecutionMode } from './queryExecutionSql'
import type { QueryWorkspaceDocument } from './workspaceTypes'

interface QueryWorkspaceToolbarProps {
  document: QueryWorkspaceDocument
  connections: Map<string, ConnectionData>
  activeConnections: Set<string>
  databases: string[]
  onExecute: (mode: QueryExecutionMode) => void
  onCancel: () => void
  onExport: () => void
  onContextChange: (patch: { connId?: string; database?: string }) => void
  onTransaction: (action: 'begin' | 'commit' | 'rollback') => void
}

export default function QueryWorkspaceToolbar({
  document,
  connections,
  activeConnections,
  databases,
  onExecute,
  onCancel,
  onExport,
  onContextChange,
  onTransaction,
}: QueryWorkspaceToolbarProps) {
  const activeConnectionList = useMemo(
    () => Array.from(connections.values()).filter(
      connection => activeConnections.has(connection.id),
    ),
    [activeConnections, connections],
  )
  const isExecuting = document.executionState !== 'idle'
  const hasTransaction = document.transactionState !== 'idle'
  const transactionLabel = document.transactionState === 'active'
    ? '事务中'
    : document.transactionState === 'failed'
      ? '事务失败'
      : '自动提交'
  const transactionColor = document.transactionState === 'active'
    ? 'processing'
    : document.transactionState === 'failed'
      ? 'error'
      : 'default'

  return (
    <div className="query-toolbar">
      <div className="query-toolbar__context">
        <Select
          size="small"
          className="query-toolbar__connection"
          placeholder="选择连接"
          value={document.connId || undefined}
          disabled={isExecuting || hasTransaction}
          onChange={connId => onContextChange({ connId, database: '' })}
          options={activeConnectionList.map(connection => ({
            label: connection.name,
            value: connection.id,
          }))}
        />
        <Select
          size="small"
          className="query-toolbar__database"
          placeholder="选择数据库"
          value={document.database || undefined}
          disabled={isExecuting || hasTransaction}
          onChange={database => onContextChange({ database })}
          options={databases.map(database => ({
            label: database,
            value: database,
          }))}
        />
      </div>

      <Divider type="vertical" />
      <div className="query-toolbar__actions">
        <Tooltip title="执行选中 SQL 或光标所在语句（Ctrl+Enter）">
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            loading={document.executionState === 'running'}
            disabled={isExecuting || !document.sql.trim()}
            onClick={() => onExecute('current')}
          >
            运行
          </Button>
        </Tooltip>
        <Tooltip title="执行编辑器中的全部 SQL（Ctrl+Shift+Enter）">
          <Button
            size="small"
            icon={<PlaySquareOutlined />}
            disabled={isExecuting || !document.sql.trim()}
            onClick={() => onExecute('all')}
          >
            全部
          </Button>
        </Tooltip>
        <Tooltip title={
          document.capabilities.supportsCancel
            ? '停止当前查询（Ctrl+.）'
            : '当前驱动不支持中断正在运行的语句'
        }>
          <Button
            danger
            size="small"
            icon={<StopOutlined />}
            disabled={
              !isExecuting
              || !document.capabilities.supportsCancel
              || document.executionState === 'cancelling'
            }
            onClick={onCancel}
          >
            停止
          </Button>
        </Tooltip>
      </div>

      <Divider type="vertical" />
      <div className="query-toolbar__transactions">
        <Tooltip title="在当前查询会话中开始事务">
          <Button
            size="small"
            icon={<SwapOutlined />}
            disabled={isExecuting || hasTransaction}
            onClick={() => onTransaction('begin')}
          >
            开始事务
          </Button>
        </Tooltip>
        <Tooltip title="提交当前事务">
          <Button
            size="small"
            icon={<CheckOutlined />}
            disabled={isExecuting || document.transactionState !== 'active'}
            onClick={() => onTransaction('commit')}
          >
            提交
          </Button>
        </Tooltip>
        <Tooltip title="回滚当前事务">
          <Button
            size="small"
            icon={<RollbackOutlined />}
            disabled={isExecuting || !hasTransaction}
            onClick={() => onTransaction('rollback')}
          >
            回滚
          </Button>
        </Tooltip>
        <Tag color={transactionColor} className="query-toolbar__transaction-tag">
          {transactionLabel}
        </Tag>
      </div>

      <div className="query-toolbar__spacer" />
      <Button
        size="small"
        icon={<DownloadOutlined />}
        onClick={onExport}
        disabled={document.resultSets.length === 0}
      >
        导出
      </Button>
    </div>
  )
}
