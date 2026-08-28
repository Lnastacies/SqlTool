import { normalizeValue, quoteIdentifier } from './mutationSqlUtils'
import type {
  TableRowDelete,
  TableRowInsert,
  TableRowUpdate,
} from './tableMutationTypes'

function tableReference(database: string, tableName: string): string {
  return `${quoteIdentifier(database, '`')}.${quoteIdentifier(tableName, '`')}`
}

export async function insertMySQL(
  connection: any,
  database: string,
  tableName: string,
  insert: TableRowInsert,
): Promise<number> {
  const columns = Object.keys(insert.values)
  const table = tableReference(database, tableName)
  const sql = columns.length > 0
    ? `INSERT INTO ${table} (${columns.map(
      column => quoteIdentifier(column, '`'),
    ).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
    : `INSERT INTO ${table} () VALUES ()`
  const values = columns.map(column => normalizeValue(insert.values[column]))
  const [result] = await connection.execute(sql, values)
  return Number(result.affectedRows || 0)
}

export async function updateMySQL(
  connection: any,
  database: string,
  tableName: string,
  update: TableRowUpdate,
): Promise<number> {
  const columns = Object.keys(update.changes)
  const keys = Object.keys(update.originalKey)
  const sql = `UPDATE ${tableReference(database, tableName)} SET ${columns.map(
    column => `${quoteIdentifier(column, '`')} = ?`,
  ).join(', ')} WHERE ${keys.map(
    key => `${quoteIdentifier(key, '`')} <=> ?`,
  ).join(' AND ')}`
  const values = [
    ...columns.map(column => normalizeValue(update.changes[column])),
    ...keys.map(key => normalizeValue(update.originalKey[key])),
  ]
  const [result] = await connection.execute(sql, values)
  return Number(result.affectedRows || 0)
}

export async function deleteMySQL(
  connection: any,
  database: string,
  tableName: string,
  deletion: TableRowDelete,
): Promise<number> {
  const keys = Object.keys(deletion.originalKey)
  const sql = `DELETE FROM ${tableReference(database, tableName)} WHERE ${keys.map(
    key => `${quoteIdentifier(key, '`')} <=> ?`,
  ).join(' AND ')}`
  const values = keys.map(key => normalizeValue(deletion.originalKey[key]))
  const [result] = await connection.execute(sql, values)
  return Number(result.affectedRows || 0)
}
