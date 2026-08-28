import type { ConnectionData } from './adapters'
import type { DatabaseToolGateway } from './databaseToolGateway'
import type {
  DatabaseToolEndpoint,
  DatabaseToolScope,
} from './databaseToolTypes'
import { quoteIdentifier } from './mutationSqlUtils'

export interface ValidatedToolScope {
  source: DatabaseToolEndpoint
  target: DatabaseToolEndpoint
  tables: string[]
  sourceType: ConnectionData['type']
  targetType: ConnectionData['type']
}

export async function validateToolScope(
  gateway: DatabaseToolGateway,
  scope: DatabaseToolScope,
): Promise<ValidatedToolScope> {
  if (!scope?.source?.connId || !scope.source.database) {
    throw new Error('请选择源连接和源数据库')
  }
  if (!scope?.target?.connId || !scope.target.database) {
    throw new Error('请选择目标连接和目标数据库')
  }
  if (
    scope.source.connId === scope.target.connId
    && scope.source.database === scope.target.database
  ) {
    throw new Error('源数据库和目标数据库不能相同')
  }
  const tables = Array.from(new Set(
    (scope.tables || []).map(table => table.trim()).filter(Boolean),
  ))
  if (tables.length === 0) throw new Error('请至少选择一张数据表')
  if (tables.length > 200) throw new Error('单次任务最多处理 200 张数据表')

  const catalog = gateway.getConnectionCatalog()
  const sourceConnection = catalog.connections.find(
    connection => connection.id === scope.source.connId,
  )
  const targetConnection = catalog.connections.find(
    connection => connection.id === scope.target.connId,
  )
  if (!sourceConnection) throw new Error('源连接不存在或尚未连接')
  if (!targetConnection) throw new Error('目标连接不存在或尚未连接')

  const sourceTables = await gateway.getTables(
    scope.source.connId,
    scope.source.database,
  )
  const missingSource = tables.filter(table => !sourceTables.includes(table))
  if (missingSource.length > 0) {
    throw new Error(`源表不存在或不可访问: ${missingSource.join(', ')}`)
  }

  return {
    source: { ...scope.source },
    target: { ...scope.target },
    tables,
    sourceType: sourceConnection.type,
    targetType: targetConnection.type,
  }
}

export function buildClearTableSql(
  type: ConnectionData['type'],
  database: string,
  tableName: string,
): string {
  if (type === 'MySQL') {
    return `DELETE FROM ${quoteIdentifier(database, '`')}.${quoteIdentifier(tableName, '`')}`
  }
  if (type === 'SQL Server') {
    return `DELETE FROM ${quoteIdentifier(database, '[')}.[dbo].${quoteIdentifier(tableName, '[')}`
  }
  if (type === 'PostgreSQL') {
    return `DELETE FROM "public".${quoteIdentifier(tableName, '"')}`
  }
  return `DELETE FROM ${quoteIdentifier(tableName, '"')}`
}

export function commonColumnNames(
  source: string[],
  target: string[],
): string[] {
  const targetNames = new Set(target)
  return source.filter(column => targetNames.has(column))
}
