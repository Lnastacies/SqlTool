import {
  buildCreateIndexStatement,
  buildCreateTableStatements,
  quoteTableIdentifier,
  tableReference,
} from './tableStructureSqlCommon'
import type {
  TableDefinition,
  TableStructurePlan,
} from './tableStructureTypes'

export function buildSQLiteAlterPlan(
  database: string,
  original: TableDefinition,
  definition: TableDefinition,
): TableStructurePlan {
  const quote = (value: string) => quoteTableIdentifier(value, 'SQLite')
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
  const temporaryTable = `__sqltool_rebuild_${suffix}`
  const retainedFields = definition.fields.filter(field => field.originalName)
  if (retainedFields.length === 0) {
    throw new Error('SQLite 修改表结构时至少需要保留一个原字段')
  }

  const createTemporary = buildCreateTableStatements(
    'SQLite',
    database,
    definition,
    temporaryTable,
  )[0]
  const targetColumns = retainedFields.map(field => quote(field.name)).join(', ')
  const sourceColumns = retainedFields.map(
    field => quote(field.originalName!),
  ).join(', ')
  const statements = [
    'PRAGMA foreign_keys = OFF',
    'BEGIN IMMEDIATE',
    createTemporary,
    `INSERT INTO ${quote(temporaryTable)} (${targetColumns}) SELECT ${sourceColumns} FROM ${tableReference('SQLite', database, original.name)}`,
    `DROP TABLE ${tableReference('SQLite', database, original.name)}`,
    `ALTER TABLE ${quote(temporaryTable)} RENAME TO ${quote(definition.name)}`,
    ...definition.indexes.map(index => buildCreateIndexStatement(
      'SQLite',
      database,
      definition.name,
      index,
    )),
    'COMMIT',
    'PRAGMA foreign_keys = ON',
  ]

  return {
    mode: 'alter',
    statements,
    warnings: ['SQLite 将在事务内重建数据表，保存前请确认字段类型转换兼容'],
  }
}
