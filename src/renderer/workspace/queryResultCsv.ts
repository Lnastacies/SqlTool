import type { QueryResultSet } from '../types'

/** 将单元格值转换为 CSV 文本 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  let text: string
  if (typeof value === 'string') {
    text = value
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    text = String(value)
  } else if (
    typeof value === 'object'
    && typeof (value as { toString?: unknown }).toString === 'function'
  ) {
    // Buffer 等对象按其 toString 输出
    text = String(value)
  } else {
    text = ''
  }
  // 包含逗号、引号、换行时用双引号包裹并转义内部引号
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/**
 * 将查询结果集序列化为 CSV 文本（含表头行，使用 CRLF 换行）。
 * 前置 BOM 由主进程写文件时统一添加。
 */
export function buildQueryResultCsv(resultSet: QueryResultSet): string {
  const delimiter = ','
  const recordDelimiter = '\r\n'
  const lines = [
    resultSet.columns.map(column => csvCell(column.name)).join(delimiter),
    ...resultSet.rows.map(row => row.map(cell => csvCell(cell)).join(delimiter)),
  ]
  return `${lines.join(recordDelimiter)}${recordDelimiter}`
}
