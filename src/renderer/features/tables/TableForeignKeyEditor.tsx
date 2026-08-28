import React from 'react'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import PlusOutlined from '@ant-design/icons/PlusOutlined'
import { Button, Input, Select, Table } from 'antd'
import {
  createDraftKey,
  type TableFieldDraft,
  type TableForeignKeyDraft,
} from './tableDesignerModel'

interface TableForeignKeyEditorProps {
  fields: TableFieldDraft[]
  foreignKeys: TableForeignKeyDraft[]
  onChange: (foreignKeys: TableForeignKeyDraft[]) => void
}

function splitFields(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

export default function TableForeignKeyEditor({
  fields,
  foreignKeys,
  onChange,
}: TableForeignKeyEditorProps) {
  const update = (
    key: string,
    patch: Partial<TableForeignKeyDraft>,
  ) => {
    onChange(foreignKeys.map(foreignKey => (
      foreignKey.key === key ? { ...foreignKey, ...patch } : foreignKey
    )))
  }
  const fieldOptions = fields
    .filter(field => field.name.trim())
    .map(field => ({ label: field.name, value: field.name }))

  return (
    <div className="table-designer__editor">
      <div className="table-designer__editor-toolbar">
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onChange([
            ...foreignKeys,
            {
              key: createDraftKey('foreign-key'),
              name: `fk_${fields[0]?.name || 'field'}`,
              fields: fields[0]?.name ? [fields[0].name] : [],
              referencedTable: '',
              referencedFields: ['id'],
            },
          ])}
        >
          新增外键
        </Button>
        <span>组合外键的本地字段与引用字段数量必须一致。</span>
      </div>
      <Table<TableForeignKeyDraft>
        rowKey="key"
        size="small"
        pagination={false}
        scroll={{ x: 850, y: 390 }}
        dataSource={foreignKeys}
        locale={{ emptyText: '暂无外键' }}
        columns={[
          {
            title: '外键名',
            width: 190,
            render: (_, foreignKey) => (
              <Input
                size="small"
                value={foreignKey.name}
                onChange={event => update(foreignKey.key, {
                  name: event.target.value,
                })}
              />
            ),
          },
          {
            title: '本地字段',
            width: 240,
            render: (_, foreignKey) => (
              <Select
                mode="multiple"
                size="small"
                value={foreignKey.fields}
                options={fieldOptions}
                onChange={value => update(foreignKey.key, { fields: value })}
              />
            ),
          },
          {
            title: '引用表',
            width: 190,
            render: (_, foreignKey) => (
              <Input
                size="small"
                value={foreignKey.referencedTable}
                onChange={event => update(foreignKey.key, {
                  referencedTable: event.target.value,
                })}
              />
            ),
          },
          {
            title: '引用字段（逗号分隔）',
            render: (_, foreignKey) => (
              <Input
                size="small"
                value={foreignKey.referencedFields.join(', ')}
                onChange={event => update(foreignKey.key, {
                  referencedFields: splitFields(event.target.value),
                })}
              />
            ),
          },
          {
            title: '操作',
            width: 70,
            fixed: 'right',
            align: 'center',
            render: (_, foreignKey) => (
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onChange(
                  foreignKeys.filter(item => item.key !== foreignKey.key),
                )}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
