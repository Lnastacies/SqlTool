import React from 'react'
import { Pagination } from 'antd'
import TableOutlined from '@ant-design/icons/TableOutlined'

interface DataWorkspaceFooterProps {
  database: string
  objectName: string
  page: number
  pageSize: number
  total: number
  filterCount: number
  selectedCount: number
  pendingCount: number
  editable: boolean
  onPageChange: (page: number, pageSize: number) => void
}

export default function DataWorkspaceFooter({
  database,
  objectName,
  page,
  pageSize,
  total,
  filterCount,
  selectedCount,
  pendingCount,
  editable,
  onPageChange,
}: DataWorkspaceFooterProps) {
  return (
    <div className="data-workspace__footer">
      <div className="data-workspace__footer-context">
        <TableOutlined />
        <span
          className="data-workspace__footer-object"
          title={`${database}.${objectName}`}
        >
          {database}.{objectName}
        </span>
        <span className="data-workspace__footer-divider" />
        <span className={editable ? 'status-editable' : 'status-readonly'}>
          {editable ? '可编辑' : '只读'}
        </span>
        {selectedCount > 0 && <span>已选 {selectedCount}</span>}
        {pendingCount > 0 && (
          <span className="status-pending">待提交 {pendingCount}</span>
        )}
        {filterCount > 0 && <span>筛选 {filterCount}</span>}
      </div>

      <Pagination
        className="data-workspace__pagination"
        current={page}
        pageSize={pageSize}
        total={total}
        size="small"
        showLessItems
        showSizeChanger
        pageSizeOptions={[20, 50, 100, 200, 500]}
        showTotal={(count, range) => (
          count > 0 ? `${range[0]}-${range[1]} / ${count}` : '0 条'
        )}
        onChange={onPageChange}
      />
    </div>
  )
}
