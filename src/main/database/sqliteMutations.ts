import { normalizeValue, quoteIdentifier } from './mutationSqlUtils'
import type {
  TableRowDelete,
  TableRowInsert,
  TableRowUpdate,
} from './tableMutationTypes'

function normalizeSQLiteValue(value: unknown): unknown {
  // sql.js 的绑定值不接受 boolean，SQLite 布尔字段按 0/1 存储。
  if (typeof value === 'boolean') return value ? 1 : 0
  return normalizeValue(value)
}

export async function insertSQLite(
  connection: any,
  _database: string,
  tableName: string,
  insert: TableRowInsert,
): Promise<number> {
  const columns = Object.keys(insert.values)
  const table = quoteIdentifier(tableName, '"')
  const sql = columns.length > 0
    ? `INSERT INTO ${table} (${columns.map(
      column => quoteIdentifier(column, '"'),
    ).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
    : `INSERT INTO ${table} DEFAULT VALUES`
  const values = columns.map(
    column => normalizeSQLiteValue(insert.values[column]),
  )
  connection.run(sql, values)
  return Number(connection.getRowsModified() || 0)
}

export async function updateSQLite(
  connection: any,
  _database: string,
  tableName: string,
  update: TableRowUpdate,
): Promise<number> {
  const columns = Object.keys(update.changes)
  const keys = Object.keys(update.originalKey)
  const sql = `UPDATE ${quoteIdentifier(tableName, '"')} SET ${columns.map(
    column => `${quoteIdentifier(column, '"')} = ?`,
  ).join(', ')} WHERE ${keys.map(
    key => `${quoteIdentifier(key, '"')} IS ?`,
  ).join(' AND ')}`
  const values = [
    ...columns.map(column => normalizeSQLiteValue(update.changes[column])),
    ...keys.map(key => normalizeSQLiteValue(update.originalKey[key])),
  ]
  connection.run(sql, values)
  return Number(connection.getRowsModified() || 0)
}

export async function deleteSQLite(
  connection: any,
  _database: string,
  tableName: string,
  deletion: TableRowDelete,
): Promise<number> {
  const keys = Object.keys(deletion.originalKey)
  const sql = `DELETE FROM ${quoteIdentifier(tableName, '"')} WHERE ${keys.map(
    key => `${quoteIdentifier(key, '"')} IS ?`,
  ).join(' AND ')}`
  const values = keys.map(
    key => normalizeSQLiteValue(deletion.originalKey[key]),
  )
  connection.run(sql, values)
  return Number(connection.getRowsModified() || 0)
}
