import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Empty, Pagination, Spin, Table, Tabs } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import CellValueDisplay from './CellValueDisplay'
import { writeLayoutOverflowLog } from '../layoutDiagnostics'
import type {
  QueryExecutionMessage,
  QueryResultSet,
} from '../types'
import type { QueryWorkspaceDocument } from './workspaceTypes'

interface QueryResultPanelProps {
  document: QueryWorkspaceDocument
  onActiveResultChange: (index: number) => void
}

interface QueryTableRow {
  key: number
  rowNumber: number
  values: unknown[]
}

export default function QueryResultPanel({
  document,
  onActiveResultChange,
}: QueryResultPanelProps) {
  const items = useMemo(() => [
    ...document.resultSets.map(resultSet => ({
      key: `result-${resultSet.index}`,
      label: `结果 ${resultSet.index + 1} (${resultSet.rowCount})`,
      children: <ResultTable resultSet={resultSet} />,
    })),
    {
      key: 'messages',
      label: `消息 (${document.messages.length})`,
      children: (
        <QueryMessages
          messages={document.messages}
          emptyText={
            document.executionState === 'idle'
              ? '执行查询后将在此显示服务端消息'
              : '正在等待数据库响应'
          }
        />
      ),
    },
  ], [
    document.executionState,
    document.messages,
    document.resultSets,
  ])
  const activeKey = document.activeResultIndex >= 0
    ? `result-${document.activeResultIndex}`
    : 'messages'
  const isExecuting = document.executionState !== 'idle'

  return (
    <section className="query-results">
      <div className="query-results__summary">
        <span>执行结果</span>
        <span>
          {isExecuting ? (
            <><Spin size="small" /> 正在执行</>
          ) : document.executionTime > 0 ? (
            `耗时 ${document.executionTime.toFixed(3)} 秒`
          ) : (
            '尚未执行'
          )}
        </span>
      </div>
      <Tabs
        size="small"
        className="query-results__tabs"
        activeKey={activeKey}
        onChange={key => {
          onActiveResultChange(
            key === 'messages'
              ? -1
              : Number(key.replace('result-', '')),
          )
        }}
        items={items}
      />
    </section>
  )
}

function ResultTable({ resultSet }: { resultSet: QueryResultSet }) {
  const tableViewportRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const columns: ColumnsType<QueryTableRow> = [
    {
      title: '#',
      key: '__row_number',
      width: 48,
      fixed: 'left',
      align: 'right',
      render: (_value, record) => (
        <span className="query-result-row-number">{record.rowNumber}</span>
      ),
    },
    ...resultSet.columns.map((column, columnIndex) => ({
      title: (
        <span className="query-result-column">
          <span>{column.name}</span>
          {column.dataType && (
            <small title={column.dataType}>{column.dataType}</small>
          )}
        </span>
      ),
      key: column.key,
      width: 160,
      ellipsis: true,
      render: (_value: unknown, record: QueryTableRow) => (
        <CellValueDisplay value={record.values[columnIndex]} />
      ),
    })),
  ]
  const dataSource = resultSet.rows.map((values, index) => ({
    key: index,
    rowNumber: index + 1,
    values,
  }))
  const pageRows = dataSource.slice(
    (page - 1) * pageSize,
    page * pageSize,
  )

  useEffect(() => {
    setPage(1)
  }, [resultSet.id])

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(dataSource.length / pageSize))
    setPage(currentPage => Math.min(currentPage, lastPage))
  }, [dataSource.length, pageSize])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      writeLayoutOverflowLog(
        'QueryResultLayout',
        `query-result-${resultSet.index}`,
        tableViewportRef.current,
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [resultSet.index, resultSet.rowCount, resultSet.rows.length])

  return (
    <div ref={tableViewportRef} className="query-result-table">
      <div className="query-result-table__grid">
        <Table<QueryTableRow>
          columns={columns}
          dataSource={pageRows}
          pagination={false}
          scroll={{ x: 'max-content' }}
          bordered
          size="small"
        />
      </div>
      <div className="query-result-table__pagination">
        {/* 左侧占位，保持容器布局对称（flex: space-between），使分页控件视觉靠右 */}
        <div style={{ minWidth: 0, flex: '0 1 auto' }} />
        <Pagination
          current={page}
          pageSize={pageSize}
          pageSizeOptions={[20, 50, 100, 200, 500]}
          total={dataSource.length}
          size="small"
          showLessItems
          showSizeChanger
          showTotal={(count, range) =>
            count > 0 ? `${range[0]}-${range[1]} / ${count}` : '0 条'
          }
          onChange={(nextPage, nextPageSize) => {
            setPage(nextPageSize === pageSize ? nextPage : 1)
            setPageSize(nextPageSize)
            void window.logger.write(
              'info',
              'QueryResultPagination',
              `查询结果分页切换: 结果集=${resultSet.index + 1}, 页码=${nextPage}, 每页=${nextPageSize}, 总行数=${dataSource.length}`,
            )
          }}
        />
      </div>
    </div>
  )
}

function QueryMessages({
  messages,
  emptyText,
}: {
  messages: QueryExecutionMessage[]
  emptyText: string
}) {
  if (messages.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={emptyText}
      />
    )
  }
  return (
    <div className="query-message-list">
      {messages.map((item, index) => (
        <div
          key={`${item.index}-${index}-${item.text}`}
          className={`query-message query-message--${item.level}`}
        >
          <span className="query-message__index">{item.index + 1}</span>
          <span className="query-message__text">{item.text}</span>
        </div>
      ))}
    </div>
  )
}
