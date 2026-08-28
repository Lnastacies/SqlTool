import type { TableStructurePlan } from './tableStructureTypes'

export interface DatabaseToolEndpoint {
  connId: string
  database: string
}

export interface DatabaseToolScope {
  source: DatabaseToolEndpoint
  target: DatabaseToolEndpoint
  tables: string[]
}

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
