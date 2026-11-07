export type DatabaseType = 'MySQL' | 'PostgreSQL' | 'SQL Server' | 'SQLite' | 'TDSQL'

export interface ConnectionData {
  id: string
  name: string
  type: DatabaseType
  groupId?: string
  host: string
  port: number
  username: string
  password: string
  database: string
  timeout?: number
  charset?: string
  ssl?: boolean
  color?: string
}

export type ConnectionDraft = Omit<ConnectionData, 'id'>

export interface ConnectionGroup {
  id: string
  name: string
}

export interface ConnectionCatalog {
  connections: ConnectionData[]
  groups: ConnectionGroup[]
}

export interface CreateDatabaseResult {
  name: string
}

export interface CreateDatabaseOptions {
  charset?: string
  encoding?: string
  collation?: string
}

export interface AlterDatabaseRequest {
  name?: string
  charset?: string
  collation?: string
}

export interface AlterDatabaseResult {
  previousName: string
  name: string
}

export interface DatabaseCharsetOption {
  value: string
  label: string
  defaultCollation?: string
}

export interface DatabaseCollationOption {
  value: string
  charset: string
}

export interface DatabaseEncodingCatalog {
  charset?: string
  collation?: string
  charsets: DatabaseCharsetOption[]
  collations: DatabaseCollationOption[]
}

export interface DatabaseSummary {
  name: string
  sizeBytes?: number
  tableCount?: number
  charset?: string
  collation?: string
  state?: string
}

export interface CloseDatabaseResult {
  name: string
  /** 关闭时检测到连接已失效并已剔除，渲染层需把连接回退为“未连接” */
  connectionInvalidated?: boolean
}

export interface DropDatabaseResult {
  name: string
}

export type DatabaseDumpMode = 'structure-data' | 'structure' | 'data'

export interface DatabaseDumpResult {
  cancelled: boolean
  filePath?: string
  tableCount: number
  rowCount: number
}

export interface DatabaseBackupScope {
  tables: string[]
  views: string[]
  functions: string[]
  procedures: string[]
  events: string[]
}

export interface DatabaseBackupOptions {
  compressed: boolean
  includeDropStatements: boolean
  disableForeignKeyChecks: boolean
  stripDefiners: boolean
}

export interface CreateDatabaseBackupRequest {
  operationId: string
  name: string
  description: string
  mode: DatabaseDumpMode
  scope: DatabaseBackupScope
  options: DatabaseBackupOptions
}

export interface DatabaseBackupRecord {
  schemaVersion: 1
  id: string
  connectionId: string
  database: string
  name: string
  description: string
  fileName: string
  filePath: string
  createdAt: string
  size: number
  databaseType: DatabaseType
  mode: DatabaseDumpMode
  compressed: boolean
  tableCount: number
  objectCount: number
  rowCount: number
  checksumSha256: string
}

export interface CreateDatabaseBackupResult {
  record: DatabaseBackupRecord
}

export interface RestoreDatabaseBackupRequest {
  operationId: string
  backupId?: string
  continueOnError: boolean
  useTransaction?: boolean
}

export interface RestoreDatabaseBackupResult {
  cancelled: boolean
  fileName?: string
  statementCount: number
  completedStatements: number
  failedStatements: number
}

export interface ExtractDatabaseBackupResult {
  cancelled: boolean
  filePath?: string
}

export interface DeleteDatabaseBackupResult {
  backupId: string
  fileName: string
}

export interface RenameDatabaseBackupResult {
  record: DatabaseBackupRecord
}

export interface VerifyDatabaseBackupResult {
  backupId: string
  fileName: string
  valid: true
}

export interface DatabaseBackupProgress {
  operationId: string
  phase: 'prepare' | 'structure' | 'data' | 'compress' | 'restore' | 'complete'
  percent: number
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

export interface DatabasePrintResult {
  cancelled: boolean
  tableCount: number
}

export interface IPCError {
  code: string
  message: string
  detail?: string
  suggestion?: string
}

export interface IPCResponse<T> {
  success: boolean
  data?: T
  error?: IPCError
}

export interface OpenedSqlFile {
  filePath: string
  name: string
  content: string
}

export interface OpenSqlFilesResult {
  cancelled: boolean
  files: OpenedSqlFile[]
}

export interface SaveSqlFileRequest {
  filePath?: string
  suggestedName?: string
  content: string
  forceDialog?: boolean
}

export interface SaveSqlFileResult {
  cancelled: boolean
  filePath?: string
  name?: string
}

export interface RecentSqlFile {
  filePath: string
  name: string
  lastOpenedAt: string
}

export interface TableFieldMetadata {
  name: string
  type: string
  not_null: boolean
  default: unknown
  default_expression?: string
  primary: boolean
  auto_increment?: boolean
  comment: string
}

export interface TableMetadata {
  primary_key_name?: string
  fields: TableFieldMetadata[]
  indexes: Array<{
    name: string
    type: string
    fields: string[]
    unique: boolean
  }>
  foreign_keys: Array<{
    name: string
    fields: string[]
    referenced_table: string
    referenced_fields: string[]
  }>
  ddl: string
}

export interface TableSummary {
  name: string
  rowCount?: number
  sizeBytes?: number
  createdAt?: string
  updatedAt?: string
  engine?: string
  comment?: string
  type: string
}

export interface DatabaseModelTable {
  name: string
  primaryKeyName?: string
  fields: TableMetadata['fields']
  indexes?: TableMetadata['indexes']
  foreignKeys: TableMetadata['foreign_keys']
  ddl: string
}

export interface DatabaseModel {
  name: string
  type: DatabaseType
  tables: DatabaseModelTable[]
  views: string[]
  functions: string[]
  procedures: string[]
  events: string[]
}

export interface TableFieldDefinition {
  originalName?: string
  name: string
  type: string
  notNull: boolean
  primary: boolean
  autoIncrement: boolean
  defaultValue: string
  comment: string
}

export interface TableIndexDefinition {
  originalName?: string
  name: string
  fields: string[]
  unique: boolean
}

export interface TableForeignKeyDefinition {
  originalName?: string
  name: string
  fields: string[]
  referencedTable: string
  referencedFields: string[]
}

export interface TableDefinition {
  name: string
  primaryKeyName?: string
  fields: TableFieldDefinition[]
  indexes: TableIndexDefinition[]
  foreignKeys: TableForeignKeyDefinition[]
}

export interface SaveTableStructureRequest {
  originalName?: string
  definition: TableDefinition
  /** TDSQL 建表选项，仅 databaseType === 'TDSQL' 时使用 */
  tdsqlOptions?: {
    tableType: 'shard' | 'noshard' | 'broadcast'
    shardKey?: string
  }
}

export interface TableStructurePlan {
  mode: 'create' | 'alter'
  statements: string[]
  /** 当前草稿对应的完整建表结构，仅用于预览。 */
  definitionStatements?: string[]
  warnings: string[]
}

export interface SaveTableStructureResult {
  tableName: string
  mode: TableStructurePlan['mode']
  statementCount: number
  warnings: string[]
}

export type TableImportFormat = 'txt' | 'csv' | 'json' | 'xml' | 'xlsx'
export type TableExportFormat =
  | 'txt'
  | 'csv'
  | 'html'
  | 'xlsx'
  | 'sql'
  | 'xml'
  | 'json'
export type DatabaseExportObjectType = 'table' | 'view'
export type TableTextEncoding = 'utf8' | 'utf8bom' | 'utf16le' | 'latin1'

export interface TableTextFormatOptions {
  includeHeader: boolean
  delimiter: string
  recordDelimiter: '\r\n' | '\n'
  quote: string
  encoding: TableTextEncoding
}

export interface TableImportOptions {
  format: TableImportFormat
  text?: TableTextFormatOptions
}

export interface TableImportPreview {
  cancelled: boolean
  filePath?: string
  fileName?: string
  format?: TableImportFormat
  sheetName?: string
  columns: string[]
  rows: Record<string, unknown>[]
  totalRows: number
  options?: TableImportOptions
}

export interface TableImportMapping {
  source: string
  target: string
}

export interface TableImportRequest {
  fileName?: string
  format?: TableImportFormat
  rows: Record<string, unknown>[]
  mappings: TableImportMapping[]
  emptyStringAsNull: boolean
}

export interface TableImportResult {
  importedRows: number
}

export interface TableExportOptions {
  format: TableExportFormat
  columns: string[]
  text?: TableTextFormatOptions
  binaryEncoding: 'base64' | 'hex'
  xml?: {
    prettyPrint: boolean
  }
  excel?: {
    freezeHeader: boolean
    autoFilter: boolean
  }
  sql?: {
    includeTransaction: boolean
  }
}

export interface TableExportObjectRequest {
  name: string
  objectType: DatabaseExportObjectType
  columns: string[]
}

export interface TableExportObjectMetadata {
  name: string
  objectType: DatabaseExportObjectType
  columns: string[]
}

export interface TableExportBatchRequest {
  objects: TableExportObjectRequest[]
  options: Omit<TableExportOptions, 'columns'>
}

export interface TableExportResult {
  cancelled: boolean
  filePath?: string
  rowCount: number
}

export interface TableExportBatchResult {
  cancelled: boolean
  directoryPath?: string
  objectCount: number
  rowCount: number
  files: Array<{
    objectName: string
    filePath: string
    rowCount: number
  }>
}

export interface ExecuteResult {
  success: boolean
  columns?: string[]
  rows?: Record<string, unknown>[]
  affected_rows?: number
  message: string
  execution_time?: number
}

export type QueryTransactionState = 'idle' | 'active' | 'failed'

export interface QueryCapabilities {
  supportsCancel: boolean
  supportsTransactions: boolean
  cancelMode: 'native' | 'control-connection' | 'unsupported'
}

export interface QueryResultColumn {
  key: string
  name: string
  dataType?: string
}

export interface QueryResultSet {
  id: string
  index: number
  columns: QueryResultColumn[]
  rows: unknown[][]
  rowCount: number
  command?: string
}

export interface QueryExecutionMessage {
  index: number
  level: 'info' | 'warning' | 'error'
  text: string
  command?: string
  affectedRows?: number
}

export interface QueryExecutionRequest {
  sessionId: string
  requestId: string
  connId: string
  database: string
  sql: string
}

export interface QueryExecutionResult {
  sessionId: string
  requestId: string
  success: boolean
  cancelled: boolean
  resultSets: QueryResultSet[]
  messages: QueryExecutionMessage[]
  affectedRows: number
  executionTime: number
  transactionState: QueryTransactionState
  capabilities: QueryCapabilities
}

export interface QuerySessionActionResult {
  sessionId: string
  transactionState: QueryTransactionState
  capabilities: QueryCapabilities
  message: string
}

export interface QueryCancelResult {
  sessionId: string
  requestId: string
  accepted: boolean
  message: string
}

export interface TableDataPage {
  columns: string[]
  fields: TableFieldMetadata[]
  rows: Record<string, unknown>[]
  total: number
  page: number
  pageSize: number
  primaryKeys: string[]
  editable: boolean
}

export type TableFilterLogic = 'and' | 'or'
export type TableSortDirection = 'asc' | 'desc'
export type TableFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'isNull'
  | 'isNotNull'

export interface TableDataSort {
  field: string
  direction: TableSortDirection
}

export interface TableDataFilter {
  field: string
  operator: TableFilterOperator
  value?: unknown
}

export interface TableDataQuery {
  sorts: TableDataSort[]
  filters: TableDataFilter[]
  filterLogic: TableFilterLogic
}

export interface TableRowUpdate {
  originalKey: Record<string, unknown>
  changes: Record<string, unknown>
}

export interface TableRowInsert {
  values: Record<string, unknown>
}

export interface TableRowDelete {
  originalKey: Record<string, unknown>
}

export interface TableMutationBatch {
  inserts: TableRowInsert[]
  updates: TableRowUpdate[]
  deletes: TableRowDelete[]
}

export interface TableMutationResult {
  insertedRows: number
  updatedRows: number
  deletedRows: number
  affectedRows: number
}

export interface DatabaseToolEndpoint {
  connId: string
  database: string
}

export interface DatabaseToolScope {
  source: DatabaseToolEndpoint
  target: DatabaseToolEndpoint
  tables: string[]
}

export type DatabaseToolMode = 'transfer' | 'dataSync' | 'structureSync'
export type DatabaseToolItemStatus = 'ready' | 'warning' | 'blocked'
export type DataTransferStrategy = 'append' | 'replace'

export interface DataTransferRequest extends DatabaseToolScope {
  strategy: DataTransferStrategy
  createMissing: boolean
  batchSize?: number
}

export interface DataTransferPreviewItem {
  table: string
  sourceRows: number
  targetRows: number
  targetExists: boolean
  commonColumns: string[]
  status: DatabaseToolItemStatus
  warnings: string[]
}

export interface DataTransferPreview {
  items: DataTransferPreviewItem[]
  sourceType: string
  targetType: string
  warnings: string[]
}

export interface DataTransferResult {
  tableCount: number
  transferredRows: number
  createdTables: string[]
  warnings: string[]
}

export interface DataSyncOptions {
  insert: boolean
  update: boolean
  delete: boolean
}

export interface DataSyncRequest extends DatabaseToolScope {
  options: DataSyncOptions
  batchSize?: number
}

export interface DataSyncPreviewItem {
  table: string
  sourceRows: number
  targetRows: number
  primaryKeys: string[]
  insertedRows: number
  updatedRows: number
  deletedRows: number
  unchangedRows: number
  status: DatabaseToolItemStatus
  warnings: string[]
}

export interface DataSyncPreview {
  items: DataSyncPreviewItem[]
  totals: {
    insertedRows: number
    updatedRows: number
    deletedRows: number
  }
  warnings: string[]
}

export interface DataSyncResult {
  tableCount: number
  insertedRows: number
  updatedRows: number
  deletedRows: number
  warnings: string[]
}

export interface StructureSyncRequest extends DatabaseToolScope {}

export interface StructureSyncPreviewItem {
  table: string
  targetExists: boolean
  status: DatabaseToolItemStatus | 'same'
  plan: TableStructurePlan
  warnings: string[]
}

export interface StructureSyncPreview {
  items: StructureSyncPreviewItem[]
  sourceType: string
  targetType: string
  warnings: string[]
}

export interface StructureSyncResult {
  tableCount: number
  statementCount: number
  createdTables: string[]
  alteredTables: string[]
  warnings: string[]
}
