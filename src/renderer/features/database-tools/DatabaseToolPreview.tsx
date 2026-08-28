import React from 'react'
import { Alert, Collapse, Table, Tag } from 'antd'
import type {
  DataSyncPreview,
  DataTransferPreview,
  DatabaseToolItemStatus,
  DatabaseToolMode,
  StructureSyncPreview,
} from '../../types'

type ToolPreview = DataTransferPreview | DataSyncPreview | StructureSyncPreview

interface DatabaseToolPreviewProps {
  mode: DatabaseToolMode
  preview: ToolPreview
}

function statusTag(status: DatabaseToolItemStatus | 'same') {
  if (status === 'blocked') return <Tag color="red">无法执行</Tag>
  if (status === 'warning') return <Tag color="gold">需确认</Tag>
  if (status === 'same') return <Tag>无需变更</Tag>
  return <Tag color="green">可执行</Tag>
}

function warningsCell(warnings: string[]) {
  return warnings.length > 0
    ? <span className="database-tool-preview__warning">{warnings.join('；')}</span>
    : <span className="database-tool-preview__muted">无</span>
}

function TransferPreviewTable({ preview }: { preview: DataTransferPreview }) {
  return (
    <Table
      size="small"
      pagination={false}
      scroll={{ y: 340 }}
      rowKey="table"
      dataSource={preview.items}
      columns={[
        { title: '表', dataIndex: 'table', width: 190, ellipsis: true },
        { title: '源行数', dataIndex: 'sourceRows', width: 90 },
        { title: '目标行数', dataIndex: 'targetRows', width: 90 },
        {
          title: '写入字段',
          dataIndex: 'commonColumns',
          width: 90,
          render: columns => columns.length,
        },
        {
          title: '状态',
          dataIndex: 'status',
          width: 90,
          render: statusTag,
        },
        {
          title: '提示',
          dataIndex: 'warnings',
          render: warningsCell,
        },
      ]}
    />
  )
}

function DataSyncPreviewTable({ preview }: { preview: DataSyncPreview }) {
  return (
    <Table
      size="small"
      pagination={false}
      scroll={{ y: 340 }}
      rowKey="table"
      dataSource={preview.items}
      columns={[
        { title: '表', dataIndex: 'table', width: 170, ellipsis: true },
        {
          title: '主键',
          dataIndex: 'primaryKeys',
          width: 150,
          render: keys => keys.join(', ') || '-',
        },
        { title: '新增', dataIndex: 'insertedRows', width: 70 },
        { title: '更新', dataIndex: 'updatedRows', width: 70 },
        { title: '删除', dataIndex: 'deletedRows', width: 70 },
        { title: '相同', dataIndex: 'unchangedRows', width: 70 },
        {
          title: '状态',
          dataIndex: 'status',
          width: 90,
          render: statusTag,
        },
        {
          title: '提示',
          dataIndex: 'warnings',
          render: warningsCell,
        },
      ]}
    />
  )
}

function StructurePreviewTable({
  preview,
}: {
  preview: StructureSyncPreview
}) {
  return (
    <Table
      size="small"
      pagination={false}
      scroll={{ y: 330 }}
      rowKey="table"
      dataSource={preview.items}
      expandable={{
        rowExpandable: item => item.plan.statements.length > 0,
        expandedRowRender: item => (
          <Collapse
            ghost
            size="small"
            defaultActiveKey={['sql']}
            items={[{
              key: 'sql',
              label: `${item.plan.mode === 'create' ? '创建' : '变更'} SQL（${item.plan.statements.length} 条）`,
              children: (
                <pre className="database-tool-preview__sql">
                  {item.plan.statements.join(';\n\n')}
                </pre>
              ),
            }]}
          />
        ),
      }}
      columns={[
        { title: '表', dataIndex: 'table', width: 220, ellipsis: true },
        {
          title: '模式',
          dataIndex: 'targetExists',
          width: 100,
          render: exists => exists ? '变更' : '创建',
        },
        {
          title: 'SQL',
          dataIndex: ['plan', 'statements'],
          width: 80,
          render: statements => `${statements.length} 条`,
        },
        {
          title: '状态',
          dataIndex: 'status',
          width: 100,
          render: statusTag,
        },
        {
          title: '风险与提示',
          dataIndex: 'warnings',
          render: warningsCell,
        },
      ]}
    />
  )
}

export default function DatabaseToolPreview({
  mode,
  preview,
}: DatabaseToolPreviewProps) {
  const warnings = preview.warnings
  const blocked = preview.items.filter(item => item.status === 'blocked').length
  return (
    <div className="database-tool-preview">
      <Alert
        showIcon
        type={blocked > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'success'}
        message={
          blocked > 0
            ? `${blocked} 张表未通过预检查，任务不能执行`
            : `预检查完成，共 ${preview.items.length} 张表`
        }
        description={warnings.join('；') || '所有检查项均已通过'}
      />
      {mode === 'transfer' && (
        <TransferPreviewTable preview={preview as DataTransferPreview} />
      )}
      {mode === 'dataSync' && (
        <DataSyncPreviewTable preview={preview as DataSyncPreview} />
      )}
      {mode === 'structureSync' && (
        <StructurePreviewTable preview={preview as StructureSyncPreview} />
      )}
    </div>
  )
}
