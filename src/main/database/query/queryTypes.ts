import type { ConnectionData } from '../adapters'

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

export interface QueryExecutorOutput {
  resultSets: QueryResultSet[]
  messages: QueryExecutionMessage[]
  affectedRows: number
}

export type QueryCancelHandler = () => void | Promise<void>

export interface QueryExecutionContext {
  requestId: string
  setCancelHandler: (handler: QueryCancelHandler) => void
  isCancelRequested: () => boolean
}

export interface QueryExecutor {
  readonly capabilities: QueryCapabilities
  execute(
    connection: any,
    sql: string,
    connData: ConnectionData,
    context: QueryExecutionContext,
  ): Promise<QueryExecutorOutput>
  begin(connection: any): Promise<void>
  commit(connection: any): Promise<void>
  rollback(connection: any): Promise<void>
}
