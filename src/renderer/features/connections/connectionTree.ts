import type {
  ConnectionCatalog,
  ConnectionData,
} from '../../types'
import type {
  DatabaseObjectCategory,
  DatabaseObjectKind,
} from '../database-objects/databaseObjectModel'

export type ConnectionTreeItemType =
  | 'group'
  | 'objectGroup'
  | 'connection'
  | 'database'
  /** 连接已建立但数据库列表尚未加载完成的占位节点，不可作为数据库点击。 */
  | 'databaseLoading'
  | DatabaseObjectCategory
  | DatabaseObjectKind

export interface ConnectionTreeItem {
  key: string
  title: string
  type: ConnectionTreeItemType
  connId?: string
  groupId?: string
  objectGroupId?: string
  database?: string
  objectCategory?: DatabaseObjectCategory
  objectKind?: DatabaseObjectKind
  objectId?: string
  objectName?: string
  sizeBytes?: number
  children?: ConnectionTreeItem[]
}

export function buildConnectionTree(
  catalog: ConnectionCatalog,
  activeConnections: Set<string>,
  previous: ConnectionTreeItem[] = [],
): ConnectionTreeItem[] {
  const previousConnections = new Map<string, ConnectionTreeItem>()
  collectConnectionNodes(previous, previousConnections)

  const toNode = (connection: ConnectionData): ConnectionTreeItem => {
    const previousNode = previousConnections.get(connection.id)
    return {
      key: `connection:${connection.id}`,
      title: connection.name,
      type: 'connection',
      connId: connection.id,
      groupId: connection.groupId,
      children: activeConnections.has(connection.id)
        ? previousNode?.children || [{
          key: `connection:${connection.id}:loading`,
          title: '正在加载...',
          type: 'databaseLoading',
          connId: connection.id,
        }]
        : undefined,
    }
  }

  const groupedIds = new Set<string>()
  const groups = catalog.groups.map(group => {
    const children = catalog.connections
      .filter(connection => connection.groupId === group.id)
      .map(connection => {
        groupedIds.add(connection.id)
        return toNode(connection)
      })
    return {
      key: `group:${group.id}`,
      title: group.name,
      type: 'group' as const,
      groupId: group.id,
      children,
    }
  })
  const ungrouped = catalog.connections
    .filter(connection => !groupedIds.has(connection.id))
    .map(toNode)
  return [...groups, ...ungrouped]
}

export function findConnectionTreeItem(
  items: ConnectionTreeItem[],
  key: string,
): ConnectionTreeItem | undefined {
  for (const item of items) {
    if (item.key === key) return item
    const found = item.children
      ? findConnectionTreeItem(item.children, key)
      : undefined
    if (found) return found
  }
  return undefined
}

export function updateConnectionTreeNode(
  items: ConnectionTreeItem[],
  predicate: (item: ConnectionTreeItem) => boolean,
  update: (item: ConnectionTreeItem) => ConnectionTreeItem,
): ConnectionTreeItem[] {
  return items.map(item => {
    if (predicate(item)) return update(item)
    if (!item.children) return item
    return {
      ...item,
      children: updateConnectionTreeNode(item.children, predicate, update),
    }
  })
}

function collectConnectionNodes(
  items: ConnectionTreeItem[],
  result: Map<string, ConnectionTreeItem>,
): void {
  items.forEach(item => {
    if (item.type === 'connection' && item.connId) {
      result.set(item.connId, item)
    }
    if (item.children) collectConnectionNodes(item.children, result)
  })
}
