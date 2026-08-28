import type { DatabaseObjectCategory } from './databaseObjectModel'

const STORAGE_KEY = 'sqltool.database-object-groups.v1'

export interface DatabaseObjectGroup {
  id: string
  connId: string
  database: string
  category: DatabaseObjectCategory
  name: string
}

type ObjectGroupStorage = Pick<Storage, 'getItem' | 'setItem'>

function isDatabaseObjectGroup(value: unknown): value is DatabaseObjectGroup {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<DatabaseObjectGroup>
  return typeof item.id === 'string'
    && typeof item.connId === 'string'
    && typeof item.database === 'string'
    && typeof item.category === 'string'
    && typeof item.name === 'string'
}

function readAll(storage: ObjectGroupStorage): DatabaseObjectGroup[] {
  const content = storage.getItem(STORAGE_KEY)
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed)
      ? parsed.filter(isDatabaseObjectGroup)
      : []
  } catch {
    return []
  }
}

export function loadDatabaseObjectGroups(
  connId: string,
  database: string,
  storage: ObjectGroupStorage = window.localStorage,
): DatabaseObjectGroup[] {
  return readAll(storage).filter(group => (
    group.connId === connId && group.database === database
  ))
}

export function createDatabaseObjectGroup(
  context: {
    connId: string
    database: string
    category: DatabaseObjectCategory
  },
  inputName: string,
  storage: ObjectGroupStorage = window.localStorage,
): DatabaseObjectGroup {
  const name = inputName.trim()
  if (!name) throw new Error('分组名称不能为空')

  const groups = readAll(storage)
  const duplicated = groups.some(group => (
    group.connId === context.connId
    && group.database === context.database
    && group.category === context.category
    && group.name.toLocaleLowerCase() === name.toLocaleLowerCase()
  ))
  if (duplicated) throw new Error(`分组“${name}”已存在`)

  const group: DatabaseObjectGroup = {
    id: crypto.randomUUID(),
    ...context,
    name,
  }
  storage.setItem(STORAGE_KEY, JSON.stringify([...groups, group]))
  return group
}
