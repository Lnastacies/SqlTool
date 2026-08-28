import mysql from 'mysql2/promise'
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

export class MySQLQueryExecutor implements QueryExecutor {
  readonly capabilities = {
    supportsCancel: true,
    supportsTransactions: true,
    cancelMode: 'control-connection' as const,
  }

  async execute(
    connection: mysql.Connection,
    sql: string,
    connData: ConnectionData,
    context: QueryExecutionContext,
  ): Promise<QueryExecutorOutput> {
    const threadId = Number((connection as any).threadId)
    context.setCancelHandler(async () => {
      if (!Number.isFinite(threadId)) {
        throw new Error('当前 MySQL 会话没有可用的线程 ID')
      }
      const control = await mysql.createConnection({
        // 与主连接保持一致，localhost 统一走 IPv4 回环，避免 ::1 解析问题
        host: connData.host === 'localhost' ? '127.0.0.1' : connData.host,
        port: connData.port,
        user: connData.username,
        password: connData.password,
        connectTimeout: Math.max(1, connData.timeout || 30) * 1000,
      })
      try {
        // threadId 来自驱动的数值属性，禁止拼接任何用户输入。
        await control.query(`KILL QUERY ${threadId}`)
      } finally {
        await control.end()
      }
    })

    const [rawRows, rawFields] = await connection.query(sql)
    return this.normalizeResults(
      rawRows,
      rawFields,
      context.requestId,
    )
  }

  async begin(connection: mysql.Connection): Promise<void> {
    await connection.query('START TRANSACTION')
  }

  async commit(connection: mysql.Connection): Promise<void> {
    await connection.query('COMMIT')
  }

  async rollback(connection: mysql.Connection): Promise<void> {
    await connection.query('ROLLBACK')
  }

  private normalizeResults(
    rawRows: any,
    rawFields: any,
    requestId: string,
  ): QueryExecutorOutput {
    const resultSets: QueryResultSet[] = []
    const messages: QueryExecutionMessage[] = []
    let affectedRows = 0
    const multiple = this.isMultipleResult(rawRows, rawFields)
    const rowGroups = multiple ? rawRows : [rawRows]
    const fieldGroups = multiple ? (rawFields || []) : [rawFields]

    rowGroups.forEach((rowGroup: any, index: number) => {
      const fieldGroup = fieldGroups[index]
      if (Array.isArray(fieldGroup)) {
        const columns = buildColumns(
          fieldGroup.map((field: any) => field.name),
          fieldGroup.map((field: any) => String(
            field.type ?? field.columnType ?? '',
          ) || undefined),
        )
        const rows = this.toValueRows(rowGroup, fieldGroup)
        resultSets.push(buildResultSet(
          requestId,
          resultSets.length,
          columns,
          rows,
          'SELECT',
        ))
        messages.push(resultMessage(index, rows.length, 'SELECT'))
        return
      }

      const count = Number(rowGroup?.affectedRows || 0)
      affectedRows += count
      messages.push(affectedMessage(index, count))
    })

    return { resultSets, messages, affectedRows }
  }

  private isMultipleResult(rawRows: any, rawFields: any): boolean {
    if (Array.isArray(rawFields)) {
      return rawFields.some(
        fieldGroup => fieldGroup == null || Array.isArray(fieldGroup),
      )
    }
    return Array.isArray(rawRows)
      && rawRows.length > 0
      && rawRows.every(row => !Array.isArray(row) && 'affectedRows' in row)
  }

  private toValueRows(rows: any, fields: any[]): unknown[][] {
    if (!Array.isArray(rows)) return []
    return rows.map(row => {
      if (Array.isArray(row)) return row
      return fields.map(field => row[field.name])
    })
  }
}
