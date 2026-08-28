import { Connection, Request } from 'tedious'
import type { ConnectionData } from '../adapters'
import {
  affectedMessage,
  buildColumns,
  buildResultSet,
  resultMessage,
} from './queryResultUtils'
import type {
  QueryExecutionContext,
  QueryExecutionMessage,
  QueryExecutor,
  QueryExecutorOutput,
  QueryResultColumn,
  QueryResultSet,
} from './queryTypes'

export class SQLServerQueryExecutor implements QueryExecutor {
  readonly capabilities = {
    supportsCancel: true,
    supportsTransactions: true,
    cancelMode: 'native' as const,
  }

  execute(
    connection: Connection,
    sql: string,
    _connData: ConnectionData,
    context: QueryExecutionContext,
  ): Promise<QueryExecutorOutput> {
    return new Promise((resolve, reject) => {
      const resultSets: QueryResultSet[] = []
      const messages: QueryExecutionMessage[] = []
      let currentColumns: QueryResultColumn[] = []
      let currentRows: unknown[][] = []
      let affectedRows = 0
      let statementIndex = 0

      const finalizeCurrent = (rowCount?: number) => {
        if (currentColumns.length > 0) {
          resultSets.push(buildResultSet(
            context.requestId,
            resultSets.length,
            currentColumns,
            currentRows,
            'SELECT',
          ))
          messages.push(resultMessage(
            statementIndex,
            currentRows.length,
            'SELECT',
          ))
          currentColumns = []
          currentRows = []
        } else if (rowCount !== undefined) {
          const count = Number(rowCount || 0)
          affectedRows += count
          messages.push(affectedMessage(statementIndex, count))
        }
        statementIndex += 1
      }

      const request = new Request(sql, (error: Error | undefined, rowCount) => {
        if (currentColumns.length > 0) finalizeCurrent()
        if (error) {
          reject(error)
          return
        }
        if (messages.length === 0) {
          finalizeCurrent(Number(rowCount || 0))
        }
        resolve({ resultSets, messages, affectedRows })
      })

      context.setCancelHandler(() => {
        if (!connection.cancel()) {
          throw new Error('SQL Server 当前没有可取消的活动请求')
        }
      })
      request.on('columnMetadata', (metadata: any[]) => {
        // 某些批处理不会先发送 doneInProc，新的列元数据出现时先封存上一结果。
        if (currentColumns.length > 0) finalizeCurrent()
        currentColumns = buildColumns(
          metadata.map(column => column.colName),
          metadata.map(column => column.type?.name),
        )
      })
      request.on('row', (columns: any[]) => {
        currentRows.push(columns.map(column => column.value))
      })
      request.on('doneInProc', (rowCount: number) => {
        finalizeCurrent(rowCount)
      })
      connection.execSql(request)
    })
  }

  begin(connection: Connection): Promise<void> {
    return new Promise((resolve, reject) => {
      connection.beginTransaction(error => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  commit(connection: Connection): Promise<void> {
    return new Promise((resolve, reject) => {
      connection.commitTransaction(error => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  rollback(connection: Connection): Promise<void> {
    return new Promise((resolve, reject) => {
      connection.rollbackTransaction(error => {
        if (error) reject(error)
        else resolve()
      })
    })
  }
}
