import type { ConnectionData } from './adapters'

export interface ConnectionGroup {
  id: string
  name: string
}

export interface ConnectionCatalog {
  connections: ConnectionData[]
  groups: ConnectionGroup[]
}

export type ConnectionDraft = Omit<ConnectionData, 'id'>

export interface PersistedConnectionCatalog {
  version: 2
  connections: ConnectionData[]
  groups: ConnectionGroup[]
}

export interface LegacyConnectionCatalog {
  connections?: Record<string, Partial<ConnectionData> & {
    group?: string
  }>
  groups?: Record<string, string[]>
}
