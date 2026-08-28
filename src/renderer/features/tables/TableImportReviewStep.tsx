import React from 'react'
import { Alert, Descriptions, Table, Tag, Typography } from 'antd'
import type {
  TableImportOptions,
  TableImportPreview,
} from '../../types'
import type { TableImportMappingDraft } from './tableTransferModel'

const { Text } = Typography

interface TableImportReviewStepProps {
  tableName: string
  preview: TableImportPreview
  options: TableImportOptions
  mappings: TableImportMappingDraft[]
  emptyStringAsNull: boolean
}

/**
 * 导入第三步：确认导出摘要与映射关系。
 * 展示源文件、格式、目标表、数据行数等关键信息，
 * 并附带字段映射预览表，让用户最终确认前一目了然。
 */
export default function TableImportReviewStep({
  tableName,
  preview,
  options,
  mappings,
  emptyStringAsNull,
}: TableImportReviewStepProps) {
  const mappedCount = mappings.filter(item => item.target).length

  return (
    <div className="table-transfer-review">
      <Alert
        type="warning"
        showIcon
        message="导入会立即写入目标表"
        description="全部数据在一个事务中提交；任意一行失败时，本次导入将整体回滚。"
      />

      <Descriptions
        bordered
        size="small"
        column={2}
        items={[
          { key: 'file', label: '源文件', children: preview.fileName },
          {
            key: 'format',
            label: '文件格式',
            children: <Tag color="blue">{options.format.toUpperCase()}</Tag>,
          },
          { key: 'target', label: '目标表', children: tableName },
          {
            key: 'rows',
            label: '数据行',
            children: <Text strong>{preview.totalRows} 行</Text>,
          },
          {
            key: 'mapping',
            label: '字段映射',
            children: `${mappedCount} / ${mappings.length} 个字段`,
          },
          {
            key: 'empty',
            label: '空字符串',
            children: emptyStringAsNull ? '转换为 NULL' : '保持空字符串',
          },
        ]}
      />

      {/* 映射预览表：让用户在确认前直观检查映射关系 */}
      <Text type="secondary" className="table-import-review__title">
        字段映射预览
      </Text>
      <Table
        size="small"
        rowKey="source"
        pagination={false}
        scroll={{ y: 180 }}
        dataSource={mappings.filter(item => item.target)}
        columns={[
          {
            title: '源字段',
            dataIndex: 'source',
            width: 220,
            ellipsis: true,
          },
          {
            title: '→',
            key: 'arrow',
            width: 40,
            align: 'center',
            render: () => <Text type="secondary">→</Text>,
          },
          {
            title: '目标字段',
            dataIndex: 'target',
            ellipsis: true,
          },
        ]}
      />
    </div>
  )
}
