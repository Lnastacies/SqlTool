import React from 'react'
import { Empty, Table } from 'antd'
import type { TableImportPreview } from '../../types'
import { formatPreviewValue } from './tableTransferModel'

interface TableDataPreviewTableProps {
  /** 导入预览数据 */
  preview: TableImportPreview
  /** 最多展示的列数 */
  maxColumns?: number
  /** 最多展示的行数 */
  maxRows?: number
  /** 表格高度（含表头） */
  height?: number
  /** 列宽 */
  columnWidth?: number
}

/**
 * 可复用的数据预览表格组件。
 * 用于导入向导各步骤中展示解析后的样例数据，
 * 让用户在调整格式或确认映射时直接对照实际数据。
 */
export default function TableDataPreviewTable({
  preview,
  maxColumns = 10,
  maxRows = 8,
  height = 200,
  columnWidth = 140,
}: TableDataPreviewTableProps) {
  // 无数据时展示空状态，避免渲染空表格
  if (preview.columns.length === 0 || preview.rows.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可预览数据" style={{ margin: '12px 0' }} />
  }

  const columns = preview.columns.slice(0, maxColumns).map(column => ({
    title: column,
    dataIndex: column,
    key: column,
    width: columnWidth,
    ellipsis: true,
    render: (value: unknown) => (
      <span title={formatPreviewValue(value)}>
        {formatPreviewValue(value)}
      </span>
    ),
  }))

  const rows = preview.rows.slice(0, maxRows).map((row, index) => ({
    ...row,
    __preview_key: index,
  }))

  const truncated = preview.columns.length > maxColumns

  return (
    <div className="table-data-preview">
      {truncated && (
        <div className="table-data-preview__hint">
          仅展示前 {maxColumns} 个字段（共 {preview.columns.length} 个），所有字段可在映射步骤中配置。
        </div>
      )}
      <Table
        size="small"
        rowKey="__preview_key"
        pagination={false}
        scroll={{ x: 'max-content', y: height - (truncated ? 26 : 0) }}
        columns={columns}
        dataSource={rows}
      />
    </div>
  )
}
