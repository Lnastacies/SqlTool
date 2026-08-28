import React from 'react'
import { Empty, Table, Tabs, Tag, Tooltip } from 'antd'
import type { TableMetadata } from '../../types'

interface TableStructureTabsProps {
  metadata: TableMetadata
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '无'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function FieldsTable({ metadata }: TableStructureTabsProps) {
  return (
    <Table
      rowKey="name"
      size="small"
      pagination={false}
      scroll={{ x: 820, y: 'calc(100vh - 275px)' }}
      dataSource={metadata.fields}
      columns={[
        {
          title: '#',
          width: 42,
          align: 'center',
          render: (_value, _field, index) => index + 1,
        },
        {
          title: '字段名',
          dataIndex: 'name',
          width: 170,
          render: (name: string, field) => (
            <span className="table-structure__field-name">
              {field.primary && <Tag color="gold">PK</Tag>}
              <strong>{name}</strong>
            </span>
          ),
        },
        {
          title: '数据类型',
          dataIndex: 'type',
          width: 190,
          render: (type: string) => <code>{type}</code>,
        },
        {
          title: '可空',
          width: 64,
          align: 'center',
          render: (_value, field) => (
            <Tag color={field.not_null ? 'default' : 'green'}>
              {field.not_null ? '否' : '是'}
            </Tag>
          ),
        },
        {
          title: '自增',
          width: 64,
          align: 'center',
          render: (_value, field) => field.auto_increment
            ? <Tag color="blue">是</Tag>
            : <span className="table-structure__muted">否</span>,
        },
        {
          title: '默认值',
          width: 180,
          render: (_value, field) => {
            const value = field.default_expression ?? field.default
            const text = displayValue(value)
            return (
              <Tooltip title={text}>
                <code className="table-structure__ellipsis">{text}</code>
              </Tooltip>
            )
          },
        },
        {
          title: '注释',
          dataIndex: 'comment',
          ellipsis: true,
          render: (comment: string) => comment || (
            <span className="table-structure__muted">无</span>
          ),
        },
      ]}
    />
  )
}

function IndexesTable({ metadata }: TableStructureTabsProps) {
  if (metadata.indexes.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无索引" />
  }
  return (
    <Table
      rowKey="name"
      size="small"
      pagination={false}
      dataSource={metadata.indexes}
      columns={[
        { title: '索引名', dataIndex: 'name', width: 220 },
        {
          title: '类型',
          dataIndex: 'type',
          width: 110,
          render: (type: string) => type || 'INDEX',
        },
        {
          title: '唯一',
          width: 80,
          align: 'center',
          render: (_value, index) => index.unique
            ? <Tag color="blue">唯一</Tag>
            : '普通',
        },
        {
          title: '字段',
          render: (_value, index) => index.fields.map(field => (
            <Tag key={field}>{field}</Tag>
          )),
        },
      ]}
    />
  )
}

function ForeignKeysTable({ metadata }: TableStructureTabsProps) {
  if (metadata.foreign_keys.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无外键" />
  }
  return (
    <Table
      rowKey="name"
      size="small"
      pagination={false}
      dataSource={metadata.foreign_keys}
      columns={[
        { title: '外键名', dataIndex: 'name', width: 190 },
        {
          title: '本地字段',
          width: 180,
          render: (_value, item) => item.fields.join(', '),
        },
        { title: '引用表', dataIndex: 'referenced_table', width: 190 },
        {
          title: '引用字段',
          render: (_value, item) => item.referenced_fields.join(', '),
        },
      ]}
    />
  )
}

export default function TableStructureTabs({
  metadata,
}: TableStructureTabsProps) {
  return (
    <Tabs
      className="table-structure__tabs"
      size="small"
      items={[
        {
          key: 'fields',
          label: `字段 ${metadata.fields.length}`,
          children: <FieldsTable metadata={metadata} />,
        },
        {
          key: 'indexes',
          label: `索引 ${metadata.indexes.length}`,
          children: <IndexesTable metadata={metadata} />,
        },
        {
          key: 'foreign-keys',
          label: `外键 ${metadata.foreign_keys.length}`,
          children: <ForeignKeysTable metadata={metadata} />,
        },
        {
          key: 'ddl',
          label: 'DDL',
          children: (
            <pre className="table-structure__ddl">
              {metadata.ddl || '当前数据库未返回建表 DDL。'}
            </pre>
          ),
        },
      ]}
    />
  )
}
