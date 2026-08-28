import {
  buildCreateTableStatements,
  buildForeignKeyClause,
  tableReference,
} from './tableStructureSqlCommon'
import { metadataToTableDefinition } from './tableStructureTypes'
import type {
  DatabaseModel,
  DatabaseModelTable,
} from './databaseManagementTypes'

export interface DatabaseBackupTableSql {
  createSql: string
  deferredConstraintSql: string[]
}

function terminateStatements(statements: string[]): string {
  return statements
    .map(statement => `${statement.trim().replace(/;+\s*$/, '')};`)
    .join('\n\n')
}

export function buildDatabaseBackupTableSql(
  model: Pick<DatabaseModel, 'name' | 'type'>,
  table: DatabaseModelTable,
): DatabaseBackupTableSql {
  if (model.type !== 'PostgreSQL' && model.type !== 'SQL Server') {
    return {
      createSql: table.ddl,
      deferredConstraintSql: [],
    }
  }

  const definition = metadataToTableDefinition(table.name, {
    primary_key_name: table.primaryKeyName,
    fields: table.fields,
    indexes: table.indexes || [],
    foreign_keys: table.foreignKeys,
    ddl: table.ddl,
  })
  const createStatements = buildCreateTableStatements(
    model.type,
    model.name,
    { ...definition, foreignKeys: [] },
  )
  const tableRef = tableReference(model.type, model.name, table.name)
  const deferredConstraintSql = definition.foreignKeys.map(foreignKey => (
    `ALTER TABLE ${tableRef} ADD ${buildForeignKeyClause(model.type, foreignKey)};`
  ))

  return {
    createSql: terminateStatements(createStatements),
    deferredConstraintSql,
  }
}
