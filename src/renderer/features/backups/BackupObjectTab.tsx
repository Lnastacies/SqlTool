import React, { useMemo, useState } from 'react'
import { Checkbox, Empty, Input } from 'antd'
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined'
import EyeOutlined from '@ant-design/icons/EyeOutlined'
import FunctionOutlined from '@ant-design/icons/FunctionOutlined'
import PlayCircleOutlined from '@ant-design/icons/PlayCircleOutlined'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import TableOutlined from '@ant-design/icons/TableOutlined'
import type {
  DatabaseBackupScope,
  DatabaseModel,
} from '../../types'

type ScopeKey = keyof DatabaseBackupScope

interface BackupObjectTabProps {
  model?: DatabaseModel
  scope: DatabaseBackupScope
  dataOnly: boolean
  disabled: boolean
  onChange: (scope: DatabaseBackupScope) => void
}

const groupMeta: Array<{
  key: ScopeKey
  label: string
  icon: React.ReactNode
}> = [
  { key: 'tables', label: '表', icon: <TableOutlined /> },
  { key: 'views', label: '视图', icon: <EyeOutlined /> },
  { key: 'functions', label: '函数', icon: <FunctionOutlined /> },
  { key: 'procedures', label: '存储过程', icon: <PlayCircleOutlined /> },
  { key: 'events', label: '事件 / 触发器', icon: <ClockCircleOutlined /> },
]

export default function BackupObjectTab({
  model,
  scope,
  dataOnly,
  disabled,
  onChange,
}: BackupObjectTabProps) {
  const [searchText, setSearchText] = useState('')
  const catalogs = useMemo<DatabaseBackupScope>(() => ({
    tables: model?.tables.map(table => table.name) || [],
    views: model?.views || [],
    functions: model?.functions || [],
    procedures: model?.procedures || [],
    events: model?.events || [],
  }), [model])
  const keyword = searchText.trim().toLocaleLowerCase()

  const updateGroup = (key: ScopeKey, values: string[]) => {
    onChange({ ...scope, [key]: values })
  }

  return (
    <div className="backup-objects">
      <Input
        allowClear
        prefix={<SearchOutlined />}
        value={searchText}
        placeholder="筛选备份对象"
        disabled={disabled}
        onChange={event => setSearchText(event.target.value)}
      />
      <div className="backup-object-groups">
        {groupMeta.map(group => {
          const values = catalogs[group.key]
          const filtered = keyword
            ? values.filter(name => name.toLocaleLowerCase().includes(keyword))
            : values
          const selected = scope[group.key]
          const allChecked = values.length > 0
            && values.every(name => selected.includes(name))
          const partiallyChecked = !allChecked
            && values.some(name => selected.includes(name))
          const groupDisabled = disabled || (dataOnly && group.key !== 'tables')
          return (
            <section key={group.key} className="backup-object-group">
              <header>
                <Checkbox
                  checked={allChecked}
                  indeterminate={partiallyChecked}
                  disabled={groupDisabled || values.length === 0}
                  onChange={event => updateGroup(
                    group.key,
                    event.target.checked ? [...values] : [],
                  )}
                >
                  <span className="backup-object-group__title">
                    {group.icon}
                    <strong>{group.label}</strong>
                    <small>{selected.length}/{values.length}</small>
                  </span>
                </Checkbox>
              </header>
              {filtered.length > 0 ? (
                <Checkbox.Group
                  value={selected}
                  disabled={groupDisabled}
                  onChange={values => updateGroup(
                    group.key,
                    values.map(String),
                  )}
                >
                  {filtered.map(name => (
                    <Checkbox key={name} value={name} title={name}>
                      {name}
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={keyword ? '无匹配对象' : '暂无对象'}
                />
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
