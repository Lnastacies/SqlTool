import type { ConnectionData, DatabaseAdapter } from '../adapters'
import type { QueryCancelHandler, QueryExecutor, QueryTransactionState } from './queryTypes'

export interface ActiveQueryRequest {
  requestId: string
  cancelRequested: boolean
  cancelHandler?: QueryCancelHandler
  completion: Promise<void>
}

export interface QuerySession {
  id: string
  connId: string
  database: string
  connData: ConnectionData
  adapter: DatabaseAdapter
  connection: any
  ownsConnection: boolean
  executor: QueryExecutor
  transactionState: QueryTransactionState
  activeRequest?: ActiveQueryRequest
}

export type QueryTransactionAction = 'begin' | 'commit' | 'rollback'
