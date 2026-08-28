import React from 'react'
import { Button, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableExportObjectMetadata } from '../../types'

const { Text } = Typography

interface TableExportContentStepProps {
  objects: TableExportObjectMetadata[]
  selectedNames: string[]
  columnsByObject: Record<string, string[]>
  onSelectedNamesChange: (names: string[]) => void
  onColumnsChange: (name: string, columns: string[]) => void
}

/**
 * 导出第一步：选择导出对象与字段。
 * 对象列表使用 Table + Checkbox 行选择，
 * 字段选择附带"全选/清空"快捷按钮，减少逐项操作。
 */
export default function TableExportContentStep({
  objects,
  selectedNames,
  columnsByObject,
  onSelectedNamesChange,
  onColumnsChange,
}: TableExportContentStepProps) {
  const selected = new Set(selectedNames)
  const totalFields = selectedNames.reduce(
    (sum, name) => sum + (columnsByObject[name]?.length || 0),
    0,
  )

  return (
    <div className="table-export-content">
      <Table
        size="small"
        rowKey="name"
        pagination={false}
        scroll={{ y: 380 }}
        dataSource={objects}
        rowSelection={{
          selectedRowKeys: selectedNames,
          preserveSelectedRowKeys: true,
          onChange: keys => onSelectedNamesChange(keys.map(String)),
        }}
        columns={[
          {
            title: '对象',
            dataIndex: 'name',
            width: 220,
            ellipsis: true,
            render: (name, object) => (
              <Space size={4} title={name}>
                <Tag color={object.objectType === 'view' ? 'cyan' : 'blue'}>
                  {object.objectType === 'view' ? '视图' : '表'}
                </Tag>
                <span>{name}</span>
              </Space>
            ),
          },
          {
            title: '导出字段',
            key: 'columns',
            render: (_, object) => {
              const current = columnsByObject[object.name] || []
              const isDisabled = !selected.has(object.name)
              return (
                <Space size={6} style={{ width: '100%' }}>
                  <Select
                    mode="multiple"
                    size="small"
                    maxTagCount="responsive"
                    style={{ flex: 1, minWidth: 200 }}
                    disabled={isDisabled}
                    value={current}
                    placeholder="选择导出字段"
                    options={object.columns.map(column => ({
                      value: column,
                      label: column,
                    }))}
                    onChange={columns => onColumnsChange(object.name, columns)}
                  />
                  {/* 快捷操作：全选或清空字段，减少逐项点击 */}
                  <Tooltip title="全选字段">
                    <Button
                      size="small"
                      type="link"
                      disabled={isDisabled}
                      onClick={() => onColumnsChange(object.name, object.columns)}
                    >
                      全选
                    </Button>
                  </Tooltip>
                  {current.length > 0 && (
                    <Tooltip title="清空字段">
                      <Button
                        size="small"
                        type="link"
                        disabled={isDisabled}
                        onClick={() => onColumnsChange(object.name, [])}
                      >
                        清空
                      </Button>
                    </Tooltip>
                  )}
                </Space>
              )
            },
          },
          {
            title: '字段数',
            key: 'count',
            width: 70,
            align: 'right',
            render: (_, object) => {
              const count = (columnsByObject[object.name] || []).length
              return selected.has(object.name)
                ? <Text strong>{count}/{object.columns.length}</Text>
                : <Text type="secondary">-</Text>
            },
          },
        ]}
      />

      {/* 汇总信息条 */}
      <div className="table-export-content__summary">
        <Text type="secondary">
          已选择 <Text strong>{selectedNames.length}</Text> 个对象，
          共 <Text strong>{totalFields}</Text> 个字段
        </Text>
      </div>
    </div>
  )
}
