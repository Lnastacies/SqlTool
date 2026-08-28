import React from 'react'
import { Input, Select } from 'antd'
import { formatEditorValue } from './cellEditorUtils'
import type { CellEditorKind } from './cellEditorUtils'

interface DataFilterValueInputProps {
  disabled: boolean
  kind: CellEditorKind
  enumOptions: string[]
  value: unknown
  onChange: (value: unknown) => void
}

export default function DataFilterValueInput({
  disabled,
  kind,
  enumOptions,
  value,
  onChange,
}: DataFilterValueInputProps) {
  if (kind === 'boolean') {
    return (
      <Select
        size="small"
        disabled={disabled}
        value={value}
        options={[
          { value: true, label: 'TRUE' },
          { value: false, label: 'FALSE' },
        ]}
        onChange={onChange}
      />
    )
  }
  if (kind === 'enum') {
    return (
      <Select
        size="small"
        disabled={disabled}
        value={value}
        options={enumOptions.map(option => ({
          value: option,
          label: option,
        }))}
        onChange={onChange}
      />
    )
  }
  return (
    <Input
      size="small"
      disabled={disabled}
      type={kind === 'date' || kind === 'time' ? kind : 'text'}
      value={formatEditorValue(value)}
      placeholder={disabled ? '无需输入值' : '输入筛选值'}
      onChange={event => onChange(event.target.value)}
    />
  )
}
