import React, { useMemo, useState } from 'react'
import {
  Button,
  Checkbox,
  Input,
  Radio,
  Space,
  Table,
  Tag,
} from 'antd'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import type {
  DataSyncOptions,
  DataTransferStrategy,
  DatabaseToolMode,
} from '../../types'

interface DatabaseToolTableStepProps {
  mode: DatabaseToolMode
  sourceTables: string[]
  targetTables: string[]
  selectedTables: string[]
  transferStrategy: DataTransferStrategy
  createMissing: boolean
  syncOptions: DataSyncOptions
  onSelectedTablesChange: (tables: string[]) => void
  onTransferStrategyChange: (strategy: DataTransferStrategy) => void
  onCreateMissingChange: (checked: boolean) => void
  onSyncOptionsChange: (options: DataSyncOptions) => void
}

export default function DatabaseToolTableStep({
  mode,
  sourceTables,
  targetTables,
  selectedTables,
  transferStrategy,
  createMissing,
  syncOptions,
  onSelectedTablesChange,
  onTransferStrategyChange,
  onCreateMissingChange,
  onSyncOptionsChange,
}: DatabaseToolTableStepProps) {
  const [filter, setFilter] = useState('')
  const targetSet = useMemo(() => new Set(targetTables), [targetTables])
  const filteredTables = useMemo(() => sourceTables.filter(
    table => table.toLowerCase().includes(filter.trim().toLowerCase()),
  ), [filter, sourceTables])
  const missingTables = sourceTables.filter(table => !targetSet.has(table))

  const toggleOption = (key: keyof DataSyncOptions, checked: boolean) => {
    onSyncOptionsChange({ ...syncOptions, [key]: checked })
  }

  return (
    <div className="database-tool-tables">
      <div className="database-tool-options">
        {mode === 'transfer' && (
          <>
            <span className="database-tool-options__label">写入策略</span>
            <Radio.Group
              value={transferStrategy}
              onChange={event => onTransferStrategyChange(event.target.value)}
            >
              <Radio.Button value="append">追加数据</Radio.Button>
              <Radio.Button value="replace">覆盖目标表数据</Radio.Button>
            </Radio.Group>
            <Checkbox
              checked={createMissing}
              onChange={event => onCreateMissingChange(event.target.checked)}
            >
              自动创建缺失表
            </Checkbox>
          </>
        )}
        {mode === 'dataSync' && (
          <>
            <span className="database-tool-options__label">同步操作</span>
            <Checkbox
              checked={syncOptions.insert}
              onChange={event => toggleOption('insert', event.target.checked)}
            >
              新增
            </Checkbox>
            <Checkbox
              checked={syncOptions.update}
              onChange={event => toggleOption('update', event.target.checked)}
            >
              更新
            </Checkbox>
            <Checkbox
              checked={syncOptions.delete}
              onChange={event => toggleOption('delete', event.target.checked)}
            >
              删除目标多余行
            </Checkbox>
          </>
        )}
        {mode === 'structureSync' && (
          <span className="database-tool-options__note">
            目标端将以源表字段、索引和外键为准，执行前可逐条核对 SQL。
          </span>
        )}
      </div>

      <div className="database-tool-tablebar">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="筛选表名"
          value={filter}
          onChange={event => setFilter(event.target.value)}
        />
        <Space>
          <Button size="small" onClick={() => onSelectedTablesChange(sourceTables)}>
            全选
          </Button>
          <Button size="small" onClick={() => onSelectedTablesChange(missingTables)}>
            仅缺失表
          </Button>
          <Button size="small" onClick={() => onSelectedTablesChange([])}>
            清空
          </Button>
        </Space>
        <span>已选 {selectedTables.length} / {sourceTables.length}</span>
      </div>

      <Table
        size="small"
        pagination={false}
        scroll={{ y: 330 }}
        rowKey="name"
        dataSource={filteredTables.map(name => ({
          name,
          targetExists: targetSet.has(name),
        }))}
        rowSelection={{
          selectedRowKeys: selectedTables,
          onChange: keys => onSelectedTablesChange(keys.map(String)),
        }}
        columns={[
          { title: '源表', dataIndex: 'name', ellipsis: true },
          {
            title: '目标状态',
            dataIndex: 'targetExists',
            width: 130,
            render: exists => exists
              ? <Tag color="blue">已存在</Tag>
              : <Tag color="gold">缺失</Tag>,
          },
        ]}
      />
    </div>
  )
}
