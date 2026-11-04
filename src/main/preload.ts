import { contextBridge, ipcRenderer } from 'electron'
import type { TableDataQuery } from './database/tableDataQuery'
import type { QueryExecutionRequest } from './database/query/queryTypes'
import type {
  DatabaseExportObjectType,
  TableExportBatchRequest,
  TableExportFormat,
  TableImportOptions,
  TableImportRequest,
} from './database/tableTransferTypes'
import type {
  DataSyncRequest,
  DataTransferRequest,
  StructureSyncRequest,
} from './database/databaseToolTypes'
import type {
  AlterDatabaseRequest,
  DatabaseDumpMode,
} from './database/databaseManagementTypes'
import type { CreateDatabaseOptions } from './database/databaseCreation'
import type { SaveSqlFileRequest } from './services/sqlFileService'
import type { ExportQueryResultCsvRequest } from './services/resultExportService'
import type {
  CreateDatabaseBackupRequest,
  DatabaseBackupProgress,
  RestoreDatabaseBackupRequest,
} from './database/databaseBackupTypes'

contextBridge.exposeInMainWorld('sys', {
  appInfo: () => ipcRenderer.invoke('sys:appInfo'),
})

contextBridge.exposeInMainWorld('database', {
  loadConnections: () => ipcRenderer.invoke('database:loadConnections'),
  createConnection: (draft: any) =>
    ipcRenderer.invoke('database:createConnection', draft),
  updateConnection: (id: string, draft: any) =>
    ipcRenderer.invoke('database:updateConnection', id, draft),
  deleteConnection: (id: string) =>
    ipcRenderer.invoke('database:deleteConnection', id),
  createGroup: (name: string) =>
    ipcRenderer.invoke('database:createGroup', name),
  renameGroup: (id: string, name: string) =>
    ipcRenderer.invoke('database:renameGroup', id, name),
  deleteGroup: (id: string) =>
    ipcRenderer.invoke('database:deleteGroup', id),
  testConnection: (draft: any) =>
    ipcRenderer.invoke('database:testConnection', draft),
  connect: (connId: string) => ipcRenderer.invoke('database:connect', connId),
  disconnect: (connId: string) => ipcRenderer.invoke('database:disconnect', connId),
  getDatabases: (connId: string) => ipcRenderer.invoke('database:getDatabases', connId),
  getDatabaseSummaries: (connId: string) =>
    ipcRenderer.invoke('database:getDatabaseSummaries', connId),
  getDatabaseEncodingCatalog: (connId: string, database?: string) =>
    ipcRenderer.invoke(
      'database:getDatabaseEncodingCatalog',
      connId,
      database,
    ),
  createDatabase: (
    connId: string,
    databaseName: string,
    options?: CreateDatabaseOptions,
  ) => ipcRenderer.invoke(
    'database:createDatabase',
    connId,
    databaseName,
    options,
  ),
  closeDatabase: (connId: string, database: string) =>
    ipcRenderer.invoke('database:closeDatabase', connId, database),
  alterDatabase: (
    connId: string,
    database: string,
    request: AlterDatabaseRequest,
  ) => ipcRenderer.invoke(
    'database:alterDatabase',
    connId,
    database,
    request,
  ),
  dropDatabase: (connId: string, database: string) =>
    ipcRenderer.invoke('database:dropDatabase', connId, database),
  dumpDatabase: (
    connId: string,
    database: string,
    mode: DatabaseDumpMode,
  ) => ipcRenderer.invoke(
    'database:dumpDatabase',
    connId,
    database,
    mode,
  ),
  listBackups: (connId: string, database: string) =>
    ipcRenderer.invoke('database:listBackups', connId, database),
  createBackup: (
    connId: string,
    database: string,
    request: CreateDatabaseBackupRequest,
  ) => ipcRenderer.invoke(
    'database:createBackup',
    connId,
    database,
    request,
  ),
  restoreBackup: (
    connId: string,
    database: string,
    request: RestoreDatabaseBackupRequest,
  ) => ipcRenderer.invoke(
    'database:restoreBackup',
    connId,
    database,
    request,
  ),
  extractBackupSql: (
    connId: string,
    database: string,
    backupId?: string,
  ) => ipcRenderer.invoke(
    'database:extractBackupSql',
    connId,
    database,
    backupId,
  ),
  deleteBackup: (
    connId: string,
    database: string,
    backupId: string,
  ) => ipcRenderer.invoke(
    'database:deleteBackup',
    connId,
    database,
    backupId,
  ),
  renameBackup: (
    connId: string,
    database: string,
    backupId: string,
    name: string,
  ) => ipcRenderer.invoke(
    'database:renameBackup',
    connId,
    database,
    backupId,
    name,
  ),
  verifyBackup: (
    connId: string,
    database: string,
    backupId: string,
  ) => ipcRenderer.invoke(
    'database:verifyBackup',
    connId,
    database,
    backupId,
  ),
  showBackupFolder: (connId: string, database: string) =>
    ipcRenderer.invoke('database:showBackupFolder', connId, database),
  onBackupProgress: (
    callback: (progress: DatabaseBackupProgress) => void,
  ) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: DatabaseBackupProgress) => (
      callback(progress)
    )
    ipcRenderer.on('database:backupProgress', listener)
    return () => ipcRenderer.removeListener(
      'database:backupProgress',
      listener,
    )
  },
  getDatabaseModel: (connId: string, database: string) =>
    ipcRenderer.invoke('database:getDatabaseModel', connId, database),
  printDatabase: (connId: string, database: string) =>
    ipcRenderer.invoke('database:printDatabase', connId, database),
  getTables: (connId: string, database: string) => ipcRenderer.invoke('database:getTables', connId, database),
  getTableSummaries: (connId: string, database: string) =>
    ipcRenderer.invoke('database:getTableSummaries', connId, database),
  getViews: (connId: string, database: string) => ipcRenderer.invoke('database:getViews', connId, database),
  getProcedures: (connId: string, database: string) => ipcRenderer.invoke('database:getProcedures', connId, database),
  getFunctions: (connId: string, database: string) => ipcRenderer.invoke('database:getFunctions', connId, database),
  getEvents: (connId: string, database: string) => ipcRenderer.invoke('database:getEvents', connId, database),
  getTableMetadata: (connId: string, database: string, tableName: string) => 
    ipcRenderer.invoke('database:getTableMetadata', connId, database, tableName),
  previewTableStructure: (
    connId: string,
    database: string,
    request: any,
  ) => ipcRenderer.invoke(
    'database:previewTableStructure',
    connId,
    database,
    request,
  ),
  saveTableStructure: (
    connId: string,
    database: string,
    request: any,
  ) => ipcRenderer.invoke(
    'database:saveTableStructure',
    connId,
    database,
    request,
  ),
  dropTable: (connId: string, database: string, tableName: string) =>
    ipcRenderer.invoke('database:dropTable', connId, database, tableName),
  truncateTable: (connId: string, database: string, tableName: string) =>
    ipcRenderer.invoke(
      'database:truncateTable',
      connId,
      database,
      tableName,
    ),
  openTableImport: (connId: string, database: string, tableName: string) =>
    ipcRenderer.invoke(
      'database:openTableImport',
      connId,
      database,
      tableName,
    ),
  reloadTableImport: (
    connId: string,
    database: string,
    tableName: string,
    filePath: string,
    options: TableImportOptions,
  ) => ipcRenderer.invoke(
    'database:reloadTableImport',
    connId,
    database,
    tableName,
    filePath,
    options,
  ),
  importTableRows: (
    connId: string,
    database: string,
    tableName: string,
    request: TableImportRequest,
  ) => ipcRenderer.invoke(
    'database:importTableRows',
    connId,
    database,
    tableName,
    request,
  ),
  exportTableData: (
    connId: string,
    database: string,
    tableName: string,
    format: TableExportFormat,
    objectType: DatabaseExportObjectType = 'table',
  ) => ipcRenderer.invoke(
    'database:exportTableData',
    connId,
    database,
    tableName,
    format,
    objectType,
  ),
  getTableExportObjects: (
    connId: string,
    database: string,
    objectType: DatabaseExportObjectType,
  ) => ipcRenderer.invoke(
    'database:getTableExportObjects',
    connId,
    database,
    objectType,
  ),
  exportTableBatch: (
    connId: string,
    database: string,
    request: TableExportBatchRequest,
  ) => ipcRenderer.invoke(
    'database:exportTableBatch',
    connId,
    database,
    request,
  ),
  getTableData: (
    connId: string,
    database: string,
    tableName: string,
    page: number,
    pageSize: number,
    query?: TableDataQuery,
  ) => ipcRenderer.invoke(
    'database:getTableData',
    connId,
    database,
    tableName,
    page,
    pageSize,
    query,
  ),
  updateTableRows: (
    connId: string,
    database: string,
    tableName: string,
    updates: any[],
  ) => ipcRenderer.invoke(
    'database:updateTableRows',
    connId,
    database,
    tableName,
    updates,
  ),
  mutateTableRows: (
    connId: string,
    database: string,
    tableName: string,
    batch: any,
  ) => ipcRenderer.invoke(
    'database:mutateTableRows',
    connId,
    database,
    tableName,
    batch,
  ),
  executeSQL: (connId: string, database: string, sql: string) =>
    ipcRenderer.invoke('database:executeSQL', connId, database, sql),
  dropDatabaseObject: (
    connId: string,
    database: string,
    kind: 'view' | 'function' | 'procedure' | 'event',
    objectName: string,
  ) => ipcRenderer.invoke(
    'database:dropDatabaseObject',
    connId,
    database,
    kind,
    objectName,
  ),
  toggleDatabaseEvent: (
    connId: string,
    database: string,
    eventName: string,
    enable: boolean,
  ) => ipcRenderer.invoke(
    'database:toggleDatabaseEvent',
    connId,
    database,
    eventName,
    enable,
  ),
  executeDatabaseRoutine: (
    connId: string,
    database: string,
    kind: 'function' | 'procedure',
    routineName: string,
  ) => ipcRenderer.invoke(
    'database:executeDatabaseRoutine',
    connId,
    database,
    kind,
    routineName,
  ),
})

contextBridge.exposeInMainWorld('databaseTool', {
  previewTransfer: (request: DataTransferRequest) =>
    ipcRenderer.invoke('databaseTool:previewTransfer', request),
  executeTransfer: (request: DataTransferRequest) =>
    ipcRenderer.invoke('databaseTool:executeTransfer', request),
  previewDataSync: (request: DataSyncRequest) =>
    ipcRenderer.invoke('databaseTool:previewDataSync', request),
  executeDataSync: (request: DataSyncRequest) =>
    ipcRenderer.invoke('databaseTool:executeDataSync', request),
  previewStructureSync: (request: StructureSyncRequest) =>
    ipcRenderer.invoke('databaseTool:previewStructureSync', request),
  executeStructureSync: (request: StructureSyncRequest) =>
    ipcRenderer.invoke('databaseTool:executeStructureSync', request),
})

contextBridge.exposeInMainWorld('querySession', {
  execute: (request: QueryExecutionRequest) =>
    ipcRenderer.invoke('query:execute', request),
  cancel: (sessionId: string, requestId: string) =>
    ipcRenderer.invoke('query:cancel', sessionId, requestId),
  begin: (sessionId: string, connId: string, database: string) =>
    ipcRenderer.invoke('query:begin', sessionId, connId, database),
  commit: (sessionId: string, connId: string, database: string) =>
    ipcRenderer.invoke('query:commit', sessionId, connId, database),
  rollback: (sessionId: string, connId: string, database: string) =>
    ipcRenderer.invoke('query:rollback', sessionId, connId, database),
  close: (sessionId: string) =>
    ipcRenderer.invoke('query:closeSession', sessionId),
})

contextBridge.exposeInMainWorld('sqlFile', {
  open: () => ipcRenderer.invoke('file:openSql'),
  save: (request: SaveSqlFileRequest) =>
    ipcRenderer.invoke('file:saveSql', request),
  getRecent: () => ipcRenderer.invoke('file:getRecentSql'),
  openRecent: (filePath: string) =>
    ipcRenderer.invoke('file:openRecentSql', filePath),
  clearRecent: () => ipcRenderer.invoke('file:clearRecentSql'),
})

contextBridge.exposeInMainWorld('resultExport', {
  exportCsv: (request: ExportQueryResultCsvRequest) =>
    ipcRenderer.invoke('result:exportCsv', request),
})

contextBridge.exposeInMainWorld('application', {
  showDatabaseObjectFolder: (
    category: 'queries' | 'reports' | 'backups',
  ) => ipcRenderer.invoke('application:showDatabaseObjectFolder', category),
  confirmClose: () => ipcRenderer.invoke('application:confirmClose'),
  onCloseRequested: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('application:close-requested', listener)
    return () => {
      ipcRenderer.removeListener('application:close-requested', listener)
    }
  },
})

contextBridge.exposeInMainWorld('queryHistory', {
  get: (filterText?: string) => ipcRenderer.invoke('queryHistory:get', filterText),
  add: (sql: string, connectionName: string, database: string, 
        executionTime: number, rowCount: number, success: boolean, error: string) => 
    ipcRenderer.invoke('queryHistory:add', sql, connectionName, database, executionTime, rowCount, success, error),
  delete: (entryId: number) => ipcRenderer.invoke('queryHistory:delete', entryId),
  clear: () => ipcRenderer.invoke('queryHistory:clear'),
})

contextBridge.exposeInMainWorld('snippet', {
  get: (filterText?: string, category?: string) => ipcRenderer.invoke('snippet:get', filterText, category),
  getCategories: () => ipcRenderer.invoke('snippet:getCategories'),
  getById: (id: string) => ipcRenderer.invoke('snippet:getById', id),
  add: (snippet: any) => ipcRenderer.invoke('snippet:add', snippet),
  update: (id: string, updates: any) => ipcRenderer.invoke('snippet:update', id, updates),
  delete: (id: string) => ipcRenderer.invoke('snippet:delete', id),
  replaceVariables: (sql: string, variables: any) => ipcRenderer.invoke('snippet:replaceVariables', sql, variables),
})

contextBridge.exposeInMainWorld('favorite', {
  list: () => ipcRenderer.invoke('favorite:list'),
  add: (favorite: any) => ipcRenderer.invoke('favorite:add', favorite),
  update: (id: string, updates: any) => ipcRenderer.invoke('favorite:update', id, updates),
  delete: (id: string) => ipcRenderer.invoke('favorite:delete', id),
})

contextBridge.exposeInMainWorld('logger', {
  getLogFiles: () => ipcRenderer.invoke('logger:getLogFiles'),
  getLogContent: (fileName: string) => ipcRenderer.invoke('logger:getLogContent', fileName),
  clearLogs: () => ipcRenderer.invoke('logger:clearLogs'),
  write: (level: 'info' | 'warn' | 'error', module: string, message: string) =>
    ipcRenderer.invoke('logger:write', level, module, message),
})

// TDSQL 分布式数据库 IPC 暴露
contextBridge.exposeInMainWorld('tdsql', {
  getTableMetadata: (connId: string, database: string, tableName: string) =>
    ipcRenderer.invoke('tdsql:getTableMetadata', connId, database, tableName),
  getSessions: (connId: string) =>
    ipcRenderer.invoke('tdsql:getSessions', connId),
  getDdlTasks: (connId: string) =>
    ipcRenderer.invoke('tdsql:getDdlTasks', connId),
})
