import type { ConnectionData } from './adapters'
import { normalizeDatabaseName } from './databaseCreation'
import type { AlterDatabaseRequest } from './databaseManagementTypes'

const PROTECTED_DATABASES: Partial<Record<ConnectionData['type'], string[]>> = {
  MySQL: ['information_schema', 'mysql', 'performance_schema', 'sys'],
  PostgreSQL: ['postgres', 'template0', 'template1'],
  'SQL Server': ['master', 'model', 'msdb', 'tempdb'],
}

function quoteIdentifier(
  type: ConnectionData['type'],
  value: string,
): string {
  if (type === 'MySQL') return `\`${value.replace(/`/g, '``')}\``
  if (type === 'SQL Server') return `[${value.replace(/]/g, ']]')}]`
  return `"${value.replace(/"/g, '""')}"`
}

function normalizeOption(value: string | undefined, label: string): string {
  const normalized = value?.trim() || ''
  if (!normalized) return ''
  if (normalized.length > 64 || !/^[A-Za-z0-9_]+$/.test(normalized)) {
    throw new Error(`${label}只能包含字母、数字和下划线，且不能超过 64 个字符`)
  }
  return normalized
}

export function assertDatabaseCanBeDropped(
  type: ConnectionData['type'],
  database: string,
): void {
  const name = assertDatabaseCanBeManaged(type, database, '删除')
  if (type === 'SQLite') return
  const protectedNames = PROTECTED_DATABASES[type] || []
  if (protectedNames.some(item => item.toLowerCase() === name.toLowerCase())) {
    throw new Error(`系统数据库“${name}”不允许删除`)
  }
}

export function assertDatabaseCanBeAltered(
  type: ConnectionData['type'],
  database: string,
): void {
  const name = assertDatabaseCanBeManaged(type, database, '编辑')
  const protectedNames = PROTECTED_DATABASES[type] || []
  if (protectedNames.some(item => item.toLowerCase() === name.toLowerCase())) {
    throw new Error(`系统数据库“${name}”不允许编辑`)
  }
}

function assertDatabaseCanBeManaged(
  type: ConnectionData['type'],
  database: string,
  action: string,
): string {
  if (type === 'SQLite') {
    throw new Error(`SQLite 数据库文件不能通过实例菜单${action}`)
  }
  return normalizeDatabaseName(type, database)
}

export function buildDropDatabaseStatement(
  type: ConnectionData['type'],
  database: string,
): string {
  assertDatabaseCanBeDropped(type, database)
  return `DROP DATABASE ${quoteIdentifier(type, database.trim())}`
}

export function buildAlterDatabaseStatement(
  type: ConnectionData['type'],
  database: string,
  request: AlterDatabaseRequest,
): { statement: string; nextName: string } {
  assertDatabaseCanBeAltered(type, database)
  const currentName = normalizeDatabaseName(type, database)
  if (type === 'MySQL') {
    const charset = normalizeOption(request.charset, '字符集')
    const collation = normalizeOption(request.collation, '排序规则')
    if (!charset && !collation) {
      throw new Error('请至少设置字符集或排序规则')
    }
    const clauses = [
      charset ? `DEFAULT CHARACTER SET = ${charset}` : '',
      collation ? `DEFAULT COLLATE = ${collation}` : '',
    ].filter(Boolean)
    return {
      statement: `ALTER DATABASE ${quoteIdentifier(type, currentName)} ${clauses.join(' ')}`,
      nextName: currentName,
    }
  }

  if (type === 'SQLite') {
    throw new Error('SQLite 数据库属性请通过连接配置管理')
  }

  const nextName = normalizeDatabaseName(type, request.name || '')
  if (nextName.toLowerCase() === currentName.toLowerCase()) {
    throw new Error('新数据库名称与当前名称相同')
  }
  if (type === 'PostgreSQL') {
    return {
      statement: [
        'ALTER DATABASE',
        quoteIdentifier(type, currentName),
        'RENAME TO',
        quoteIdentifier(type, nextName),
      ].join(' '),
      nextName,
    }
  }
  return {
    statement: [
      'ALTER DATABASE',
      quoteIdentifier(type, currentName),
      'MODIFY NAME =',
      quoteIdentifier(type, nextName),
    ].join(' '),
    nextName,
  }
}
