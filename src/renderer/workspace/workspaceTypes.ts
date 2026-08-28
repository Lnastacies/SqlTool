import type {
  QueryCapabilities,
  QueryExecutionMessage,
  QueryResultSet,
  QueryTransactionState,
  TableDataQuery,
  TableFieldMetadata,
} from '../types'

export type WorkspaceDocumentKind =
  | 'query'
  | 'data'
  | 'tableDesigner'
  | 'viewDesigner'
  | 'routineDesigner'
  | 'triggerDesigner'
  | 'model'
  | 'report'
  | 'transfer'
  | 'synchronization'
  | 'backup'
  | 'automation'
  | 'monitor'

export type WorkspaceSurface = 'objects' | 'documents'

export interface WorkspaceDocumentBase {
  id: string
  kind: WorkspaceDocumentKind
  name: string
  connId: string
  database: string
  dirty: boolean
}

export interface QueryWorkspaceDocument extends WorkspaceDocumentBase {
  kind: 'query'
  sql: string
  filePath?: string
  selectedSql: string
  cursorOffset: number
  resultSets: QueryResultSet[]
  messages: QueryExecutionMessage[]
  activeResultIndex: number
  executionTime: number
  executionState: 'idle' | 'running' | 'cancelling'
  requestId: string
  transactionState: QueryTransactionState
  capabilities: QueryCapabilities
}

export interface ObjectWorkspaceDocument extends WorkspaceDocumentBase {
  kind:
    | 'tableDesigner'
    | 'viewDesigner'
    | 'routineDesigner'
    | 'triggerDesigner'
  objectName: string
}

export interface DataWorkspaceDocument extends WorkspaceDocumentBase {
  kind: 'data'
  objectName: string
  columns: string[]
  fields: TableFieldMetadata[]
  rows: Record<string, unknown>[]
  total: number
  page: number
  pageSize: number
  primaryKeys: string[]
  editable: boolean
  loading: boolean
  error: string
  query: TableDataQuery
}

export interface ToolWorkspaceDocument extends WorkspaceDocumentBase {
  kind:
    | 'model'
    | 'report'
    | 'transfer'
    | 'synchronization'
    | 'backup'
    | 'automation'
    | 'monitor'
}

export type WorkspaceDocument =
  | QueryWorkspaceDocument
  | DataWorkspaceDocument
  | ObjectWorkspaceDocument
  | ToolWorkspaceDocument
