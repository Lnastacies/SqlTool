import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConfigProvider, Dropdown, Input, Layout, Tree, Tooltip } from 'antd'
import type { MenuProps, ThemeConfig } from 'antd'
import BarChartOutlined from '@ant-design/icons/BarChartOutlined'
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined'
import CloudUploadOutlined from '@ant-design/icons/CloudUploadOutlined'
import CodeOutlined from '@ant-design/icons/CodeOutlined'
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import EditOutlined from '@ant-design/icons/EditOutlined'
import EyeOutlined from '@ant-design/icons/EyeOutlined'
import FolderAddOutlined from '@ant-design/icons/FolderAddOutlined'
import FolderOpenOutlined from '@ant-design/icons/FolderOpenOutlined'
import FunctionOutlined from '@ant-design/icons/FunctionOutlined'
import HddOutlined from '@ant-design/icons/HddOutlined'
import LoadingOutlined from '@ant-design/icons/LoadingOutlined'
import PlusOutlined from '@ant-design/icons/PlusOutlined'
import PlayCircleOutlined from '@ant-design/icons/PlayCircleOutlined'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import TableOutlined from '@ant-design/icons/TableOutlined'
import type { ConnectionData, ConnectionGroup } from '../types'
import type { ConnectionTreeItem } from '../features/connections/connectionTree'
import { buildConnectionContextMenu } from '../features/connections/connectionContextMenu'
import { buildDatabaseContextMenu } from '../features/databases/databaseContextMenu'
import {
  buildDatabaseObjectContextMenu,
  type DatabaseObjectCategoryActionId,
} from '../features/database-objects/databaseObjectContextMenu'
import {
  buildDatabaseBackupContextMenu,
  type DatabaseBackupRecordActionId,
} from '../features/backups/databaseBackupContextMenu'
import type {
  DatabaseBackupTarget,
} from '../features/backups/databaseBackupActionSupport'
import type {
  DatabaseObjectCategory,
} from '../features/database-objects/databaseObjectModel'
import type {
  DatabaseObjectAction,
} from '../features/database-objects/databaseObjectPresentation'
import {
  buildTableObjectContextMenu,
} from '../features/tables/tableObjectContextMenu'
import { writeLayoutOverflowLog } from '../layoutDiagnostics'
import { formatTableSize } from '../workspace/tableSummaryFormat'

const { Sider } = Layout

const compactTreeTheme: ThemeConfig = {
  components: {
    Tree: {
      indentSize: 10,
      titleHeight: 14,
    },
  },
}

interface LeftPanelProps {
  treeData: ConnectionTreeItem[]
  connections: Map<string, ConnectionData>
  groups: ConnectionGroup[]
  activeConnections: Set<string>
  selectedKey?: string
  onSelect: (key: string) => void
  onConnect: (connection: ConnectionData) => Promise<unknown>
  onDisconnect: (connection: ConnectionData) => Promise<void>
  onCreateDatabase: (connection: ConnectionData) => void
  onNewConnection: (groupId?: string) => void
  onEditConnection: (connection: ConnectionData) => void
  onDeleteConnection: (connection: ConnectionData) => void
  onDuplicateConnection: (connection: ConnectionData) => void
  onNewQuery: (connection: ConnectionData) => void
  onOpenTerminal: (connection: ConnectionData) => void
  onRunSqlFile: (connection: ConnectionData) => void
  onRefreshConnection: (connection: ConnectionData) => void
  onSetConnectionColor: (connection: ConnectionData, color?: string) => void
  onMoveConnection: (connection: ConnectionData, groupId?: string) => void
  /** 打开 TDSQL 集群监控面板（仅 TDSQL 连接调用） */
  onOpenClusterMonitor: (connection: ConnectionData) => void
  onCloseDatabase: (connection: ConnectionData, database: string) => void
  onEditDatabase: (connection: ConnectionData, database: string) => void
  onDeleteDatabase: (connection: ConnectionData, database: string) => void
  onNewDatabaseQuery: (connection: ConnectionData, database: string) => void
  onOpenDatabaseTerminal: (connection: ConnectionData, database: string) => void
  onRunDatabaseSqlFile: (connection: ConnectionData, database: string) => void
  onDumpDatabase: (connection: ConnectionData, database: string) => void
  onPrintDatabase: (connection: ConnectionData, database: string) => void
  onReverseDatabase: (connection: ConnectionData, database: string) => void
  onSearchDatabase: (connection: ConnectionData, database: string) => void
  onRefreshDatabase: (connection: ConnectionData, database: string) => void
  onDatabaseObjectCategoryAction: (
    connection: ConnectionData,
    database: string,
    category: DatabaseObjectCategory,
    action: DatabaseObjectCategoryActionId,
  ) => void
  onTableAction: (
    connection: ConnectionData,
    database: string,
    action: DatabaseObjectAction,
    tableName: string,
  ) => void
  onDatabaseBackupAction: (
    connection: ConnectionData,
    database: string,
    target: DatabaseBackupTarget,
    action: DatabaseBackupRecordActionId,
  ) => void
  onNewGroup: () => void
  onEditGroup: (group: ConnectionGroup) => void
  onDeleteGroup: (group: ConnectionGroup) => void
}

const iconMap: Record<string, React.ReactNode> = {
  group: <FolderOpenOutlined className="tree-icon tree-icon--group" />,
  objectGroup: <FolderOpenOutlined className="tree-icon tree-icon--group" />,
  connection: <HddOutlined className="tree-icon tree-icon--connection" />,
  database: <DatabaseOutlined className="tree-icon tree-icon--database" />,
  databaseLoading: <LoadingOutlined className="tree-icon tree-icon--loading" />,
  tables: <TableOutlined className="tree-icon tree-icon--table" />,
  table: <TableOutlined className="tree-icon tree-icon--table" />,
  views: <EyeOutlined className="tree-icon tree-icon--view" />,
  view: <EyeOutlined className="tree-icon tree-icon--view" />,
  functions: <FunctionOutlined className="tree-icon tree-icon--function" />,
  function: <FunctionOutlined className="tree-icon tree-icon--function" />,
  procedure: <PlayCircleOutlined className="tree-icon tree-icon--procedure" />,
  events: <ClockCircleOutlined className="tree-icon tree-icon--event" />,
  event: <ClockCircleOutlined className="tree-icon tree-icon--event" />,
  queries: <CodeOutlined className="tree-icon tree-icon--query" />,
  query: <CodeOutlined className="tree-icon tree-icon--query" />,
  reports: <BarChartOutlined className="tree-icon tree-icon--report" />,
  report: <BarChartOutlined className="tree-icon tree-icon--report" />,
  backups: <CloudUploadOutlined className="tree-icon tree-icon--backup" />,
  backup: <CloudUploadOutlined className="tree-icon tree-icon--backup" />,
}

function LeftPanel(props: LeftPanelProps) {
  const {
    treeData,
    connections,
    groups,
    activeConnections,
    selectedKey,
    onSelect,
    onConnect,
    onDisconnect,
    onCreateDatabase,
    onNewConnection,
    onEditConnection,
    onDeleteConnection,
    onDuplicateConnection,
    onNewQuery,
    onOpenTerminal,
    onRunSqlFile,
    onRefreshConnection,
    onSetConnectionColor,
    onMoveConnection,
    onOpenClusterMonitor,
    onCloseDatabase,
    onEditDatabase,
    onDeleteDatabase,
    onNewDatabaseQuery,
    onOpenDatabaseTerminal,
    onRunDatabaseSqlFile,
    onDumpDatabase,
    onPrintDatabase,
    onReverseDatabase,
    onSearchDatabase,
    onRefreshDatabase,
    onDatabaseObjectCategoryAction,
    onTableAction,
    onDatabaseBackupAction,
    onNewGroup,
    onEditGroup,
    onDeleteGroup,
  } = props
  const [searchText, setSearchText] = useState('')
  // 上下文菜单：单一实例挂在 Tree 外层，避免 800+ 节点各持 Dropdown 实例
  const [menuItems, setMenuItems] = useState<MenuProps['items']>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  // 虚拟滚动需要容器高度；未测到时给 600 兜底，避免首次渲染无高度导致不渲染
  const [viewportHeight, setViewportHeight] = useState(600)
  const treeViewportRef = useRef<HTMLDivElement>(null)

  // 测量容器高度，节流 100ms 避免 resize 抖动；只在 mount 时订阅一次
  useEffect(() => {
    const el = treeViewportRef.current
    if (!el) return
    let frame = 0
    const update = () => {
      frame = 0
      const h = el.clientHeight
      if (h > 0) setViewportHeight(prev => (prev === h ? prev : h))
    }
    const ro = new ResizeObserver(() => {
      if (frame) return
      frame = window.setTimeout(update, 100) as unknown as number
    })
    ro.observe(el)
    update()
    return () => {
      ro.disconnect()
      if (frame) window.clearTimeout(frame)
    }
  }, [])

  React.useEffect(() => {
    if (!selectedKey) return
    const path = findItemPath(treeData, selectedKey)
    const ancestorKeys = path.slice(0, -1).map(item => item.key)
    if (ancestorKeys.length === 0) return
    setExpandedKeys(previous => (
      [...new Set([...previous, ...ancestorKeys])]
    ))
  }, [selectedKey, treeData])

  React.useEffect(() => {
    const expandableKeys = collectExpandableKeys(treeData)
    setExpandedKeys(previous => {
      const next = previous.filter(key => expandableKeys.has(String(key)))
      return next.length === previous.length ? previous : next
    })
  }, [treeData])

  const menuFor = (node: ConnectionTreeItem): MenuProps['items'] => {
    if (node.type === 'group' && node.groupId) {
      const group = groups.find(item => item.id === node.groupId)
      if (!group) return []
      return [
        {
          key: 'new-connection',
          icon: <PlusOutlined />,
          label: '在此分组中新建连接',
          onClick: () => onNewConnection(group.id),
        },
        {
          key: 'rename',
          icon: <EditOutlined />,
          label: '重命名分组',
          onClick: () => onEditGroup(group),
        },
        { type: 'divider' },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: '删除分组',
          danger: true,
          onClick: () => onDeleteGroup(group),
        },
      ]
    }
    if (node.type === 'database' && node.connId && node.database) {
      const connection = connections.get(node.connId)
      if (!connection) return []
      return buildDatabaseContextMenu({
        connection,
        onClose: () => onCloseDatabase(connection, node.database!),
        onEdit: () => onEditDatabase(connection, node.database!),
        onCreate: () => onCreateDatabase(connection),
        onDelete: () => onDeleteDatabase(connection, node.database!),
        onNewQuery: () => onNewDatabaseQuery(connection, node.database!),
        onOpenTerminal: () => onOpenDatabaseTerminal(connection, node.database!),
        onRunSqlFile: () => onRunDatabaseSqlFile(connection, node.database!),
        onDump: () => onDumpDatabase(connection, node.database!),
        onPrint: () => onPrintDatabase(connection, node.database!),
        onReverseModel: () => onReverseDatabase(connection, node.database!),
        onSearch: () => onSearchDatabase(connection, node.database!),
        onRefresh: () => onRefreshDatabase(connection, node.database!),
      })
    }
    if (
      node.objectCategory
      && node.type === node.objectCategory
      && node.connId
      && node.database
    ) {
      const connection = connections.get(node.connId)
      if (!connection) return []
      return buildDatabaseObjectContextMenu({
        category: node.objectCategory,
        onAction: action => onDatabaseObjectCategoryAction(
          connection,
          node.database!,
          node.objectCategory!,
          action,
        ),
      })
    }
    if (
      node.objectKind === 'table'
      && node.connId
      && node.database
    ) {
      const connection = connections.get(node.connId)
      if (!connection) return []
      return buildTableObjectContextMenu({
        onAction: action => onTableAction(
          connection,
          node.database!,
          action,
          node.objectName || node.title,
        ),
      })
    }
    if (
      node.objectKind === 'backup'
      && node.objectId
      && node.connId
      && node.database
    ) {
      const connection = connections.get(node.connId)
      if (!connection) return []
      return buildDatabaseBackupContextMenu({
        onAction: action => onDatabaseBackupAction(
          connection,
          node.database!,
          {
            id: node.objectId!,
            name: node.objectName || node.title,
            fileName: node.title,
          },
          action,
        ),
      })
    }
    if (node.type !== 'connection' || !node.connId) return []
    const connection = connections.get(node.connId)
    if (!connection) return []
    return buildConnectionContextMenu({
      connection,
      groups,
      active: activeConnections.has(connection.id),
      onConnect: () => void onConnect(connection),
      onDisconnect: () => void onDisconnect(connection),
      onEdit: () => onEditConnection(connection),
      onNewConnection: () => onNewConnection(),
      onDelete: () => onDeleteConnection(connection),
      onDuplicate: () => onDuplicateConnection(connection),
      onCreateDatabase: () => onCreateDatabase(connection),
      onNewQuery: () => onNewQuery(connection),
      onOpenTerminal: () => onOpenTerminal(connection),
      onRunSqlFile: () => onRunSqlFile(connection),
      onRefresh: () => onRefreshConnection(connection),
      onMoveToGroup: groupId => onMoveConnection(connection, groupId),
      onNewGroup,
      onSetColor: color => onSetConnectionColor(connection, color),
      onOpenClusterMonitor: () => onOpenClusterMonitor(connection),
    })
  }

  // 节点 title 渲染：不再包 Dropdown，仅保留视觉 span + data-node-key 供统一菜单反查
  const renderTreeNodes = useCallback((nodes: ConnectionTreeItem[]): any[] => nodes.map(node => {
    const connectionColor = node.type === 'connection' && node.connId
      ? connections.get(node.connId)?.color
      : undefined
    const isOpenDatabase = node.type === 'database'
      && Boolean(node.database && node.children)
    const icon = node.type === 'connection'
      ? (
        <HddOutlined
          className="tree-icon tree-icon--connection"
          style={connectionColor ? { color: connectionColor } : undefined}
        />
      )
      : iconMap[node.type] || ''

    return {
      key: node.key,
      title: (
        <span
          className="tree-node-title"
          data-node-key={node.key}
          onContextMenu={(e) => {
            // 阻止默认 + 选中表节点，菜单弹出由外层 Dropdown 统一处理
            if (node.objectKind === 'table') {
              e.preventDefault()
              onSelect(node.key)
            }
          }}
          onDoubleClick={() => {
            if (node.type === 'connection' && node.connId) {
              const connection = connections.get(node.connId)
              if (connection) onEditConnection(connection)
            }
          }}
        >
          {icon}
          <span
            className={[
              'tree-node-label',
              isOpenDatabase ? 'tree-node-label--database-open' : '',
            ].filter(Boolean).join(' ')}
          >
            {node.title}
          </span>
          {node.type === 'database' && node.sizeBytes != null && (
            <span
              className="tree-node-size"
              title={`数据库大小：${formatTableSize(node.sizeBytes)}`}
            >
              {formatTableSize(node.sizeBytes)}
            </span>
          )}
          {node.type === 'group' && (
            <span className="tree-node-count">{node.children?.length || 0}</span>
          )}
          {node.type === 'connection' && activeConnections.has(node.connId!) && (
            <span
              className="tree-node-status"
              title="已连接"
              style={connectionColor
                ? { backgroundColor: connectionColor }
                : undefined}
            />
          )}
        </span>
      ),
      children: node.children ? renderTreeNodes(node.children) : undefined,
    }
  }), [
    connections,
    activeConnections,
    onEditConnection,
    onSelect,
  ])

  // 搜索过滤 memo：treeData 或 searchText 变化才重算
  const filteredTreeData = useMemo(
    () => searchText
      ? filterTree(treeData, searchText.toLocaleLowerCase())
      : treeData,
    [treeData, searchText],
  )

  // 树节点 memo：filteredTreeData 或依赖项变化才重建，避免 800 节点每帧重渲染
  const treeNodes = useMemo(
    () => renderTreeNodes(filteredTreeData),
    [filteredTreeData, renderTreeNodes],
  )

  // 统一上下文菜单：捕获右键节点 key → 反查 node → 构建 items
  // 不用 useCallback：依赖 menuFor（含 groups/connections 等），每次 render 用最新闭包
  const handleTreeContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const keyEl = target.closest('[data-node-key]') as HTMLElement | null
    const key = keyEl?.getAttribute('data-node-key') || ''
    const node = key ? findItem(treeData, key) : undefined
    if (node) {
      setMenuItems(menuFor(node))
    } else {
      setMenuItems([])
    }
  }

  return (
    <Sider width={248} className="sqltool-left-panel" theme="light">
      <div className="left-panel-header">
        <span className="left-panel-title">连接</span>
        <div className="left-panel-actions">
          <Tooltip title="新建分组">
            <button type="button" onClick={onNewGroup}><FolderAddOutlined /></button>
          </Tooltip>
          <Tooltip title="新建连接">
            <button type="button" onClick={() => onNewConnection()}><PlusOutlined /></button>
          </Tooltip>
        </div>
      </div>
      <div className="connection-search">
        <SearchOutlined />
        <Input
          variant="borderless"
          placeholder="筛选连接或对象"
          value={searchText}
          onChange={event => setSearchText(event.target.value)}
          allowClear
        />
      </div>
      <Dropdown
        menu={{
          items: menuItems,
          // 菜单位于 Portal 中，必须阻止点击继续冒泡到树节点
          onClick: info => {
            info.domEvent.stopPropagation()
            setMenuOpen(false)
          },
        }}
        trigger={['contextMenu']}
        open={menuOpen}
        onOpenChange={setMenuOpen}
      >
        <div
          ref={treeViewportRef}
          className="connection-tree-scroll"
          onContextMenu={handleTreeContextMenu}
        >
          <ConfigProvider theme={compactTreeTheme}>
            <Tree
              className="connection-tree"
              showLine={{ showLeafIcon: false }}
              blockNode
              virtual
              height={viewportHeight}
              selectedKeys={selectedKey ? [selectedKey] : []}
              expandedKeys={expandedKeys}
              onExpand={(keys, info) => {
                setExpandedKeys(keys)
                requestAnimationFrame(() => {
                  writeLayoutOverflowLog(
                    'ConnectionTreeLayout',
                    'connection-tree',
                    treeViewportRef.current,
                  )
                })
                if (!info.expanded) return
                const item = findItem(treeData, String(info.node.key))
                if (item?.type !== 'connection' || !item.connId) return
                const connection = connections.get(item.connId)
                if (connection && !activeConnections.has(connection.id)) {
                  void onConnect(connection)
                }
              }}
              onSelect={keys => {
                if (keys.length > 0) onSelect(String(keys[0]))
              }}
              treeData={treeNodes}
            />
          </ConfigProvider>
        </div>
      </Dropdown>
      <div className="connection-tree-hint">右键管理连接与分组</div>
    </Sider>
  )
}

function findItem(
  nodes: ConnectionTreeItem[],
  key: string,
): ConnectionTreeItem | undefined {
  for (const node of nodes) {
    if (node.key === key) return node
    const found = node.children ? findItem(node.children, key) : undefined
    if (found) return found
  }
  return undefined
}

function collectExpandableKeys(
  nodes: ConnectionTreeItem[],
  keys = new Set<string>(),
): Set<string> {
  nodes.forEach(node => {
    if (!node.children?.length) return
    keys.add(node.key)
    collectExpandableKeys(node.children, keys)
  })
  return keys
}

function findItemPath(
  nodes: ConnectionTreeItem[],
  key: string,
): ConnectionTreeItem[] {
  for (const node of nodes) {
    if (node.key === key) return [node]
    const childPath = node.children
      ? findItemPath(node.children, key)
      : []
    if (childPath.length > 0) return [node, ...childPath]
  }
  return []
}

function filterTree(
  nodes: ConnectionTreeItem[],
  search: string,
): ConnectionTreeItem[] {
  return nodes.reduce<ConnectionTreeItem[]>((result, node) => {
    const children = node.children ? filterTree(node.children, search) : []
    if (node.title.toLocaleLowerCase().includes(search) || children.length > 0) {
      result.push({ ...node, children: node.children ? children : undefined })
    }
    return result
  }, [])
}

export default LeftPanel
