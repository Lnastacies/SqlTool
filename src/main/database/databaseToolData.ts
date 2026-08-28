import type { DatabaseToolGateway } from './databaseToolGateway'
import type { DatabaseToolEndpoint } from './databaseToolTypes'
import type {
  TableMutationBatch,
  TableRowDelete,
  TableRowInsert,
  TableRowUpdate,
} from './tableMutationTypes'

export interface ComparedTableRows {
  sourceRows: number
  targetRows: number
  unchangedRows: number
  batch: TableMutationBatch
}

function canonicalNumber(value: string): string {
  const normalized = value.replace(/^\+/, '')
  if (/^-?\d+$/.test(normalized)) {
    try {
      return BigInt(normalized).toString()
    } catch {
      return normalized
    }
  }
  const [integer, decimal = ''] = normalized.split('.')
  const compactDecimal = decimal.replace(/0+$/, '')
  return compactDecimal ? `${integer}.${compactDecimal}` : integer
}

function canonicalValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (value instanceof Date) return `date:${value.toISOString()}`
  if (value instanceof Uint8Array) {
    return `binary:${Buffer.from(value).toString('base64')}`
  }
  if (typeof value === 'bigint' || typeof value === 'number') {
    return `number:${canonicalNumber(String(value))}`
  }
  if (typeof value === 'boolean') return `number:${value ? '1' : '0'}`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `object:{${Object.keys(record).sort().map(key => (
      `${JSON.stringify(key)}:${canonicalValue(record[key])}`
    )).join(',')}}`
  }
  const text = String(value)
  if (/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
    return `number:${canonicalNumber(text)}`
  }
  return `text:${text}`
}

function keyFingerprint(
  row: Record<string, unknown>,
  primaryKeys: string[],
): string {
  return primaryKeys.map(key => canonicalValue(row[key])).join('|')
}

function projectRow(
  row: Record<string, unknown>,
  columns: string[],
): Record<string, unknown> {
  return Object.fromEntries(columns.map(column => [column, row[column]]))
}

export async function loadAllTableRows(
  gateway: DatabaseToolGateway,
  endpoint: DatabaseToolEndpoint,
  tableName: string,
  pageSize: number = 500,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  let page = 1
  let total = 0
  do {
    const result = await gateway.getTableData(
      endpoint.connId,
      endpoint.database,
      tableName,
      page,
      pageSize,
    )
    rows.push(...result.rows)
    total = result.total
    page += 1
  } while (rows.length < total)
  return rows
}

function indexRows(
  rows: Record<string, unknown>[],
  primaryKeys: string[],
  label: string,
): Map<string, Record<string, unknown>> {
  const indexed = new Map<string, Record<string, unknown>>()
  rows.forEach(row => {
    const key = keyFingerprint(row, primaryKeys)
    if (indexed.has(key)) {
      throw new Error(`${label}存在重复主键，无法进行可靠的数据同步`)
    }
    indexed.set(key, row)
  })
  return indexed
}

export function compareTableRows(
  sourceRows: Record<string, unknown>[],
  targetRows: Record<string, unknown>[],
  primaryKeys: string[],
  commonColumns: string[],
): ComparedTableRows {
  const sourceMap = indexRows(sourceRows, primaryKeys, '源表')
  const targetMap = indexRows(targetRows, primaryKeys, '目标表')
  const inserts: TableRowInsert[] = []
  const updates: TableRowUpdate[] = []
  const deletes: TableRowDelete[] = []
  let unchangedRows = 0

  sourceMap.forEach((sourceRow, key) => {
    const targetRow = targetMap.get(key)
    if (!targetRow) {
      inserts.push({ values: projectRow(sourceRow, commonColumns) })
      return
    }
    const changes = Object.fromEntries(
      commonColumns
        .filter(column => (
          !primaryKeys.includes(column)
          && canonicalValue(sourceRow[column]) !== canonicalValue(targetRow[column])
        ))
        .map(column => [column, sourceRow[column]]),
    )
    if (Object.keys(changes).length === 0) {
      unchangedRows += 1
      return
    }
    updates.push({
      originalKey: projectRow(targetRow, primaryKeys),
      changes,
    })
  })

  targetMap.forEach(targetRow => {
    const key = keyFingerprint(targetRow, primaryKeys)
    if (!sourceMap.has(key)) {
      deletes.push({ originalKey: projectRow(targetRow, primaryKeys) })
    }
  })

  return {
    sourceRows: sourceRows.length,
    targetRows: targetRows.length,
    unchangedRows,
    batch: { inserts, updates, deletes },
  }
}

export function splitMutationBatch(
  batch: TableMutationBatch,
  size: number,
): TableMutationBatch[] {
  const chunks: TableMutationBatch[] = []
  const max = Math.min(500, Math.max(20, Math.floor(size)))
  for (let index = 0; index < batch.deletes.length; index += max) {
    chunks.push({
      inserts: [],
      updates: [],
      deletes: batch.deletes.slice(index, index + max),
    })
  }
  for (let index = 0; index < batch.updates.length; index += max) {
    chunks.push({
      inserts: [],
      updates: batch.updates.slice(index, index + max),
      deletes: [],
    })
  }
  for (let index = 0; index < batch.inserts.length; index += max) {
    chunks.push({
      inserts: batch.inserts.slice(index, index + max),
      updates: [],
      deletes: [],
    })
  }
  return chunks
}
