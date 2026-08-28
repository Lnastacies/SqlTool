import React from 'react'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import PlusOutlined from '@ant-design/icons/PlusOutlined'
import { Button, Checkbox, Input, Select, Table } from 'antd'
import {
  createDraftKey,
  type TableFieldDraft,
  type TableIndexDraft,
} from './tableDesignerModel'

interface TableIndexEditorProps {
  fields: TableFieldDraft[]
  indexes: TableIndexDraft[]
  onChange: (indexes: TableIndexDraft[]) => void
}

export default function TableIndexEditor({
  fields,
  indexes,
  onChange,
}: TableIndexEditorProps) {
  const update = (
    key: string,
    patch: Partial<TableIndexDraft>,
  ) => {
    onChange(indexes.map(index => (
      index.key === key ? { ...index, ...patch } : index
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
            ...indexes,
            {
              key: createDraftKey('index'),
              name: `idx_${fields[0]?.name || 'field'}`,
              fields: fields[0]?.name ? [fields[0].name] : [],
              unique: false,
            },
          ])}
        >
          新增索引
        </Button>
        <span>主键由“字段”页统一设置，不需要在此重复创建。</span>
      </div>
      <Table<TableIndexDraft>
        rowKey="key"
        size="small"
        pagination={false}
        scroll={{ y: 390 }}
        dataSource={indexes}
        locale={{ emptyText: '暂无普通索引' }}
        columns={[
          {
            title: '索引名',
            width: 220,
            render: (_, index) => (
              <Input
                size="small"
                value={index.name}
                onChange={event => update(index.key, {
                  name: event.target.value,
                })}
              />
            ),
          },
          {
            title: '字段',
            render: (_, index) => (
              <Select
                mode="multiple"
                size="small"
                value={index.fields}
                options={fieldOptions}
                placeholder="选择索引字段"
                onChange={value => update(index.key, { fields: value })}
              />
            ),
          },
          {
            title: '唯一',
            width: 80,
            align: 'center',
            render: (_, index) => (
              <Checkbox
                checked={index.unique}
                onChange={event => update(index.key, {
                  unique: event.target.checked,
                })}
              />
            ),
          },
          {
            title: '操作',
            width: 70,
            align: 'center',
            render: (_, index) => (
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onChange(
                  indexes.filter(item => item.key !== index.key),
                )}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
