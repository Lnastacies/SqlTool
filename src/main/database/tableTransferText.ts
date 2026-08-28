import type {
  TableExportOptions,
  TableTextFormatOptions,
} from './tableTransferTypes'
import {
  binaryValue,
  isSerializedBuffer,
  textValue,
} from './tableTransferValueFormat'

export const DEFAULT_TEXT_FORMAT_OPTIONS: TableTextFormatOptions = {
  includeHeader: true,
  delimiter: ',',
  recordDelimiter: '\r\n',
  quote: '"',
  encoding: 'utf8bom',
}

export function normalizedTextOptions(
  options?: Partial<TableTextFormatOptions>,
): TableTextFormatOptions {
  const delimiter = options?.delimiter ?? DEFAULT_TEXT_FORMAT_OPTIONS.delimiter
  const quote = options?.quote ?? DEFAULT_TEXT_FORMAT_OPTIONS.quote
  if (!delimiter) throw new Error('字段分隔符不能为空')
  if (delimiter === '\r' || delimiter === '\n') {
    throw new Error('字段分隔符不能是换行符')
  }
  if (quote.length > 1) throw new Error('文本识别符只能是单个字符')
  return {
    includeHeader: options?.includeHeader ?? true,
    delimiter,
    recordDelimiter: options?.recordDelimiter === '\n' ? '\n' : '\r\n',
    quote,
    encoding: options?.encoding || DEFAULT_TEXT_FORMAT_OPTIONS.encoding,
  }
}

export function parseDelimitedRows(
  content: string,
  options?: Partial<TableTextFormatOptions>,
): string[][] {
  const { delimiter, quote } = normalizedTextOptions(options)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    if (quoted) {
      if (quote && char === quote && content[index + 1] === quote) {
        cell += quote
        index += 1
      } else if (quote && char === quote) {
        quoted = false
      } else {
        cell += char
      }
      continue
    }
    if (quote && char === quote) {
      quoted = true
    } else if (content.startsWith(delimiter, index)) {
      row.push(cell)
      cell = ''
      index += delimiter.length - 1
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (quoted) throw new Error('文本文件存在未闭合的文本识别符')
  if (cell || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export function delimitedCell(
  value: unknown,
  options: TableTextFormatOptions,
  binaryEncoding: TableExportOptions['binaryEncoding'],
): string {
  if (value === null || value === undefined) return ''
  const text = value instanceof Uint8Array || isSerializedBuffer(value)
    ? binaryValue(value, binaryEncoding)
    : textValue(value, binaryEncoding)
  const requiresQuote = Boolean(options.quote) && (
    text.includes(options.delimiter)
    || text.includes(options.quote)
    || /[\r\n]/.test(text)
  )
  return requiresQuote
    ? `${options.quote}${text.split(options.quote).join(
      options.quote.repeat(2),
    )}${options.quote}`
    : text
}
