import React, { useState, useEffect } from 'react'
import { Layout, Tabs, Table, Tag, Empty } from 'antd'
import TableOutlined from '@ant-design/icons/TableOutlined'
import KeyOutlined from '@ant-design/icons/KeyOutlined'
import LinkOutlined from '@ant-design/icons/LinkOutlined'
import FileTextOutlined from '@ant-design/icons/FileTextOutlined'
import HistoryOutlined from '@ant-design/icons/HistoryOutlined'
import CodeOutlined from '@ant-design/icons/CodeOutlined'
import QueryHistory from './QueryHistory'
import SnippetPanel from './SnippetPanel'

const { Sider } = Layout

interface TableMetadata {
  fields: Array<{
    name: string
    type: string
    not_null: boolean
    default: any
    primary: boolean
    comment: string
  }>
  indexes: Array<{
    name: string
    type: string
    fields: string[]
    unique: boolean
  }>
  foreign_keys: Array<{
    name: string
    fields: string[]
    referenced_table: string
    referenced_fields: string[]
  }>
  ddl: string
}

interface RightPanelProps {
  selectedTable: { connId: string; database: string; tableName: string } | null
  onLoadMetadata: (connId: string, database: string, tableName: string) => Promise<TableMetadata>
  onInsertSQL: (sql: string) => void
}

function RightPanel({ selectedTable, onLoadMetadata, onInsertSQL }: RightPanelProps) {
  const [metadata, setMetadata] = useState<TableMetadata | null>(null)
  const [activeTab, setActiveTab] = useState('history')

  useEffect(() => {
    if (selectedTable) {
      loadMetadata(selectedTable.connId, selectedTable.database, selectedTable.tableName)
    } else {
      setMetadata(null)
    }
  }, [selectedTable])

  const loadMetadata = async (connId: string, database: string, tableName: string) => {
    try {
      const meta = await onLoadMetadata(connId, database, tableName)
      setMetadata(meta)
    } catch (e) {
      console.error('加载表元数据失败:', e)
      setMetadata(null)
    }
  }

  const columnsColumns = [
    { title: '字段名', dataIndex: 'name', key: 'name', width: 120 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
    { 
      title: '约束', 
      key: 'constraints', 
      width: 100,
      render: (_: unknown, record: any) => (
        <div>
          {record.primary && <Tag color="red">PK</Tag>}
          {record.not_null && <Tag color="orange">NOT NULL</Tag>}
        </div>
      )
    },
    { title: '默认值', dataIndex: 'default', key: 'default', width: 100 },
    { title: '注释', dataIndex: 'comment', key: 'comment' },
  ]

  const indexesColumns = [
    { title: '索引名', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { 
      title: '唯一性', 
      key: 'unique',
      render: (_: unknown, record: any) => record.unique ? '唯一' : '普通'
    },
    { title: '字段', dataIndex: 'fields', key: 'fields', render: (fields: string[]) => fields.join(', ') },
  ]

  const fkColumns = [
    { title: '外键名', dataIndex: 'name', key: 'name' },
    { title: '字段', dataIndex: 'fields', key: 'fields', render: (fields: string[]) => fields.join(', ') },
    { title: '引用表', dataIndex: 'referenced_table', key: 'referenced_table' },
    { title: '引用字段', dataIndex: 'referenced_fields', key: 'referenced_fields', render: (fields: string[]) => fields.join(', ') },
  ]

  return (
    <Sider width={340} className="sqltool-right-panel" theme="light">
      {selectedTable && (
        <div className="panel-header">
          <div className="table-info">
            <TableOutlined style={{ marginRight: 6 }} />
            <span className="table-name">{selectedTable.tableName}</span>
            <span className="database-name">@{selectedTable.database}</span>
          </div>
        </div>
      )}

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={[
          { key: 'history', label: '查询历史', icon: <HistoryOutlined /> },
          { key: 'snippets', label: '代码片段', icon: <CodeOutlined /> },
          { key: 'columns', label: '列', icon: <TableOutlined /> },
          { key: 'indexes', label: '索引', icon: <KeyOutlined /> },
          { key: 'foreignKeys', label: '外键', icon: <LinkOutlined /> },
          { key: 'ddl', label: 'DDL', icon: <FileTextOutlined /> },
        ]}
        size="small"
      />

      <div className="panel-content">
        {activeTab === 'history' && (
          <QueryHistory onInsertSQL={onInsertSQL} />
        )}

        {activeTab === 'snippets' && (
          <SnippetPanel onInsertSQL={onInsertSQL} />
        )}

        {activeTab === 'columns' && (
          metadata ? (
            <Table
              columns={columnsColumns}
              dataSource={metadata.fields.map((f, i) => ({ ...f, key: i }))}
              pagination={false}
              scroll={{ y: 400 }}
              size="small"
              bordered
            />
          ) : (
            <Empty description={selectedTable ? "加载中..." : "请选择表查看"} />
          )
        )}

        {activeTab === 'indexes' && (
          metadata ? (
            metadata.indexes.length > 0 ? (
              <Table
                columns={indexesColumns}
                dataSource={metadata.indexes.map((i, idx) => ({ ...i, key: idx }))}
                pagination={false}
                scroll={{ y: 400 }}
                size="small"
                bordered
              />
            ) : (
              <Empty description="暂无索引" />
            )
          ) : (
            <Empty description={selectedTable ? "加载中..." : "请选择表查看"} />
          )
        )}

        {activeTab === 'foreignKeys' && (
          metadata ? (
            metadata.foreign_keys.length > 0 ? (
              <Table
                columns={fkColumns}
                dataSource={metadata.foreign_keys.map((fk, idx) => ({ ...fk, key: idx }))}
                pagination={false}
                scroll={{ y: 400 }}
                size="small"
                bordered
              />
            ) : (
              <Empty description="暂无外键" />
            )
          ) : (
            <Empty description={selectedTable ? "加载中..." : "请选择表查看"} />
          )
        )}

        {activeTab === 'ddl' && (
          metadata ? (
            <pre className="ddl-code">{metadata.ddl || '暂无DDL信息'}</pre>
          ) : (
            <Empty description={selectedTable ? "加载中..." : "请选择表查看"} />
          )
        )}
      </div>

      <style>{`
        .sqltool-right-panel {
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border-left: 1px solid #e0e0e0;
        }
        
        .dark .sqltool-right-panel {
          background: #252526;
          border-left: 1px solid #3c3c3c;
        }
        
        .panel-header {
          padding: 12px;
          border-bottom: 1px solid #e0e0e0;
          background: #fafafa;
        }
        
        .dark .panel-header {
          border-bottom: 1px solid #3c3c3c;
          background: #2d2d2d;
        }
        
        .table-info {
          display: flex;
          align-items: center;
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }
        
        .dark .table-info {
          color: #d4d4d4;
        }
        
        .database-name {
          margin-left: 8px;
          font-weight: normal;
          color: #999;
          font-size: 12px;
        }
        
        .dark .database-name {
          color: #666;
        }
        
        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }
        
        .ddl-code {
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 4px;
          white-space: pre-wrap;
          word-break: break-all;
          color: #333;
        }
        
        .dark .ddl-code {
          background: #1e1e1e;
          color: #d4d4d4;
        }
        
              `}</style>
    </Sider>
  )
}

export default RightPanel
