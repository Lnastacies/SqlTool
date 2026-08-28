import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Empty, Input, List, Modal, Spin, Tag } from 'antd'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import type { DatabaseModel } from '../../types'

export interface DatabaseSearchResult {
  kind: 'table' | 'field' | 'view' | 'function' | 'procedure' | 'event'
  name: string
  parent?: string
  detail: string
}

interface DatabaseSearchDialogProps {
  connId: string
  database: string
  onClose: () => void
  onSelect: (result: DatabaseSearchResult) => void
}

const kindLabels: Record<DatabaseSearchResult['kind'], string> = {
  table: '表',
  field: '字段',
  view: '视图',
  function: '函数',
  procedure: '存储过程',
  event: '事件',
}

function buildSearchIndex(model: DatabaseModel): DatabaseSearchResult[] {
  return [
    ...model.tables.flatMap(table => [
      {
        kind: 'table' as const,
        name: table.name,
        detail: `${table.fields.length} 个字段`,
      },
      ...table.fields.map(field => ({
        kind: 'field' as const,
        name: field.name,
        parent: table.name,
        detail: field.type,
      })),
    ]),
    ...model.views.map(name => ({ kind: 'view' as const, name, detail: '视图' })),
    ...model.functions.map(name => ({ kind: 'function' as const, name, detail: '函数' })),
    ...model.procedures.map(name => ({ kind: 'procedure' as const, name, detail: '存储过程' })),
    ...model.events.map(name => ({ kind: 'event' as const, name, detail: '事件' })),
  ]
}

export default function DatabaseSearchDialog({
  connId,
  database,
  onClose,
  onSelect,
}: DatabaseSearchDialogProps) {
  const [model, setModel] = useState<DatabaseModel>()
  const [keyword, setKeyword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void window.database.getDatabaseModel(connId, database).then(result => {
      if (cancelled) return
      if (!result.success || !result.data) {
        setError(result.error?.detail || result.error?.message || '数据库对象读取失败')
        return
      }
      setModel(result.data)
    }).catch(loadError => {
      if (!cancelled) {
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      }
    })
    return () => {
      cancelled = true
    }
  }, [connId, database])

  const results = useMemo(() => {
    if (!model || !keyword.trim()) return []
    const search = keyword.trim().toLocaleLowerCase()
    return buildSearchIndex(model).filter(item => (
      item.name.toLocaleLowerCase().includes(search)
      || item.parent?.toLocaleLowerCase().includes(search)
    )).slice(0, 300)
  }, [keyword, model])

  return (
    <Modal
      className="database-search-dialog"
      title={`在数据库中查找 - ${database}`}
      open
      width={680}
      destroyOnHidden
      onCancel={onClose}
      footer={null}
    >
      <Input
        value={keyword}
        prefix={<SearchOutlined />}
        placeholder="输入表、字段、视图、函数或事件名称"
        autoFocus
        allowClear
        disabled={!model}
        onChange={event => setKeyword(event.target.value)}
      />
      {!model && !error && (
        <div className="database-search-dialog__loading">
          <Spin size="small" />
          <span>正在建立数据库对象索引...</span>
        </div>
      )}
      {error && <Alert type="error" showIcon message={error} />}
      {model && !keyword.trim() && <Empty description="输入关键字开始查找" />}
      {model && keyword.trim() && (
        <List
          className="database-search-results"
          locale={{ emptyText: '没有匹配的数据库对象' }}
          dataSource={results}
          renderItem={item => (
            <List.Item
              className="database-search-result"
              onClick={() => onSelect(item)}
            >
              <Tag>{kindLabels[item.kind]}</Tag>
              <span className="database-search-result__name">
                {item.parent ? `${item.parent}.${item.name}` : item.name}
              </span>
              <span className="database-search-result__detail">{item.detail}</span>
            </List.Item>
          )}
        />
      )}
    </Modal>
  )
}
