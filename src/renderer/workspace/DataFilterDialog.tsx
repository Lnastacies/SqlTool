import React, { useEffect, useMemo, useState } from 'react'
import { Button, Modal, Radio, Select } from 'antd'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import PlusOutlined from '@ant-design/icons/PlusOutlined'
import type {
  TableDataFilter,
  TableDataQuery,
  TableFieldMetadata,
  TableFilterOperator,
} from '../types'
import { describeCellEditor } from './cellEditorUtils'
import DataFilterValueInput from './DataFilterValueInput'

interface DataFilterDialogProps {
  open: boolean
  fields: TableFieldMetadata[]
  query: TableDataQuery
  onClose: () => void
  onApply: (query: TableDataQuery) => void
}

interface FilterDraft extends TableDataFilter {
  id: number
}

const OPERATOR_OPTIONS: Array<{
  value: TableFilterOperator
  label: string
}> = [
  { value: 'equals', label: '等于' },
  { value: 'notEquals', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'startsWith', label: '开头为' },
  { value: 'endsWith', label: '结尾为' },
  { value: 'greaterThan', label: '大于' },
  { value: 'greaterThanOrEqual', label: '大于等于' },
  { value: 'lessThan', label: '小于' },
  { value: 'lessThanOrEqual', label: '小于等于' },
  { value: 'isNull', label: '为空' },
  { value: 'isNotNull', label: '不为空' },
]

let nextFilterId = 1

export default function DataFilterDialog({
  open,
  fields,
  query,
  onClose,
  onApply,
}: DataFilterDialogProps) {
  const [logic, setLogic] = useState(query.filterLogic)
  const [filters, setFilters] = useState<FilterDraft[]>([])
  const fieldMap = useMemo(
    () => new Map(fields.map(field => [field.name, field])),
    [fields],
  )

  useEffect(() => {
    if (!open) return
    setLogic(query.filterLogic)
    setFilters(query.filters.map(filter => ({
      ...filter,
      id: nextFilterId++,
    })))
  }, [open, query])

  const addFilter = () => {
    if (fields.length === 0 || filters.length >= 20) return
    setFilters(previous => [
      ...previous,
      {
        id: nextFilterId++,
        field: fields[0].name,
        operator: 'equals',
        value: '',
      },
    ])
  }

  const updateFilter = (
    id: number,
    patch: Partial<TableDataFilter>,
  ) => {
    setFilters(previous => previous.map(filter => (
      filter.id === id ? { ...filter, ...patch } : filter
    )))
  }

  return (
    <Modal
      title="条件筛选"
      open={open}
      width={760}
      okText="应用筛选"
      cancelText="取消"
      destroyOnHidden
      onCancel={onClose}
      onOk={() => {
        onApply({
          ...query,
          filterLogic: logic,
          filters: filters.map(({ id: _id, ...filter }) => filter),
        })
      }}
    >
      <div className="data-filter">
        <div className="data-filter__summary">
          <span>匹配以下</span>
          <Radio.Group
            size="small"
            optionType="button"
            buttonStyle="solid"
            value={logic}
            onChange={event => setLogic(event.target.value)}
            options={[
              { label: '全部条件', value: 'and' },
              { label: '任一条件', value: 'or' },
            ]}
          />
          <span>最多可添加 20 个条件</span>
        </div>

        <div className="data-filter__rows">
          {filters.length === 0 && (
            <div className="data-filter__empty">
              尚未设置条件，应用后将显示全部记录。
            </div>
          )}
          {filters.map(filter => {
            const field = fieldMap.get(filter.field)
            const descriptor = describeCellEditor(field, filter.value)
            const needsValue = (
              filter.operator !== 'isNull'
              && filter.operator !== 'isNotNull'
            )
            return (
              <div className="data-filter__row" key={filter.id}>
                <Select
                  size="small"
                  value={filter.field}
                  options={fields.map(item => ({
                    value: item.name,
                    label: item.name,
                  }))}
                  onChange={value => updateFilter(filter.id, {
                    field: value,
                    value: '',
                  })}
                />
                <Select
                  size="small"
                  value={filter.operator}
                  options={OPERATOR_OPTIONS}
                  onChange={value => updateFilter(filter.id, {
                    operator: value,
                  })}
                />
                <DataFilterValueInput
                  disabled={!needsValue}
                  kind={descriptor.kind}
                  enumOptions={descriptor.enumOptions}
                  value={filter.value}
                  onChange={value => updateFilter(filter.id, { value })}
                />
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  title="删除条件"
                  onClick={() => {
                    setFilters(previous => previous.filter(
                      item => item.id !== filter.id,
                    ))
                  }}
                />
              </div>
            )
          })}
        </div>

        <Button
          size="small"
          icon={<PlusOutlined />}
          disabled={fields.length === 0 || filters.length >= 20}
          onClick={addFilter}
        >
          添加条件
        </Button>
      </div>
    </Modal>
  )
}
