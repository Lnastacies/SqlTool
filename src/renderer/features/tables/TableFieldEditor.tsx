import React from 'react'
import PlusOutlined from '@ant-design/icons/PlusOutlined'
import {
  Button,
  Tag,
} from 'antd'
import type { DatabaseType } from '../../types'
import TableFieldGrid from './TableFieldGrid'
import { TABLE_DATA_TYPE_OPTIONS } from './tableDataTypeCatalog'
import {
  createDefaultField,
  type TableFieldDraft,
} from './tableDesignerModel'

interface TableFieldEditorProps {
  databaseType: DatabaseType
  fields: TableFieldDraft[]
  onChange: (fields: TableFieldDraft[]) => void
}

export default function TableFieldEditor({
  databaseType,
  fields,
  onChange,
}: TableFieldEditorProps) {
  return (
    <div className="table-designer__editor">
      <div className="table-designer__editor-toolbar">
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onChange([
            ...fields,
            {
              ...createDefaultField(databaseType, `field_${fields.length + 1}`),
              primary: false,
              autoIncrement: false,
            },
          ])}
        >
          新增字段
        </Button>
        <div className="table-designer__type-summary">
          <Tag>{databaseType}</Tag>
          <span>
            已加载 {TABLE_DATA_TYPE_OPTIONS[databaseType].length} 种方言类型，
            也可输入自定义类型
          </span>
        </div>
        <span className="table-designer__default-tip">
          默认值按 SQL 表达式填写，如 <code>CURRENT_TIMESTAMP</code>
        </span>
      </div>
      <TableFieldGrid
        databaseType={databaseType}
        fields={fields}
        onChange={onChange}
      />
    </div>
  )
}
