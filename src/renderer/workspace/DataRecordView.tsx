import React from 'react'
import { Button, Empty } from 'antd'
import LeftOutlined from '@ant-design/icons/LeftOutlined'
import RightOutlined from '@ant-design/icons/RightOutlined'
import CellValueDisplay from './CellValueDisplay'
import DataCellEditor from './DataCellEditor'
import type { DataGridRow } from './dataEditingTypes'
import type { DataWorkspaceDocument } from './workspaceTypes'

interface DataRecordViewProps {
  document: DataWorkspaceDocument
  rows: DataGridRow[]
  editMode: boolean
  selectedRowKey?: string
  pendingRows: Record<string, unknown>
  deletedRows: Record<string, unknown>
  onSelect: (rowKey: string) => void
  onCellChange: (
    record: DataGridRow,
    column: string,
    value: unknown,
  ) => void
}

export default function DataRecordView({
  document,
  rows,
  editMode,
  selectedRowKey,
  pendingRows,
  deletedRows,
  onSelect,
  onCellChange,
}: DataRecordViewProps) {
  const selectedIndex = Math.max(
    0,
    rows.findIndex(row => row.identity === selectedRowKey),
  )
  const record = rows[selectedIndex]
  const fieldMap = new Map(
    document.fields.flatMap(field => [
      [field.name, field] as const,
      [field.name.toLowerCase(), field] as const,
    ]),
  )

  if (!record) {
    return (
      <div className="data-record-view data-record-view--empty">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有可显示的记录" />
      </div>
    )
  }

  const isDeleted = Boolean(deletedRows[record.identity])
  const isPending = Boolean(pendingRows[record.identity])

  return (
    <div className="data-record-view">
      <div className="data-record-view__navigation">
        <Button
          size="small"
          icon={<LeftOutlined />}
          disabled={selectedIndex <= 0}
          onClick={() => onSelect(rows[selectedIndex - 1].identity)}
        />
        <span>
          记录 {selectedIndex + 1} / {rows.length}
          {record.kind === 'draft' && ' · 新增'}
          {isPending && ' · 已修改'}
          {isDeleted && ' · 待删除'}
        </span>
        <Button
          size="small"
          icon={<RightOutlined />}
          disabled={selectedIndex >= rows.length - 1}
          onClick={() => onSelect(rows[selectedIndex + 1].identity)}
        />
      </div>

      <div className={`data-record-view__fields${
        isDeleted ? ' data-record-view__fields--deleted' : ''
      }`}>
        {document.columns.map(column => {
          const field = fieldMap.get(column) || fieldMap.get(
            column.toLowerCase(),
          )
          const value = record.data[column]
          const usesDefault = (
            record.kind === 'draft'
            && !Object.prototype.hasOwnProperty.call(record.data, column)
          )
          const sampleValue = document.rows.find(row => (
            row[column] !== null && row[column] !== undefined
          ))?.[column]
          return (
            <div className="data-record-field" key={column}>
              <div className="data-record-field__label">
                <span>{column}</span>
                <small>
                  {field?.primary && 'PK · '}
                  {field?.type || '未知类型'}
                  {(field?.not_null || field?.primary) && ' · NN'}
                </small>
              </div>
              <div className="data-record-field__value">
                {editMode && !isDeleted ? (
                  <DataCellEditor
                    value={value}
                    field={field}
                    isDraft={record.kind === 'draft'}
                    sampleValue={sampleValue}
                    onChange={nextValue => onCellChange(
                      record,
                      column,
                      nextValue,
                    )}
                  />
                ) : (
                  <CellValueDisplay
                    value={value}
                    useDefault={usesDefault}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
