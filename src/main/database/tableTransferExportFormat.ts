import { XMLBuilder } from 'fast-xml-parser'
import type { TableDatabaseType } from './tableStructureTypes'
import { quoteTableIdentifier } from './tableStructureSqlCommon'
import type {
  TableExportFormat,
  TableExportOptions,
} from './tableTransferTypes'
import {
  delimitedCell,
  normalizedTextOptions,
} from './tableTransferText'
import {
  serializableValue,
  sqlValue,
  textValue,
} from './tableTransferValueFormat'

function jsonRow(
  row: Record<string, unknown>,
  encoding: TableExportOptions['binaryEncoding'],
): string {
  const serialized = JSON.stringify(
    row,
    (_key, value) => serializableValue(value, encoding),
    2,
  )
  return serialized.split('\n').map(line => `  ${line}`).join('\n')
}

function htmlEscape(value: unknown, encoding: 'base64' | 'hex'): string {
  if (value === null || value === undefined) return ''
  return textValue(value, encoding)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function xmlRows(
  rows: Record<string, unknown>[],
  columns: string[],
  encoding: 'base64' | 'hex',
  prettyPrint: boolean,
): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    format: prettyPrint,
    suppressEmptyNode: false,
    suppressBooleanAttributes: false,
  })
  return rows.map(row => builder.build({
    row: {
      field: columns.map(column => ({
        '@_name': column,
        ...(row[column] === null || row[column] === undefined
          ? { '@_null': 'true' }
          : { '#text': textValue(row[column], encoding) }),
      })),
    },
  })).join('')
}

export function exportPreamble(
  format: TableExportFormat,
  columns: string[],
  options?: Partial<TableExportOptions>,
  databaseType: TableDatabaseType = 'SQLite',
): string {
  const text = normalizedTextOptions(options?.text)
  const encoding = options?.binaryEncoding || 'base64'
  if (format === 'csv' || format === 'txt') {
    return text.includeHeader
      ? `${columns.map(column => (
        delimitedCell(column, text, encoding)
      )).join(text.delimiter)}${text.recordDelimiter}`
      : ''
  }
  if (format === 'json') return '[\n'
  if (format === 'html') {
    return `<!doctype html>\n<html><head><meta charset="utf-8"><title>SQLTool 数据导出</title></head><body><table border="1"><thead><tr>${columns.map(
      column => `<th>${htmlEscape(column, encoding)}</th>`,
    ).join('')}</tr></thead><tbody>\n`
  }
  if (format === 'xml') {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<sqltool-export>\n'
  }
  if (format === 'sql' && options?.sql?.includeTransaction) {
    return databaseType === 'MySQL'
      ? 'START TRANSACTION;\n'
      : 'BEGIN TRANSACTION;\n'
  }
  return ''
}

export function exportRowsChunk(
  databaseType: TableDatabaseType,
  tableName: string,
  columns: string[],
  rows: Record<string, unknown>[],
  format: TableExportFormat,
  rowsAlreadyWritten: number,
  options?: Partial<TableExportOptions>,
  sqlOptions?: { overrideSystemValue?: boolean },
): string {
  const text = normalizedTextOptions(options?.text)
  const encoding = options?.binaryEncoding || 'base64'
  if (format === 'csv' || format === 'txt') {
    return rows.map(row => (
      `${columns.map(column => (
        delimitedCell(row[column], text, encoding)
      )).join(text.delimiter)}${text.recordDelimiter}`
    )).join('')
  }
  if (format === 'json') {
    return rows.map((row, index) => (
      `${rowsAlreadyWritten + index > 0 ? ',\n' : ''}${jsonRow(row, encoding)}`
    )).join('')
  }
  if (format === 'html') {
    return rows.map(row => (
      `<tr>${columns.map(column => (
        `<td>${htmlEscape(row[column], encoding)}</td>`
      )).join('')}</tr>\n`
    )).join('')
  }
  if (format === 'xml') {
    return xmlRows(
      rows,
      columns,
      encoding,
      options?.xml?.prettyPrint !== false,
    )
  }
  const quote = (value: string) => quoteTableIdentifier(value, databaseType)
  const table = quote(tableName)
  const identityOverride = (
    databaseType === 'PostgreSQL'
    && sqlOptions?.overrideSystemValue
  )
    ? ' OVERRIDING SYSTEM VALUE'
    : ''
  return rows.map(row => (
    `INSERT INTO ${table} (${columns.map(quote).join(', ')})${identityOverride} VALUES (${columns.map(
      column => sqlValue(databaseType, row[column]),
    ).join(', ')});\n`
  )).join('')
}

export function exportEpilogue(
  format: TableExportFormat,
  tableName: string,
  rowCount: number,
  options?: Partial<TableExportOptions>,
): string {
  if (format === 'json') return '\n]\n'
  if (format === 'html') return '</tbody></table></body></html>\n'
  if (format === 'xml') return '</sqltool-export>\n'
  if (format === 'sql') {
    const emptyComment = rowCount === 0
      ? `-- 表 ${tableName} 没有可导出的数据\n`
      : ''
    const commit = options?.sql?.includeTransaction ? 'COMMIT;\n' : ''
    return `${emptyComment}${commit}`
  }
  return ''
}
