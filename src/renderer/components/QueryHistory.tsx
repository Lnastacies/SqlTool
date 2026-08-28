import { useState, useEffect } from 'react'
import { List, Input, Button, Popconfirm, Empty, Tag, Tooltip } from 'antd'
import { SearchOutlined, ClearOutlined, CopyOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons'

interface QueryHistoryEntry {
  id: number
  sql: string
  connection: string
  database: string
  timestamp: string
  execution_time: number
  row_count: number
  success: boolean
  error: string
}

interface QueryHistoryProps {
  onInsertSQL: (sql: string) => void
}

export default function QueryHistory({ onInsertSQL }: QueryHistoryProps) {
  const [history, setHistory] = useState<QueryHistoryEntry[]>([])
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const result = await (window as any).queryHistory.get(searchText)
      const data = result && result.success ? result.data : []
      setHistory(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('加载查询历史失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearchText(value)
  }

  const handleClearHistory = async () => {
    try {
      await (window as any).queryHistory.clear()
      setHistory([])
    } catch (error) {
      console.error('清空查询历史失败:', error)
    }
  }

  const handleDeleteEntry = async (id: number) => {
    try {
      await (window as any).queryHistory.delete(id)
      setHistory(prev => prev.filter(item => item.id !== id))
    } catch (error) {
      console.error('删除历史记录失败:', error)
    }
  }

  const handleCopySQL = (sql: string) => {
    navigator.clipboard.writeText(sql)
  }

  const handleInsertSQL = (sql: string) => {
    onInsertSQL(sql)
  }

  const formatSQLPreview = (sql: string) => {
    const preview = sql.replace(/\n/g, ' ').trim()
    return preview.length > 80 ? preview.substring(0, 80) + '...' : preview
  }

  return (
    <div className="query-history-panel">
      <div className="panel-header">
        <div className="header-left">
          <span className="header-icon">📜</span>
          <span className="header-title">查询历史</span>
        </div>
        <Popconfirm
          title="确定要清空所有查询历史吗？"
          onConfirm={handleClearHistory}
          okText="确定"
          cancelText="取消"
        >
          <Button type="text" size="small" danger icon={<ClearOutlined />}>
            清空
          </Button>
        </Popconfirm>
      </div>

      <div className="search-bar">
        <Input.Search
          placeholder="搜索历史记录..."
          allowClear
          value={searchText}
          onChange={(e) => handleSearch(e.target.value)}
          onSearch={loadHistory}
          prefix={<SearchOutlined />}
          size="small"
        />
      </div>

      <div className="history-list">
        <List
          loading={loading}
          dataSource={history}
          renderItem={(item) => (
            <List.Item
              className={`history-item ${item.success ? 'success' : 'error'}`}
              actions={[
                <Tooltip title="复制SQL">
                  <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopySQL(item.sql)} />
                </Tooltip>,
                <Tooltip title="插入到编辑器">
                  <Button type="text" size="small" icon={<PlayCircleOutlined />} onClick={() => handleInsertSQL(item.sql)} />
                </Tooltip>,
                <Tooltip title="删除">
                  <Popconfirm
                    title="确定删除这条记录？"
                    onConfirm={() => handleDeleteEntry(item.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Tooltip>,
              ]}
            >
              <div className="history-content">
                <div className="history-header">
                  <Tag color={item.success ? 'success' : 'error'}>
                    {item.success ? '✓' : '✗'}
                  </Tag>
                  <span className="history-time">{item.timestamp}</span>
                  {item.connection && (
                    <Tag color="blue">{item.connection}</Tag>
                  )}
                  {item.database && (
                    <Tag>{item.database}</Tag>
                  )}
                </div>
                <div className="history-sql">{formatSQLPreview(item.sql)}</div>
                <div className="history-meta">
                  {item.execution_time > 0 && (
                    <span className="meta-item">耗时: {item.execution_time.toFixed(2)}s</span>
                  )}
                  {item.row_count > 0 && (
                    <span className="meta-item">行数: {item.row_count}</span>
                  )}
                </div>
              </div>
            </List.Item>
          )}
          locale={{ emptyText: <Empty description="暂无查询历史" /> }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </div>
    </div>
  )
}
