import type { DatabaseDumpMode } from './databaseManagementTypes'

export type DatabaseBackupObjectKind =
  | 'view'
  | 'function'
  | 'procedure'
  | 'event'
  | 'trigger'

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
  databaseType: string
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

export interface DatabaseBackupObjectDdl {
  name: string
  kind: DatabaseBackupObjectKind
  ddl: string
}

export type DatabaseBackupProgressReporter = (
  progress: Omit<DatabaseBackupProgress, 'timestamp'>,
) => void
