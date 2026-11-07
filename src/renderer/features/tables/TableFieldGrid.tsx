import React from 'react'
import { Input, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { DatabaseType } from '../../types'
import { isMySQLCompatible } from '../mysqlCompat'
import {
  TableDataTypeArgumentInput,
  TableDataTypeScaleInput,
  TableDataTypeSelect,
  TableDataTypeUnsignedToggle,
} from './TableDataTypeControls'
import {
  FieldAutoIncrementToggle,
  FieldNotNullToggle,
  FieldPrimaryToggle,
} from './TableFieldConstraintControls'
import TableFieldActions from './TableFieldActions'
import {
  createDraftKey,
  supportsAutoIncrement,
  type TableFieldDraft,
} from './tableDesignerModel'

interface TableFieldGridProps {
  databaseType: DatabaseType
  fields: TableFieldDraft[]
  onChange: (fields: TableFieldDraft[]) => void
}

export default function TableFieldGrid({
  databaseType,
  fields,
  onChange,
}: TableFieldGridProps) {
  const update = (key: string, patch: Partial<TableFieldDraft>) => {
    onChange(fields.map(field => (
      field.key === key ? { ...field, ...patch } : field
    )))
  }
  const updateType = (field: TableFieldDraft, type: string) => {
    update(field.key, {
      type,
      autoIncrement: field.autoIncrement
        && supportsAutoIncrement(databaseType, type),
    })
  }
  const move = (index: number, offset: number) => {
    const target = index + offset
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    const [field] = next.splice(index, 1)
    next.splice(target, 0, field)
    onChange(next)
  }
  const duplicate = (field: TableFieldDraft, index: number) => {
    const copy: TableFieldDraft = {
      ...field,
      key: createDraftKey('field'),
      originalName: undefined,
      name: `${field.name || 'field'}_copy`,
      primary: false,
      autoIncrement: false,
    }
    const next = [...fields]
    next.splice(index + 1, 0, copy)
    onChange(next)
  }
  const typeControlProps = (field: TableFieldDraft) => ({
    databaseType,
    value: field.type,
    onChange: (value: string) => updateType(field, value),
  })
  const toggleProps = (field: TableFieldDraft) => ({
    field,
    onChange: (patch: Partial<TableFieldDraft>) => update(field.key, patch),
  })

  const columns: ColumnsType<TableFieldDraft> = [
    {
      title: '字段名',
      width: 150,
      render: (_, field) => (
        <Input
          size="small"
          value={field.name}
          onChange={event => update(field.key, { name: event.target.value })}
        />
      ),
    },
    {
      title: '类型',
      width: 170,
      render: (_, field) => <TableDataTypeSelect {...typeControlProps(field)} />,
    },
    {
      title: '长度/精度',
      width: 108,
      render: (_, field) => (
        <TableDataTypeArgumentInput {...typeControlProps(field)} />
      ),
    },
    {
      title: '小数位',
      width: 78,
      render: (_, field) => (
        <TableDataTypeScaleInput {...typeControlProps(field)} />
      ),
    },
  ]
  if (isMySQLCompatible(databaseType)) {
    columns.push({
      title: '无符号',
      width: 62,
      align: 'center',
      render: (_, field) => (
        <TableDataTypeUnsignedToggle {...typeControlProps(field)} />
      ),
    })
  }
  columns.push(
    {
      title: '非空',
      width: 58,
      align: 'center',
      render: (_, field) => <FieldNotNullToggle {...toggleProps(field)} />,
    },
    {
      title: '主键',
      width: 58,
      align: 'center',
      render: (_, field) => <FieldPrimaryToggle {...toggleProps(field)} />,
    },
    {
      title: '自增',
      width: 58,
      align: 'center',
      render: (_, field) => (
        <FieldAutoIncrementToggle
          databaseType={databaseType}
          {...toggleProps(field)}
        />
      ),
    },
    {
      title: '默认值',
      width: 180,
      render: (_, field) => (
        <Input
          size="small"
          value={field.defaultValue}
          disabled={field.autoIncrement}
          placeholder="无默认值"
          onChange={event => update(field.key, {
            defaultValue: event.target.value,
          })}
        />
      ),
    },
    {
      title: '注释',
      width: 180,
      render: (_, field) => (
        <Input
          size="small"
          value={field.comment}
          onChange={event => update(field.key, {
            comment: event.target.value,
          })}
        />
      ),
    },
    {
      title: '操作',
      width: 120,
      fixed: 'right',
      render: (_, field, index) => (
        <TableFieldActions
          index={index}
          fieldCount={fields.length}
          onMove={offset => move(index, offset)}
          onDuplicate={() => duplicate(field, index)}
          onDelete={() => onChange(
            fields.filter(item => item.key !== field.key),
          )}
        />
      ),
    },
  )

  return (
    <Table<TableFieldDraft>
      rowKey="key"
      size="small"
      pagination={false}
      scroll={{ x: isMySQLCompatible(databaseType) ? 1320 : 1260, y: 390 }}
      dataSource={fields}
      columns={columns}
    />
  )
}
