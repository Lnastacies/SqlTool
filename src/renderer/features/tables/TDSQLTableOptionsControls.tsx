import React from 'react'
import { Form, Select } from 'antd'
import type { TDSQLTableOptions, TableFieldDraft } from './tableDesignerModel'

/** TDSQL 表类型可选项：分表 / 单表 / 广播表 */
const TABLE_TYPE_OPTIONS: Array<{
  label: string
  value: TDSQLTableOptions['tableType']
  description: string
}> = [
  { label: '分表 (shard)', value: 'shard', description: '按 SHARDKEY 分片存储' },
  { label: '单表 (noshard)', value: 'noshard', description: '仅存储于第一个分片' },
  { label: '广播表 (broadcast)', value: 'broadcast', description: '全量数据广播' },
]

interface TDSQLTableOptionsControlsProps {
  /** 当前 TDSQL 选项 */
  value: TDSQLTableOptions
  /** 选项变更回调 */
  onChange: (value: TDSQLTableOptions) => void
  /** 当前 draft 的字段列表，用于 SHARDKEY 候选 */
  fields: TableFieldDraft[]
  /**
   * 是否禁用。
   * 编辑已有表时必须禁用：TDSQL 的表类型/SHARDKEY 属于建表属性，
   * ALTER 语句无法变更，允许修改只会误导用户。
   */
  disabled?: boolean
}

/**
 * TDSQL 表选项控件：表类型 + SHARDKEY 字段选择。
 * 仅在 TDSQL 模式下渲染，SHARDKEY 仅在分表（shard）模式下显示。
 */
export default function TDSQLTableOptionsControls({
  value,
  onChange,
  fields,
  disabled = false,
}: TDSQLTableOptionsControlsProps) {
  // SHARDKEY 候选来自当前草稿的有效字段名
  const shardKeyOptions = fields
    .filter(field => field.name.trim())
    .map(field => ({ label: field.name, value: field.name }))

  // 切换表类型：切换到非 shard 时清空 shardKey，避免残留无效值
  const handleTypeChange = (tableType: TDSQLTableOptions['tableType']) => {
    onChange({
      tableType,
      shardKey: tableType === 'shard' ? value.shardKey : undefined,
    })
  }

  const showShardKey = value.tableType === 'shard'

  return (
    <div className="table-designer__tdsql">
      <Form layout="inline" size="small" disabled={disabled}>
        <Form.Item label="表类型">
          <Select
            size="small"
            style={{ width: 220 }}
            value={value.tableType}
            options={TABLE_TYPE_OPTIONS}
            disabled={disabled}
            onChange={handleTypeChange}
          />
        </Form.Item>
        {showShardKey && (
          <Form.Item
            label="SHARDKEY"
            required
            validateStatus={!disabled && !value.shardKey ? 'error' : undefined}
          >
            <Select
              size="small"
              style={{ width: 220 }}
              placeholder="选择分片字段（必填）"
              value={value.shardKey}
              options={shardKeyOptions}
              allowClear
              disabled={disabled}
              onChange={shardKey => onChange({ ...value, shardKey })}
            />
          </Form.Item>
        )}
        {disabled && (
          <span className="table-designer__tdsql-hint">
            表类型与 SHARDKEY 为建表属性，已有表不支持修改
          </span>
        )}
      </Form>
    </div>
  )
}
