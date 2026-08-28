import React from 'react'
import { Tooltip } from 'antd'
import CaretDownOutlined from '@ant-design/icons/CaretDownOutlined'
import CaretUpOutlined from '@ant-design/icons/CaretUpOutlined'
import type {
  TableFieldMetadata,
  TableSortDirection,
} from '../types'

interface DataColumnHeaderProps {
  column: string
  field?: TableFieldMetadata
  primary: boolean
  sortDirection?: TableSortDirection
  onSort: () => void
}

export default function DataColumnHeader({
  column,
  field,
  primary,
  sortDirection,
  onSort,
}: DataColumnHeaderProps) {
  const details = field ? (
    <div className="data-column-tooltip">
      <strong>{field.name}</strong>
      <span>类型：{field.type || '未知'}</span>
      <span>可空：{field.not_null || primary ? '否' : '是'}</span>
      <span>默认值：{formatDefaultValue(field.default)}</span>
      {field.comment && <span>注释：{field.comment}</span>}
    </div>
  ) : column

  return (
    <Tooltip title={details} placement="topLeft" mouseEnterDelay={0.35}>
      <button
        type="button"
        className={`data-column-title${
          sortDirection ? ' data-column-title--sorted' : ''
        }`}
        title={`点击排序：${column}`}
        onClick={onSort}
      >
        <span className="data-column-title__name">
          {primary && (
            <span className="data-primary-key" title="主键">PK</span>
          )}
          <span className="data-column-title__label">{column}</span>
          {(field?.not_null || primary) && (
            <span className="data-column-not-null" title="不允许 NULL">NN</span>
          )}
          <span
            className={`data-column-sort${
              sortDirection ? '' : ' data-column-sort--idle'
            }`}
            aria-label={sortDirection ? `按${sortDirection}排序` : '未排序'}
          >
            {sortDirection === 'asc' && <CaretUpOutlined />}
            {sortDirection === 'desc' && <CaretDownOutlined />}
            {!sortDirection && (
              <>
                <CaretUpOutlined />
                <CaretDownOutlined />
              </>
            )}
          </span>
        </span>
        {field?.type && (
          <span className="data-column-title__type">{field.type}</span>
        )}
      </button>
    </Tooltip>
  )
}

function formatDefaultValue(value: unknown): string {
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
