import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Layout, Modal, message } from 'antd'
import AppMenu from './components/AppMenu'
import LeftPanel from './components/LeftPanel'
import RightPanel from './components/RightPanel'
import Toolbar from './components/Toolbar'
import StatusBar from './components/StatusBar'
import AboutDialog from './components/AboutDialog'
import ChangelogDialog from './components/ChangelogDialog'
import ConnectionDialog from './components/ConnectionDialog'
import FavoriteDialog, {
  type FavoriteItem,
} from './components/FavoriteDialog'
import ConnectionGroupDialog from './components/ConnectionGroupDialog'
import CreateDatabaseDialog from './components/CreateDatabaseDialog'
import CommandLineDialog from './features/connections/CommandLineDialog'
import DatabaseDumpDialog from './features/databases/DatabaseDumpDialog'
import DatabaseEditDialog from './features/databases/DatabaseEditDialog'
import DatabaseModelDialog from './features/databases/DatabaseModelDialog'
import DatabaseSearchDialog, {
  type DatabaseSearchResult,
} from './features/databases/DatabaseSearchDialog'
import UserManagementDialog from './features/databases/UserManagementDialog'
import AutomationDialog, {
  type AutomationConfig,
} from './features/databases/AutomationDialog'
import {
  useDatabaseActions,
  type DatabaseActionContext,
} from './features/databases/useDatabaseActions'
import {
  isConnectionInvalidError,
  responseError,
} from './features/databases/databaseActionRunners'
import TableDesignerDialog from './features/tables/TableDesignerDialog'
import TableExportDialog from './features/tables/TableExportDialog'
import TableImportDialog from './features/tables/TableImportDialog'
import TDSQLMonitorPanel from './features/tdsql/TDSQLMonitorPanel'
import DatabaseToolDialog from './features/database-tools/DatabaseToolDialog'
import DatabaseBackupDialog from './features/backups/DatabaseBackupDialog'
import DatabaseRestoreDialog from './features/backups/DatabaseRestoreDialog'
import {
  useDatabaseBackupActions,
  type DatabaseBackupContext,
} from './features/backups/useDatabaseBackupActions'
import type {
  DatabaseBackupTarget,
} from './features/backups/databaseBackupActionSupport'
import type {
  DatabaseBackupRecordActionId,
} from './features/backups/databaseBackupContextMenu'
import DatabaseObjectTargetDialog, {
  type DatabaseObjectTargetDialogValue,
} from './features/database-objects/DatabaseObjectTargetDialog'
import type {
  ConnectionData,
  ConnectionCatalog,
  ConnectionDraft,
  ConnectionGroup,
  CreateDatabaseOptions,
  CreateDatabaseResult,
  CreateDatabaseBackupRequest,
  CreateDatabaseBackupResult,
  AlterDatabaseRequest,
  AlterDatabaseResult,
  CloseDatabaseResult,
  DatabaseBackupProgress,
  DatabaseBackupRecord,
  DeleteDatabaseBackupResult,
  DatabaseDumpMode,
  DatabaseDumpResult,
  DatabaseEncodingCatalog,
  DatabaseModel,
  DatabasePrintResult,
  DatabaseSummary,
  DropDatabaseResult,
  ExecuteResult,
  ExtractDatabaseBackupResult,
  RenameDatabaseBackupResult,
  RestoreDatabaseBackupRequest,
  RestoreDatabaseBackupResult,
  TableDataQuery,
  IPCResponse,
  QueryCancelResult,
  QueryExecutionRequest,
  QueryExecutionResult,
  QuerySessionActionResult,
  OpenSqlFilesResult,
  OpenedSqlFile,
  RecentSqlFile,
  SaveSqlFileRequest,
  SaveSqlFileResult,
  TableDataPage,
  TableMutationBatch,
  TableMutationResult,
  TableMetadata,
  TableSummary,
  TableRowUpdate,
  SaveTableStructureRequest,
  SaveTableStructureResult,
  TableStructurePlan,
  TableExportBatchRequest,
  TableExportBatchResult,
  TableExportObjectMetadata,
  DatabaseExportObjectType,
  TableImportOptions,
  TableImportPreview,
  TableImportRequest,
  TableImportResult,
  DatabaseToolMode,
  DataTransferRequest,
  DataTransferPreview,
  DataTransferResult,
  DataSyncRequest,
  DataSyncPreview,
  DataSyncResult,
  StructureSyncRequest,
  StructureSyncPreview,
  StructureSyncResult,
  VerifyDatabaseBackupResult,
} from './types'
import { useAppCommands } from './commands/useAppCommands'
import {
  useSqlFileCommands,
  type OpenQueryFileInput,
} from './features/query-files/useSqlFileCommands'
import UnsavedChangesDialog from './features/query-files/UnsavedChangesDialog'
import { useDocumentCloseGuard } from './features/query-files/useDocumentCloseGuard'
import { useWorkspace } from './workspace/useWorkspace'
import WorkspaceHost from './workspace/WorkspaceHost'
import type { WorkspaceDocument } from './workspace/workspaceTypes'
import {
  resolveQueryExecutionSql,
  type QueryExecutionMode,
} from './workspace/queryExecutionSql'
import {
  executeEditorAction,
  type EditorActionId,
} from './monaco/editorRegistry'
import {
  buildConnectionTree,
  findConnectionTreeItem,
  updateConnectionTreeNode,
  type ConnectionTreeItem,
} from './features/connections/connectionTree'
import {
  buildDatabaseObjectTree,
  createEmptyDatabaseObjects,
  databaseBackupTreeKey,
  databaseObjectGroupTreeNode,
  databaseObjectCategoryTreeKey,
  databaseObjectTreeKey,
  type DatabaseObjectCategory,
  type DatabaseObjectKind,
  type DatabaseObjectSelection,
  type DatabaseObjects,
} from './features/database-objects/databaseObjectModel'
import {
  clearConnection as clearObjectCacheConnection,
  clearDatabase as clearObjectCacheDatabase,
  clearTableMetadata as clearObjectCacheTableMetadata,
  getTableMetadata as getCachedTableMetadata,
  getTableSummaries as getCachedTableSummaries,
  setTableMetadata as setCachedTableMetadata,
  setTableSummaries as setCachedTableSummaries,
} from './features/database-objects/databaseObjectCache'
import {
  createDatabaseObjectGroup,
  loadDatabaseObjectGroups,
} from './features/database-objects/databaseObjectGroupStore'
import {
  runDatabaseObjectCategoryAction,
  type DatabaseObjectCategoryActionContext,
} from './features/database-objects/databaseObjectCategoryActions'
import type {
  DatabaseObjectCategoryActionId,
} from './features/database-objects/databaseObjectContextMenu'
import type {
  DatabaseObjectAction,
} from './features/database-objects/databaseObjectPresentation'
import {
  runDatabaseObjectAction,
  type DatabaseObjectActionContext,
} from './features/database-objects/databaseObjectActionRunner'

const { Header, Content, Footer } = Layout

declare global {
  interface Window {
    database: {
      loadConnections: () => Promise<IPCResponse<ConnectionCatalog>>
      createConnection: (draft: ConnectionDraft) => Promise<IPCResponse<ConnectionCatalog>>
      updateConnection: (id: string, draft: ConnectionDraft) => Promise<IPCResponse<ConnectionCatalog>>
      deleteConnection: (id: string) => Promise<IPCResponse<ConnectionCatalog>>
      createGroup: (name: string) => Promise<IPCResponse<ConnectionCatalog>>
      renameGroup: (id: string, name: string) => Promise<IPCResponse<ConnectionCatalog>>
      deleteGroup: (id: string) => Promise<IPCResponse<ConnectionCatalog>>
      testConnection: (draft: ConnectionDraft) => Promise<IPCResponse<{ success: boolean; message: string }>>
      connect: (connId: string) => Promise<IPCResponse<{ success: boolean; message: string }>>
      disconnect: (connId: string) => Promise<IPCResponse<void>>
      getDatabases: (connId: string) => Promise<IPCResponse<string[]>>
      getDatabaseSummaries: (
        connId: string,
      ) => Promise<IPCResponse<DatabaseSummary[]>>
      getDatabaseEncodingCatalog: (
        connId: string,
        database?: string,
      ) => Promise<IPCResponse<DatabaseEncodingCatalog>>
      createDatabase: (
        connId: string,
        databaseName: string,
        options?: CreateDatabaseOptions,
      ) => Promise<IPCResponse<CreateDatabaseResult>>
      closeDatabase: (
        connId: string,
        database: string,
      ) => Promise<IPCResponse<CloseDatabaseResult>>
      alterDatabase: (
        connId: string,
        database: string,
        request: AlterDatabaseRequest,
      ) => Promise<IPCResponse<AlterDatabaseResult>>
      dropDatabase: (
        connId: string,
        database: string,
      ) => Promise<IPCResponse<DropDatabaseResult>>
      dumpDatabase: (
        connId: string,
        database: string,
        mode: DatabaseDumpMode,
      ) => Promise<IPCResponse<DatabaseDumpResult>>
      listBackups: (
        connId: string,
        database: string,
      ) => Promise<IPCResponse<DatabaseBackupRecord[]>>
      createBackup: (
        connId: string,
        database: string,
        request: CreateDatabaseBackupRequest,
      ) => Promise<IPCResponse<CreateDatabaseBackupResult>>
      restoreBackup: (
        connId: string,
        database: string,
        request: RestoreDatabaseBackupRequest,
      ) => Promise<IPCResponse<RestoreDatabaseBackupResult>>
      extractBackupSql: (
        connId: string,
        database: string,
        backupId?: string,
      ) => Promise<IPCResponse<ExtractDatabaseBackupResult>>
      deleteBackup: (
        connId: string,
        database: string,
        backupId: string,
      ) => Promise<IPCResponse<DeleteDatabaseBackupResult>>
      renameBackup: (
        connId: string,
        database: string,
        backupId: string,
        name: string,
      ) => Promise<IPCResponse<RenameDatabaseBackupResult>>
      verifyBackup: (
        connId: string,
        database: string,
        backupId: string,
      ) => Promise<IPCResponse<VerifyDatabaseBackupResult>>
      showBackupFolder: (
        connId: string,
        database: string,
      ) => Promise<IPCResponse<{ path: string }>>
      onBackupProgress: (
        callback: (progress: DatabaseBackupProgress) => void,
      ) => () => void
      getDatabaseModel: (
        connId: string,
        database: string,
      ) => Promise<IPCResponse<DatabaseModel>>
      printDatabase: (
        connId: string,
        database: string,
      ) => Promise<IPCResponse<DatabasePrintResult>>
      getTables: (connId: string, database: string) => Promise<IPCResponse<string[]>>
      getTableSummaries: (
        connId: string,
        database: string,
      ) => Promise<IPCResponse<TableSummary[]>>
      getViews: (connId: string, database: string) => Promise<IPCResponse<string[]>>
      getProcedures: (connId: string, database: string) => Promise<IPCResponse<string[]>>
      getFunctions: (connId: string, database: string) => Promise<IPCResponse<string[]>>
      getEvents: (connId: string, database: string) => Promise<IPCResponse<string[]>>
      getTableMetadata: (connId: string, database: string, tableName: string) => Promise<IPCResponse<TableMetadata>>
      previewTableStructure: (
        connId: string,
        database: string,
        request: SaveTableStructureRequest,
      ) => Promise<IPCResponse<TableStructurePlan>>
      saveTableStructure: (
        connId: string,
        database: string,
        request: SaveTableStructureRequest,
      ) => Promise<IPCResponse<SaveTableStructureResult>>
      dropTable: (
        connId: string,
        database: string,
        tableName: string,
      ) => Promise<IPCResponse<{ tableName: string }>>
      truncateTable: (
        connId: string,
        database: string,
        tableName: string,
      ) => Promise<IPCResponse<{ tableName: string; affectedRows: number }>>
      openTableImport: (
        connId: string,
        database: string,
        tableName: string,
      ) => Promise<IPCResponse<TableImportPreview>>
      reloadTableImport: (
        connId: string,
        database: string,
        tableName: string,
        filePath: string,
        options: TableImportOptions,
      ) => Promise<IPCResponse<TableImportPreview>>
      importTableRows: (
        connId: string,
        database: string,
        tableName: string,
        request: TableImportRequest,
      ) => Promise<IPCResponse<TableImportResult>>
      getTableExportObjects: (
        connId: string,
        database: string,
        objectType: DatabaseExportObjectType,
      ) => Promise<IPCResponse<TableExportObjectMetadata[]>>
      exportTableBatch: (
        connId: string,
        database: string,
        request: TableExportBatchRequest,
      ) => Promise<IPCResponse<TableExportBatchResult>>
      getTableData: (
        connId: string,
        database: string,
        tableName: string,
        page: number,
        pageSize: number,
        query: TableDataQuery,
      ) => Promise<IPCResponse<TableDataPage>>
      updateTableRows: (
        connId: string,
        database: string,
        tableName: string,
        updates: TableRowUpdate[],
      ) => Promise<IPCResponse<{ affectedRows: number }>>
      mutateTableRows: (
        connId: string,
        database: string,
        tableName: string,
        batch: TableMutationBatch,
      ) => Promise<IPCResponse<TableMutationResult>>
      executeSQL: (
        connId: string,
        database: string,
        sql: string,
      ) => Promise<IPCResponse<ExecuteResult>>
      dropDatabaseObject: (
        connId: string,
        database: string,
        kind: 'view' | 'function' | 'procedure' | 'event',
        objectName: string,
      ) => Promise<IPCResponse<{ objectName: string; skipped: boolean }>>
      toggleDatabaseEvent: (
        connId: string,
        database: string,
        eventName: string,
        enable: boolean,
      ) => Promise<IPCResponse<{ eventName: string; enabled: boolean }>>
      executeDatabaseRoutine: (
        connId: string,
        database: string,
        kind: 'function' | 'procedure',
        routineName: string,
      ) => Promise<IPCResponse<ExecuteResult>>
    }
    databaseTool: {
      previewTransfer: (
        request: DataTransferRequest,
      ) => Promise<IPCResponse<DataTransferPreview>>
      executeTransfer: (
        request: DataTransferRequest,
      ) => Promise<IPCResponse<DataTransferResult>>
      previewDataSync: (
        request: DataSyncRequest,
      ) => Promise<IPCResponse<DataSyncPreview>>
      executeDataSync: (
        request: DataSyncRequest,
      ) => Promise<IPCResponse<DataSyncResult>>
      previewStructureSync: (
        request: StructureSyncRequest,
      ) => Promise<IPCResponse<StructureSyncPreview>>
      executeStructureSync: (
        request: StructureSyncRequest,
      ) => Promise<IPCResponse<StructureSyncResult>>
    }
    querySession: {
      execute: (
        request: QueryExecutionRequest,
      ) => Promise<IPCResponse<QueryExecutionResult>>
      cancel: (
        sessionId: string,
        requestId: string,
      ) => Promise<IPCResponse<QueryCancelResult>>
      begin: (
        sessionId: string,
        connId: string,
        database: string,
      ) => Promise<IPCResponse<QuerySessionActionResult>>
      commit: (
        sessionId: string,
        connId: string,
        database: string,
      ) => Promise<IPCResponse<QuerySessionActionResult>>
      rollback: (
        sessionId: string,
        connId: string,
        database: string,
      ) => Promise<IPCResponse<QuerySessionActionResult>>
      close: (sessionId: string) => Promise<IPCResponse<void>>
    }
    sqlFile: {
      open: () => Promise<IPCResponse<OpenSqlFilesResult>>
      save: (
        request: SaveSqlFileRequest,
      ) => Promise<IPCResponse<SaveSqlFileResult>>
      getRecent: () => Promise<IPCResponse<RecentSqlFile[]>>
      openRecent: (filePath: string) => Promise<IPCResponse<OpenedSqlFile>>
      clearRecent: () => Promise<IPCResponse<boolean>>
    }
    resultExport: {
      exportCsv: (
        request: { suggestedName?: string; content: string },
      ) => Promise<IPCResponse<{ cancelled: boolean; filePath?: string }>>
    }
    application: {
      showDatabaseObjectFolder: (
        category: 'queries' | 'reports' | 'backups',
      ) => Promise<IPCResponse<{ path: string }>>
      confirmClose: () => Promise<IPCResponse<boolean>>
      onCloseRequested: (callback: () => void) => () => void
    }
    logger: {
      getLogFiles: () => Promise<IPCResponse<string[]>>
      getLogContent: (fileName: string) => Promise<IPCResponse<string>>
      clearLogs: () => Promise<IPCResponse<boolean>>
      write: (
        level: 'info' | 'warn' | 'error',
        module: string,
        message: string,
      ) => Promise<IPCResponse<boolean>>
    }
    favorite: {
      list: () => Promise<IPCResponse<FavoriteItem[]>>
      add: (favorite: {
        name: string
        connId: string
        connectionName: string
        database: string
        objectName?: string
        objectType?: 'table' | 'view' | 'function' | 'event' | 'procedure'
      }) => Promise<IPCResponse<FavoriteItem>>
      update: (id: string, updates: any) => Promise<IPCResponse<boolean>>
      delete: (id: string) => Promise<IPCResponse<boolean>>
    }
    /** TDSQL 分布式数据库扩展 IPC，仅 TDSQL 连接可用 */
    tdsql: {
      getTableMetadata: (
        connId: string,
        database: string,
        tableName: string,
      ) => Promise<IPCResponse<{
        tableName: string
        tableType: string
        shardKey: { fieldName: string; source: string } | null
        engine: string
        partitions: Array<{
          partitionName: string
          subpartitionName: string | null
          partitionMethod: string | null
          partitionExpression: string | null
          tableRows: number
          dataLength: number
          indexLength: number
          tableSchema: string
        }>
      }>>
      getSessions: (connId: string) => Promise<IPCResponse<{
        id: number
        user: string
        host: string
        db: string | null
        command: string
        time: number
        timeMs: number | null
        state: string | null
        rowsSent: number | null
        tid: number | null
        info: string | null
      }[]>>
      getDdlTasks: (
        connId: string,
      ) => Promise<IPCResponse<Record<string, unknown>[]>>
    }
  }
}

function getInitialQueryCapabilities(type?: ConnectionData['type']) {
  const supportsCancel = type !== 'SQLite'
  return {
    supportsCancel,
    supportsTransactions: true,
    cancelMode: supportsCancel
      ? (type === 'SQL Server' ? 'native' as const : 'control-connection' as const)
      : 'unsupported' as const,
  }
}

function toConnectionDraft(connection: ConnectionData): ConnectionDraft {
  const { id: _id, ...draft } = connection
  return draft
}

function connectionSettingsChanged(
  connection: ConnectionData,
  draft: ConnectionDraft,
): boolean {
  const fields: Array<keyof ConnectionDraft> = [
    'type',
    'host',
    'port',
    'username',
    'password',
    'database',
    'timeout',
    'charset',
  ]
  return fields.some(field => connection[field] !== draft[field])
}

function buildDuplicateConnectionName(
  sourceName: string,
  connections: Map<string, ConnectionData>,
): string {
  const existingNames = new Set(
    Array.from(connections.values()).map(
      connection => connection.name.toLocaleLowerCase(),
    ),
  )
  const baseName = `${sourceName} (副本)`
  if (!existingNames.has(baseName.toLocaleLowerCase())) return baseName
  let suffix = 2
  while (existingNames.has(`${baseName} ${suffix}`.toLocaleLowerCase())) {
    suffix += 1
  }
  return `${baseName} ${suffix}`
}

interface TableImportDialogState {
  open: boolean
  connId?: string
  database?: string
  tableName?: string
  fields?: TableMetadata['fields']
  preview?: TableImportPreview
  importing: boolean
}

interface TableExportDialogState {
  open: boolean
  connId?: string
  database?: string
  objects?: TableExportObjectMetadata[]
  initialSelection?: string[]
  exporting: boolean
}

function App() {
  const [connections, setConnections] = useState<Map<string, ConnectionData>>(new Map())
  const [connectionGroups, setConnectionGroups] = useState<ConnectionGroup[]>([])
  const [activeConnections, setActiveConnections] = useState<Set<string>>(new Set())
  /** 进行中的连接请求（按连接 ID 去重），防止并发重复建连 */
  const connectInFlightRef = useRef(new Map<string, Promise<{ success: boolean; message: string }>>())
  const [treeData, setTreeData] = useState<ConnectionTreeItem[]>([])
  const [showConnectionDialog, setShowConnectionDialog] = useState(false)
  const [editingConnection, setEditingConnection] = useState<ConnectionData>()
  const [newConnectionDraft, setNewConnectionDraft] = useState<ConnectionDraft>()
  const [newConnectionGroupId, setNewConnectionGroupId] = useState<string>()
  const [groupDialog, setGroupDialog] = useState<{
    open: boolean
    group?: ConnectionGroup
  }>({ open: false })
  const [createDatabaseDialog, setCreateDatabaseDialog] = useState<{
    open: boolean
    connection?: ConnectionData
  }>({ open: false })
  const [commandLineContext, setCommandLineContext] = useState<{
    connection: ConnectionData
    database?: string
  }>()
  const [selectedConnection, setSelectedConnection] = useState<ConnectionData | null>(null)
  const [connectionDatabases, setConnectionDatabases] =
    useState<Map<string, DatabaseSummary[]>>(new Map())
  const [connectionDatabasesLoading, setConnectionDatabasesLoading] =
    useState<Set<string>>(new Set())
  const [selectedTable, setSelectedTable] = useState<{ connId: string; database: string; tableName: string } | null>(null)
  const [selectedDatabase, setSelectedDatabase] = useState<{ connId: string; database: string } | null>(null)
  const [objectCategory, setObjectCategory] =
    useState<DatabaseObjectCategory>('tables')
  const [selectedObject, setSelectedObject] =
    useState<DatabaseObjectSelection | null>(null)
  const [selectedTreeKey, setSelectedTreeKey] = useState<string>()
  const [databaseObjects, setDatabaseObjects] = useState<DatabaseObjects>(
    createEmptyDatabaseObjects,
  )
  const [databaseBackupRecords, setDatabaseBackupRecords] = useState<
    DatabaseBackupRecord[]
  >([])
  const [databaseObjectsLoading, setDatabaseObjectsLoading] = useState(false)
  const [tableSummaries, setTableSummaries] = useState<TableSummary[]>([])
  const [tableSummariesError, setTableSummariesError] = useState('')
  const [tableDesigner, setTableDesigner] = useState<{
    open: boolean
    originalName?: string
    metadata?: TableMetadata
    loading: boolean
  }>({ open: false, loading: false })
  const [tableDesignerSaving, setTableDesignerSaving] = useState(false)
  const [tableStructureRevision, setTableStructureRevision] = useState(0)
  const [tableImport, setTableImport] = useState<TableImportDialogState>({
    open: false,
    importing: false,
  })
  const [tableExport, setTableExport] = useState<TableExportDialogState>({
    open: false,
    exporting: false,
  })
  const [objectTransferTarget, setObjectTransferTarget] =
    useState<DatabaseObjectTargetDialogValue>()
  const [databaseTool, setDatabaseTool] = useState<{
    open: boolean
    mode: DatabaseToolMode
  }>({ open: false, mode: 'transfer' })
  const [showDetails, setShowDetails] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)
  const [showFavorite, setShowFavorite] = useState(false)
  const [userManagementContext, setUserManagementContext] = useState<{
    connection: ConnectionData
    database: string
  }>()
  const [showAutomation, setShowAutomation] = useState(false)
  /** TDSQL 集群监控面板：处于打开状态时记录对应连接 */
  const [clusterMonitorConnection, setClusterMonitorConnection] =
    useState<ConnectionData | null>(null)
  /** 监控面板中分片分布子面板的当前数据库表列表 */
  const [monitorTables, setMonitorTables] = useState<string[]>([])
  /** 监控面板表列表加载态 */
  const [monitorTablesLoading, setMonitorTablesLoading] = useState(false)
  /**
   * 监控面板表列表请求序号。
   * 快速切换数据库时仅接收最后一次请求的结果，防止旧库响应覆盖新库；
   * 同时作为重复请求的判据，配合子面板 effect 防重，避免请求风暴。
   */
  const monitorTablesSeqRef = useRef(0)
  const [status, setStatus] = useState({ connection: '未连接', database: '未选择', executionTime: '0.0000', recordCount: 0 })
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const {
    activeDocument,
    activeDocumentId: activeTabId,
    documents,
    queryDocuments: queryTabs,
    surface,
    openQuery,
    openData,
    activateDocument,
    updateQuery,
    updateData,
    closeDocument,
    showObjects,
  } = useWorkspace()
  const tableLoadSequence = useRef(new Map<string, number>())
  const databaseObjectLoadSequence = useRef(0)
  const databaseObjectLoadTarget = useRef('')

  const clearConnectionContext = (connId: string) => {
    const clearConnection = selectedConnection?.id === connId
    const clearDatabase = selectedDatabase?.connId === connId
    if (clearConnection) setSelectedConnection(null)
    if (clearDatabase) {
      databaseObjectLoadSequence.current += 1
      setSelectedDatabase(null)
      setSelectedTable(null)
      setSelectedObject(null)
      setSelectedTreeKey(undefined)
      setObjectCategory('tables')
      setDatabaseObjects(createEmptyDatabaseObjects())
      setDatabaseObjectsLoading(false)
      setTableSummaries([])
      setTableSummariesError('')
    }
    // 清理 TDSQL 集群监控面板状态，连接断开时关闭面板
    if (clusterMonitorConnection?.id === connId) {
      setClusterMonitorConnection(null)
      setMonitorTables([])
      setMonitorTablesLoading(false)
      void window.logger.write(
        'info',
        'TDSQLMonitor',
        `集群监控面板已随连接关闭: 连接=${connId}`,
      )
    }
    if (clearConnection || clearDatabase) {
      setStatus(previous => ({
        ...previous,
        connection: clearConnection ? '未连接' : previous.connection,
        database: clearDatabase ? '未选择' : previous.database,
      }))
    }
  }

  /**
   * 连接在空闲期间被服务端断开（或已不存在）时的本地状态复位：
   * 把连接回退为“未连接”、清空对象缓存与选中上下文，并提示用户重新连接。
   * 按既定策略不做自动重连，由用户点击连接手动重建。
   */
  const resetInvalidConnection = (connection: ConnectionData) => {
    setActiveConnections(previous => {
      if (!previous.has(connection.id)) return previous
      const next = new Set(previous)
      next.delete(connection.id)
      return next
    })
    setTreeData(previous => updateConnectionTreeNode(
      previous,
      item => item.type === 'connection' && item.connId === connection.id,
      item => ({ ...item, children: undefined }),
    ))
    clearConnectionContext(connection.id)
    // 清掉该连接的全部对象缓存，避免重连后读到失效连接期间的陈旧数据
    clearObjectCacheConnection(connection.id)
    void window.logger.write(
      'warn',
      'ConnectionWorkspace',
      `数据库连接已失效，已重置连接状态: 连接=${connection.id}, 名称=${connection.name}, 类型=${connection.type}`,
    )
    message.warning('数据库连接已失效，请重新连接')
  }

  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    try {
      const result = await window.database.loadConnections()
      if (!result?.success || !result.data) {
        throw new Error(result?.error?.message || '连接配置加载失败')
      }
      const catalog = result.data
      const connMap = new Map(
        catalog.connections.map(connection => [connection.id, connection]),
      )
      setConnections(connMap)
      setConnectionGroups(catalog.groups)
      setTreeData(previous => buildConnectionTree(
        catalog,
        activeConnections,
        previous,
      ))
      void window.logger.write(
        'info',
        'ConnectionWorkspace',
        `连接列表已刷新: 连接=${catalog.connections.length}, 分组=${catalog.groups.length}`,
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      setConnections(new Map())
      setConnectionGroups([])
      setTreeData([])
      void window.logger.write(
        'error',
        'ConnectionWorkspace',
        `加载连接配置失败: ${detail}`,
      )
    }
  }

  const handleConnect = async (connData: ConnectionData) => {
    // 防抖去重：同一连接的并发触发（快速双击/重复展开）复用同一请求，
    // 避免后端重复建连与竞态覆盖
    const inFlight = connectInFlightRef.current.get(connData.id)
    if (inFlight) {
      void window.logger.write(
        'info',
        'ConnectionWorkspace',
        `忽略重复的连接请求，复用进行中的连接流程: 连接=${connData.id}`,
      )
      return await inFlight
    }
    const request = (async (): Promise<{ success: boolean; message: string }> => {
    let result = { success: false, message: '' }
    try {
      const ipcResult = await window.database.connect(connData.id)
      if (ipcResult && ipcResult.success) {
        result = ipcResult.data || { success: true, message: '连接成功' }
      } else {
        result = { success: false, message: ipcResult?.error?.message || '连接失败' }
      }
    } catch (error) {
      result = {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      }
    }
    
    if (result.success) {
      setActiveConnections(prev => new Set([...prev, connData.id]))
      setTreeData(previous => updateConnectionTreeNode(
        previous,
        item => item.type === 'connection' && item.connId === connData.id,
        item => ({
          ...item,
          children: item.children || [{
            key: `connection:${connData.id}:loading`,
            title: '正在加载...',
            // 占位节点不使用 database 类型，避免加载期间点击误报"连接已失效"
            type: 'databaseLoading',
            connId: connData.id,
          }],
        }),
      ))
      setStatus(prev => ({ ...prev, connection: `已连接: ${connData.name}` }))
      void window.logger.write(
        'info',
        'ConnectionWorkspace',
        `数据库连接成功: 连接=${connData.id}, 类型=${connData.type}`,
      )
      void loadDatabases(connData.id)
    } else {
      void window.logger.write(
        'error',
        'ConnectionWorkspace',
        `数据库连接失败: 连接=${connData.id}, 类型=${connData.type}, 原因=${result.message || '未知错误'}`,
      )
      message.error(result.message || '数据库连接失败')
    }
    return result
    })()
    connectInFlightRef.current.set(connData.id, request)
    try {
      return await request
    } finally {
      connectInFlightRef.current.delete(connData.id)
    }
  }

  const loadDatabases = async (connId: string) => {
    const startedAt = Date.now()
    setConnectionDatabasesLoading(previous => (
      new Set(previous).add(connId)
    ))
    void window.logger.write(
      'info',
      'ConnectionWorkspace',
      `开始加载连接数据库列表: 连接=${connId}`,
    )
    try {
      const result = await window.database.getDatabaseSummaries(connId)
      if (!result?.success) {
        throw responseError(result || {}, '数据库摘要加载失败')
      }
      const summaries = Array.isArray(result.data) ? result.data : []
      const databases = summaries.map(summary => summary.name)
      setConnectionDatabases(previous => {
        const next = new Map(previous)
        next.set(connId, summaries)
        return next
      })
      
      setTreeData(previous => updateConnectionTreeNode(
        previous,
        item => item.type === 'connection' && item.connId === connId,
        item => ({
          ...item,
          children: summaries.map(summary => ({
            key: `database:${connId}:${summary.name}`,
            title: summary.name,
            type: 'database',
            connId,
            database: summary.name,
            sizeBytes: summary.sizeBytes,
          })),
        }),
      ))
      const totalSize = summaries.reduce(
        (total, summary) => total + (summary.sizeBytes || 0),
        0,
      )
      void window.logger.write(
        'info',
        'ConnectionWorkspace',
        `连接数据库摘要加载完成: 连接=${connId}, 数量=${databases.length}, 总大小=${totalSize}, 含大小=${summaries.filter(item => item.sizeBytes != null).length}, 耗时=${Date.now() - startedAt}ms`,
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      void window.logger.write(
        'error',
        'ConnectionWorkspace',
        `加载数据库列表失败: 连接=${connId}, 原因=${detail}`,
      )
      // 连接已被服务端断开时，这里同时把连接状态回退为“未连接”，
      // 避免树与状态栏继续显示“已连接”导致后续操作反复报错
      const invalidConnection = connections.get(connId)
      if (invalidConnection && isConnectionInvalidError(error)) {
        resetInvalidConnection(invalidConnection)
      } else {
        message.error(`加载数据库列表失败: ${detail}`)
      }
    } finally {
      setConnectionDatabasesLoading(previous => {
        const next = new Set(previous)
        next.delete(connId)
        return next
      })
    }
  }

  const openCreateDatabase = async (connection: ConnectionData) => {
    if (connection.type === 'SQLite') {
      message.warning('SQLite 连接通过数据库文件管理')
      return
    }
    if (!activeConnections.has(connection.id)) {
      void window.logger.write(
        'info',
        'ConnectionWorkspace',
        `新建数据库前建立连接: 连接=${connection.id}`,
      )
      const result = await handleConnect(connection)
      if (!result.success) return
    }
    setCreateDatabaseDialog({ open: true, connection })
    void window.logger.write(
      'info',
      'ConnectionWorkspace',
      `从连接右键菜单打开新建数据库对话框: 连接=${connection.id}, 类型=${connection.type}`,
    )
  }

  const createDatabase = async (
    databaseName: string,
    options: CreateDatabaseOptions,
  ) => {
    const connection = createDatabaseDialog.connection
    if (!connection) throw new Error('未找到目标连接')

    void window.logger.write(
      'info',
      'ConnectionWorkspace',
      `提交新建数据库: 连接=${connection.id}, 数据库=${databaseName}, 编码选项=${JSON.stringify(options)}`,
    )
    const result = await window.database.createDatabase(
      connection.id,
      databaseName,
      options,
    )
    if (!result?.success || !result.data) {
      const detail = result?.error?.detail
        || result?.error?.message
        || '新建数据库失败'
      void window.logger.write(
        'error',
        'ConnectionWorkspace',
        `新建数据库失败: 连接=${connection.id}, 数据库=${databaseName}, 原因=${detail}`,
      )
      throw new Error(detail)
    }

    await loadDatabases(connection.id)
    void window.logger.write(
      'info',
      'ConnectionWorkspace',
      `新建数据库并刷新列表完成: 连接=${connection.id}, 数据库=${result.data.name}, 编码选项=${JSON.stringify(options)}`,
    )
  }

  const loadDatabaseObjects = async (
    connId: string,
    database: string,
    options?: { force?: boolean },
  ) => {
    const force = options?.force === true
    const requestSequence = ++databaseObjectLoadSequence.current
    const loadTarget = `database:${connId}:${database}`
    databaseObjectLoadTarget.current = loadTarget

    // 缓存命中且非强制刷新：先用缓存秒开树与面板，后台异步刷新
    const cachedSummaries = force ? undefined : getCachedTableSummaries(connId, database)
    if (cachedSummaries && cachedSummaries.length > 0) {
      const cachedTables = [...new Set(cachedSummaries.map(item => item.name))]
      const cachedObjects: DatabaseObjects = {
        tables: cachedTables,
        views: [],
        functions: [],
        procedures: [],
        events: [],
        queries: [],
        reports: [],
        backups: [],
      }
      setDatabaseObjects(cachedObjects)
      setTableSummaries(cachedSummaries)
      setTableSummariesError('')
      setDatabaseObjectsLoading(false)
      const groups = loadDatabaseObjectGroups(connId, database)
      const cachedChildren = buildDatabaseObjectTree(
        connId,
        database,
        cachedObjects,
        groups,
        [],
      )
      setTreeData(previous => updateConnectionTreeNode(
        previous,
        item => item.type === 'database'
          && item.connId === connId
          && item.database === database,
        item => ({ ...item, children: cachedChildren }),
      ))
      void window.logger.write(
        'info',
        'ObjectWorkspace',
        `命中表清单缓存秒开: 连接=${connId}, 数据库=${database}, 表=${cachedTables.length}`,
      )
      // 后台异步刷新（不阻塞 UI）；不预清空，避免界面闪烁
      void refreshDatabaseObjectsFromIPC(connId, database, requestSequence, false)
      return
    }

    setDatabaseObjects(createEmptyDatabaseObjects())
    setDatabaseBackupRecords([])
    setTableSummaries([])
    setTableSummariesError('')
    setDatabaseObjectsLoading(true)
    setTreeData(previous => updateConnectionTreeNode(
      previous,
      item => item.type === 'database'
        && item.connId === connId
        && item.database === database,
      item => ({
        ...item,
        // 数据请求返回前先创建固定分类，避免显示上一个数据库的对象。
        children: buildDatabaseObjectTree(connId, database, createEmptyDatabaseObjects()),
      }),
    ))
    void window.logger.write(
      'info',
      'ObjectWorkspace',
      `开始加载数据库对象: 连接=${connId}, 数据库=${database}, 序号=${requestSequence}, 强制=${force}`,
    )

    // 未命中或强制：走完整 IPC 加载
    await refreshDatabaseObjectsFromIPC(connId, database, requestSequence, true)
  }

  /**
   * 走 IPC 全量加载数据库对象并落地（缓存 + state + tree）。
   * 仅在请求序号仍为最新时落地，避免覆盖更新的请求。
   * @param clearFirst 是否在请求前清空对象（命中缓存秒开后台刷新场景传 false）
   */
  const refreshDatabaseObjectsFromIPC = async (
    connId: string,
    database: string,
    requestSequence: number,
    clearFirst: boolean,
  ) => {
    if (clearFirst) {
      setDatabaseObjects(createEmptyDatabaseObjects())
      setDatabaseBackupRecords([])
      setTableSummaries([])
      setTableSummariesError('')
      setDatabaseObjectsLoading(true)
    }
    try {
      const [
        tableSummariesResult,
        viewsResult,
        functionsResult,
        proceduresResult,
        eventsResult,
        backupsResult,
      ] = await Promise.all([
        window.database.getTableSummaries(connId, database),
        window.database.getViews(connId, database),
        window.database.getFunctions(connId, database),
        window.database.getProcedures(connId, database),
        window.database.getEvents(connId, database),
        window.database.listBackups(connId, database),
      ])
      const readList = (
        result: IPCResponse<string[]>,
        label: string,
      ): string[] => {
        if (!result?.success) {
          throw responseError(result || {}, `${label}加载失败`)
        }
        const source = Array.isArray(result.data) ? result.data : []
        const normalized = source.flatMap(value => (
          typeof value === 'string' && value.trim()
            ? [value.trim()]
            : []
        ))
        const values = [...new Set(normalized)]
        const invalidCount = source.length - normalized.length
        const duplicateCount = normalized.length - values.length
        if (invalidCount > 0 || duplicateCount > 0) {
          void window.logger.write(
            'warn',
            'ObjectWorkspace',
            `${label}包含无效数据: 无效=${invalidCount}, 重复=${duplicateCount}, 原始=${source.length}, 有效=${values.length}`,
          )
        }
        return values
      }
      if (!tableSummariesResult?.success) {
        throw responseError(tableSummariesResult || {}, '表明细加载失败')
      }
      const summaries = (tableSummariesResult.data || []).filter(item => (
        item
        && typeof item.name === 'string'
        && item.name.trim().length > 0
      )).map(item => ({ ...item, name: item.name.trim() }))
      const tables = [...new Set(summaries.map(item => item.name))]
      const views = readList(viewsResult, '视图列表')
      const functions = readList(functionsResult, '函数列表')
      const procedures = readList(proceduresResult, '存储过程列表')
      const events = readList(eventsResult, '事件列表')
      if (!backupsResult?.success) {
        throw responseError(backupsResult || {}, '备份记录加载失败')
      }
      const backups = (backupsResult.data || []).filter(record => (
        typeof record?.id === 'string'
        && typeof record.fileName === 'string'
        && record.fileName.length > 0
      ))
      const objects: DatabaseObjects = {
        tables,
        views,
        functions,
        procedures,
        events,
        queries: [],
        reports: [],
        backups: backups.map(record => record.fileName),
      }
      if (requestSequence !== databaseObjectLoadSequence.current) {
        void window.logger.write(
          'info',
          'ObjectWorkspace',
          `忽略过期数据库对象结果: 连接=${connId}, 数据库=${database}, 序号=${requestSequence}`,
        )
        return
      }
      databaseObjectLoadTarget.current = ''
      setDatabaseObjects(objects)
      setTableSummaries(summaries)
      setTableSummariesError('')
      setDatabaseBackupRecords(backups)
      setDatabaseObjectsLoading(false)
      // 写入缓存：供下次切换秒开
      setCachedTableSummaries(connId, database, summaries)
      const groups = loadDatabaseObjectGroups(connId, database)
      const children = buildDatabaseObjectTree(
        connId,
        database,
        objects,
        groups,
        backups,
      )

      setTreeData(previous => updateConnectionTreeNode(
        previous,
        item => item.type === 'database'
          && item.connId === connId
          && item.database === database,
        item => ({ ...item, children }),
      ))
      void window.logger.write(
        'info',
        'ObjectWorkspace',
        `数据库对象加载完成: 连接=${connId}, 数据库=${database}, 表=${tables.length}, 视图=${views.length}, 函数=${functions.length}, 存储过程=${procedures.length}, 事件=${events.length}, 备份=${backups.length}, 对象分组=${groups.length}, 表样例=${tables.slice(0, 3).join(',') || '无'}`,
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      if (requestSequence !== databaseObjectLoadSequence.current) {
        void window.logger.write(
          'info',
          'ObjectWorkspace',
          `忽略过期数据库对象错误: 连接=${connId}, 数据库=${database}, 序号=${requestSequence}, 原因=${detail}`,
        )
        return
      }
      databaseObjectLoadTarget.current = ''
      setDatabaseObjects(createEmptyDatabaseObjects())
      setTableSummaries([])
      setTableSummariesError(detail)
      setDatabaseBackupRecords([])
      setDatabaseObjectsLoading(false)
      void window.logger.write(
        'error',
        'ObjectWorkspace',
        `加载数据库对象失败: 连接=${connId}, 数据库=${database}, 原因=${detail}`,
      )
      // 连接已失效时同步复位连接状态，并提示重新连接
      const invalidConnection = connections.get(connId)
      if (invalidConnection && isConnectionInvalidError(error)) {
        resetInvalidConnection(invalidConnection)
      } else {
        message.error(`加载数据库对象失败: ${detail}`)
      }
    }
  }

  const backupActions = useDatabaseBackupActions({
    onChanged: async context => {
      await loadDatabaseObjects(context.connection.id, context.database)
    },
  })

  const selectObjectCategory = (
    category: DatabaseObjectCategory,
    context = selectedDatabase,
    source: 'tree' | 'toolbar' = 'toolbar',
  ) => {
    if (!context || !activeConnections.has(context.connId)) return
    setSelectedDatabase(context)
    setObjectCategory(category)
    setSelectedObject(null)
    setSelectedTable(null)
    setSelectedTreeKey(databaseObjectCategoryTreeKey(
      context.connId,
      context.database,
      category,
    ))
    showObjects()
    void window.logger.write(
      'info',
      'ObjectWorkspace',
      `切换对象分类: 连接=${context.connId}, 数据库=${context.database}, 分类=${category}, 来源=${source}`,
    )
  }

  const handleTreeSelect = async (key: string) => {
    const item = findConnectionTreeItem(treeData, key)
    if (!item) return

    if (item.type === 'connection') {
      const conn = item.connId ? connections.get(item.connId) : undefined
      if (conn) {
        const wasActive = activeConnections.has(conn.id)
        const result = wasActive
          ? { success: true }
          : await handleConnect(conn)
        if (result.success) {
          databaseObjectLoadSequence.current += 1
          setSelectedConnection(conn)
          setSelectedDatabase(null)
          setSelectedTable(null)
          setSelectedObject(null)
          setSelectedTreeKey(key)
          setObjectCategory('tables')
          setDatabaseObjects(createEmptyDatabaseObjects())
          setDatabaseObjectsLoading(false)
          setTableSummaries([])
          setTableSummariesError('')
          showObjects()
          if (
            wasActive
            && !connectionDatabases.has(conn.id)
            && !connectionDatabasesLoading.has(conn.id)
          ) {
            void loadDatabases(conn.id)
          }
          setStatus(previous => ({
            ...previous,
            connection: `已连接: ${conn.name}`,
            database: '未选择',
          }))
          void window.logger.write(
            'info',
            'ConnectionWorkspace',
            `显示连接数据库概览: 连接=${conn.id}, 已缓存数据库=${connectionDatabases.get(conn.id)?.length || 0}`,
          )
        }
      }
    } else if (item.type === 'database') {
      if (!item.connId || !item.database || !activeConnections.has(item.connId)) {
        void window.logger.write(
          'warn',
          'ConnectionWorkspace',
          `忽略失效数据库选择: 连接=${item.connId || '未知'}, 数据库=${item.database || '未知'}`,
        )
        message.warning('数据库连接已失效，请重新连接')
        return
      }
      const connection = connections.get(item.connId)
      if (connection) setSelectedConnection(connection)
      const context = { connId: item.connId, database: item.database }
      selectObjectCategory('tables', context, 'tree')
      setStatus(previous => ({
        ...previous,
        connection: connection
          ? `已连接: ${connection.name}`
          : previous.connection,
        database: item.database!,
      }))
      await loadDatabaseObjects(item.connId, item.database)
    } else if (item.objectCategory) {
      if (!item.connId || !item.database || !activeConnections.has(item.connId)) {
        void window.logger.write(
          'warn',
          'ConnectionWorkspace',
          `忽略失效数据库对象选择: 连接=${item.connId || '未知'}, 数据库=${item.database || '未知'}, 对象=${item.title}`,
        )
        message.warning('数据库连接已失效，请重新连接')
        return
      }
      const connection = connections.get(item.connId)
      if (connection) setSelectedConnection(connection)
      const context = { connId: item.connId, database: item.database }
      selectObjectCategory(item.objectCategory, context, 'tree')
      setSelectedTreeKey(key)
      if (item.objectKind) {
        const selection: DatabaseObjectSelection = {
          id: item.objectId,
          name: item.title,
          category: item.objectCategory,
          kind: item.objectKind,
        }
        setSelectedObject(selection)
        setSelectedTable(item.objectKind === 'table'
          ? { ...context, tableName: item.title }
          : null)
        void window.logger.write(
          'info',
          'ObjectWorkspace',
          `选择数据库对象: 连接=${item.connId}, 数据库=${item.database}, 类型=${item.objectKind}, 对象=${item.title}`,
        )
      }
      setStatus(previous => ({
        ...previous,
        connection: connection
          ? `已连接: ${connection.name}`
          : previous.connection,
        database: item.database!,
      }))
    }
  }

  const openQueryTab = (
    connId: string,
    database: string,
    sql: string = '',
    file?: { name: string; filePath?: string },
  ) => {
    const connectionType = Array.from(connections.values()).find(
      connection => connection.id === connId,
    )?.type
    const newTab = {
      id: `query-${crypto.randomUUID()}`,
      kind: 'query' as const,
      name: file?.name || `查询 ${queryTabs.length + 1}`,
      sql,
      filePath: file?.filePath,
      selectedSql: '',
      cursorOffset: 0,
      connId,
      database,
      resultSets: [],
      messages: [],
      activeResultIndex: -1,
      executionTime: 0,
      executionState: 'idle' as const,
      requestId: '',
      transactionState: 'idle' as const,
      capabilities: getInitialQueryCapabilities(connectionType),
      dirty: file?.filePath ? false : Boolean(sql),
    }
    openQuery(newTab)
  }

  const finalizeCloseDocument = useCallback(async (
    document: WorkspaceDocument,
  ) => {
    if (document.kind === 'query') {
      const result = await window.querySession.close(document.id)
      if (!result.success) {
        await window.logger.write(
          'warn',
          'QueryWorkspace',
          `关闭查询会话失败: 会话=${document.id}, 原因=${
            result.error?.message || '未知错误'
          }`,
        )
      }
    }
    closeDocument(document.id)
  }, [closeDocument])

  const executeSQL = async (
    tabId: string,
    mode: QueryExecutionMode = 'current',
  ) => {
    const tab = queryTabs.find(t => t.id === tabId)
    if (!tab || tab.executionState !== 'idle') return
    const executionSql = resolveQueryExecutionSql(
      tab.sql,
      tab.selectedSql,
      tab.cursorOffset,
      mode,
    )
    if (!executionSql) {
      message.info('当前没有可执行的 SQL 语句')
      return
    }
    if (!tab.connId) {
      message.error('请先选择一个已连接的数据库连接')
      return
    }

    const requestId = `request-${crypto.randomUUID()}`
    void window.logger.write(
      'info',
      'QueryWorkspace',
      `准备执行查询: 会话=${tab.id}, 模式=${mode}, SQL长度=${executionSql.length}`,
    )
    updateQuery(tabId, {
      executionState: 'running',
      requestId,
      resultSets: [],
      messages: [],
      activeResultIndex: -1,
      executionTime: 0,
    })
    try {
      const ipcResult = await window.querySession.execute({
        sessionId: tab.id,
        requestId,
        connId: tab.connId,
        database: tab.database,
        sql: executionSql,
      })
      if (!ipcResult.success || !ipcResult.data) {
        throw new Error(ipcResult.error?.message || '查询执行失败')
      }
      const result = ipcResult.data
      if (result.requestId !== requestId) {
        void window.logger.write(
          'warn',
          'QueryWorkspace',
          `忽略过期查询响应: 会话=${tab.id}, 期望请求=${requestId}, 实际请求=${result.requestId}`,
        )
        return
      }
      const rowCount = result.resultSets.reduce(
        (total, resultSet) => total + resultSet.rowCount,
        0,
      )
      updateQuery(tabId, {
        resultSets: result.resultSets,
        messages: result.messages,
        activeResultIndex: result.resultSets.length > 0 ? 0 : -1,
        executionTime: result.executionTime,
        executionState: 'idle',
        requestId: '',
        transactionState: result.transactionState,
        capabilities: result.capabilities,
      })
      setStatus(prev => ({
        ...prev,
        executionTime: result.executionTime.toFixed(4),
        recordCount: rowCount,
      }))

      const connName = Array.from(connections.values()).find(
        connection => connection.id === tab.connId,
      )?.name || tab.connId
      await (window as any).queryHistory.add(
        executionSql,
        connName,
        tab.database,
        result.executionTime,
        rowCount,
        result.success,
        result.messages.map(item => item.text).join('; '),
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      updateQuery(tabId, {
        resultSets: [],
        messages: [{
          index: 0,
          level: 'error',
          text: `执行失败: ${detail}`,
        }],
        activeResultIndex: -1,
        executionState: 'idle',
        requestId: '',
      })
      void window.logger.write(
        'error',
        'QueryWorkspace',
        `查询请求失败: 会话=${tab.id}, 请求=${requestId}, 模式=${mode}, 原因=${detail}`,
      )
    }
  }

  const cancelQuery = async (tabId: string) => {
    const tab = queryTabs.find(item => item.id === tabId)
    if (!tab || !tab.requestId || tab.executionState === 'idle') return
    updateQuery(tabId, { executionState: 'cancelling' })
    try {
      const result = await window.querySession.cancel(tab.id, tab.requestId)
      if (!result.success || !result.data?.accepted) {
        message.warning(
          result.data?.message
          || result.error?.message
          || '停止请求未被数据库接受',
        )
      }
    } catch (error) {
      message.error(
        `停止查询失败: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const changeQueryContext = async (
    tabId: string,
    patch: { connId?: string; database?: string },
  ) => {
    const tab = queryTabs.find(item => item.id === tabId)
    if (!tab) return
    const connId = patch.connId ?? tab.connId
    const database = patch.database ?? tab.database
    const closeResult = await window.querySession.close(tab.id)
    if (!closeResult.success) {
      message.error(closeResult.error?.message || '切换查询上下文失败')
      return
    }
    const connectionType = Array.from(connections.values()).find(
      connection => connection.id === connId,
    )?.type
    updateQuery(tabId, {
      connId,
      database,
      transactionState: 'idle',
      capabilities: getInitialQueryCapabilities(connectionType),
    })
  }

  const runQueryTransaction = async (
    tabId: string,
    action: 'begin' | 'commit' | 'rollback',
  ) => {
    const tab = queryTabs.find(item => item.id === tabId)
    if (!tab) return
    try {
      const result = await window.querySession[action](
        tab.id,
        tab.connId,
        tab.database,
      )
      if (!result.success || !result.data) {
        throw new Error(result.error?.message || '事务操作失败')
      }
      updateQuery(tabId, {
        transactionState: result.data.transactionState,
        capabilities: result.data.capabilities,
      })
      message.success(result.data.message)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`事务操作失败: ${detail}`)
      void window.logger.write(
        'error',
        'QueryWorkspace',
        `事务操作失败: 会话=${tab.id}, 操作=${action}, 原因=${detail}`,
      )
    }
  }

  const applyConnectionCatalog = (
    catalog: ConnectionCatalog,
    active = activeConnections,
  ) => {
    setConnections(new Map(
      catalog.connections.map(connection => [connection.id, connection]),
    ))
    setConnectionGroups(catalog.groups)
    setTreeData(previous => buildConnectionTree(catalog, active, previous))
  }

  const readCatalogResult = (
    result: IPCResponse<ConnectionCatalog>,
    fallbackMessage: string,
  ): ConnectionCatalog => {
    if (!result.success || !result.data) {
      throw new Error(
        result.error?.detail || result.error?.message || fallbackMessage,
      )
    }
    return result.data
  }

  const openNewConnection = (
    groupId?: string,
    initialDraft?: ConnectionDraft,
  ) => {
    setEditingConnection(undefined)
    setNewConnectionDraft(initialDraft)
    setNewConnectionGroupId(groupId)
    setShowConnectionDialog(true)
  }

  const openEditConnection = (connection: ConnectionData) => {
    setEditingConnection(connection)
    setNewConnectionDraft(undefined)
    setNewConnectionGroupId(undefined)
    setShowConnectionDialog(true)
  }

  const duplicateConnection = (connection: ConnectionData) => {
    const draft = {
      ...toConnectionDraft(connection),
      name: buildDuplicateConnectionName(connection.name, connections),
    }
    openNewConnection(connection.groupId, draft)
    void window.logger.write(
      'info',
      'ConnectionWorkspace',
      `打开复制连接对话框: 来源=${connection.id}, 副本名称=${draft.name}`,
    )
  }

  const ensureConnectionActive = async (
    connection: ConnectionData,
    action: string,
  ): Promise<boolean> => {
    if (activeConnections.has(connection.id)) return true
    void window.logger.write(
      'info',
      'ConnectionWorkspace',
      `${action}前建立连接: 连接=${connection.id}`,
    )
    const result = await handleConnect(connection)
    return result.success
  }

  const newQueryForConnection = async (connection: ConnectionData) => {
    if (!await ensureConnectionActive(connection, '新建查询')) return
    const database = selectedDatabase?.connId === connection.id
      ? selectedDatabase.database
      : connection.database || ''
    openQueryTab(connection.id, database)
    void window.logger.write(
      'info',
      'ConnectionWorkspace',
      `从连接右键菜单新建查询: 连接=${connection.id}, 数据库=${database || '服务器级'}`,
    )
  }

  const openCommandLine = async (
    connection: ConnectionData,
    database?: string,
  ) => {
    if (!await ensureConnectionActive(connection, '打开命令列界面')) return
    setCommandLineContext({ connection, database })
    void window.logger.write(
      'info',
      'ConnectionWorkspace',
      `打开命令列界面: 连接=${connection.id}, 类型=${connection.type}, 数据库=${database || '服务器级'}`,
    )
  }

  const saveConnection = async (
    draft: ConnectionDraft,
    connectAfterSave: boolean,
  ) => {
    const original = editingConnection
    const result = original
      ? await window.database.updateConnection(original.id, draft)
      : await window.database.createConnection(draft)
    const catalog = readCatalogResult(result, '保存连接失败')
    const nextActive = new Set(activeConnections)
    const runtimeSettingsChanged = Boolean(
      original && connectionSettingsChanged(original, draft),
    )
    if (original && runtimeSettingsChanged) {
      nextActive.delete(original.id)
      setActiveConnections(nextActive)
      clearConnectionContext(original.id)
    }
    applyConnectionCatalog(catalog, nextActive)

    const saved = original
      ? catalog.connections.find(item => item.id === original.id)
      : catalog.connections.find(item => (
        item.name.toLocaleLowerCase() === draft.name.trim().toLocaleLowerCase()
      ))
    if (
      saved
      && selectedConnection?.id === saved.id
      && !runtimeSettingsChanged
    ) {
      setSelectedConnection(saved)
    }
    void window.logger.write(
      'info',
      'ConnectionWorkspace',
      `${original ? '编辑' : '新建'}连接完成: 连接=${saved?.id || '未知'}, 分组=${draft.groupId || '未分组'}, 范围=${draft.type === 'SQLite' ? '文件数据库' : draft.database || '服务器级'}`,
    )
    if (connectAfterSave && saved) await handleConnect(saved)
  }

  const disconnectConnection = async (connection: ConnectionData) => {
    try {
      const result = await window.database.disconnect(connection.id)
      if (!result.success) {
        throw new Error(
          result.error?.detail || result.error?.message || '断开连接失败',
        )
      }
      const nextActive = new Set(activeConnections)
      nextActive.delete(connection.id)
      setActiveConnections(nextActive)
      setTreeData(previous => updateConnectionTreeNode(
        previous,
        item => item.type === 'connection' && item.connId === connection.id,
        item => ({ ...item, children: undefined }),
      ))
      clearConnectionContext(connection.id)
      // 断开连接后清掉该连接的所有缓存（表清单 + 表元数据），避免重连时读到陈旧数据
      clearObjectCacheConnection(connection.id)
      void window.logger.write(
        'info',
        'ConnectionWorkspace',
        `用户断开数据库连接: 连接=${connection.id}`,
      )
      message.success('连接已断开')
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      void window.logger.write(
        'error',
        'ConnectionWorkspace',
        `断开数据库连接失败: 连接=${connection.id}, 原因=${detail}`,
      )
      message.error(`断开连接失败: ${detail}`)
    }
  }

  const deleteConnection = (connection: ConnectionData) => {
    Modal.confirm({
      title: '删除连接',
      content: `确定删除“${connection.name}”吗？连接配置将无法恢复。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        const result = await window.database.deleteConnection(connection.id)
        const catalog = readCatalogResult(result, '删除连接失败')
        const nextActive = new Set(activeConnections)
        nextActive.delete(connection.id)
        setActiveConnections(nextActive)
        applyConnectionCatalog(catalog, nextActive)
        clearConnectionContext(connection.id)
        void window.logger.write(
          'info',
          'ConnectionWorkspace',
          `删除连接完成: 连接=${connection.id}`,
        )
        message.success('连接已删除')
      },
    })
  }

  const moveConnection = async (
    connection: ConnectionData,
    groupId?: string,
  ) => {
    try {
      const result = await window.database.updateConnection(
        connection.id,
        { ...toConnectionDraft(connection), groupId },
      )
      const catalog = readCatalogResult(result, '移动连接失败')
      applyConnectionCatalog(catalog)
      const updated = catalog.connections.find(item => item.id === connection.id)
      if (updated && selectedConnection?.id === connection.id) {
        setSelectedConnection(updated)
      }
      void window.logger.write(
        'info',
        'ConnectionWorkspace',
        `连接分组已更新: 连接=${connection.id}, 分组=${groupId || '未分组'}`,
      )
      message.success(groupId ? '连接已移动到指定分组' : '连接已移出分组')
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      void window.logger.write(
        'error',
        'ConnectionWorkspace',
        `更新连接分组失败: 连接=${connection.id}, 原因=${detail}`,
      )
      message.error(`更新连接分组失败: ${detail}`)
    }
  }

  const setConnectionColor = async (
    connection: ConnectionData,
    color?: string,
  ) => {
    try {
      const result = await window.database.updateConnection(
        connection.id,
        { ...toConnectionDraft(connection), color },
      )
      const catalog = readCatalogResult(result, '设置连接颜色失败')
      applyConnectionCatalog(catalog)
      const updated = catalog.connections.find(item => item.id === connection.id)
      if (updated && selectedConnection?.id === connection.id) {
        setSelectedConnection(updated)
      }
      void window.logger.write(
        'info',
        'ConnectionWorkspace',
        `连接颜色已更新: 连接=${connection.id}, 颜色=${color || '默认'}`,
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      void window.logger.write(
        'error',
        'ConnectionWorkspace',
        `设置连接颜色失败: 连接=${connection.id}, 原因=${detail}`,
      )
      message.error(`设置连接颜色失败: ${detail}`)
    }
  }

  const saveConnectionGroup = async (name: string) => {
    const result = groupDialog.group
      ? await window.database.renameGroup(groupDialog.group.id, name)
      : await window.database.createGroup(name)
    const catalog = readCatalogResult(result, '保存分组失败')
    applyConnectionCatalog(catalog)
  }

  const deleteConnectionGroup = (group: ConnectionGroup) => {
    const connectionCount = Array.from(connections.values())
      .filter(connection => connection.groupId === group.id).length
    Modal.confirm({
      title: '删除分组',
      content: connectionCount > 0
        ? `分组中有 ${connectionCount} 个连接。删除分组后，这些连接将移到未分组。`
        : `确定删除空分组“${group.name}”吗？`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        const result = await window.database.deleteGroup(group.id)
        applyConnectionCatalog(
          readCatalogResult(result, '删除分组失败'),
        )
        message.success('分组已删除')
      },
    })
  }

  const handleNewQuery = () => {
    if (selectedDatabase && activeConnections.has(selectedDatabase.connId)) {
      openQueryTab(selectedDatabase.connId, selectedDatabase.database)
      return
    }
    if (selectedConnection && activeConnections.has(selectedConnection.id)) {
      openQueryTab(selectedConnection.id, selectedConnection.database || '')
      return
    }
    void window.logger.write(
      'warn',
      'ConnectionWorkspace',
      '已阻止从失效连接上下文新建查询',
    )
    message.warning('请先建立并选择数据库连接')
  }

  const handleSelectDatabaseObject = (
    selection: DatabaseObjectSelection,
  ) => {
    if (!selectedDatabase) return
    setSelectedObject(selection)
    setSelectedTable(selection.kind === 'table'
      ? { ...selectedDatabase, tableName: selection.name }
      : null)
    if (selection.kind === 'table') {
      const tableIndex = databaseObjects.tables.indexOf(selection.name)
      if (tableIndex >= 0) {
        setSelectedTreeKey(databaseObjectTreeKey(
          selectedDatabase.connId,
          selectedDatabase.database,
          selection.kind,
          tableIndex,
          selection.name,
        ))
      }
    }
    void window.logger.write(
      'info',
      'ObjectWorkspace',
      `选择内容区对象: 连接=${selectedDatabase.connId}, 数据库=${selectedDatabase.database}, 类型=${selection.kind}, 对象=${selection.name}`,
    )
  }

  const handleOpenObjectTable = (
    tableName: string,
    targetDatabase = selectedDatabase,
  ) => {
    if (!targetDatabase) return
    const isCurrentDatabase = (
      selectedDatabase?.connId === targetDatabase.connId
      && selectedDatabase.database === targetDatabase.database
    )
    setSelectedDatabase(targetDatabase)
    setObjectCategory('tables')
    setSelectedObject({
      name: tableName,
      category: 'tables',
      kind: 'table',
    })
    setSelectedTable({ ...targetDatabase, tableName })
    const tableIndex = isCurrentDatabase
      ? databaseObjects.tables.indexOf(tableName)
      : -1
    if (tableIndex >= 0) {
      setSelectedTreeKey(databaseObjectTreeKey(
        targetDatabase.connId,
        targetDatabase.database,
        'table',
        tableIndex,
        tableName,
      ))
    }
    const documentId = [
      'data',
      targetDatabase.connId,
      targetDatabase.database,
      tableName,
    ].join(':')
    const existingDocument = documents.find(
      document => document.id === documentId && document.kind === 'data',
    )
    if (existingDocument) {
      activateDocument(documentId)
      return
    }
    openData({
      id: documentId,
      kind: 'data',
      name: tableName,
      connId: targetDatabase.connId,
      database: targetDatabase.database,
      objectName: tableName,
      dirty: false,
      columns: [],
      fields: [],
      rows: [],
      total: 0,
      page: 1,
      pageSize: 100,
      primaryKeys: [],
      editable: false,
      loading: true,
      error: '',
      query: {
        sorts: [],
        filters: [],
        filterLogic: 'and',
      },
    })
    const initialQuery: TableDataQuery = {
      sorts: [],
      filters: [],
      filterLogic: 'and',
    }
    void loadTableData(
      documentId,
      targetDatabase.connId,
      targetDatabase.database,
      tableName,
      1,
      100,
      initialQuery,
    )
    void window.logger.write(
      'info',
      'TableObjectMenu',
      `打开表数据: 连接=${targetDatabase.connId}, 数据库=${targetDatabase.database}, 表=${tableName}`,
    )
  }

  const loadTableMetadata = useCallback(async (
    connId: string,
    database: string,
    tableName: string,
  ): Promise<TableMetadata> => {
    // 命中缓存直接返回，避免来回切换表时反复拉 metadata
    const cached = getCachedTableMetadata(connId, database, tableName)
    if (cached) {
      return cached
    }
    void window.logger.write(
      'info',
      'TableStructure',
      `开始加载表内部结构: 连接=${connId}, 数据库=${database}, 表=${tableName}`,
    )
    try {
      const result = await window.database.getTableMetadata(
        connId,
        database,
        tableName,
      )
      if (!result.success || !result.data) {
        throw new Error(
          result.error?.detail
          || result.error?.message
          || '表内部结构加载失败',
        )
      }
      void window.logger.write(
        'info',
        'TableStructure',
        `表内部结构加载完成: 数据库=${database}, 表=${tableName}, 字段=${result.data.fields.length}, 索引=${result.data.indexes.length}, 外键=${result.data.foreign_keys.length}, DDL=${result.data.ddl ? '有' : '无'}`,
      )
      // 写入缓存，下次切换回该表秒出
      setCachedTableMetadata(connId, database, tableName, result.data)
      return result.data
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      void window.logger.write(
        'error',
        'TableStructure',
        `表内部结构加载失败: 连接=${connId}, 数据库=${database}, 表=${tableName}, 原因=${detail}`,
      )
      throw error
    }
  }, [])

  const closeTableDataDocuments = (
    connId: string,
    database: string,
    tableName: string,
  ) => {
    documents
      .filter(document => (
        document.kind === 'data'
        && document.connId === connId
        && document.database === database
        && document.objectName === tableName
      ))
      .forEach(document => closeDocument(document.id))
  }

  const openTableDesigner = async (
    tableName?: string,
    targetDatabase = selectedDatabase,
  ) => {
    if (!targetDatabase) return
    if (!tableName) {
      setTableDesigner({
        open: true,
        loading: false,
      })
      void window.logger.write(
        'info',
        'TableDesigner',
        `打开新建表设计器: 连接=${targetDatabase.connId}, 数据库=${targetDatabase.database}`,
      )
      return
    }

    setTableDesigner({
      open: true,
      originalName: tableName,
      loading: true,
    })
    try {
      const metadata = await loadTableMetadata(
        targetDatabase.connId,
        targetDatabase.database,
        tableName,
      )
      setTableDesigner({
        open: true,
        originalName: tableName,
        metadata,
        loading: false,
      })
      void window.logger.write(
        'info',
        'TableDesigner',
        `打开表结构设计器: 数据库=${targetDatabase.database}, 表=${tableName}, 字段=${metadata.fields.length}, 索引=${metadata.indexes.length}, 外键=${metadata.foreign_keys.length}`,
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      setTableDesigner({ open: false, loading: false })
      void window.logger.write(
        'error',
        'TableDesigner',
        `表结构加载失败: 数据库=${targetDatabase.database}, 表=${tableName}, 原因=${detail}`,
      )
      message.error(`加载表结构失败：${detail}`)
    }
  }

  const saveTableDefinition = async (
    request: SaveTableStructureRequest,
  ) => {
    if (!selectedDatabase) return
    setTableDesignerSaving(true)
    void window.logger.write(
      'info',
      'TableDesigner',
      `提交表内部结构: 数据库=${selectedDatabase.database}, 原表=${request.originalName || '新建'}, 新表=${request.definition.name}, 字段=${request.definition.fields.length}, 索引=${request.definition.indexes.length}, 外键=${request.definition.foreignKeys.length}`,
    )
    try {
      const result = await window.database.saveTableStructure(
        selectedDatabase.connId,
        selectedDatabase.database,
        request,
      )
      if (!result.success || !result.data) {
        throw new Error(
          result.error?.detail
          || result.error?.message
          || '保存表结构失败',
        )
      }
      if (request.originalName) {
        closeTableDataDocuments(
          selectedDatabase.connId,
          selectedDatabase.database,
          request.originalName,
        )
      }
      setTableDesigner({ open: false, loading: false })
      setSelectedObject({
        name: result.data.tableName,
        category: 'tables',
        kind: 'table',
      })
      setSelectedTable({
        ...selectedDatabase,
        tableName: result.data.tableName,
      })
      // 保存表结构后：失效旧表名 metadata（重命名场景），并清整库 metadata（字段/索引可能变化）
      if (request.originalName && request.originalName !== result.data.tableName) {
        clearObjectCacheTableMetadata(
          selectedDatabase.connId,
          selectedDatabase.database,
          request.originalName,
        )
      }
      clearObjectCacheTableMetadata(
        selectedDatabase.connId,
        selectedDatabase.database,
        result.data.tableName,
      )
      await loadDatabaseObjects(
        selectedDatabase.connId,
        selectedDatabase.database,
        { force: true },
      )
      setTableStructureRevision(value => value + 1)
      void window.logger.write(
        'info',
        'TableDesigner',
        `表内部结构保存完成: 数据库=${selectedDatabase.database}, 表=${result.data.tableName}, 模式=${result.data.mode}, 语句数=${result.data.statementCount}`,
      )
      message.success(
        result.data.mode === 'create'
          ? `表“${result.data.tableName}”已创建`
          : `表“${result.data.tableName}”结构已保存`,
      )
      result.data.warnings.forEach(warning => message.warning(warning))
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      void window.logger.write(
        'error',
        'TableDesigner',
        `表结构保存失败: 数据库=${selectedDatabase.database}, 表=${request.definition.name}, 原因=${detail}`,
      )
      message.error(`保存表结构失败：${detail}`)
    } finally {
      setTableDesignerSaving(false)
    }
  }

  const deleteTable = (
    tableName: string,
    targetDatabase = selectedDatabase,
  ) => {
    if (!targetDatabase) return
    const context = targetDatabase
    const hasDirtyData = documents.some(document => (
      document.kind === 'data'
      && document.connId === context.connId
      && document.database === context.database
      && document.objectName === tableName
      && document.dirty
    ))
    Modal.confirm({
      title: '删除表',
      content: hasDirtyData
        ? `表“${tableName}”存在未提交的数据修改。删除后表结构和全部数据都无法恢复。`
        : `确定删除表“${tableName}”吗？表结构和全部数据都将被删除。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        void window.logger.write(
          'info',
          'TableObjectMenu',
          `开始删除表: 连接=${context.connId}, 数据库=${context.database}, 表=${tableName}`,
        )
        try {
          const result = await window.database.dropTable(
            context.connId,
            context.database,
            tableName,
          )
          if (!result.success) {
            throw new Error(result.error?.message || '删除表失败')
          }
          closeTableDataDocuments(context.connId, context.database, tableName)
          setSelectedObject(null)
          setSelectedTable(null)
          // 删除表后：清掉该表 metadata 缓存，避免下次重名建表时命中陈旧元数据
          clearObjectCacheTableMetadata(context.connId, context.database, tableName)
          await loadDatabaseObjects(context.connId, context.database, { force: true })
          void window.logger.write(
            'info',
            'TableObjectMenu',
            `删除表完成: 连接=${context.connId}, 数据库=${context.database}, 表=${tableName}`,
          )
          message.success(`表“${tableName}”已删除`)
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error)
          void window.logger.write(
            'error',
            'TableObjectMenu',
            `删除表失败: 连接=${context.connId}, 数据库=${context.database}, 表=${tableName}, 原因=${detail}`,
          )
          message.error(`删除表失败：${detail}`)
          throw error
        }
      },
    })
  }

  const truncateTable = (
    tableName: string,
    targetDatabase = selectedDatabase,
  ) => {
    if (!targetDatabase) return
    const context = targetDatabase
    const hasDirtyData = documents.some(document => (
      document.kind === 'data'
      && document.connId === context.connId
      && document.database === context.database
      && document.objectName === tableName
      && document.dirty
    ))
    Modal.confirm({
      title: '清空表',
      content: hasDirtyData
        ? `表“${tableName}”存在未提交的数据修改。清空后所有数据都无法恢复。`
        : `确定清空表“${tableName}”吗？表中所有数据都将被删除。`,
      okText: '清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        const startedAt = Date.now()
        void window.logger.write(
          'info',
          'TableObjectMenu',
          `开始清空表: 连接=${context.connId}, 数据库=${context.database}, 表=${tableName}`,
        )
        try {
          const result = await window.database.truncateTable(
            context.connId,
            context.database,
            tableName,
          )
          if (!result.success || !result.data) {
            throw new Error(result.error?.message || '清空表失败')
          }
          const openDocuments = documents.filter(
            (document): document is Extract<
              WorkspaceDocument,
              { kind: 'data' }
            > => (
            document.kind === 'data'
            && document.connId === context.connId
            && document.database === context.database
            && document.objectName === tableName
            ),
          )
          await Promise.all(openDocuments.map(document => loadTableData(
            document.id,
            document.connId,
            document.database,
            document.objectName,
            1,
            document.pageSize,
            document.query,
          )))
          await loadDatabaseObjects(context.connId, context.database)
          void window.logger.write(
            'info',
            'TableObjectMenu',
            `清空表完成: 连接=${context.connId}, 数据库=${context.database}, 表=${tableName}, 影响行数=${result.data.affectedRows}, 耗时=${Date.now() - startedAt}ms`,
          )
          message.success(`表“${tableName}”已清空`)
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error)
          void window.logger.write(
            'error',
            'TableObjectMenu',
            `清空表失败: 连接=${context.connId}, 数据库=${context.database}, 表=${tableName}, 原因=${detail}, 耗时=${Date.now() - startedAt}ms`,
          )
          message.error(`清空表失败：${detail}`)
          throw error
        }
      },
    })
  }

  const openTableImportDialog = async (
    tableName: string,
    targetDatabase = selectedDatabase,
  ) => {
    if (!targetDatabase) return
    const context = targetDatabase
    try {
      void window.logger.write(
        'info',
        'TableTransfer',
        `打开导入向导: 连接=${context.connId}, 数据库=${context.database}, 目标表=${tableName}`,
      )
      const metadataResult = await window.database.getTableMetadata(
        context.connId,
        context.database,
        tableName,
      )
      if (!metadataResult.success || !metadataResult.data) {
        throw new Error(metadataResult.error?.message || '读取目标表结构失败')
      }
      const previewResult = await window.database.openTableImport(
        context.connId,
        context.database,
        tableName,
      )
      if (!previewResult.success || !previewResult.data) {
        throw new Error(
          previewResult.error?.detail
          || previewResult.error?.message
          || '读取导入文件失败',
        )
      }
      if (previewResult.data.cancelled) return
      setTableImport({
        open: true,
        ...context,
        tableName,
        fields: metadataResult.data.fields,
        preview: previewResult.data,
        importing: false,
      })
      void window.logger.write(
        'info',
        'TableTransfer',
        `导入向导文件加载完成: 数据库=${context.database}, 目标表=${tableName}, 文件=${previewResult.data.fileName}, 格式=${previewResult.data.format}, 行数=${previewResult.data.totalRows}, 字段=${previewResult.data.columns.length}`,
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      void window.logger.write(
        'error',
        'TableTransfer',
        `打开表数据导入向导失败: 数据库=${context.database}, 表=${tableName}, 原因=${detail}`,
      )
      message.error(`打开导入向导失败：${detail}`)
    }
  }

  const reloadTableImport = async (
    filePath: string,
    options: TableImportOptions,
  ): Promise<TableImportPreview> => {
    if (
      !tableImport.connId
      || !tableImport.database
      || !tableImport.tableName
    ) throw new Error('导入目标上下文已失效')
    void window.logger.write(
      'info',
      'TableTransfer',
      `按格式设置重新解析: 数据库=${tableImport.database}, 表=${tableImport.tableName}, 格式=${options.format}, 编码=${options.text?.encoding || '自动'}, 分隔符=${options.text ? JSON.stringify(options.text.delimiter) : '不适用'}`,
    )
    const result = await window.database.reloadTableImport(
      tableImport.connId,
      tableImport.database,
      tableImport.tableName,
      filePath,
      options,
    )
    if (!result.success || !result.data) {
      throw new Error(
        result.error?.detail
        || result.error?.message
        || '重新解析导入文件失败',
      )
    }
    void window.logger.write(
      'info',
      'TableTransfer',
      `重新解析完成: 数据库=${tableImport.database}, 表=${tableImport.tableName}, 格式=${options.format}, 行数=${result.data.totalRows}, 字段=${result.data.columns.length}`,
    )
    return result.data
  }

  const importTableData = async (request: TableImportRequest) => {
    if (
      !tableImport.connId
      || !tableImport.database
      || !tableImport.tableName
    ) return
    const context = {
      connId: tableImport.connId,
      database: tableImport.database,
      tableName: tableImport.tableName,
    }
    setTableImport(previous => ({ ...previous, importing: true }))
    void window.logger.write(
      'info',
      'TableTransfer',
      `提交表数据导入: 数据库=${context.database}, 表=${context.tableName}, 格式=${request.format || '未知'}, 文件=${request.fileName || '未知'}, 行数=${request.rows.length}, 映射=${request.mappings.length}, 空字符串转NULL=${request.emptyStringAsNull ? '是' : '否'}`,
    )
    try {
      const result = await window.database.importTableRows(
        context.connId,
        context.database,
        context.tableName,
        request,
      )
      if (!result.success || !result.data) {
        throw new Error(
          result.error?.detail
          || result.error?.message
          || '导入表数据失败',
        )
      }
      setTableImport({ open: false, importing: false })
      void window.logger.write(
        'info',
        'TableTransfer',
        `表数据导入完成: 数据库=${context.database}, 表=${context.tableName}, 格式=${request.format || '未知'}, 导入行数=${result.data.importedRows}`,
      )
      const relatedDocuments = documents.filter(document => (
        document.kind === 'data'
        && document.connId === context.connId
        && document.database === context.database
        && document.objectName === context.tableName
      ))
      relatedDocuments
        .filter(document => !document.dirty)
        .forEach(document => {
          if (document.kind !== 'data') return
          void loadTableData(
            document.id,
            document.connId,
            document.database,
            document.objectName,
            document.page,
            document.pageSize,
            document.query,
          )
        })
      message.success(`已向表“${context.tableName}”导入 ${result.data.importedRows} 行数据`)
      if (relatedDocuments.some(document => document.dirty)) {
        message.warning('存在未提交的数据页，为避免覆盖本地修改未自动刷新')
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      void window.logger.write(
        'error',
        'TableTransfer',
        `表数据导入失败: 数据库=${context.database}, 表=${context.tableName}, 原因=${detail}`,
      )
      message.error(`导入失败：${detail}`)
    } finally {
      setTableImport(previous => ({ ...previous, importing: false }))
    }
  }

  const openTableExportDialog = async (
    connId: string,
    database: string,
    objectType: DatabaseExportObjectType,
    initialSelection?: string[],
  ) => {
    const startedAt = Date.now()
    void window.logger.write(
      'info',
      'TableTransfer',
      `加载导出向导对象: 连接=${connId}, 数据库=${database}, 类型=${objectType}, 预选=${initialSelection?.join(',') || '无'}`,
    )
    const result = await window.database.getTableExportObjects(
      connId,
      database,
      objectType,
    )
    if (!result.success || !result.data) {
      throw new Error(
        result.error?.detail
        || result.error?.message
        || '读取导出对象和字段失败',
      )
    }
    if (result.data.length === 0) {
      throw new Error(objectType === 'view'
        ? '当前数据库中没有可导出的视图'
        : '当前数据库中没有可导出的表')
    }
    setTableExport({
      open: true,
      connId,
      database,
      objects: result.data,
      initialSelection,
      exporting: false,
    })
    void window.logger.write(
      'info',
      'TableTransfer',
      `导出向导对象加载完成: 数据库=${database}, 类型=${objectType}, 对象数=${result.data.length}, 字段总数=${result.data.reduce((sum, item) => sum + item.columns.length, 0)}, 耗时=${Date.now() - startedAt}ms`,
    )
  }

  const exportTableData = async (request: TableExportBatchRequest) => {
    if (!tableExport.connId || !tableExport.database) return
    const context = {
      connId: tableExport.connId,
      database: tableExport.database,
    }
    setTableExport(previous => ({ ...previous, exporting: true }))
    void window.logger.write(
      'info',
      'TableTransfer',
      `提交批量导出: 数据库=${context.database}, 格式=${request.options.format}, 对象数=${request.objects.length}, 字段总数=${request.objects.reduce((sum, item) => sum + item.columns.length, 0)}`,
    )
    try {
      const result = await window.database.exportTableBatch(
        context.connId,
        context.database,
        request,
      )
      if (!result.success || !result.data) {
        throw new Error(
          result.error?.detail
          || result.error?.message
          || '导出对象数据失败',
        )
      }
      if (result.data.cancelled) {
        void window.logger.write(
          'info',
          'TableTransfer',
          `用户取消批量导出: 数据库=${context.database}, 格式=${request.options.format}`,
        )
        return
      }
      setTableExport({ open: false, exporting: false })
      void window.logger.write(
        'info',
        'TableTransfer',
        `批量导出完成: 数据库=${context.database}, 格式=${request.options.format}, 对象数=${result.data.objectCount}, 行数=${result.data.rowCount}`,
      )
      message.success(
        `已导出 ${result.data.objectCount} 个对象，共 ${result.data.rowCount} 行数据`,
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      void window.logger.write(
        'error',
        'TableTransfer',
        `批量导出失败: 数据库=${context.database}, 格式=${request.options.format}, 对象数=${request.objects.length}, 原因=${detail}`,
      )
      message.error(`导出失败：${detail}`)
    } finally {
      setTableExport(previous => ({ ...previous, exporting: false }))
    }
  }

  const openObjectTransferTarget = async (
    context: DatabaseObjectCategoryActionContext,
    action: 'import' | 'export',
  ) => {
    const startedAt = Date.now()
    if (context.category !== 'tables' && context.category !== 'views') {
      throw new Error('当前对象分类不支持数据导入或导出')
    }
    const selectedInContext = selectedDatabase?.connId === context.connection.id
      && selectedDatabase.database === context.database
      && selectedObject?.category === context.category
      ? selectedObject.name
      : undefined
    void window.logger.write(
      'info',
      'ObjectCategoryMenu',
      `开始加载传输候选: 动作=${action}, 分类=${context.category}, 连接=${context.connection.id}, 数据库=${context.database}`,
    )
    if (action === 'export') {
      await openTableExportDialog(
        context.connection.id,
        context.database,
        context.category === 'views' ? 'view' : 'table',
        selectedInContext ? [selectedInContext] : undefined,
      )
      return
    }
    if (context.category !== 'tables') {
      throw new Error('导入向导仅支持将文件数据写入表')
    }
    const response = await window.database.getTables(
      context.connection.id,
      context.database,
    )
    if (!response.success || !response.data) {
      throw new Error(
        response.error?.detail
        || response.error?.message
        || '读取可选对象失败',
      )
    }
    if (response.data.length === 0) {
      throw new Error(
        context.category === 'tables'
          ? '当前数据库中没有可用表'
          : '当前数据库中没有可用视图',
      )
    }

    setObjectTransferTarget({
      connId: context.connection.id,
      database: context.database,
      category: context.category,
      action,
      candidates: response.data,
      initialValue: selectedInContext,
    })
    void window.logger.write(
      'info',
      'ObjectCategoryMenu',
      `对象传输候选加载完成: 动作=${action}, 分类=${context.category}, 连接=${context.connection.id}, 数据库=${context.database}, 候选=${response.data.length}, 默认对象=${selectedInContext || '无'}, 耗时=${Date.now() - startedAt}ms`,
    )
  }

  const confirmObjectTransferTarget = (name: string) => {
    const target = objectTransferTarget
    if (!target) return
    setObjectTransferTarget(undefined)
    void window.logger.write(
      'info',
      'ObjectCategoryMenu',
      `确认导入目标表: 连接=${target.connId}, 数据库=${target.database}, 表=${name}`,
    )
    void openTableImportDialog(name, target)
  }

  const handleTableAction = (
    action: DatabaseObjectAction,
    tableName?: string,
    targetDatabase = selectedDatabase,
  ) => {
    if (!targetDatabase) {
      message.warning('请先选择数据库')
      return
    }
    void window.logger.write(
      'info',
      'TableObjectMenu',
      `触发表对象操作: 动作=${action.id}, 连接=${targetDatabase.connId}, 数据库=${targetDatabase.database}, 表=${tableName || '未选择'}`,
    )
    if (action.id === 'open' && tableName) {
      handleOpenObjectTable(tableName, targetDatabase)
      return
    }
    if (action.id === 'create') {
      void openTableDesigner(undefined, targetDatabase)
      return
    }
    if (action.id === 'design' && tableName) {
      void openTableDesigner(tableName, targetDatabase)
      return
    }
    if (action.id === 'delete' && tableName) {
      deleteTable(tableName, targetDatabase)
      return
    }
    if (action.id === 'truncate' && tableName) {
      truncateTable(tableName, targetDatabase)
      return
    }
    if (action.id === 'import' && tableName) {
      void openTableImportDialog(tableName, targetDatabase)
      return
    }
    if (action.id === 'export' && tableName) {
      void openTableExportDialog(
        targetDatabase.connId,
        targetDatabase.database,
        'table',
        [tableName],
      ).catch(error => {
        const detail = error instanceof Error ? error.message : String(error)
        void window.logger.write(
          'error',
          'TableTransfer',
          `打开单表导出向导失败: 数据库=${targetDatabase.database}, 表=${tableName}, 原因=${detail}`,
        )
        message.error(`打开导出向导失败：${detail}`)
      })
      return
    }
    notifyUnavailable(action.label)
  }

  const reportBackupActionFailure = (
    label: string,
    action: Promise<unknown>,
  ) => {
    void action.catch(error => {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`${label}失败：${detail}`)
    })
  }

  const executeBackupAction = (
    context: DatabaseBackupContext,
    action: DatabaseBackupRecordActionId | 'create' | 'refresh',
    target?: DatabaseBackupTarget,
  ) => {
    void window.logger.write(
      'info',
      'DatabaseBackup',
      `触发备份操作: 操作=${action}, 数据库=${context.database}, 备份=${target?.id || '未选择'}`,
    )
    if (action === 'create') {
      reportBackupActionFailure('打开备份窗口', backupActions.openCreate(context))
      return
    }
    if (action === 'restore') {
      backupActions.openRestore(context, target)
      return
    }
    if (action === 'showInFolder') {
      reportBackupActionFailure('打开备份目录', backupActions.showFolder(context))
      return
    }
    if (action === 'refresh') {
      reportBackupActionFailure(
        '刷新备份记录',
        loadDatabaseObjects(context.connection.id, context.database),
      )
      return
    }
    if (!target) {
      message.warning('请先选择备份记录')
      return
    }
    if (action === 'extract') {
      reportBackupActionFailure('提取备份 SQL', backupActions.extract(context, target))
      return
    }
    if (action === 'verify') {
      reportBackupActionFailure('校验备份', backupActions.verify(context, target))
      return
    }
    if (action === 'delete') {
      reportBackupActionFailure(
        '删除备份',
        backupActions.remove(context, target).then(deleted => {
          if (deleted) setSelectedObject(null)
        }),
      )
      return
    }
    reportBackupActionFailure(
      '重命名备份',
      backupActions.rename(context, target).then(record => {
        if (!record) return
        setSelectedObject({
          id: record.id,
          name: record.fileName,
          category: 'backups',
          kind: 'backup',
        })
      }),
    )
  }

  const handleObjectAction = (
    action: DatabaseObjectAction,
    selection?: DatabaseObjectSelection,
  ) => {
    if (!selectedDatabase) {
      message.warning('请先选择数据库')
      return
    }
    const connection = connections.get(selectedDatabase.connId)
    if (!connection) {
      message.error('当前连接信息不存在，请重新选择数据库')
      return
    }
    // 备份分类沿用专用处理逻辑
    if (objectCategory === 'backups') {
      const record = selection
        ? databaseBackupRecords.find(item => (
          selection.id ? item.id === selection.id : item.fileName === selection.name
        ))
        : undefined
      executeBackupAction(
        { connection, database: selectedDatabase.database },
        action.id as DatabaseBackupRecordActionId | 'create' | 'refresh',
        record,
      )
      return
    }
    // 其他分类走通用对象操作执行器
    const context: DatabaseObjectActionContext = {
      connection,
      database: selectedDatabase.database,
      category: objectCategory,
    }
    void runDatabaseObjectAction(context, action, selection, {
      onOpenViewData: (_ctx, viewName) => {
        // 视图数据浏览复用表数据浏览入口
        handleOpenObjectTable(viewName, selectedDatabase)
      },
      onOpenQueryDocument: (ctx, input) => {
        openQueryTab(ctx.connection.id, ctx.database, input.sql, { name: input.name })
      },
      onOpenExport: (connId, database, objectType, names) => (
        openTableExportDialog(connId, database, objectType, names)
      ),
      onRefresh: ctx => loadDatabaseObjects(ctx.connection.id, ctx.database),
      onClearSelection: () => setSelectedObject(null),
    })
  }

  const notifyUnavailable = (label: string) => {
    void window.logger.write(
      'info',
      'ObjectWorkspace',
      `对象操作暂未开放: 操作=${label}, 分类=${objectCategory}, 数据库=${selectedDatabase?.database || '未选择'}`,
    )
    message.info(`${label}功能正在迁移，当前版本尚不可用`)
  }

  /**
   * 将当前选中的对象或查询文档添加到收藏夹。
   * 优先级：选中的数据库对象 > 当前活动查询文档。
   */
  const addCurrentFavorite = async () => {
    // 优先收藏当前选中的数据库对象
    if (selectedDatabase && selectedObject) {
      const connection = connections.get(selectedDatabase.connId)
      if (!connection) {
        message.error('当前连接信息不存在')
        return
      }
      const objectTypeMap: Record<string, 'table' | 'view' | 'function' | 'event' | 'procedure'> = {
        table: 'table',
        view: 'view',
        function: 'function',
        procedure: 'procedure',
        event: 'event',
      }
      try {
        const result = await window.favorite.add({
          name: selectedObject.name,
          connId: connection.id,
          connectionName: connection.name,
          database: selectedDatabase.database,
          objectName: selectedObject.name,
          objectType: objectTypeMap[selectedObject.kind],
        })
        if (!result.success) {
          throw new Error(result.error?.message || '添加收藏失败')
        }
        void window.logger.write(
          'info',
          'Favorite',
          `添加对象收藏: 对象=${selectedObject.name}, 连接=${connection.id}`,
        )
        message.success(`已收藏「${selectedObject.name}」`)
        return
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        message.error(`添加收藏失败：${detail}`)
        return
      }
    }

    // 其次收藏当前活动查询文档
    if (activeDocument?.kind === 'query') {
      const connection = connections.get(activeDocument.connId)
      if (!connection) {
        message.error('当前查询文档连接信息不存在')
        return
      }
      try {
        const result = await window.favorite.add({
          name: activeDocument.name,
          connId: connection.id,
          connectionName: connection.name,
          database: activeDocument.database,
        })
        if (!result.success) {
          throw new Error(result.error?.message || '添加收藏失败')
        }
        void window.logger.write(
          'info',
          'Favorite',
          `添加查询收藏: 文档=${activeDocument.name}, 连接=${connection.id}`,
        )
        message.success(`已收藏「${activeDocument.name}」`)
        return
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        message.error(`添加收藏失败：${detail}`)
        return
      }
    }

    message.warning('请先选择数据库对象或打开查询文档')
  }

  /**
   * 选择收藏项后定位到对应对象。
   */
  const selectFavoriteItem = (item: FavoriteItem) => {
    const connection = Array.from(connections.values()).find(
      conn => conn.id === item.connId,
    )
    if (!connection) {
      message.error(`连接“${item.connectionName}”已不存在，请先创建对应连接`)
      return
    }
    setSelectedConnection(connection)
    setSelectedDatabase({
      connId: item.connId,
      database: item.database,
    })
    if (item.objectName) {
      const category: DatabaseObjectCategory = item.objectType === 'table'
        ? 'tables'
        : item.objectType === 'view'
          ? 'views'
          : item.objectType === 'event'
            ? 'events'
            : 'functions'
      setObjectCategory(category)
      const kind = item.objectType === 'table'
        ? 'table'
        : item.objectType === 'view'
          ? 'view'
          : item.objectType === 'event'
            ? 'event'
            : item.objectType === 'procedure'
              ? 'procedure'
              : 'function'
      setSelectedObject({
        name: item.objectName,
        kind: kind as DatabaseObjectKind,
        category,
      })
      if (item.objectType === 'table') {
        setSelectedTable({
          connId: item.connId,
          database: item.database,
          tableName: item.objectName,
        })
      }
    }
    showObjects()
    void window.logger.write(
      'info',
      'Favorite',
      `定位收藏项: 名称=${item.name}, 连接=${item.connId}, 对象=${item.objectName || '无'}`,
    )
  }

  const loadTableData = async (
    documentId: string,
    connId: string,
    database: string,
    tableName: string,
    page: number,
    pageSize: number,
    query: TableDataQuery,
  ) => {
    const requestId = (
      tableLoadSequence.current.get(documentId) || 0
    ) + 1
    tableLoadSequence.current.set(documentId, requestId)
    updateData(documentId, { loading: true, error: '' })
    try {
      const result = await window.database.getTableData(
        connId,
        database,
        tableName,
        page,
        pageSize,
        query,
      )
      if (tableLoadSequence.current.get(documentId) !== requestId) return
      if (!result.success || !result.data) {
        throw new Error(result.error?.message || '读取表数据失败')
      }
      updateData(documentId, {
        ...result.data,
        query,
        loading: false,
        error: '',
      })
      setStatus(previous => ({
        ...previous,
        recordCount: result.data?.total || 0,
      }))
    } catch (error) {
      if (tableLoadSequence.current.get(documentId) !== requestId) return
      const errorMessage = error instanceof Error
        ? error.message
        : String(error)
      updateData(documentId, {
        loading: false,
        error: errorMessage,
      })
      message.error(`读取表数据失败：${errorMessage}`)
    }
  }

  const handleRefresh = async () => {
    if (selectedDatabase && activeConnections.has(selectedDatabase.connId)) {
      // 强制刷新：清掉该库所有缓存（含表 metadata），再用 force 重拉覆盖
      clearObjectCacheDatabase(selectedDatabase.connId, selectedDatabase.database)
      await loadDatabaseObjects(
        selectedDatabase.connId,
        selectedDatabase.database,
        { force: true },
      )
      return
    }
    if (selectedConnection && activeConnections.has(selectedConnection.id)) {
      await loadDatabases(selectedConnection.id)
    }
  }

  const refreshConnection = async (connection: ConnectionData) => {
    try {
      if (activeConnections.has(connection.id)) {
        await loadDatabases(connection.id)
      } else {
        await loadConnections()
      }
      void window.logger.write(
        'info',
        'ConnectionWorkspace',
        `连接刷新完成: 连接=${connection.id}, 状态=${
          activeConnections.has(connection.id) ? '已连接' : '未连接'
        }`,
      )
      message.success('连接已刷新')
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      void window.logger.write(
        'error',
        'ConnectionWorkspace',
        `连接刷新失败: 连接=${connection.id}, 原因=${detail}`,
      )
      message.error(`连接刷新失败: ${detail}`)
    }
  }

  const commitTableData = async (
    documentId: string,
    batch: TableMutationBatch,
  ): Promise<boolean> => {
    const document = documents.find(
      item => item.id === documentId && item.kind === 'data',
    )
    if (!document || document.kind !== 'data') return false

    try {
      const result = await window.database.mutateTableRows(
        document.connId,
        document.database,
        document.objectName,
        batch,
      )
      if (!result.success || !result.data) {
        throw new Error(result.error?.message || '提交数据修改失败')
      }
      message.success(
        `提交完成：新增 ${result.data.insertedRows}，更新 ${result.data.updatedRows}，删除 ${result.data.deletedRows}`,
      )
      updateData(documentId, { dirty: false })
      return true
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error)
      message.error(`提交数据修改失败：${errorMessage}`)
      return false
    }
  }

  const activeSelectedDatabase = selectedDatabase
    && activeConnections.has(selectedDatabase.connId)
    ? selectedDatabase
    : null
  const activeSelectedConnection = selectedConnection
    && activeConnections.has(selectedConnection.id)
    ? selectedConnection
    : null

  const sqlFileCommands = useSqlFileCommands({
    activeDocument,
    defaultContext: activeSelectedDatabase || {
      connId: activeSelectedConnection?.id || '',
      database: activeSelectedConnection?.database || '',
    },
    openQueryFile: (input: OpenQueryFileInput) => {
      const existingDocument = queryTabs.find(
        document => document.filePath?.toLowerCase()
          === input.filePath.toLowerCase(),
      )
      if (existingDocument) {
        activateDocument(existingDocument.id)
        void window.logger.write(
          'info',
          'SqlFile',
          `最近文件已在工作区打开: 文件=${input.name}`,
        )
        return
      }
      openQueryTab(
        input.connId,
        input.database,
        input.sql,
        { name: input.name, filePath: input.filePath },
      )
    },
    updateQuery,
  })

  const runSqlFilesForConnection = async (connection: ConnectionData) => {
    if (!await ensureConnectionActive(connection, '运行 SQL 文件')) return
    const database = selectedDatabase?.connId === connection.id
      ? selectedDatabase.database
      : connection.database || ''
    await sqlFileCommands.openSqlFiles({
      connId: connection.id,
      database,
    })
  }

  const {
    pendingDocument: pendingCloseDocument,
    decide: decideDocumentClose,
    closeDocumentSafely,
    closeAllDocumentsSafely,
  } = useDocumentCloseGuard({
    documents,
    saveQueryDocument: sqlFileCommands.saveQueryDocument,
    finalizeClose: finalizeCloseDocument,
  })

  const unloadDatabaseWorkspace = (context: DatabaseActionContext) => {
    const loadTarget = `database:${context.connection.id}:${context.database}`
    const cancelledPendingLoad = databaseObjectLoadTarget.current === loadTarget
    if (cancelledPendingLoad) {
      databaseObjectLoadSequence.current += 1
      databaseObjectLoadTarget.current = ''
    }
    setTreeData(previous => updateConnectionTreeNode(
      previous,
      item => item.type === 'database'
        && item.connId === context.connection.id
        && item.database === context.database,
      item => ({ ...item, children: undefined }),
    ))
    void window.logger.write(
      'info',
      'DatabaseWorkspace',
      `数据库树节点已卸载: 连接=${context.connection.id}, 数据库=${context.database}, 取消在途加载=${cancelledPendingLoad ? '是' : '否'}`,
    )
    if (
      selectedDatabase?.connId !== context.connection.id
      || selectedDatabase.database !== context.database
    ) return
    setSelectedDatabase(null)
    setSelectedTable(null)
    setSelectedObject(null)
    setSelectedTreeKey(`connection:${context.connection.id}`)
    setObjectCategory('tables')
    setDatabaseObjects(createEmptyDatabaseObjects())
    setDatabaseObjectsLoading(false)
    setStatus(previous => ({ ...previous, database: '未选择' }))
    showObjects()
  }

  const selectDatabaseWorkspace = async (
    context: DatabaseActionContext,
  ) => {
    setSelectedConnection(context.connection)
    setSelectedDatabase({
      connId: context.connection.id,
      database: context.database,
    })
    setSelectedTable(null)
    setSelectedObject(null)
    setObjectCategory('tables')
    setSelectedTreeKey(databaseObjectCategoryTreeKey(
      context.connection.id,
      context.database,
      'tables',
    ))
    setStatus(previous => ({
      ...previous,
      connection: `已连接: ${context.connection.name}`,
      database: context.database,
    }))
    showObjects()
    await loadDatabaseObjects(context.connection.id, context.database)
  }

  /**
   * 打开 TDSQL 集群监控面板
   *
   * 仅 TDSQL 类型连接支持，由右键菜单触发。打开后会隐藏普通工作区，
   * 显示会话列表、DDL 任务、分片分布三个子面板。
   */
  const openClusterMonitor = async (connection: ConnectionData) => {
    if (connection.type !== 'TDSQL') {
      message.warning('集群监控仅支持 TDSQL 连接')
      return
    }
    if (!activeConnections.has(connection.id)) {
      message.warning('请先建立连接')
      return
    }
    setSelectedConnection(connection)
    setClusterMonitorConnection(connection)
    // 重置表列表，触发后续按需加载
    setMonitorTables([])
    void window.logger.write(
      'info',
      'TDSQLMonitor',
      `打开集群监控面板: 连接=${connection.id}, 默认数据库=${connection.database || '未指定'}`,
    )
  }

  /**
   * 为监控面板加载指定数据库下的表列表
   *
   * 分片分布子面板需要表名作为下拉选项，独立于左侧树的加载逻辑。
   * 使用 useCallback 保持引用稳定：子面板 effect 依赖本回调，
   * 若每次渲染都产生新引用会导致 effect 反复触发、形成请求风暴。
   */
  const loadMonitorTables = useCallback(async (database: string) => {
    const connId = clusterMonitorConnection?.id
    if (!connId || !database) return
    // 序号机制：仅最后一次请求允许落地结果，快速切库时旧响应直接丢弃
    const seq = ++monitorTablesSeqRef.current
    setMonitorTablesLoading(true)
    try {
      const result = await window.database.getTables(connId, database)
      if (seq !== monitorTablesSeqRef.current) return
      if (!result.success || !result.data) {
        throw new Error(
          result.error?.detail
          || result.error?.message
          || '加载表列表失败',
        )
      }
      setMonitorTables(result.data)
      void window.logger.write(
        'info',
        'TDSQLMonitor',
        `监控面板表列表已加载: 连接=${connId}, 数据库=${database}, 表数=${result.data.length}`,
      )
    } catch (error) {
      if (seq !== monitorTablesSeqRef.current) return
      const detail = error instanceof Error ? error.message : String(error)
      setMonitorTables([])
      void window.logger.write(
        'error',
        'TDSQLMonitor',
        `监控面板表列表加载失败: 连接=${connId}, 数据库=${database}, 原因=${detail}`,
      )
      message.error(`加载表列表失败：${detail}`)
    } finally {
      if (seq === monitorTablesSeqRef.current) {
        setMonitorTablesLoading(false)
      }
    }
  }, [clusterMonitorConnection])

  const databaseActions = useDatabaseActions({
    documents,
    closeDocumentSafely,
    onDisconnect: disconnectConnection,
    onConnectionInvalid: resetInvalidConnection,
    onUnload: unloadDatabaseWorkspace,
    onRenamed: async (context, nextName) => {
      await loadDatabases(context.connection.id)
      if (
        selectedDatabase?.connId === context.connection.id
        && selectedDatabase.database === context.database
      ) {
        await selectDatabaseWorkspace({ ...context, database: nextName })
      }
      void window.logger.write(
        'info',
        'DatabaseWorkspace',
        `数据库编辑完成: 连接=${context.connection.id}, 原名称=${context.database}, 新名称=${nextName}`,
      )
    },
    onDeleted: async context => {
      unloadDatabaseWorkspace(context)
      await loadDatabases(context.connection.id)
      void window.logger.write(
        'info',
        'DatabaseWorkspace',
        `数据库删除并刷新完成: 连接=${context.connection.id}, 数据库=${context.database}`,
      )
    },
    onEditConnection: openEditConnection,
    onNewQuery: context => {
      openQueryTab(context.connection.id, context.database)
      void window.logger.write(
        'info',
        'DatabaseWorkspace',
        `从数据库菜单新建查询: 连接=${context.connection.id}, 数据库=${context.database}`,
      )
    },
    onOpenTerminal: context => {
      void openCommandLine(context.connection, context.database)
    },
    onRunSqlFile: context => sqlFileCommands.openSqlFiles({
      connId: context.connection.id,
      database: context.database,
    }),
    onRefresh: async context => {
      await selectDatabaseWorkspace(context)
      message.success(`数据库“${context.database}”已刷新`)
    },
  })

  const focusObjectCategoryContext = (
    context: DatabaseObjectCategoryActionContext,
  ) => {
    setSelectedConnection(context.connection)
    selectObjectCategory(
      context.category,
      { connId: context.connection.id, database: context.database },
      'tree',
    )
    setStatus(previous => ({
      ...previous,
      connection: `已连接: ${context.connection.name}`,
      database: context.database,
    }))
  }

  const createObjectGroup = (
    context: DatabaseObjectCategoryActionContext,
    name: string,
  ) => {
    const startedAt = Date.now()
    const group = createDatabaseObjectGroup({
      connId: context.connection.id,
      database: context.database,
      category: context.category,
    }, name)
    const groupNode = databaseObjectGroupTreeNode(group)
    setTreeData(previous => updateConnectionTreeNode(
      previous,
      item => item.type === context.category
        && item.connId === context.connection.id
        && item.database === context.database,
      item => {
        const children = item.children || []
        const groupNodes = children.filter(child => child.type === 'objectGroup')
        const objectNodes = children.filter(child => child.type !== 'objectGroup')
        return {
          ...item,
          children: [...groupNodes, groupNode, ...objectNodes],
        }
      },
    ))
    void window.logger.write(
      'info',
      'ObjectCategoryMenu',
      `对象分组持久化并更新树完成: 分组=${group.name}, 分组ID=${group.id}, 分类=${context.category}, 连接=${context.connection.id}, 数据库=${context.database}, 耗时=${Date.now() - startedAt}ms`,
    )
    message.success(`分组“${group.name}”已创建`)
  }

  const showObjectCategoryFolder = async (
    context: DatabaseObjectCategoryActionContext,
  ) => {
    const startedAt = Date.now()
    if (
      context.category !== 'queries'
      && context.category !== 'reports'
      && context.category !== 'backups'
    ) {
      throw new Error('当前对象分类没有本地文件目录')
    }
    void window.logger.write(
      'info',
      'ObjectCategoryMenu',
      `请求打开对象文件夹: 分类=${context.category}, 连接=${context.connection.id}, 数据库=${context.database}`,
    )
    const result = context.category === 'backups'
      ? await window.database.showBackupFolder(
        context.connection.id,
        context.database,
      )
      : await window.application.showDatabaseObjectFolder(context.category)
    if (!result.success) {
      throw new Error(
        result.error?.detail
        || result.error?.message
        || '打开对象文件夹失败',
      )
    }
    void window.logger.write(
      'info',
      'ObjectCategoryMenu',
      `对象文件夹打开完成: 分类=${context.category}, 连接=${context.connection.id}, 数据库=${context.database}, 路径=${result.data?.path || '未知'}, 耗时=${Date.now() - startedAt}ms`,
    )
  }

  const handleDatabaseObjectCategoryAction = (
    connection: ConnectionData,
    database: string,
    category: DatabaseObjectCategory,
    action: DatabaseObjectCategoryActionId,
  ) => {
    const context = { connection, database, category }
    void runDatabaseObjectCategoryAction(context, action, {
      onFocus: focusObjectCategoryContext,
      onCreateTable: target => openTableDesigner(undefined, {
        connId: target.connection.id,
        database: target.database,
      }),
      onSelectTransferTarget: openObjectTransferTarget,
      onOpenQueryDocument: (target, input) => {
        openQueryTab(
          target.connection.id,
          target.database,
          input.sql,
          { name: input.name },
        )
      },
      onOpenSqlFiles: target => sqlFileCommands.openSqlFiles({
        connId: target.connection.id,
        database: target.database,
      }),
      onSearch: target => databaseActions.openSearch(target),
      onOpenBackup: target => backupActions.openCreate({
        connection: target.connection,
        database: target.database,
      }),
      onRestoreBackup: target => backupActions.openRestore({
        connection: target.connection,
        database: target.database,
      }),
      onExtractBackupSql: target => backupActions.extract({
        connection: target.connection,
        database: target.database,
      }),
      onCreateGroup: createObjectGroup,
      onShowInFolder: target => target.category === 'backups'
        ? backupActions.showFolder({
          connection: target.connection,
          database: target.database,
        })
        : showObjectCategoryFolder(target),
      onRefresh: async target => {
        await loadDatabaseObjects(target.connection.id, target.database)
        message.success(`“${target.category}”已刷新`)
      },
    })
  }

  const handleDatabaseBackupAction = (
    connection: ConnectionData,
    database: string,
    target: DatabaseBackupTarget,
    action: DatabaseBackupRecordActionId,
  ) => {
    const context = { connId: connection.id, database }
    selectObjectCategory('backups', context, 'tree')
    setSelectedObject({
      id: target.id,
      name: target.fileName,
      category: 'backups',
      kind: 'backup',
    })
    setSelectedTreeKey(databaseBackupTreeKey(
      connection.id,
      database,
      target.id,
    ))
    executeBackupAction({ connection, database }, action, target)
  }

  const selectDatabaseSearchResult = (result: DatabaseSearchResult) => {
    const context = databaseActions.searchDialog
    if (!context) return
    const objectName = result.kind === 'field'
      ? result.parent || result.name
      : result.name
    const kind = result.kind === 'field' ? 'table' : result.kind
    const category: DatabaseObjectCategory = kind === 'table'
      ? 'tables'
      : kind === 'view'
        ? 'views'
        : kind === 'event'
          ? 'events'
          : 'functions'
    setSelectedConnection(context.connection)
    setSelectedDatabase({
      connId: context.connection.id,
      database: context.database,
    })
    setObjectCategory(category)
    setSelectedObject({ name: objectName, kind, category })
    setSelectedTable(kind === 'table'
      ? {
        connId: context.connection.id,
        database: context.database,
        tableName: objectName,
      }
      : null)
    setSelectedTreeKey(databaseObjectCategoryTreeKey(
      context.connection.id,
      context.database,
      category,
    ))
    showObjects()
    databaseActions.closeSearch()
    void window.logger.write(
      'info',
      'DatabaseWorkspace',
      `数据库查找结果已定位: 数据库=${context.database}, 类型=${result.kind}, 对象=${objectName}`,
    )
  }

  const requestApplicationClose = useCallback(async () => {
    const canClose = await closeAllDocumentsSafely()
    if (!canClose) return

    const result = await window.application.confirmClose()
    if (!result.success) {
      await window.logger.write(
        'error',
        'DocumentClose',
        `关闭应用失败: ${result.error?.message || '未知错误'}`,
      )
      message.error(result.error?.message || '关闭应用失败')
    }
  }, [closeAllDocumentsSafely])

  useEffect(() => window.application.onCloseRequested(() => {
    void requestApplicationClose()
  }), [requestApplicationClose])

  const commands = useAppCommands(
    {
      newConnection: () => openNewConnection(),
      newQuery: handleNewQuery,
      openSqlFiles: sqlFileCommands.openSqlFiles,
      saveSqlFile: sqlFileCommands.saveActiveSqlFile,
      saveSqlFileAs: sqlFileCommands.saveActiveSqlFileAs,
      executeQuery: () => {
        if (activeTabId) void executeSQL(activeTabId, 'current')
      },
      executeAllQuery: () => {
        if (activeTabId) void executeSQL(activeTabId, 'all')
      },
      stopQuery: () => {
        if (activeTabId) void cancelQuery(activeTabId)
      },
      showObjects,
      selectObjectCategory,
      toggleDetails: () => setShowDetails(previous => !previous),
      toggleTheme: () => {
        setTheme(previous => previous === 'light' ? 'dark' : 'light')
      },
      refresh: () => {
        void handleRefresh()
      },
      openDataTransfer: () => {
        setDatabaseTool({ open: true, mode: 'transfer' })
      },
      openDataSync: () => {
        setDatabaseTool({ open: true, mode: 'dataSync' })
      },
      openStructureSync: () => {
        setDatabaseTool({ open: true, mode: 'structureSync' })
      },
      openModel: () => {
        // 通过菜单打开模型窗口：复用当前选中的数据库上下文
        if (!selectedDatabase) {
          message.warning('请先选择数据库')
          return
        }
        const connection = connections.get(selectedDatabase.connId)
        if (!connection) {
          message.error('当前连接信息不存在')
          return
        }
        databaseActions.openModel({
          connection,
          database: selectedDatabase.database,
        })
      },
      openAutomation: () => {
        // 自动运行配置对话框：管理保存的 SQL 自动执行配置
        setShowAutomation(true)
        void window.logger.write('info', 'Automation', '打开自动运行配置对话框')
      },
      editDocument: (action: EditorActionId) => {
        // 将命令系统分发的编辑动作路由到当前活动查询文档对应的 Monaco 编辑器
        const targetId = activeDocument?.kind === 'query' ? activeDocument.id : activeTabId
        const executed = executeEditorAction(targetId, action)
        // 未找到编辑器时提示，避免执行无声失败
        void executed.then(success => {
          if (!success) {
            const labelMap: Record<EditorActionId, string> = {
              undo: '撤销',
              redo: '重做',
              find: '查找',
              replace: '替换',
            }
            message.warning(`${labelMap[action]}：当前没有可编辑的查询文档`)
          }
        })
      },
      closeCurrent: async () => {
        if (activeTabId) await closeDocumentSafely(activeTabId)
      },
      closeAll: async () => {
        await closeAllDocumentsSafely()
      },
      exit: requestApplicationClose,
      showAbout: () => setShowAbout(true),
      showChangelog: () => setShowChangelog(true),
      favoriteAdd: () => {
        void addCurrentFavorite()
      },
      favoriteManage: () => setShowFavorite(true),
      openUserManagement: () => {
        // 用户管理需要选中的数据库上下文，回退到第一个可用连接
        const targetConnection = selectedConnection
          || Array.from(connections.values())[0]
        if (!targetConnection) {
          message.warning('请先创建至少一个数据库连接')
          return
        }
        const targetDatabase = selectedDatabase?.database
          || targetConnection.database
          || ''
        setUserManagementContext({
          connection: targetConnection,
          database: targetDatabase,
        })
        void window.logger.write(
          'info',
          'UserManagement',
          `打开用户管理: 连接=${targetConnection.id}`,
        )
      },
      notifyUnavailable,
    },
    {
      canCreateQuery: Boolean(
        activeSelectedDatabase || activeSelectedConnection,
      ),
      canExecuteQuery: Boolean(
        activeDocument?.kind === 'query'
        && activeDocument.sql.trim()
        && activeDocument.executionState === 'idle',
      ),
      canStopQuery: Boolean(
        activeDocument?.kind === 'query'
        && activeDocument.executionState !== 'idle'
        && activeDocument.capabilities.supportsCancel,
      ),
      canSaveSqlFile: activeDocument?.kind === 'query',
      /** 是否存在可接收编辑命令的活动 Monaco 编辑器：仅限查询文档 */
      canEditDocument: activeDocument?.kind === 'query',
      canShowObjects: Boolean(activeSelectedDatabase),
      canUseDatabaseTools: connections.size > 0,
      canFavoriteCurrent: Boolean(
        (selectedDatabase && selectedObject)
        || activeDocument?.kind === 'query',
      ),
      activeObjectCategory: objectCategory,
      detailsVisible: showDetails,
      hasActiveDocument: Boolean(activeTabId),
      hasDocuments: documents.length > 0,
      theme,
    },
  )

  return (
    <Layout className={`sqltool-layout ${theme}`}>
      <Header className="sqltool-header">
        <AppMenu
          commands={commands}
          recentFiles={sqlFileCommands.recentFiles}
          onOpenRecentFile={(filePath) => {
            void sqlFileCommands.openRecentSqlFile(filePath)
          }}
          onClearRecentFiles={() => {
            void sqlFileCommands.clearRecentFiles()
          }}
        />
        <Toolbar commands={commands} />
      </Header>

      <Content className="sqltool-content">
        <Layout className="workspace-layout">
          <LeftPanel
            treeData={treeData}
            connections={connections}
            groups={connectionGroups}
            activeConnections={activeConnections}
            selectedKey={selectedTreeKey}
            onSelect={handleTreeSelect}
            onConnect={handleConnect}
            onDisconnect={disconnectConnection}
            onCreateDatabase={connection => {
              void openCreateDatabase(connection)
            }}
            onNewConnection={groupId => {
              if (groupId) openNewConnection(groupId)
              else void commands.execute('connection.new')
            }}
            onEditConnection={openEditConnection}
            onDeleteConnection={deleteConnection}
            onDuplicateConnection={duplicateConnection}
            onNewQuery={connection => {
              void newQueryForConnection(connection)
            }}
            onOpenTerminal={connection => {
              void openCommandLine(connection)
            }}
            onRunSqlFile={connection => {
              void runSqlFilesForConnection(connection)
            }}
            onRefreshConnection={connection => {
              void refreshConnection(connection)
            }}
            onSetConnectionColor={(connection, color) => {
              void setConnectionColor(connection, color)
            }}
            onMoveConnection={(connection, groupId) => {
              void moveConnection(connection, groupId)
            }}
            onCloseDatabase={(connection, database) => {
              void databaseActions.closeDatabase({ connection, database })
            }}
            onEditDatabase={(connection, database) => {
              databaseActions.editDatabase({ connection, database })
            }}
            onDeleteDatabase={(connection, database) => {
              databaseActions.deleteDatabase({ connection, database })
            }}
            onNewDatabaseQuery={(connection, database) => {
              databaseActions.newQuery({ connection, database })
            }}
            onOpenDatabaseTerminal={(connection, database) => {
              databaseActions.openTerminal({ connection, database })
            }}
            onRunDatabaseSqlFile={(connection, database) => {
              void databaseActions.runSqlFile({ connection, database })
            }}
            onDumpDatabase={(connection, database) => {
              databaseActions.openDump({ connection, database })
            }}
            onPrintDatabase={(connection, database) => {
              void databaseActions.printDatabase({ connection, database })
            }}
            onReverseDatabase={(connection, database) => {
              databaseActions.openModel({ connection, database })
            }}
            onSearchDatabase={(connection, database) => {
              databaseActions.openSearch({ connection, database })
            }}
            onRefreshDatabase={(connection, database) => {
              void databaseActions.refresh({ connection, database })
            }}
            onDatabaseObjectCategoryAction={
              handleDatabaseObjectCategoryAction
            }
            onTableAction={(connection, database, action, tableName) => {
              const target = { connId: connection.id, database }
              setSelectedConnection(connection)
              setSelectedDatabase(target)
              setObjectCategory('tables')
              handleTableAction(action, tableName, target)
            }}
            onDatabaseBackupAction={handleDatabaseBackupAction}
            onNewGroup={() => setGroupDialog({ open: true })}
            onEditGroup={group => setGroupDialog({ open: true, group })}
            onDeleteGroup={deleteConnectionGroup}
            onOpenClusterMonitor={connection => {
              void openClusterMonitor(connection)
            }}
          />

          {clusterMonitorConnection ? (
            <TDSQLMonitorPanel
              connection={clusterMonitorConnection}
              databases={
                connectionDatabases.get(clusterMonitorConnection.id)
                  ?.map(item => item.name) || []
              }
              tables={monitorTables}
              tablesLoading={monitorTablesLoading}
              onLoadTables={loadMonitorTables}
              onClose={() => {
                void window.logger.write(
                  'info',
                  'TDSQLMonitor',
                  `关闭集群监控面板: 连接=${clusterMonitorConnection.id}`,
                )
                setClusterMonitorConnection(null)
                setMonitorTables([])
                // 关闭面板后回到对象浏览视图
                showObjects()
              }}
            />
          ) : (
            <>
              <WorkspaceHost
                documents={documents}
                activeDocumentId={activeTabId}
                surface={surface}
                onActivate={activateDocument}
                onClose={(documentId) => {
                  void closeDocumentSafely(documentId)
                }}
                onExecuteQuery={executeSQL}
                onCancelQuery={cancelQuery}
                onChangeQueryContext={changeQueryContext}
                onQueryTransaction={runQueryTransaction}
                onUpdateQuery={updateQuery}
                activeConnections={activeConnections}
                connections={connections}
                selectedConnection={selectedConnection}
                selectedDatabase={selectedDatabase}
                connectionDatabases={selectedConnection
                  ? connectionDatabases.get(selectedConnection.id) || []
                  : []}
                connectionDatabasesLoading={Boolean(
                  selectedConnection
                  && connectionDatabasesLoading.has(selectedConnection.id)
                )}
                objectCategory={objectCategory}
                databaseObjects={databaseObjects}
                tableSummaries={tableSummaries}
                tableSummariesError={tableSummariesError}
                databaseBackupRecords={databaseBackupRecords}
                databaseBackupVerification={backupActions.verification}
                databaseObjectsLoading={databaseObjectsLoading}
                selectedObject={selectedObject}
                onSelectObject={handleSelectDatabaseObject}
                onOpenDatabase={database => {
                  if (!selectedConnection) return
                  void window.logger.write(
                    'info',
                    'ConnectionWorkspace',
                    `双击内容区数据库并进入表列表: 连接=${selectedConnection.id}, 数据库=${database}`,
                  )
                  void handleTreeSelect(
                    `database:${selectedConnection.id}:${database}`,
                  )
                }}
                onRefreshConnectionDatabases={() => {
                  if (selectedConnection) {
                    void loadDatabases(selectedConnection.id)
                  }
                }}
                onRefreshTableSummaries={() => {
                  if (selectedDatabase) {
                    void loadDatabaseObjects(
                      selectedDatabase.connId,
                      selectedDatabase.database,
                    )
                  }
                }}
                onOpenObject={handleOpenObjectTable}
                onTableAction={handleTableAction}
                onObjectAction={handleObjectAction}
                onLoadData={(documentId, page, pageSize, query) => {
                  const document = documents.find(
                    item => item.id === documentId && item.kind === 'data',
                  )
                  if (document?.kind === 'data') {
                    void loadTableData(
                      document.id,
                      document.connId,
                      document.database,
                      document.objectName,
                      page,
                      pageSize,
                      query,
                    )
                  }
                }}
                onCommitData={commitTableData}
                onDirtyData={(documentId, dirty) => {
                  updateData(documentId, { dirty })
                }}
                onExportData={(connId, database, tableName) => {
                  void openTableExportDialog(connId, database, 'table', [tableName])
                    .catch(error => {
                      const detail = error instanceof Error
                        ? error.message
                        : String(error)
                      void window.logger.write(
                        'error',
                        'TableTransfer',
                        `打开数据工作区导出向导失败: 数据库=${database}, 表=${tableName}, 原因=${detail}`,
                      )
                      message.error(`打开导出向导失败：${detail}`)
                    })
                }}
                onLoadTableMetadata={loadTableMetadata}
                tableStructureRevision={tableStructureRevision}
                onNewQuery={() => {
                  void commands.execute('query.new')
                }}
                onUnavailable={notifyUnavailable}
              />

              {showDetails && (
                <RightPanel
                  selectedTable={selectedTable}
                  onLoadMetadata={loadTableMetadata}
                  onInsertSQL={(sql) => {
                    if (activeSelectedDatabase) {
                      openQueryTab(
                        activeSelectedDatabase.connId,
                        activeSelectedDatabase.database,
                        sql,
                      )
                    } else if (activeSelectedConnection) {
                      openQueryTab(
                        activeSelectedConnection.id,
                        activeSelectedConnection.database || '',
                        sql,
                      )
                    } else if (queryTabs.length > 0) {
                      const activeTab = queryTabs.find(t => t.id === activeTabId)
                      if (activeTab) {
                        updateQuery(activeTabId, { sql, dirty: true })
                      }
                    }
                  }}
                />
              )}
            </>
          )}
        </Layout>
      </Content>

      <Footer className="sqltool-footer">
        <StatusBar status={status} />
      </Footer>

      <UnsavedChangesDialog
        document={pendingCloseDocument}
        onDecision={decideDocumentClose}
      />

      {objectTransferTarget && (
        <DatabaseObjectTargetDialog
          value={objectTransferTarget}
          onCancel={() => setObjectTransferTarget(undefined)}
          onConfirm={confirmObjectTransferTarget}
        />
      )}

      {tableDesigner.open && selectedDatabase && (
        <TableDesignerDialog
          open
          database={selectedDatabase.database}
          databaseType={
            connections.get(selectedDatabase.connId)?.type || 'SQLite'
          }
          originalName={tableDesigner.originalName}
          metadata={tableDesigner.metadata}
          loading={tableDesigner.loading}
          saving={tableDesignerSaving}
          onCancel={() => {
            if (!tableDesignerSaving) {
              setTableDesigner({ open: false, loading: false })
            }
          }}
          onPreview={async request => {
            const result = await window.database.previewTableStructure(
              selectedDatabase.connId,
              selectedDatabase.database,
              request,
            )
            if (!result.success || !result.data) {
              throw new Error(
                result.error?.detail
                || result.error?.message
                || '生成表结构 SQL 失败',
              )
            }
            return result.data
          }}
          onSave={saveTableDefinition}
        />
      )}

      {tableImport.open
        && tableImport.tableName
        && tableImport.fields
        && tableImport.preview
        && (
          <TableImportDialog
            open
            tableName={tableImport.tableName}
            fields={tableImport.fields}
            preview={tableImport.preview}
            importing={tableImport.importing}
            onCancel={() => {
              if (!tableImport.importing) {
                setTableImport({ open: false, importing: false })
              }
            }}
            onReload={reloadTableImport}
            onImport={importTableData}
          />
        )}

      {tableExport.open
        && tableExport.connId
        && tableExport.objects
        && (
          <TableExportDialog
            open
            databaseType={
              connections.get(tableExport.connId)?.type || 'SQLite'
            }
            objects={tableExport.objects}
            initialSelection={tableExport.initialSelection}
            exporting={tableExport.exporting}
            onCancel={() => {
              if (!tableExport.exporting) {
                setTableExport({ open: false, exporting: false })
              }
            }}
            onExport={exportTableData}
          />
        )}

      {databaseTool.open && (
        <DatabaseToolDialog
          open
          mode={databaseTool.mode}
          connections={Array.from(connections.values())}
          connectedConnectionIds={activeConnections}
          initialSource={activeSelectedDatabase || (
            activeSelectedConnection
              ? {
                connId: activeSelectedConnection.id,
                database: activeSelectedConnection.database || '',
              }
              : undefined
          )}
          onConnect={handleConnect}
          onClose={() => setDatabaseTool(previous => ({
            ...previous,
            open: false,
          }))}
          onCompleted={() => {
            void handleRefresh()
          }}
        />
      )}

      {showConnectionDialog && (
        <ConnectionDialog
          connection={editingConnection}
          initialDraft={newConnectionDraft}
          defaultGroupId={newConnectionGroupId}
          groups={connectionGroups}
          onClose={() => {
            setShowConnectionDialog(false)
            setEditingConnection(undefined)
            setNewConnectionDraft(undefined)
            setNewConnectionGroupId(undefined)
          }}
          onSave={saveConnection}
          onTest={async (draft) => {
            const result = await window.database.testConnection(draft)
            return result.success && result.data
              ? result.data
              : {
                success: false,
                message: result.error?.detail
                  || result.error?.message
                  || '测试失败',
              }
          }}
        />
      )}
      {commandLineContext && (
        <CommandLineDialog
          connection={commandLineContext.connection}
          initialDatabase={commandLineContext.database}
          onClose={() => {
            void window.logger.write(
              'info',
              'ConnectionWorkspace',
              `关闭命令列界面: 连接=${commandLineContext.connection.id}, 数据库=${commandLineContext.database || '服务器级'}`,
            )
            setCommandLineContext(undefined)
          }}
        />
      )}
      {databaseActions.editDialog && (
        <DatabaseEditDialog
          connection={databaseActions.editDialog.connection}
          database={databaseActions.editDialog.database}
          onClose={databaseActions.closeEdit}
          onSave={databaseActions.saveEdit}
        />
      )}
      {databaseActions.dumpDialog && (
        <DatabaseDumpDialog
          database={databaseActions.dumpDialog.database}
          onClose={databaseActions.closeDump}
          onDump={databaseActions.dumpDatabase}
        />
      )}
      {databaseActions.modelDialog && (
        <DatabaseModelDialog
          connId={databaseActions.modelDialog.connection.id}
          database={databaseActions.modelDialog.database}
          onClose={databaseActions.closeModel}
        />
      )}
      {databaseActions.searchDialog && (
        <DatabaseSearchDialog
          connId={databaseActions.searchDialog.connection.id}
          database={databaseActions.searchDialog.database}
          onClose={databaseActions.closeSearch}
          onSelect={selectDatabaseSearchResult}
        />
      )}
      {groupDialog.open && (
        <ConnectionGroupDialog
          group={groupDialog.group}
          onClose={() => setGroupDialog({ open: false })}
          onSave={saveConnectionGroup}
        />
      )}
      {createDatabaseDialog.open && createDatabaseDialog.connection && (
        <CreateDatabaseDialog
          connection={createDatabaseDialog.connection}
          onClose={() => setCreateDatabaseDialog({ open: false })}
          onCreate={createDatabase}
        />
      )}
      {backupActions.dialog && (
        <DatabaseBackupDialog
          connection={backupActions.dialog.connection}
          database={backupActions.dialog.database}
          loading={backupActions.dialog.loading}
          model={backupActions.dialog.model}
          error={backupActions.dialog.error}
          onClose={backupActions.closeDialog}
          onCreate={backupActions.create}
        />
      )}
      {backupActions.restoreDialog && (
        <DatabaseRestoreDialog
          connection={backupActions.restoreDialog.connection}
          database={backupActions.restoreDialog.database}
          target={backupActions.restoreDialog.target}
          onClose={backupActions.closeRestoreDialog}
          onRestore={backupActions.restore}
        />
      )}
      <AboutDialog open={showAbout} onClose={() => setShowAbout(false)} />
      <ChangelogDialog
        open={showChangelog}
        onClose={() => setShowChangelog(false)}
      />
      <FavoriteDialog
        open={showFavorite}
        onClose={() => setShowFavorite(false)}
        onSelect={selectFavoriteItem}
      />
      {userManagementContext && (
        <UserManagementDialog
          connection={userManagementContext.connection}
          database={userManagementContext.database}
          onClose={() => setUserManagementContext(undefined)}
        />
      )}
      <AutomationDialog
        open={showAutomation}
        onClose={() => setShowAutomation(false)}
        currentConnId={selectedConnection?.id}
        currentDatabase={selectedDatabase?.database}
        onExecute={(config: AutomationConfig) => {
          // 执行自动运行配置：将 SQL 载入查询文档
          // 优先使用配置保存的连接，其次使用当前选中连接
          const targetConnection = (config.connId && connections.get(config.connId))
            || selectedConnection
            || Array.from(connections.values())[0]
          if (!targetConnection) {
            message.warning('请先创建至少一个数据库连接')
            return false
          }
          const targetDatabase = config.database
            || selectedDatabase?.database
            || targetConnection.database
            || ''
          openQueryTab(
            targetConnection.id,
            targetDatabase,
            config.sql,
            { name: config.name },
          )
          void window.logger.write(
            'info',
            'Automation',
            `执行配置: 名称=${config.name}, 连接=${targetConnection.id}`,
          )
          return true
        }}
      />
    </Layout>
  )
}

export default App
