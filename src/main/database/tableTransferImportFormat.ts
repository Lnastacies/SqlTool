import { XMLParser } from 'fast-xml-parser'
import type {
  TableImportFormat,
  TableImportPreview,
  TableTextFormatOptions,
} from './tableTransferTypes'
import {
  normalizedTextOptions,
  parseDelimitedRows,
} from './tableTransferText'

function validateColumns(columns: string[]): void {
  if (columns.some(column => !column)) throw new Error('文件表头包含空字段名')
  if (new Set(columns.map(column => column.toLowerCase())).size !== columns.length) {
    throw new Error('文件表头包含重复字段名')
  }
}

function parseDelimited(
  content: string,
  format: Extract<TableImportFormat, 'csv' | 'txt'>,
  options?: Partial<TableTextFormatOptions>,
): Omit<TableImportPreview, 'cancelled'> {
  const settings = normalizedTextOptions(options)
  const parsedRows = parseDelimitedRows(content.replace(/^\uFEFF/, ''), settings)
  if (parsedRows.length === 0) throw new Error('文本文件没有内容')
  const widestRow = Math.max(...parsedRows.map(row => row.length))
  const columns = settings.includeHeader
    ? parsedRows[0].map(column => column.trim())
    : Array.from({ length: widestRow }, (_, index) => `column_${index + 1}`)
  validateColumns(columns)
  const dataRows = settings.includeHeader ? parsedRows.slice(1) : parsedRows
  const rows = dataRows
    .filter(row => row.some(value => value !== ''))
    .map(row => Object.fromEntries(
      columns.map((column, index) => [column, row[index] ?? '']),
    ))
  return {
    format,
    columns,
    rows,
    totalRows: rows.length,
    options: { format, text: settings },
  }
}

function parseJson(content: string): Omit<TableImportPreview, 'cancelled'> {
  const value = JSON.parse(content.replace(/^\uFEFF/, ''))
  if (!Array.isArray(value)) throw new Error('JSON 根节点必须是对象数组')
  if (value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error('JSON 数组中的每一项都必须是对象')
  }
  const rows = value as Record<string, unknown>[]
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))))
  return {
    format: 'json',
    columns,
    rows,
    totalRows: rows.length,
    options: { format: 'json' },
  }
}

function arrayValue<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function parseXml(content: string): Omit<TableImportPreview, 'cancelled'> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseTagValue: false,
    trimValues: false,
  })
  const document = parser.parse(content.replace(/^\uFEFF/, '')) as {
    'sqltool-export'?: {
      row?: Array<{
        field?: Array<{
          '@_name'?: string
          '@_null'?: string | boolean
          '#text'?: unknown
        }>
      }>
    }
    rows?: { row?: Record<string, unknown> | Record<string, unknown>[] }
  }
  const sqlToolRows = arrayValue(document['sqltool-export']?.row)
  const rows = sqlToolRows.length > 0
    ? sqlToolRows.map(row => Object.fromEntries(
      arrayValue(row.field)
        .filter(field => Boolean(field['@_name']))
        .map(field => [
          String(field['@_name']),
          // 兼容旧版导出的裸 null 属性，以及新版明确写出的 null="true"。
          Object.prototype.hasOwnProperty.call(field, '@_null')
            && field['@_null'] !== false
            && field['@_null'] !== 'false'
            ? null
            : field['#text'] ?? '',
        ]),
    ))
    : arrayValue(document.rows?.row).map(row => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === 'object' && value !== null
          ? JSON.stringify(value)
          : value,
      ]),
    ))
  if (rows.length === 0) {
    throw new Error('XML 文件必须包含 sqltool-export/row 或 rows/row 节点')
  }
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))))
  return {
    format: 'xml',
    columns,
    rows,
    totalRows: rows.length,
    options: { format: 'xml' },
  }
}

export function tableImportFormatFromExtension(
  extension: string,
): TableImportFormat {
  const normalized = extension.toLowerCase().replace(/^\./, '')
  if (
    normalized === 'txt'
    || normalized === 'csv'
    || normalized === 'json'
    || normalized === 'xml'
    || normalized === 'xlsx'
  ) return normalized
  throw new Error(`不支持的导入文件格式: ${extension || '未知'}`)
}

export function parseTableImportContent(
  extension: string,
  content: string,
  textOptions?: Partial<TableTextFormatOptions>,
): Omit<TableImportPreview, 'cancelled'> {
  const format = tableImportFormatFromExtension(extension)
  if (format === 'xlsx') {
    throw new Error('Excel 文件必须通过工作簿解析器读取')
  }
  const result = format === 'json'
    ? parseJson(content)
    : format === 'xml'
      ? parseXml(content)
      : parseDelimited(content, format, textOptions)
  if (result.totalRows === 0) throw new Error('导入文件没有可导入的数据行')
  if (result.columns.length === 0) throw new Error('导入文件没有可映射的字段')
  return result
}
