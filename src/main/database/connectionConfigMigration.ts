import { randomUUID } from 'crypto'
import type { ConnectionData } from './adapters'
import type {
  ConnectionCatalog,
  ConnectionGroup,
  LegacyConnectionCatalog,
  PersistedConnectionCatalog,
} from './connectionConfigTypes'

const DATABASE_TYPES = new Set<ConnectionData['type']>([
  'MySQL',
  'PostgreSQL',
  'SQL Server',
  'SQLite',
])

export function normalizeCatalog(input: unknown): ConnectionCatalog {
  if (isCurrentCatalog(input)) {
    return normalizeCurrentCatalog(input)
  }
  return migrateLegacyCatalog((input || {}) as LegacyConnectionCatalog)
}

function normalizeCurrentCatalog(
  input: PersistedConnectionCatalog,
): ConnectionCatalog {
  const groups = normalizeGroups(input.groups)
  const groupIds = new Set(groups.map(group => group.id))
  const connections = input.connections.map((connection, index) => (
    normalizeConnection(connection, connection.name || `连接 ${index + 1}`, groupIds)
  ))
  return { connections: deduplicateConnections(connections), groups }
}

function migrateLegacyCatalog(input: LegacyConnectionCatalog): ConnectionCatalog {
  const groupNames = new Set<string>()
  Object.keys(input.groups || {}).forEach(name => groupNames.add(name))
  Object.values(input.connections || {}).forEach(connection => {
    if (connection.group && connection.group !== '无') {
      groupNames.add(connection.group)
    }
  })

  const groups = Array.from(groupNames)
    .filter(name => name.trim())
    .map(name => ({ id: randomUUID(), name: name.trim() }))
  const groupIdByName = new Map(groups.map(group => [group.name, group.id]))
  const groupByConnectionName = new Map<string, string>()
  Object.entries(input.groups || {}).forEach(([groupName, connectionNames]) => {
    connectionNames.forEach(name => {
      const groupId = groupIdByName.get(groupName)
      if (groupId) groupByConnectionName.set(name, groupId)
    })
  })

  const groupIds = new Set(groups.map(group => group.id))
  const connections = Object.entries(input.connections || {}).map(
    ([storedName, connection]) => normalizeConnection({
      ...connection,
      groupId: groupByConnectionName.get(storedName)
        || groupIdByName.get(connection.group || ''),
    }, storedName, groupIds),
  )
  return { connections: deduplicateConnections(connections), groups }
}

function normalizeConnection(
  input: Partial<ConnectionData>,
  fallbackName: string,
  groupIds: Set<string>,
): ConnectionData {
  const type = DATABASE_TYPES.has(input.type as ConnectionData['type'])
    ? input.type as ConnectionData['type']
    : 'MySQL'
  const groupId = input.groupId && groupIds.has(input.groupId)
    ? input.groupId
    : undefined
  return {
    id: String(input.id || randomUUID()),
    name: String(input.name || fallbackName).trim() || fallbackName,
    type,
    groupId,
    host: type === 'SQLite' ? '' : String(input.host || 'localhost'),
    port: type === 'SQLite' ? 0 : Number(input.port || defaultPort(type)),
    username: type === 'SQLite' ? '' : String(input.username || ''),
    password: String(input.password || ''),
    database: String(input.database || ''),
    timeout: Number(input.timeout || 30),
    charset: String(input.charset || 'utf8mb4'),
    color: normalizeConnectionColor(input.color),
  }
}

function normalizeConnectionColor(input: unknown): string | undefined {
  const value = String(input || '').trim()
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : undefined
}

function normalizeGroups(input: ConnectionGroup[]): ConnectionGroup[] {
  const ids = new Set<string>()
  const names = new Set<string>()
  return (Array.isArray(input) ? input : []).reduce<ConnectionGroup[]>(
    (result, group) => {
      const name = String(group?.name || '').trim()
      const normalizedName = name.toLocaleLowerCase()
      if (!name || names.has(normalizedName)) return result
      let id = String(group?.id || randomUUID())
      if (ids.has(id)) id = randomUUID()
      ids.add(id)
      names.add(normalizedName)
      result.push({ id, name })
      return result
    },
    [],
  )
}

function deduplicateConnections(input: ConnectionData[]): ConnectionData[] {
  const ids = new Set<string>()
  const names = new Set<string>()
  return input.reduce<ConnectionData[]>((result, connection) => {
    let id = connection.id
    if (ids.has(id)) id = randomUUID()
    let name = connection.name
    let suffix = 2
    while (names.has(name.toLocaleLowerCase())) {
      name = `${connection.name} (${suffix++})`
    }
    ids.add(id)
    names.add(name.toLocaleLowerCase())
    result.push({ ...connection, id, name })
    return result
  }, [])
}

function defaultPort(type: ConnectionData['type']): number {
  return { MySQL: 3306, TDSQL: 3306, PostgreSQL: 5432, 'SQL Server': 1433, SQLite: 0 }[type]
}

function isCurrentCatalog(input: unknown): input is PersistedConnectionCatalog {
  const value = input as PersistedConnectionCatalog
  return value?.version === 2
    && Array.isArray(value.connections)
    && Array.isArray(value.groups)
}
