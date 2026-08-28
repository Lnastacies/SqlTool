import React, { useEffect, useMemo, useState } from 'react'
import ReloadOutlined from '@ant-design/icons/ReloadOutlined'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import TableOutlined from '@ant-design/icons/TableOutlined'
import { Dropdown, Empty, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DATABASE_OBJECT_ACTIONS,
  type DatabaseObjectAction,
} from '../features/database-objects/databaseObjectPresentation'
import type {
  DatabaseObjectSelection,
} from '../features/database-objects/databaseObjectModel'
import type { TableSummary } from '../types'
import {
  formatTableDateTime,
  formatTableSize,
} from './tableSummaryFormat'
import {
  buildTableObjectContextMenu,
} from '../features/tables/tableObjectContextMenu'

interface DatabaseTableOverviewProps {
  database: string
  rows: TableSummary[]
  loading: boolean
  error: string
  selectedObject: DatabaseObjectSelection | null
  onSelectObject: (selection: DatabaseObjectSelection) => void
  onOpenTable: (tableName: string) => void
  onTableAction: (
    action: DatabaseObjectAction,
    tableName?: string,
  ) => void
  onRefresh: () => void
}

export default function DatabaseTableOverview({
  database,
  rows,
  loading,
  error,
  selectedObject,
  onSelectObject,
  onOpenTable,
  onTableAction,
  onRefresh,
}: DatabaseTableOverviewProps) {
  const [searchText, setSearchText] = useState('')
  const [contextMenuName, setContextMenuName] = useState('')
  const selectedName = selectedObject?.kind === 'table'
    ? selectedObject.name
    : ''

  useEffect(() => {
    setSearchText('')
    setContextMenuName('')
  }, [database])

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLocaleLowerCase()
    return keyword
      ? rows.filter(row => row.name.toLocaleLowerCase().includes(keyword))
      : rows
  }, [rows, searchText])

  const columns: ColumnsType<TableSummary> = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 210,
      fixed: 'left',
      render: name => (
        <span className="table-overview__name">
          <TableOutlined />
          <span>{name}</span>
        </span>
      ),
    },
    {
      key: 'rowCount',
      title: '记录行数',
      dataIndex: 'rowCount',
      width: 92,
      align: 'right',
      render: value => value == null ? '' : Number(value).toLocaleString(),
    },
    {
      key: 'sizeBytes',
      title: '大小',
      dataIndex: 'sizeBytes',
      width: 88,
      align: 'right',
      render: formatTableSize,
    },
    {
      key: 'createdAt',
      title: '已创建',
      dataIndex: 'createdAt',
      width: 156,
      render: formatTableDateTime,
    },
    {
      key: 'updatedAt',
      title: '已修改',
      dataIndex: 'updatedAt',
      width: 156,
      render: formatTableDateTime,
    },
    {
      key: 'engine',
      title: '引擎',
      dataIndex: 'engine',
      width: 100,
    },
    {
      key: 'comment',
      title: '注释',
      dataIndex: 'comment',
      width: 220,
      ellipsis: true,
    },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: 90,
    },
  ]

  const selection = (name: string): DatabaseObjectSelection => ({
    name,
    category: 'tables',
    kind: 'table',
  })

  return (
    <section className="table-overview">
      <header className="table-overview__titlebar">
        <TableOutlined />
        <strong>表</strong>
        <span>@ {database}</span>
      </header>
      <div className="table-overview__toolbar">
        <div className="table-overview__commands">
          {DATABASE_OBJECT_ACTIONS.tables.map(action => (
            <button
              key={action.id}
              type="button"
              title={action.label}
              aria-label={action.label}
              disabled={loading || (action.requiresSelection && !selectedName)}
              onClick={() => onTableAction(action, selectedName || undefined)}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
          <Tooltip title="刷新表列表">
            <button
              type="button"
              aria-label="刷新表列表"
              disabled={loading}
              onClick={onRefresh}
            >
              <ReloadOutlined spin={loading} />
            </button>
          </Tooltip>
        </div>
        <label className="table-overview__search">
          <SearchOutlined />
          <input
            value={searchText}
            disabled={loading}
            onChange={event => setSearchText(event.target.value)}
            placeholder="搜索表"
          />
        </label>
      </div>
      {error && <div className="table-overview__error">{error}</div>}
      <Dropdown
        open={Boolean(contextMenuName)}
        trigger={['contextMenu']}
        menu={{
          items: buildTableObjectContextMenu({
            onAction: action => {
              const tableName = contextMenuName
              setContextMenuName('')
              onTableAction(action, tableName)
            },
          }),
        }}
        onOpenChange={open => {
          if (!open) setContextMenuName('')
        }}
      >
        <div className="table-overview__table">
          <Table<TableSummary>
            rowKey="name"
            size="small"
            columns={columns}
            dataSource={filteredRows}
            loading={loading}
            pagination={false}
            scroll={{ x: 1112, y: 'calc(100vh - 218px)' }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={searchText ? '没有匹配的表' : '该数据库暂无表'}
                />
              ),
            }}
            rowClassName={row => (
              row.name === selectedName ? 'ant-table-row-selected' : ''
            )}
            onRow={row => ({
              onClick: () => onSelectObject(selection(row.name)),
              onDoubleClick: () => onOpenTable(row.name),
              onContextMenu: () => {
                onSelectObject(selection(row.name))
                setContextMenuName(row.name)
              },
            })}
          />
        </div>
      </Dropdown>
      <footer className="table-overview__summary">
        {loading ? '正在读取表明细' : `${filteredRows.length} 个表`}
      </footer>
    </section>
  )
}
