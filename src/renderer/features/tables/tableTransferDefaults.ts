import type {
  TableExportFormat,
  TableExportOptions,
  TableImportOptions,
  TableImportPreview,
} from '../../types'

export function createTableImportOptions(
  preview: TableImportPreview,
): TableImportOptions {
  if (preview.options) return preview.options
  const format = preview.format || 'csv'
  return {
    format,
    text: format === 'csv' || format === 'txt'
      ? {
        includeHeader: true,
        delimiter: format === 'txt' ? '\t' : ',',
        recordDelimiter: '\r\n',
        quote: '"',
        encoding: 'utf8bom',
      }
      : undefined,
  }
}

export function createTableExportOptions(
  format: TableExportFormat = 'csv',
): Omit<TableExportOptions, 'columns'> {
  return {
    format,
    binaryEncoding: 'base64',
    text: format === 'csv' || format === 'txt'
      ? {
        includeHeader: true,
        delimiter: format === 'txt' ? '\t' : ',',
        recordDelimiter: '\r\n',
        quote: '"',
        encoding: 'utf8bom',
      }
      : undefined,
    xml: { prettyPrint: true },
    excel: { freezeHeader: true, autoFilter: true },
    sql: { includeTransaction: false },
  }
}
