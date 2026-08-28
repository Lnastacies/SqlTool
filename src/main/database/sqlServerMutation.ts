import { Request, TYPES } from 'tedious'
import { normalizeValue, quoteIdentifier } from './mutationSqlUtils'
import type {
  TableRowDelete,
  TableRowInsert,
  TableRowUpdate,
} from './tableMutationTypes'

export function tediousType(value: unknown): any {
  if (value instanceof Uint8Array) return TYPES.VarBinary
  if (value instanceof Date) return TYPES.DateTime2
  if (typeof value === 'boolean') return TYPES.Bit
  if (typeof value === 'number') {
    return Number.isInteger(value) ? TYPES.BigInt : TYPES.Float
  }
  return TYPES.NVarChar
}

function tableReference(database: string, tableName: string): string {
  return `${quoteIdentifier(database, '[')}.[dbo].${quoteIdentifier(tableName, '[')}`
}

export function runTedious(
  connection: any,
  sql: string,
  parameters: Array<{ name: string; value: unknown }> = [],
): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = new Request(sql, (error: Error | null, rowCount: number) => {
      if (error) reject(error)
      else resolve(rowCount || 0)
    })
    parameters.forEach(parameter => {
      const value = normalizeValue(parameter.value)
      request.addParameter(parameter.name, tediousType(value), value)
    })
    connection.execSql(request)
  })
}

export async function updateSQLServer(
  connection: any,
  database: string,
  tableName: string,
  update: TableRowUpdate,
): Promise<number> {
  const columns = Object.keys(update.changes)
  const keys = Object.keys(update.originalKey)
  const table = tableReference(database, tableName)
  const parameters = [
    ...columns.map((column, index) => ({
      name: `set_${index}`,
      value: update.changes[column],
    })),
    ...keys.map((key, index) => ({
      name: `key_${index}`,
      value: update.originalKey[key],
    })),
  ]
  const sql = `UPDATE ${table} SET ${columns.map(
    (column, index) => `${quoteIdentifier(column, '[')} = @set_${index}`,
  ).join(', ')} WHERE ${keys.map(
    (key, index) => `(${quoteIdentifier(key, '[')} = @key_${index} OR (${quoteIdentifier(key, '[')} IS NULL AND @key_${index} IS NULL))`,
  ).join(' AND ')}`
  return runTedious(connection, sql, parameters)
}

export async function insertSQLServer(
  connection: any,
  database: string,
  tableName: string,
  insert: TableRowInsert,
): Promise<number> {
  const columns = Object.keys(insert.values)
  const parameters = columns.map((column, index) => ({
    name: `value_${index}`,
    value: insert.values[column],
  }))
  const sql = columns.length > 0
    ? `INSERT INTO ${tableReference(database, tableName)} (${columns.map(
      column => quoteIdentifier(column, '['),
    ).join(', ')}) VALUES (${columns.map(
      (_, index) => `@value_${index}`,
    ).join(', ')})`
    : `INSERT INTO ${tableReference(database, tableName)} DEFAULT VALUES`
  return runTedious(connection, sql, parameters)
}

export async function deleteSQLServer(
  connection: any,
  database: string,
  tableName: string,
  deletion: TableRowDelete,
): Promise<number> {
  const keys = Object.keys(deletion.originalKey)
  const parameters = keys.map((key, index) => ({
    name: `key_${index}`,
    value: deletion.originalKey[key],
  }))
  const sql = `DELETE FROM ${tableReference(database, tableName)} WHERE ${keys.map(
    (key, index) => `(${quoteIdentifier(key, '[')} = @key_${index} OR (${quoteIdentifier(key, '[')} IS NULL AND @key_${index} IS NULL))`,
  ).join(' AND ')}`
  return runTedious(connection, sql, parameters)
}
