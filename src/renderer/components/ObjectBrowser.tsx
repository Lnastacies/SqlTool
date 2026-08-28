import React, { useEffect, useMemo, useState } from 'react'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import {
  DATABASE_OBJECT_ACTIONS,
  DATABASE_OBJECT_CATEGORY_ICONS,
  type DatabaseObjectAction,
} from '../features/database-objects/databaseObjectPresentation'
import {
  getDatabaseObjectCategoryDefinition,
  getDatabaseObjectItems,
  type DatabaseObjectCategory,
  type DatabaseObjectSelection,
  type DatabaseObjects,
} from '../features/database-objects/databaseObjectModel'
import BackupDetailsPanel from '../features/backups/BackupDetailsPanel'
import type {
  DatabaseBackupVerification,
} from '../features/backups/databaseBackupActionSupport'
import TableStructurePanel from '../features/tables/TableStructurePanel'
import type { DatabaseBackupRecord, TableMetadata } from '../types'
import DatabaseObjectCatalog from './DatabaseObjectCatalog'

interface ObjectBrowserProps {
  connectionId: string
  database: string
  category: DatabaseObjectCategory
  objects: DatabaseObjects
  backupRecords: DatabaseBackupRecord[]
  backupVerification: Record<string, DatabaseBackupVerification>
  loading: boolean
  selectedObject: DatabaseObjectSelection | null
  onOpenTable: (tableName: string) => void
  onTableAction: (
    action: DatabaseObjectAction,
    tableName?: string,
  ) => void
  onObjectAction: (
    action: DatabaseObjectAction,
    selection?: DatabaseObjectSelection,
  ) => void
  onLoadTableMetadata: (
    connectionId: string,
    database: string,
    tableName: string,
  ) => Promise<TableMetadata>
  tableStructureRevision: number
  onSelectObject: (selection: DatabaseObjectSelection) => void
  onNewQuery: () => void
  onUnavailable: (label: string) => void
}

function ObjectBrowser({
  connectionId,
  database,
  category,
  objects,
  backupRecords,
  backupVerification,
  loading,
  selectedObject,
  onOpenTable,
  onTableAction,
  onObjectAction,
  onLoadTableMetadata,
  tableStructureRevision,
  onSelectObject,
  onNewQuery,
  onUnavailable,
}: ObjectBrowserProps) {
  const [searchText, setSearchText] = useState('')
  const definition = getDatabaseObjectCategoryDefinition(category)
  const selected = selectedObject?.category === category
    ? selectedObject
    : null

  useEffect(() => setSearchText(''), [category, database])

  const items = useMemo(() => {
    const categoryItems = getDatabaseObjectItems(objects, category).map(item => {
      if (item.kind !== 'backup') return item
      const record = backupRecords.find(
        backup => backup.fileName === item.name,
      )
      return { ...item, id: record?.id }
    })
    const keyword = searchText.trim().toLowerCase()
    return keyword
      ? categoryItems.filter(item =>
        item.name.toLowerCase().includes(keyword),
      )
      : categoryItems
  }, [backupRecords, category, objects, searchText])

  const executeAction = (action: DatabaseObjectAction) => {
    if (category === 'tables' && action.id === 'open' && selected) {
      onOpenTable(selected.name)
      return
    }
    if (category === 'tables') {
      onTableAction(action, selected?.name)
      return
    }
    if (category === 'queries' && action.id === 'create') {
      onNewQuery()
      return
    }
    onObjectAction(action, selected || undefined)
  }

  const executeTableAction = (
    actionId: DatabaseObjectAction['id'],
    tableName: string,
  ) => {
    const action = DATABASE_OBJECT_ACTIONS.tables.find(
      item => item.id === actionId,
    )
    if (action) onTableAction(action, tableName)
  }
  const selectedTable = category === 'tables' && selected?.kind === 'table'
    ? selected.name
    : undefined
  const selectedBackup = category === 'backups' && selected
    ? backupRecords.find(record => (
      selected.id ? record.id === selected.id : record.fileName === selected.name
    ))
    : undefined
  const bodyClassName = [
    'object-browser__body',
    category === 'tables' ? 'object-browser__body--tables' : '',
    category === 'backups' ? 'object-browser__body--backups' : '',
  ].filter(Boolean).join(' ')

  return (
    <section className="object-browser">
      <div className="object-browser__titlebar">
        <span className={`object-browser__category-icon object-browser__category-icon--${category}`}>
          {DATABASE_OBJECT_CATEGORY_ICONS[category]}
        </span>
        <strong>{definition.label}</strong>
        <span className="object-browser__database">@ {database}</span>
      </div>
      <div className="object-browser__toolbar">
        <div className="object-browser__commands">
          {DATABASE_OBJECT_ACTIONS[category].map(action => (
            <button
              key={action.id}
              type="button"
              aria-label={action.label}
              title={action.label}
              disabled={loading || (action.requiresSelection && !selected)}
              onClick={() => executeAction(action)}
            >
              {action.icon}
              <span className="object-browser__command-label">
                {action.label}
              </span>
            </button>
          ))}
        </div>
        <label className="object-browser__search">
          <SearchOutlined />
          <input
            value={searchText}
            disabled={loading}
            onChange={event => setSearchText(event.target.value)}
            placeholder={`搜索${definition.label}`}
          />
        </label>
      </div>
      <div className={bodyClassName}>
        <DatabaseObjectCatalog
          category={category}
          items={items}
          selected={selected}
          loading={loading}
          categoryLabel={definition.label}
          itemLabel={definition.itemLabel}
          emptyLabel={definition.emptyLabel}
          hasSearch={Boolean(searchText.trim())}
          onSelect={onSelectObject}
          onOpenTable={onOpenTable}
          onUnavailable={onUnavailable}
        />
        {category === 'tables' && (
          <TableStructurePanel
            connectionId={connectionId}
            database={database}
            tableName={selectedTable}
            revision={tableStructureRevision}
            onLoadMetadata={onLoadTableMetadata}
            onOpenData={() => {
              if (selectedTable) onOpenTable(selectedTable)
            }}
            onDesign={() => {
              if (selectedTable) {
                executeTableAction('design', selectedTable)
              }
            }}
          />
        )}
        {category === 'backups' && (
          <BackupDetailsPanel
            record={selectedBackup}
            verification={selectedBackup
              ? backupVerification[selectedBackup.id]
              : undefined}
          />
        )}
      </div>
    </section>
  )
}

export default ObjectBrowser
