import React from 'react'
import LoadingOutlined from '@ant-design/icons/LoadingOutlined'
import {
  DATABASE_OBJECT_CATEGORY_ICONS,
  DATABASE_OBJECT_KIND_ICONS,
} from '../features/database-objects/databaseObjectPresentation'
import type {
  DatabaseObjectCategory,
  DatabaseObjectSelection,
} from '../features/database-objects/databaseObjectModel'

interface DatabaseObjectCatalogProps {
  category: DatabaseObjectCategory
  items: DatabaseObjectSelection[]
  selected: DatabaseObjectSelection | null
  loading: boolean
  categoryLabel: string
  itemLabel: string
  emptyLabel: string
  hasSearch: boolean
  onSelect: (selection: DatabaseObjectSelection) => void
  onOpenTable: (tableName: string) => void
  onUnavailable: (label: string) => void
}

export default function DatabaseObjectCatalog({
  category,
  items,
  selected,
  loading,
  categoryLabel,
  itemLabel,
  emptyLabel,
  hasSearch,
  onSelect,
  onOpenTable,
  onUnavailable,
}: DatabaseObjectCatalogProps) {
  return (
    <div className="object-browser__catalog">
      <div
        className="object-browser__list"
        role="list"
        aria-busy={loading}
      >
        {items.map(item => (
          <button
            className={`object-row${
              (item.id && selected?.id === item.id)
              || (!item.id && selected?.name === item.name)
                ? ' object-row--selected'
                : ''
            }`}
            key={item.id || `${item.kind}-${item.name}`}
            type="button"
            role="listitem"
            onClick={() => onSelect(item)}
            onDoubleClick={() => {
              if (item.kind === 'table') {
                onOpenTable(item.name)
              } else {
                onUnavailable(`打开${itemLabel}`)
              }
            }}
          >
            <span className={`object-row__icon object-row__icon--${item.kind}`}>
              {DATABASE_OBJECT_KIND_ICONS[item.kind]}
            </span>
            <span className="object-row__name">{item.name}</span>
            {item.kind === 'procedure' && (
              <span className="object-row__kind">存储过程</span>
            )}
          </button>
        ))}
        {items.length === 0 && (
          <div className="object-browser__empty">
            <span
              className={`object-browser__empty-icon${loading ? ' object-browser__empty-icon--loading' : ''}`}
              aria-hidden="true"
            >
              {loading
                ? <LoadingOutlined spin />
                : DATABASE_OBJECT_CATEGORY_ICONS[category]}
            </span>
            <span>
              {loading
                ? `正在加载${categoryLabel}...`
                : hasSearch
                  ? '没有匹配的对象'
                  : emptyLabel}
            </span>
          </div>
        )}
      </div>
      <div className="object-browser__summary">
        {loading ? '正在读取数据库对象' : `${items.length} 个${itemLabel}`}
      </div>
    </div>
  )
}
