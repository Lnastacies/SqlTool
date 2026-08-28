import type { ConnectionTreeItem } from '../connections/connectionTree'
import type { DatabaseObjectGroup } from './databaseObjectGroupStore'

export const DATABASE_OBJECT_CATEGORIES = [
  'tables',
  'views',
  'functions',
  'events',
  'queries',
  'reports',
  'backups',
] as const

export type DatabaseObjectCategory =
  typeof DATABASE_OBJECT_CATEGORIES[number]

export type DatabaseObjectKind =
  | 'table'
  | 'view'
  | 'function'
  | 'procedure'
  | 'event'
  | 'query'
  | 'report'
  | 'backup'

export interface DatabaseObjects {
  tables: string[]
  views: string[]
  functions: string[]
  procedures: string[]
  events: string[]
  queries: string[]
  reports: string[]
  backups: string[]
}

export interface DatabaseObjectItem {
  id?: string
  name: string
  kind: DatabaseObjectKind
  category: DatabaseObjectCategory
}

export interface DatabaseObjectSelection extends DatabaseObjectItem {}

export interface DatabaseObjectCategoryDefinition {
  category: DatabaseObjectCategory
  label: string
  itemLabel: string
  emptyLabel: string
}

export const DATABASE_OBJECT_CATEGORY_DEFINITIONS:
  DatabaseObjectCategoryDefinition[] = [
  { category: 'tables', label: '表', itemLabel: '表', emptyLabel: '该数据库暂无表' },
  { category: 'views', label: '视图', itemLabel: '视图', emptyLabel: '该数据库暂无视图' },
  { category: 'functions', label: '函数', itemLabel: '函数', emptyLabel: '该数据库暂无函数或存储过程' },
  { category: 'events', label: '事件', itemLabel: '事件', emptyLabel: '该数据库暂无事件' },
  { category: 'queries', label: '查询', itemLabel: '查询', emptyLabel: '暂无已保存查询' },
  { category: 'reports', label: '报表', itemLabel: '报表', emptyLabel: '暂无报表' },
  { category: 'backups', label: '备份', itemLabel: '备份', emptyLabel: '暂无备份记录' },
]

export function createEmptyDatabaseObjects(): DatabaseObjects {
  return {
    tables: [],
    views: [],
    functions: [],
    procedures: [],
    events: [],
    queries: [],
    reports: [],
    backups: [],
  }
}

export function getDatabaseObjectCategoryDefinition(
  category: DatabaseObjectCategory,
): DatabaseObjectCategoryDefinition {
  return DATABASE_OBJECT_CATEGORY_DEFINITIONS.find(
    item => item.category === category,
  )!
}

export function getDatabaseObjectItems(
  objects: DatabaseObjects,
  category: DatabaseObjectCategory,
): DatabaseObjectItem[] {
  if (category === 'functions') {
    return [
      ...objects.functions.map(name => ({
        name,
        category,
        kind: 'function' as const,
      })),
      ...objects.procedures.map(name => ({
        name,
        category,
        kind: 'procedure' as const,
      })),
    ]
  }

  const kindMap: Record<
    Exclude<DatabaseObjectCategory, 'functions'>,
    Exclude<DatabaseObjectKind, 'function' | 'procedure'>
  > = {
    tables: 'table',
    views: 'view',
    events: 'event',
    queries: 'query',
    reports: 'report',
    backups: 'backup',
  }
  const kind = kindMap[category]
  return objects[category].map(name => ({ name, category, kind }))
}

export function databaseObjectCategoryTreeKey(
  connId: string,
  database: string,
  category: DatabaseObjectCategory,
): string {
  return `database:${connId}:${database}:category:${category}`
}

export function databaseBackupTreeKey(
  connId: string,
  database: string,
  backupId: string,
): string {
  return `database-backup:${connId}:${database}:${backupId}`
}

export function databaseObjectTreeKey(
  connId: string,
  database: string,
  kind: DatabaseObjectKind,
  index: number,
  name: string,
): string {
  return [
    'database-object',
    connId,
    database,
    kind,
    index,
    encodeURIComponent(name),
  ].join(':')
}

interface BackupTreeRecord {
  id: string
  name: string
  fileName: string
}

function databaseObjectTreeNode(
  connId: string,
  database: string,
  item: DatabaseObjectItem,
  index: number,
  backupsByFileName: Map<string, BackupTreeRecord>,
): ConnectionTreeItem {
  const backup = item.kind === 'backup'
    ? backupsByFileName.get(item.name)
    : undefined
  return {
    key: backup
      ? databaseBackupTreeKey(connId, database, backup.id)
      : databaseObjectTreeKey(
        connId,
        database,
        item.kind,
        index,
        item.name,
      ),
    title: item.name,
    type: item.kind,
    objectCategory: item.category,
    objectKind: item.kind,
    objectId: backup?.id,
    objectName: backup?.name,
    connId,
    database,
  }
}

export function buildDatabaseObjectTree(
  connId: string,
  database: string,
  objects: DatabaseObjects,
  groups: DatabaseObjectGroup[] = [],
  backupRecords: ReadonlyArray<BackupTreeRecord> = [],
): ConnectionTreeItem[] {
  const backupsByFileName = new Map(
    backupRecords.map(record => [record.fileName, record]),
  )
  return DATABASE_OBJECT_CATEGORY_DEFINITIONS.map(definition => ({
    key: databaseObjectCategoryTreeKey(
      connId,
      database,
      definition.category,
    ),
    title: definition.label,
    type: definition.category,
    objectCategory: definition.category,
    connId,
    database,
    children: [
      ...groups
        .filter(group => group.category === definition.category)
        .map(group => databaseObjectGroupTreeNode(group)),
      ...getDatabaseObjectItems(objects, definition.category).map(
        (item, index) => databaseObjectTreeNode(
          connId,
          database,
          item,
          index,
          backupsByFileName,
        ),
      ),
    ],
  }))
}

export function databaseObjectGroupTreeNode(
  group: DatabaseObjectGroup,
): ConnectionTreeItem {
  return {
    key: `database-object-group:${group.id}`,
    title: group.name,
    type: 'objectGroup',
    objectGroupId: group.id,
    objectCategory: group.category,
    connId: group.connId,
    database: group.database,
    children: [],
  }
}
