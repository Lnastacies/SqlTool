import type {
  DatabaseAdapter,
  ConnectionData,
  ExecuteResult,
} from './adapters'
import type {
  DatabaseCharsetOption,
  DatabaseCollationOption,
  DatabaseEncodingCatalog,
} from './databaseManagementTypes'
import { isMySQLCompatible } from './mysqlCompat'

function rowsOf(result: ExecuteResult): Record<string, unknown>[] {
  if (!result.success) {
    throw new Error(result.message || '读取数据库编码信息失败')
  }
  return (result.rows || []).filter(
    (row): row is Record<string, unknown> => (
      Boolean(row) && typeof row === 'object' && !Array.isArray(row)
    ),
  )
}

function textValue(
  row: Record<string, unknown>,
  key: string,
): string {
  const matched = Object.entries(row).find(
    ([name]) => name.toLowerCase() === key.toLowerCase(),
  )
  return matched?.[1] == null ? '' : String(matched[1]).trim()
}

async function queryRows(
  adapter: DatabaseAdapter,
  connection: unknown,
  sql: string,
  parameters: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  return rowsOf(await adapter.executeSQL(
    connection,
    '',
    sql,
    parameters,
  ))
}

export async function loadDatabaseEncodingCatalog(
  connectionData: ConnectionData,
  adapter: DatabaseAdapter,
  connection: unknown,
  database?: string,
): Promise<DatabaseEncodingCatalog> {
  if (!isMySQLCompatible(connectionData.type)) {
    return { charsets: [], collations: [] }
  }

  const charsetRows = await queryRows(
    adapter,
    connection,
    `SELECT CHARACTER_SET_NAME AS charset,
            DEFAULT_COLLATE_NAME AS default_collation,
            DESCRIPTION AS description
     FROM information_schema.CHARACTER_SETS
     ORDER BY CHARACTER_SET_NAME`,
  )
  const collationRows = await queryRows(
    adapter,
    connection,
    `SELECT COLLATION_NAME AS collation,
            CHARACTER_SET_NAME AS charset
     FROM information_schema.COLLATIONS
     ORDER BY CHARACTER_SET_NAME, COLLATION_NAME`,
  )

  const charsets: DatabaseCharsetOption[] = charsetRows.flatMap(row => {
    const value = textValue(row, 'charset')
    if (!value) return []
    const description = textValue(row, 'description')
    return [{
      value,
      label: description ? `${value} - ${description}` : value,
      defaultCollation: textValue(row, 'default_collation') || undefined,
    }]
  })
  const collations: DatabaseCollationOption[] = collationRows.flatMap(row => {
    const value = textValue(row, 'collation')
    const charset = textValue(row, 'charset')
    return value && charset ? [{ value, charset }] : []
  })
  if (charsets.length === 0) {
    throw new Error('服务器未返回可用字符集')
  }

  let charset: string | undefined
  let collation: string | undefined
  if (database) {
    const currentRows = await queryRows(
      adapter,
      connection,
      `SELECT DEFAULT_CHARACTER_SET_NAME AS charset,
              DEFAULT_COLLATION_NAME AS collation
       FROM information_schema.SCHEMATA
       WHERE SCHEMA_NAME = ?`,
      [database],
    )
    if (currentRows.length === 0) {
      throw new Error(`数据库“${database}”不存在`)
    }
    charset = textValue(currentRows[0], 'charset') || undefined
    collation = textValue(currentRows[0], 'collation') || undefined
  }

  return { charset, collation, charsets, collations }
}
