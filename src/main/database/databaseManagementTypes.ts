import type { ConnectionData, TableMetadata } from './adapters'

export type DatabaseDumpMode = 'structure-data' | 'structure' | 'data'

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

export interface DropDatabaseResult {
  name: string
}

export interface CloseDatabaseResult {
  name: string
  /**
   * 关闭过程中检测到该连接已失效（服务端空闲超时断开），已一并剔除。
   * 渲染层据此把连接节点回退为“未连接”，提示用户重新连接。
   */
  connectionInvalidated?: boolean
}

export interface DatabaseDumpResult {
  cancelled: boolean
  filePath?: string
  tableCount: number
  rowCount: number
}

export interface DatabasePrintResult {
  cancelled: boolean
  tableCount: number
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
  type: ConnectionData['type']
  tables: DatabaseModelTable[]
  views: string[]
  functions: string[]
  procedures: string[]
  events: string[]
}
