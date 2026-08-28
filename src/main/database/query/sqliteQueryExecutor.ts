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
  QueryResultSet,
} from './queryTypes'

export class SQLiteQueryExecutor implements QueryExecutor {
  readonly capabilities = {
    supportsCancel: false,
    supportsTransactions: true,
    cancelMode: 'unsupported' as const,
  }

  async execute(
    connection: any,
    sql: string,
    _connData: ConnectionData,
    context: QueryExecutionContext,
  ): Promise<QueryExecutorOutput> {
    // sql.js 在主进程内同步执行，单条语句运行期间无法处理新的取消 IPC。
    const changesBefore = this.readTotalChanges(connection)
    const rawResults = connection.exec(sql)
    const affectedRows = Math.max(
      0,
      this.readTotalChanges(connection) - changesBefore,
    )
    const resultSets: QueryResultSet[] = []
    const messages: QueryExecutionMessage[] = []

    rawResults.forEach((result: any, index: number) => {
      const columns = buildColumns(result.columns || [])
      const rows = (result.values || []) as unknown[][]
      resultSets.push(buildResultSet(
        context.requestId,
        resultSets.length,
        columns,
        rows,
        'SELECT',
      ))
      messages.push(resultMessage(index, rows.length, 'SELECT'))
    })

    if (resultSets.length === 0 || affectedRows > 0) {
      messages.push(affectedMessage(
        messages.length,
        affectedRows,
      ))
    }
    return { resultSets, messages, affectedRows }
  }

  private readTotalChanges(connection: any): number {
    const result = connection.exec('SELECT total_changes() AS total_changes')
    return Number(result?.[0]?.values?.[0]?.[0] || 0)
  }

  async begin(connection: any): Promise<void> {
    connection.run('BEGIN')
  }

  async commit(connection: any): Promise<void> {
    connection.run('COMMIT')
  }

  async rollback(connection: any): Promise<void> {
    connection.run('ROLLBACK')
  }
}
