import pg from 'pg'
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

export class PostgreSQLQueryExecutor implements QueryExecutor {
  readonly capabilities = {
    supportsCancel: true,
    supportsTransactions: true,
    cancelMode: 'control-connection' as const,
  }

  async execute(
    connection: pg.Client,
    sql: string,
    connData: ConnectionData,
    context: QueryExecutionContext,
  ): Promise<QueryExecutorOutput> {
    const processId = Number((connection as any).processID)
    context.setCancelHandler(async () => {
      if (!Number.isFinite(processId)) {
        throw new Error('当前 PostgreSQL 会话没有可用的进程 ID')
      }
      const control = new pg.Client({
        host: connData.host,
        port: connData.port,
        user: connData.username,
        password: connData.password,
        database: connData.database || 'postgres',
        connectionTimeoutMillis: Math.max(1, connData.timeout || 30) * 1000,
      })
      await control.connect()
      try {
        const result = await control.query(
          'SELECT pg_cancel_backend($1) AS cancelled',
          [processId],
        )
        if (!result.rows[0]?.cancelled) {
          throw new Error('PostgreSQL 服务端未接受取消请求')
        }
      } finally {
        await control.end()
      }
    })

    const rawResult = await connection.query({
      text: sql,
      rowMode: 'array',
    } as any)
    const results: any[] = Array.isArray(rawResult)
      ? rawResult
      : [rawResult]
    const resultSets: QueryResultSet[] = []
    const messages: QueryExecutionMessage[] = []
    let affectedRows = 0

    results.forEach((result, index) => {
      const command = String(result.command || '').toUpperCase() || undefined
      if (Array.isArray(result.fields) && result.fields.length > 0) {
        const columns = buildColumns(
          result.fields.map((field: any) => field.name),
          result.fields.map((field: any) => String(field.dataTypeID)),
        )
        const rows = (result.rows || []).map((row: any) => (
          Array.isArray(row)
            ? row
            : result.fields.map((field: any) => row[field.name])
        ))
        resultSets.push(buildResultSet(
          context.requestId,
          resultSets.length,
          columns,
          rows,
          command,
        ))
        messages.push(resultMessage(index, rows.length, command))
      } else {
        const count = Number(result.rowCount || 0)
        affectedRows += count
        messages.push(affectedMessage(index, count, command))
      }
    })

    return { resultSets, messages, affectedRows }
  }

  async begin(connection: pg.Client): Promise<void> {
    await connection.query('BEGIN')
  }

  async commit(connection: pg.Client): Promise<void> {
    await connection.query('COMMIT')
  }

  async rollback(connection: pg.Client): Promise<void> {
    await connection.query('ROLLBACK')
  }
}
