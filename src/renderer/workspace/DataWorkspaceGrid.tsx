import React, { useRef } from 'react'
import { Table } from 'antd'
import CellValueDisplay from './CellValueDisplay'
import DataColumnHeader from './DataColumnHeader'
import DataCellEditor from './DataCellEditor'
import { describeCellEditor } from './cellEditorUtils'
import type { DataGridRow } from './dataEditingTypes'
import { useDataGridBodyHeight } from './useDataGridBodyHeight'
import type { DataWorkspaceDocument } from './workspaceTypes'

interface DataWorkspaceGridProps {
  document: DataWorkspaceDocument
  rows: DataGridRow[]
  editMode: boolean
  selectedRowKeys: string[]
  pendingRows: Record<string, unknown>
  deletedRows: Record<string, unknown>
  onSelectionChange: (keys: string[]) => void
  onCellChange: (
    record: DataGridRow,
    column: string,
    value: unknown,
  ) => void
  onSortChange: (column: string) => void
}

export default function DataWorkspaceGrid({
  document,
  rows,
  editMode,
  selectedRowKeys,
  pendingRows,
  deletedRows,
  onSelectionChange,
  onCellChange,
  onSortChange,
}: DataWorkspaceGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const bodyHeight = useDataGridBodyHeight(
    gridRef,
    [
      document.id,
      document.columns.join('\u0000'),
      document.pageSize,
      document.total,
    ].join(':'),
    document.id,
  )
  const fieldMap = new Map(
    document.fields.flatMap(field => [
      [field.name, field] as const,
      [field.name.toLowerCase(), field] as const,
    ]),
  )
  const columns = document.columns.map(column => {
    const field = fieldMap.get(column) || fieldMap.get(column.toLowerCase())
    const primary = (
      document.primaryKeys.includes(column)
      || Boolean(field?.primary)
    )
    return {
      title: (
        <DataColumnHeader
          column={column}
          field={field}
          primary={primary}
          sortDirection={document.query.sorts.find(
            sort => sort.field === column,
          )?.direction}
          onSort={() => onSortChange(column)}
        />
      ),
      key: column,
      width: getColumnWidth(field),
      ellipsis: true,
      render: (_value: unknown, record: DataGridRow) => {
        const value = record.data[column]
        const isDraft = record.kind === 'draft'
        const usesDefault = (
          isDraft
          && !Object.prototype.hasOwnProperty.call(record.data, column)
        )
        const sampleValue = document.rows.find(row => (
          row[column] !== null && row[column] !== undefined
        ))?.[column]
        return editMode && !deletedRows[record.identity] ? (
          <DataCellEditor
            value={value}
            field={field}
            isDraft={isDraft}
            sampleValue={sampleValue}
            onChange={nextValue => onCellChange(record, column, nextValue)}
          />
        ) : (
          <CellValueDisplay value={value} useDefault={usesDefault} />
        )
      },
    }
  })

  return (
    <div
      ref={gridRef}
      className="data-workspace__grid-shell"
      style={{
        '--data-grid-body-height': `${bodyHeight}px`,
      } as React.CSSProperties}
    >
      <Table<DataGridRow>
        columns={columns}
        dataSource={rows}
        rowKey={record => record.identity}
        rowSelection={{
          columnWidth: 30,
          selectedRowKeys,
          preserveSelectedRowKeys: true,
          onChange: keys => onSelectionChange(keys.map(String)),
          getCheckboxProps: record => ({
            disabled: Boolean(deletedRows[record.identity]),
          }),
        }}
        rowClassName={record => {
          const classes = []
          if (record.kind === 'draft') classes.push('data-row--inserted')
          if (deletedRows[record.identity]) {
            classes.push('data-row--deleted')
          } else if (pendingRows[record.identity]) {
            classes.push('data-row--modified')
          }
          return classes.join(' ')
        }}
        loading={document.loading}
        bordered
        size="small"
        scroll={{ x: 'max-content', y: bodyHeight }}
        pagination={false}
      />
    </div>
  )
}

function getColumnWidth(
  field: DataWorkspaceDocument['fields'][number] | undefined,
): number {
  const kind = describeCellEditor(field, undefined).kind
  if (kind === 'json' || kind === 'binary') return 220
  if (kind === 'datetime') return 168
  if (kind === 'date' || kind === 'time' || kind === 'enum') return 138
  if (kind === 'boolean') return 104
  return 142
}
