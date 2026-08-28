import type { ExecuteResult } from '../../types'

const MAX_OUTPUT_ROWS = 500

export function formatTerminalResult(result: ExecuteResult): string[] {
  const output: string[] = []
  if (result.message) output.push(result.message)

  const rows = Array.isArray(result.rows) ? result.rows : []
  const columns = result.columns?.length
    ? result.columns
    : collectColumns(rows)
  if (columns.length > 0) {
    output.push(columns.join('\t'))
    output.push(columns.map(() => '--------').join('\t'))
    rows.slice(0, MAX_OUTPUT_ROWS).forEach(row => {
      output.push(columns.map(column => formatCell(row[column])).join('\t'))
    })
    if (rows.length > MAX_OUTPUT_ROWS) {
      output.push(`... 已省略 ${rows.length - MAX_OUTPUT_ROWS} 行`)
    }
    output.push(`返回 ${rows.length} 行`)
  } else if (typeof result.affected_rows === 'number') {
    output.push(`影响 ${result.affected_rows} 行`)
  }

  if (typeof result.execution_time === 'number') {
    output.push(`执行耗时 ${result.execution_time.toFixed(4)} 秒`)
  }
  return output
}

function collectColumns(rows: Record<string, unknown>[]): string[] {
  const first = rows[0]
  return first ? Object.keys(first) : []
}

function formatCell(value: unknown): string {
  if (value === null) return 'NULL'
  if (value === undefined) return ''
  if (typeof value === 'string') return value.replace(/\r?\n/g, '\\n')
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}
