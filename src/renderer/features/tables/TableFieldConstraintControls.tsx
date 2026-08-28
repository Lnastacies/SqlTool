import React from 'react'
import {
  Checkbox,
  Tooltip,
} from 'antd'
import type { DatabaseType } from '../../types'
import {
  supportsAutoIncrement,
  type TableFieldDraft,
} from './tableDesignerModel'

interface FieldConstraintProps {
  field: TableFieldDraft
  onChange: (patch: Partial<TableFieldDraft>) => void
}

export function FieldNotNullToggle({
  field,
  onChange,
}: FieldConstraintProps) {
  return (
    <Checkbox
      checked={field.notNull}
      disabled={field.primary}
      onChange={event => onChange({ notNull: event.target.checked })}
    />
  )
}

export function FieldPrimaryToggle({
  field,
  onChange,
}: FieldConstraintProps) {
  return (
    <Checkbox
      checked={field.primary}
      onChange={event => onChange({
        primary: event.target.checked,
        notNull: event.target.checked || field.notNull,
        autoIncrement: event.target.checked ? field.autoIncrement : false,
      })}
    />
  )
}

interface FieldAutoIncrementToggleProps extends FieldConstraintProps {
  databaseType: DatabaseType
}

export function FieldAutoIncrementToggle({
  databaseType,
  field,
  onChange,
}: FieldAutoIncrementToggleProps) {
  const supported = supportsAutoIncrement(databaseType, field.type)

  return (
    <Tooltip
      title={supported
        ? '自动递增字段会同时设为主键和非空'
        : '当前数据类型不支持自动递增'}
    >
      <span>
        <Checkbox
          checked={field.autoIncrement}
          disabled={!field.autoIncrement && !supported}
          onChange={event => onChange({
            autoIncrement: event.target.checked,
            primary: event.target.checked || field.primary,
            notNull: event.target.checked || field.notNull,
          })}
        />
      </span>
    </Tooltip>
  )
}
