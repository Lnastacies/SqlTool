import type { ActiveConnection } from './databaseConnectionRegistry'

export function quoteBackupIdentifier(
  value: string,
  quote: '`' | '"' | '[',
): string {
  if (quote === '[') return `[${value.replace(/]/g, ']]')}]`
  return `${quote}${value.replace(
    new RegExp(quote, 'g'),
    `${quote}${quote}`,
  )}${quote}`
}

export function backupStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export async function queryBackupRows(
  active: ActiveConnection,
  database: string,
  sql: string,
  parameters: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  const executionDatabase = active.connData.type === 'PostgreSQL'
    ? ''
    : database
  const result = await active.adapter.executeSQL(
    active.connection,
    executionDatabase,
    sql,
    parameters,
  )
  if (!result.success) throw new Error(result.message)
  return (result.rows || []) as Record<string, unknown>[]
}

export function readBackupRowValue(
  row: Record<string, unknown>,
  candidates: string[],
): string {
  for (const candidate of candidates) {
    const direct = row[candidate]
    if (typeof direct === 'string' && direct.trim()) return direct
    const key = Object.keys(row).find(
      item => item.toLowerCase() === candidate.toLowerCase(),
    )
    const value = key ? row[key] : undefined
    if (typeof value === 'string' && value.trim()) return value
  }
  const fallback = Object.values(row).find(
    value => typeof value === 'string' && value.trim(),
  )
  return typeof fallback === 'string' ? fallback : ''
}
