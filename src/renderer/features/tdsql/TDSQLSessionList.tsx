/**
 * TDSQL 会话列表组件
 *
 * 展示 information_schema.PROCESSLIST 查询结果（含 TDSQL 扩展字段），
 * 支持右键菜单 Kill 指定会话。Kill 操作会弹出确认对话框，避免误操作。
 */

import React, { useMemo, useState } from 'react'
import { Modal, Table, Tooltip, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import { sessionColumns } from './tdsqlMonitorColumns'
import type { TDSQLSessionRow } from './tdsqlMonitorModel'

interface TDSQLSessionListProps {
  /** 当前连接 ID，用于执行 KILL 语句 */
  connId: string
  /** 当前数据库（KILL 需要在数据库上下文执行） */
  database: string
  /** 会话数据 */
  sessions: TDSQLSessionRow[]
  /** 加载态 */
  loading: boolean
  /** Kill 完成后的回调，用于触发父组件刷新 */
  onKilled?: () => void
}

/** 在会话列表列尾追加操作列（Kill 按钮） */
function buildColumns(
  onKill: (session: TDSQLSessionRow) => void,
): ColumnsType<TDSQLSessionRow> {
  const actionColumn: ColumnsType<TDSQLSessionRow>[number] = {
    title: '操作',
    key: 'action',
    width: 90,
    fixed: 'right',
    render: (_value, record) => (
      <Tooltip title="终止此会话（执行 KILL）">
        <button
          type="button"
          className="tdsql-monitor__row-action"
          // 系统会话 ID 通常 < 100，避免误杀内核连接
          disabled={record.id < 100}
          onClick={() => onKill(record)}
        >
          <DeleteOutlined />
          <span>Kill</span>
        </button>
      </Tooltip>
    ),
  }
  return [...sessionColumns, actionColumn]
}

export default function TDSQLSessionList({
  connId,
  database,
  sessions,
  loading,
  onKilled,
}: TDSQLSessionListProps) {
  // 待确认 Kill 的会话，null 时弹窗关闭
  const [pendingKill, setPendingKill] = useState<TDSQLSessionRow | null>(null)
  const [killing, setKilling] = useState(false)

  const columns = useMemo(() => buildColumns(setPendingKill), [])

  const confirmKill = async () => {
    if (!pendingKill) return
    setKilling(true)
    try {
      // 通过通用 executeSQL 通道执行 KILL <ID>，KILL 是 MySQL 兼容命令
      const result = await window.database.executeSQL(
        connId,
        database,
        `KILL ${pendingKill.id}`,
      )
      if (!result.success) {
        throw new Error(
          result.error?.detail
          || result.error?.message
          || 'KILL 会话失败',
        )
      }
      void window.logger.write(
        'info',
        'TDSQLMonitor',
        `Kill 会话完成: 连接=${connId}, 会话ID=${pendingKill.id}, 用户=${pendingKill.user}`,
      )
      message.success(`会话 ${pendingKill.id} 已终止`)
      setPendingKill(null)
      // 通知父组件触发刷新
      onKilled?.()
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      void window.logger.write(
        'error',
        'TDSQLMonitor',
        `Kill 会话失败: 连接=${connId}, 会话ID=${pendingKill?.id}, 原因=${detail}`,
      )
      message.error(`Kill 会话失败：${detail}`)
    } finally {
      setKilling(false)
    }
  }

  return (
    <div className="tdsql-monitor__panel">
      <Table<TDSQLSessionRow>
        className="tdsql-monitor__table"
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={sessions}
        columns={columns}
        scroll={{ x: 1200, y: 'calc(100vh - 320px)' }}
        pagination={{ pageSize: 50, showSizeChanger: false, size: 'small' }}
      />
      <Modal
        open={Boolean(pendingKill)}
        title="确认终止会话"
        okText="终止"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: killing }}
        onCancel={() => {
          if (!killing) setPendingKill(null)
        }}
        onOk={() => void confirmKill()}
      >
        {pendingKill && (
          <div className="tdsql-monitor__kill-content">
            <p>
              确定要终止会话
              <strong> #{pendingKill.id} </strong>
              吗？该操作不可撤销，可能中断用户正在执行的查询或事务。
            </p>
            <ul className="tdsql-monitor__kill-meta">
              <li>用户：{pendingKill.user}</li>
              <li>主机：{pendingKill.host}</li>
              <li>数据库：{pendingKill.db || '-'}</li>
              <li>持续时间：{pendingKill.time} 秒</li>
            </ul>
          </div>
        )}
      </Modal>
    </div>
  )
}
