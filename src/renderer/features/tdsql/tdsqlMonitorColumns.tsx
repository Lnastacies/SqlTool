/**
 * TDSQL 监控面板 - Ant Design Table 列定义
 *
 * 集中管理三类监控表格的列配置，便于复用与统一调整：
 * - 会话列表：固定列结构（含 TDSQL 扩展字段）
 * - DDL 任务：动态列（SHOW DDL 字段因版本不同）
 * - 分区分布：固定列结构
 */

import React from 'react'
import { Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type {
  TDSQLDatabaseOverview,
  TDSQLDdlTaskRow,
  TDSQLSessionRow,
} from './tdsqlMonitorModel'
import { formatTableSize } from '../../workspace/tableSummaryFormat'

/** 将 SQL 语句截断并附加 Tooltip，便于在窄列内查看完整内容 */
function renderSqlCell(value: string | null): React.ReactNode {
  if (!value) return <span className="tdsql-monitor__muted">无</span>
  const text = value.length > 80 ? `${value.slice(0, 80)}…` : value
  return (
    <Tooltip title={<pre className="tdsql-monitor__sql-tooltip">{value}</pre>}>
      <code className="tdsql-monitor__sql-cell">{text}</code>
    </Tooltip>
  )
}

/** 会话列表列定义（含 TDSQL 扩展字段 TIME_MS/ROWS_SENT/TID） */
export const sessionColumns: ColumnsType<TDSQLSessionRow> = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 80,
    fixed: 'left',
  },
  {
    title: '用户',
    dataIndex: 'user',
    key: 'user',
    width: 110,
  },
  {
    title: '主机',
    dataIndex: 'host',
    key: 'host',
    width: 180,
    ellipsis: true,
  },
  {
    title: '数据库',
    dataIndex: 'db',
    key: 'db',
    width: 120,
    render: (value: string | null) => value || (
      <span className="tdsql-monitor__muted">未指定</span>
    ),
  },
  {
    title: '命令',
    dataIndex: 'command',
    key: 'command',
    width: 90,
    render: (value: string) => (
      <Tag color={value === 'Sleep' ? 'default' : 'blue'}>{value}</Tag>
    ),
  },
  {
    title: '时间(秒)',
    dataIndex: 'time',
    key: 'time',
    width: 90,
    align: 'right',
    render: (value: number) => (
      <span className={value > 60 ? 'tdsql-monitor__warning' : ''}>
        {value}
      </span>
    ),
  },
  {
    title: '时间(毫秒)',
    dataIndex: 'timeMs',
    key: 'timeMs',
    width: 110,
    align: 'right',
    render: (value: number | null) => value ?? '-',
  },
  {
    title: '状态',
    dataIndex: 'state',
    key: 'state',
    width: 130,
    ellipsis: true,
    render: (value: string | null) => value || (
      <span className="tdsql-monitor__muted">-</span>
    ),
  },
  {
    title: '已返回行',
    dataIndex: 'rowsSent',
    key: 'rowsSent',
    width: 100,
    align: 'right',
    render: (value: number | null) => value ?? '-',
  },
  {
    title: '协程ID',
    dataIndex: 'tid',
    key: 'tid',
    width: 90,
    align: 'right',
    render: (value: number | null) => value ?? '-',
  },
  {
    title: 'SQL 语句',
    dataIndex: 'info',
    key: 'info',
    ellipsis: true,
    render: renderSqlCell,
  },
]

/**
 * 根据首行字段动态生成 DDL 任务列
 *
 * TDSQL SHOW DDL 返回字段可能因内核版本不同而变化，
 * 因此不能写死列结构，需要根据实际返回数据生成。
 */
export function buildDdlTaskColumns(
  rows: TDSQLDdlTaskRow[],
): ColumnsType<TDSQLDdlTaskRow> {
  if (rows.length === 0) return []
  // 取首行的所有键作为列来源，按出现顺序展示
  const keys = Object.keys(rows[0])
  return keys.map(key => ({
    title: key,
    dataIndex: key,
    key,
    ellipsis: true,
    render: (value: unknown) => {
      if (value == null) return <span className="tdsql-monitor__muted">-</span>
      const text = String(value)
      // 长 DDL 文本截断并加 Tooltip，避免撑爆单元格
      if (text.length > 100) {
        return (
          <Tooltip title={text}>
            <code className="tdsql-monitor__sql-cell">
              {`${text.slice(0, 100)}…`}
            </code>
          </Tooltip>
        )
      }
      return <code>{text}</code>
    },
  }))
}

/** 分区分布列定义（表名/分区名/行数/数据长度/索引长度） */
export const partitionColumns: ColumnsType<
  TDSQLDatabaseOverview['tables'][number]['partitions'][number] & { tableName: string }
> = [
  {
    title: '表名',
    dataIndex: 'tableName',
    key: 'tableName',
    width: 180,
    fixed: 'left',
  },
  {
    title: '分区名',
    dataIndex: 'partitionName',
    key: 'partitionName',
    width: 140,
  },
  {
    title: '所属数据库',
    dataIndex: 'tableSchema',
    key: 'tableSchema',
    width: 140,
  },
  {
    title: '行数',
    dataIndex: 'tableRows',
    key: 'tableRows',
    width: 110,
    align: 'right',
    render: (value: number) => value.toLocaleString(),
  },
  {
    title: '数据长度',
    dataIndex: 'dataLength',
    key: 'dataLength',
    width: 110,
    align: 'right',
    render: (value: number) => formatTableSize(value),
  },
  {
    title: '索引长度',
    dataIndex: 'indexLength',
    key: 'indexLength',
    width: 110,
    align: 'right',
    render: (value: number) => formatTableSize(value),
  },
]
