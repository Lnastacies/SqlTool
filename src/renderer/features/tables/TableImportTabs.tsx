import React, { useMemo } from 'react'
import { Select, Table, Typography } from 'antd'
import type {
  TableFieldMetadata,
  TableImportPreview,
} from '../../types'
import {
  formatPreviewValue,
  type TableImportMappingDraft,
} from './tableTransferModel'
import TableDataPreviewTable from './TableDataPreviewTable'

const { Text } = Typography

interface TableImportTabsProps {
  fields: TableFieldMetadata[]
  preview: TableImportPreview
  mappings: TableImportMappingDraft[]
  onMappingsChange: (mappings: TableImportMappingDraft[]) => void
}

/**
 * 导入第二步：字段映射与数据预览（上下分栏）。
 * 上方为映射表，下方为数据预览，各自独立滚动，
 * 用户配置映射时可直接对照下方样例数据。
 */
export default function TableImportTabs({
  fields,
  preview,
  mappings,
  onMappingsChange,
}: TableImportTabsProps) {
  const selectedTargets = useMemo(
    () => new Set(mappings.flatMap(mapping => (
      mapping.target ? [mapping.target] : []
    ))),
    [mappings],
  )
  const fieldOptions = fields.map(field => ({
    value: field.name,
    label: `${field.name}  ·  ${field.type}${
      field.auto_increment ? '  ·  自增' : ''
    }`,
  }))

  return (
    <div className="table-import-mapping">
      {/* 上栏：字段映射表 */}
      <div className="table-import-mapping__panel">
        <Text type="secondary" className="table-import-mapping__title">
          字段映射（{mappings.filter(item => item.target).length}/{mappings.length}）
        </Text>
        <Table
          size="small"
          rowKey="source"
          pagination={false}
          scroll={{ y: 200 }}
          dataSource={mappings}
          columns={[
            {
              title: '源字段',
              dataIndex: 'source',
              width: 200,
              ellipsis: true,
            },
            {
              title: '样例值',
              key: 'sample',
              ellipsis: true,
              render: (_, mapping) => {
                const sampleRow = preview.rows.find(row => (
                  Object.prototype.hasOwnProperty.call(row, mapping.source)
                ))
                const value = sampleRow?.[mapping.source]
                return (
                  <span title={formatPreviewValue(value)}>
                    {formatPreviewValue(value)}
                  </span>
                )
              },
            },
            {
              title: '目标字段',
              dataIndex: 'target',
              width: 280,
              render: (target, _mapping, index) => (
                <Select
                  size="small"
                  allowClear
                  showSearch
                  value={target}
                  placeholder="不导入此字段"
                  optionFilterProp="label"
                  options={fieldOptions.map(option => ({
                    ...option,
                    disabled: (
                      option.value !== target
                      && selectedTargets.has(option.value)
                    ),
                  }))}
                  onChange={value => onMappingsChange(
                    mappings.map((item, itemIndex) => (
                      itemIndex === index
                        ? { ...item, target: value }
                        : item
                    )),
                  )}
                />
              ),
            },
          ]}
        />
      </div>

      {/* 下栏：数据预览，与映射表独立滚动 */}
      <div className="table-import-mapping__preview">
        <Text type="secondary" className="table-import-mapping__title">
          数据预览（前 8 行）
        </Text>
        <TableDataPreviewTable preview={preview} maxRows={8} height={180} />
      </div>
    </div>
  )
}
