import { buildMySQLAlterPlan } from './mysqlTableStructureSql'
import { buildPostgresAlterPlan } from './postgresTableStructureSql'
import { buildSQLiteAlterPlan } from './sqliteTableStructureSql'
import { buildSqlServerAlterPlan } from './sqlServerTableStructureSql'
import {
  buildCreateTableStatements,
  sameTableDefinition,
  tableReference,
} from './tableStructureSqlCommon'
import type {
  TableDatabaseType,
  TableDefinition,
  TableStructurePlan,
} from './tableStructureTypes'

function validateOriginalMappings(
  original: TableDefinition,
  definition: TableDefinition,
): void {
  const available = new Set(original.fields.map(field => field.name))
  const mapped = new Set<string>()
  definition.fields.forEach(field => {
    if (!field.originalName) return
    if (!available.has(field.originalName)) {
      throw new Error(`原字段不存在: ${field.originalName}`)
    }
    if (mapped.has(field.originalName)) {
      throw new Error(`原字段“${field.originalName}”被重复映射`)
    }
    mapped.add(field.originalName)
  })
}

export function buildTableStructurePlan(
  databaseType: TableDatabaseType,
  database: string,
  definition: TableDefinition,
  original?: TableDefinition,
): TableStructurePlan {
  const definitionStatements = buildCreateTableStatements(
    databaseType,
    database,
    definition,
  )
  if (!original) {
    const warnings = (
      databaseType === 'SQL Server'
      && definition.fields.some(field => field.comment)
    )
      ? ['SQL Server 字段注释暂不参与结构保存']
      : []
    return {
      mode: 'create',
      statements: definitionStatements,
      definitionStatements,
      warnings,
    }
  }

  validateOriginalMappings(original, definition)
  if (sameTableDefinition(original, definition)) {
    return {
      mode: 'alter',
      statements: [],
      definitionStatements,
      warnings: [],
    }
  }

  let plan: TableStructurePlan
  if (databaseType === 'MySQL') {
    plan = buildMySQLAlterPlan(database, original, definition)
  } else if (databaseType === 'PostgreSQL') {
    plan = buildPostgresAlterPlan(database, original, definition)
  } else if (databaseType === 'SQL Server') {
    plan = buildSqlServerAlterPlan(database, original, definition)
  } else {
    plan = buildSQLiteAlterPlan(database, original, definition)
  }
  return { ...plan, definitionStatements }
}

export function buildDropTableStatement(
  databaseType: TableDatabaseType,
  database: string,
  tableName: string,
): string {
  return `DROP TABLE ${tableReference(databaseType, database, tableName)}`
}

export function buildTruncateTableStatement(
  databaseType: TableDatabaseType,
  database: string,
  tableName: string,
): string {
  const reference = tableReference(databaseType, database, tableName)
  return databaseType === 'SQLite'
    ? `DELETE FROM ${reference}`
    : `TRUNCATE TABLE ${reference}`
}
