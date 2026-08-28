import type { TableDatabaseType } from './tableStructureTypes'
import type { TableExportOptions } from './tableTransferTypes'

export function isSerializedBuffer(
  value: unknown,
): value is { type: 'Buffer'; data: number[] } {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.type === 'Buffer'
    && Array.isArray(record.data)
    && record.data.every(item => typeof item === 'number')
}

export function binaryValue(
  value: Uint8Array | { type: 'Buffer'; data: number[] },
  encoding: TableExportOptions['binaryEncoding'],
): string {
  const buffer = value instanceof Uint8Array
    ? Buffer.from(value)
    : Buffer.from(value.data)
  return buffer.toString(encoding)
}

export function serializableValue(
  value: unknown,
  encoding: TableExportOptions['binaryEncoding'],
): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Uint8Array || isSerializedBuffer(value)) {
    return binaryValue(value, encoding)
  }
  return value
}

export function textValue(
  value: unknown,
  encoding: TableExportOptions['binaryEncoding'],
): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && value !== null) {
    const serialized = JSON.stringify(
      value,
      (_key, nested) => serializableValue(nested, encoding),
    )
    if (serialized !== undefined) return serialized
  }
  return String(value)
}

function mysqlDateValue(value: Date): string {
  const pad = (part: number, length = 2) => String(part).padStart(length, '0')
  const date = [
    value.getFullYear(),
    pad(value.getMonth() + 1),
    pad(value.getDate()),
  ].join('-')
  const time = [
    pad(value.getHours()),
    pad(value.getMinutes()),
    pad(value.getSeconds()),
  ].join(':')
  const milliseconds = value.getMilliseconds()
  return `${date} ${time}${milliseconds ? `.${pad(milliseconds, 3)}` : ''}`
}

function mysqlStringValue(text: string): string {
  if (/[\u0000\u0008\t\n\r\u001a\\]/.test(text)) {
    const hex = Buffer.from(text, 'utf8').toString('hex')
    return `CONVERT(X'${hex}' USING utf8mb4)`
  }
  return `'${text.replace(/'/g, "''")}'`
}

export function sqlValue(
  databaseType: TableDatabaseType,
  value: unknown,
): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  if (typeof value === 'boolean') {
    return databaseType === 'PostgreSQL'
      ? (value ? 'TRUE' : 'FALSE')
      : (value ? '1' : '0')
  }
  if (value instanceof Uint8Array) {
    const hex = Buffer.from(value).toString('hex')
    if (databaseType === 'PostgreSQL') return `decode('${hex}', 'hex')`
    if (databaseType === 'SQL Server') return `0x${hex}`
    return `X'${hex}'`
  }
  const text = databaseType === 'MySQL' && value instanceof Date
    ? mysqlDateValue(value)
    : textValue(value, 'base64')
  if (databaseType === 'MySQL') return mysqlStringValue(text)
  return `'${text.replace(/'/g, "''")}'`
}
