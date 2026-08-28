import React from 'react'
import { Alert, Space, Table, Tag, Typography } from 'antd'
import type {
  DatabaseType,
  TableExportObjectRequest,
  TableExportOptions,
} from '../../types'

const { Text } = Typography

interface TableExportReviewStepProps {
  databaseType: DatabaseType
  objects: TableExportObjectRequest[]
  options: Omit<TableExportOptions, 'columns'>
}

/**
 * 导出第三步：确认导出内容。
 * 顶部信息条聚焦关键数字（对象数、字段数、行数预估），
 * 下方为对象清单，便于一眼核对范围。
 */
export default function TableExportReviewStep({
  databaseType,
  objects,
  options,
}: TableExportReviewStepProps) {
  const totalFields = objects.reduce((sum, item) => sum + item.columns.length, 0)
  const hasMultiple = objects.length > 1

  return (
    <div className="table-export-review">
      <Alert
        type="info"
        showIcon
        message="确认无误后点击导出，将选择保存位置"
        description={hasMultiple
          ? '多对象导出：选择目录后，每个对象生成独立文件。'
          : '单对象导出：选择文件位置后写入。'}
      />

      {/* 关键数字汇总条：一眼看清规模 */}
      <div className="table-export-review__stats">
        <Space size={20}>
          <span className="table-export-review__stat">
            <Text type="secondary">对象</Text>
            <Text strong>{objects.length}</Text>
          </span>
          <span className="table-export-review__stat">
            <Text type="secondary">字段</Text>
            <Text strong>{totalFields}</Text>
          </span>
          <span className="table-export-review__stat">
            <Text type="secondary">格式</Text>
            <Tag color="blue" style={{ margin: 0 }}>
              {options.format.toUpperCase()}
            </Tag>
          </span>
          <span className="table-export-review__stat">
            <Text type="secondary">数据库</Text>
            <Text>{databaseType}</Text>
          </span>
        </Space>
      </div>

      <Text type="secondary" className="table-export-review__title">
        导出清单
      </Text>
      <Table
        size="small"
        rowKey={record => `${record.objectType}:${record.name}`}
        pagination={false}
        scroll={{ y: 300 }}
        dataSource={objects}
        columns={[
          {
            title: '类型',
            dataIndex: 'objectType',
            width: 70,
            render: type => (
              <Tag color={type === 'view' ? 'cyan' : 'blue'} style={{ margin: 0 }}>
                {type === 'view' ? '视图' : '表'}
              </Tag>
            ),
          },
          { title: '对象', dataIndex: 'name', ellipsis: true },
          {
            title: '导出字段',
            dataIndex: 'columns',
            width: 120,
            align: 'right',
            render: columns => (
              <Space size={4}>
                <Text strong>{columns.length}</Text>
                <Text type="secondary">个</Text>
              </Space>
            ),
          },
          {
            title: '字段预览',
            key: 'preview',
            ellipsis: true,
            render: (_, record) => (
              <Text type="secondary" title={record.columns.join(', ')}>
                {record.columns.slice(0, 4).join('，')}
                {record.columns.length > 4 ? '…' : ''}
              </Text>
            ),
          },
        ]}
      />
    </div>
  )
}
