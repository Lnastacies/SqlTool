import React from 'react'
import { Input, Select } from 'antd'
import type { TableFieldMetadata } from '../types'
import BinaryCellEditor from './BinaryCellEditor'
import CellValueActions from './CellValueActions'
import {
  describeCellEditor,
  formatDateInputValue,
  formatEditorValue,
} from './cellEditorUtils'
import JsonCellEditor from './JsonCellEditor'

interface DataCellEditorProps {
  value: unknown
  field?: TableFieldMetadata
  isDraft: boolean
  sampleValue?: unknown
  onChange: (value: unknown) => void
}

export default function DataCellEditor({
  value,
  field,
  isDraft,
  sampleValue,
  onChange,
}: DataCellEditorProps) {
  const descriptor = describeCellEditor(field, value)
  const allowNull = !field?.not_null && !field?.primary
  const valueState = value === undefined && isDraft
    ? 'default'
    : value === null
      ? 'null'
      : 'value'

  const renderEditor = () => {
    if (descriptor.kind === 'binary') {
      return <BinaryCellEditor value={value} onChange={onChange} />
    }
    if (descriptor.kind === 'json') {
      return <JsonCellEditor value={value} onChange={onChange} />
    }
    if (descriptor.kind === 'boolean') {
      return (
        <Select
          size="small"
          value={booleanToken(value)}
          placeholder={valueState === 'default' ? 'DEFAULT' : 'NULL'}
          className="data-cell-editor data-cell-editor--boolean"
          options={[
            { value: 'true', label: 'TRUE' },
            { value: 'false', label: 'FALSE' },
          ]}
          onChange={next => {
            onChange(booleanStorageValue(next === 'true', sampleValue ?? value))
          }}
        />
      )
    }
    if (descriptor.kind === 'enum') {
      return (
        <Select
          size="small"
          showSearch
          value={value === null || value === undefined ? undefined : String(value)}
          placeholder={valueState === 'default' ? 'DEFAULT' : 'NULL'}
          className="data-cell-editor data-cell-editor--enum"
          options={descriptor.enumOptions.map(option => ({
            value: option,
            label: option,
          }))}
          onChange={onChange}
        />
      )
    }
    if (
      descriptor.kind === 'date'
      || descriptor.kind === 'time'
      || descriptor.kind === 'datetime'
    ) {
      return (
        <Input
          size="small"
          type={descriptor.kind === 'datetime' ? 'datetime-local' : descriptor.kind}
          step={descriptor.kind === 'date' ? undefined : 1}
          value={formatDateInputValue(value, descriptor.kind)}
          className="data-cell-editor data-cell-editor--temporal"
          onChange={event => {
            const next = descriptor.kind === 'datetime'
              ? event.target.value.replace('T', ' ')
              : event.target.value
            onChange(next)
          }}
        />
      )
    }
    return (
      <Input
        size="small"
        value={formatEditorValue(value)}
        placeholder={valueState === 'default' ? 'DEFAULT' : 'NULL'}
        className="data-cell-editor"
        onChange={event => onChange(event.target.value)}
      />
    )
  }

  return (
    <div
      className={`data-cell-editor-shell data-cell-editor-shell--${valueState}`}
      onKeyDownCapture={event => {
        // 与常见数据库客户端保持一致，Ctrl+0 快速把可空字段设为 NULL。
        if (allowNull && event.ctrlKey && event.key === '0') {
          event.preventDefault()
          onChange(null)
        }
      }}
    >
      <div className="data-cell-editor-shell__control">
        {renderEditor()}
      </div>
      <CellValueActions
        allowNull={allowNull}
        allowDefault={isDraft}
        onSetNull={() => onChange(null)}
        onSetDefault={() => onChange(undefined)}
      />
    </div>
  )
}

function booleanToken(value: unknown): 'true' | 'false' | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase())
      ? 'true'
      : 'false'
  }
  return value ? 'true' : 'false'
}

function booleanStorageValue(value: boolean, sampleValue: unknown): unknown {
  // SQLite 常以 0/1 返回布尔字段，保持列内既有存储类型可避免绑定失败。
  if (typeof sampleValue === 'number') {
    return value ? 1 : 0
  }
  if (typeof sampleValue === 'string') {
    const normalized = sampleValue.toLowerCase()
    if (['0', '1'].includes(normalized)) {
      return value ? '1' : '0'
    }
    if (['true', 'false'].includes(normalized)) {
      return value ? 'true' : 'false'
    }
  }
  return value
}
