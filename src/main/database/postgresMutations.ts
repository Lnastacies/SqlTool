import { normalizeValue, quoteIdentifier } from './mutationSqlUtils'
import type {
  TableRowDelete,
  TableRowInsert,
  TableRowUpdate,
} from './tableMutationTypes'

function tableReference(tableName: string): string {
  return `"public".${quoteIdentifier(tableName, '"')}`
}

export async function insertPostgreSQL(
  connection: any,
  _database: string,
  tableName: string,
  insert: TableRowInsert,
): Promise<number> {
  const columns = Object.keys(insert.values)
  const sql = columns.length > 0
    ? `INSERT INTO ${tableReference(tableName)} (${columns.map(
      column => quoteIdentifier(column, '"'),
    ).join(', ')}) VALUES (${columns.map(
      (_, index) => `$${index + 1}`,
    ).join(', ')})`
    : `INSERT INTO ${tableReference(tableName)} DEFAULT VALUES`
  const values = columns.map(column => normalizeValue(insert.values[column]))
  const result = await connection.query(sql, values)
  return Number(result.rowCount || 0)
}

export async function updatePostgreSQL(
  connection: any,
  _database: string,
  tableName: string,
  update: TableRowUpdate,
): Promise<number> {
  const columns = Object.keys(update.changes)
  const keys = Object.keys(update.originalKey)
  const values = [
    ...columns.map(column => normalizeValue(update.changes[column])),
    ...keys.map(key => normalizeValue(update.originalKey[key])),
  ]
  const sql = `UPDATE ${tableReference(tableName)} SET ${columns.map(
    (column, index) => `${quoteIdentifier(column, '"')} = $${index + 1}`,
  ).join(', ')} WHERE ${keys.map(
    (key, index) => `${quoteIdentifier(key, '"')} IS NOT DISTINCT FROM $${columns.length + index + 1}`,
  ).join(' AND ')}`
  const result = await connection.query(sql, values)
  return Number(result.rowCount || 0)
}

export async function deletePostgreSQL(
  connection: any,
  _database: string,
  tableName: string,
  deletion: TableRowDelete,
): Promise<number> {
  const keys = Object.keys(deletion.originalKey)
  const values = keys.map(key => normalizeValue(deletion.originalKey[key]))
  const sql = `DELETE FROM ${tableReference(tableName)} WHERE ${keys.map(
    (key, index) => `${quoteIdentifier(key, '"')} IS NOT DISTINCT FROM $${index + 1}`,
  ).join(' AND ')}`
  const result = await connection.query(sql, values)
  return Number(result.rowCount || 0)
}
