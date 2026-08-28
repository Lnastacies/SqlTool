import React, { useEffect, useMemo, useState } from 'react'
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined'
import HddOutlined from '@ant-design/icons/HddOutlined'
import ReloadOutlined from '@ant-design/icons/ReloadOutlined'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import { Empty, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ConnectionData, DatabaseSummary } from '../types'
import { formatTableSize } from './tableSummaryFormat'

interface DatabaseRow extends DatabaseSummary {
  key: string
}

interface ConnectionDatabaseOverviewProps {
  connection: ConnectionData
  databases: DatabaseSummary[]
  loading: boolean
  onOpenDatabase: (database: string) => void
  onRefresh: () => void
}

export default function ConnectionDatabaseOverview({
  connection,
  databases,
  loading,
  onOpenDatabase,
  onRefresh,
}: ConnectionDatabaseOverviewProps) {
  const [searchText, setSearchText] = useState('')
  const [selectedName, setSelectedName] = useState('')

  useEffect(() => {
    setSearchText('')
    setSelectedName('')
  }, [connection.id])

  useEffect(() => {
    if (loading) return
    const totalSize = databases.reduce(
      (total, item) => total + (item.sizeBytes || 0),
      0,
    )
    void window.logger.write(
      'info',
      'ConnectionDatabaseOverview',
      `数据库明细已渲染: 连接=${connection.id}, 数量=${databases.length}, 总大小=${totalSize}`,
    )
  }, [connection.id, databases, loading])

  const rows = useMemo<DatabaseRow[]>(() => {
    const keyword = searchText.trim().toLocaleLowerCase()
    return databases
      .filter(item => (
        !keyword || item.name.toLocaleLowerCase().includes(keyword)
      ))
      .map(item => ({ ...item, key: item.name }))
  }, [databases, searchText])

  const totalSize = useMemo(
    () => rows.reduce(
      (total, item) => total + (item.sizeBytes || 0),
      0,
    ),
    [rows],
  )

  const columns: ColumnsType<DatabaseRow> = [
    {
      key: 'name',
      title: '数据库',
      dataIndex: 'name',
      width: 230,
      fixed: 'left',
      render: name => (
        <span className="database-overview__name">
          <DatabaseOutlined />
          <span>{name}</span>
        </span>
      ),
    },
    {
      key: 'sizeBytes',
      title: '大小',
      dataIndex: 'sizeBytes',
      width: 100,
      align: 'right',
      render: formatTableSize,
    },
    {
      key: 'tableCount',
      title: '表数量',
      dataIndex: 'tableCount',
      width: 86,
      align: 'right',
      render: value => value == null ? '' : Number(value).toLocaleString(),
    },
    {
      key: 'charset',
      title: '字符集',
      dataIndex: 'charset',
      width: 110,
    },
    {
      key: 'collation',
      title: '排序规则',
      dataIndex: 'collation',
      width: 220,
      ellipsis: true,
    },
    {
      key: 'state',
      title: '状态',
      dataIndex: 'state',
      width: 90,
      render: value => value === 'ONLINE'
        ? '在线'
        : value === 'OFFLINE' ? '离线' : value,
    },
  ]

  return (
    <section className="database-overview">
      <header className="database-overview__titlebar">
        <HddOutlined />
        <strong>{connection.name}</strong>
        <span>{connection.type}</span>
      </header>
      <div className="database-overview__toolbar">
        <Tooltip title="刷新数据库列表">
          <button
            type="button"
            aria-label="刷新数据库列表"
            disabled={loading}
            onClick={onRefresh}
          >
            <ReloadOutlined spin={loading} />
          </button>
        </Tooltip>
        <label className="database-overview__search">
          <SearchOutlined />
          <input
            value={searchText}
            disabled={loading}
            onChange={event => setSearchText(event.target.value)}
            placeholder="搜索数据库"
          />
        </label>
      </div>
      <div className="database-overview__table">
        <Table<DatabaseRow>
          rowKey="key"
          size="small"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={false}
          scroll={{ x: 836, y: 'calc(100vh - 218px)' }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={searchText ? '没有匹配的数据库' : '暂无数据库'}
              />
            ),
          }}
          rowClassName={row => (
            row.name === selectedName ? 'ant-table-row-selected' : ''
          )}
          onRow={row => ({
            onClick: () => setSelectedName(row.name),
            onDoubleClick: () => onOpenDatabase(row.name),
          })}
        />
      </div>
      <footer className="database-overview__summary">
        {loading
          ? '正在读取数据库明细'
          : `${rows.length} 个数据库 · 总大小 ${formatTableSize(totalSize)}`}
      </footer>
    </section>
  )
}
