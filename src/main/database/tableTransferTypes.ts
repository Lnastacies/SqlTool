export const MAX_TABLE_IMPORT_BYTES = 20 * 1024 * 1024
export const MAX_TABLE_IMPORT_ROWS = 20000
export const TABLE_EXPORT_PAGE_SIZE = 500

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
