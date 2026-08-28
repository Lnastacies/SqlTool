import {
  buildColumnDefinition,
  buildCreateIndexStatement,
  buildForeignKeyClause,
  quoteSqlString,
  quoteTableIdentifier,
  tableReference,
} from './tableStructureSqlCommon'
import type {
  TableDefinition,
  TableStructurePlan,
} from './tableStructureTypes'

function dropDefaultConstraintSql(
  database: string,
  tableName: string,
  columnName: string,
): string {
  const databaseLiteral = quoteSqlString(database)
  const tableLiteral = quoteSqlString(tableName)
  const columnLiteral = quoteSqlString(columnName)
  return [
    'DECLARE @sqltool_default sysname;',
    'SELECT @sqltool_default = dc.name',
    `FROM ${quoteTableIdentifier(database, 'SQL Server')}.sys.default_constraints dc`,
    `JOIN ${quoteTableIdentifier(database, 'SQL Server')}.sys.columns c ON c.default_object_id = dc.object_id`,
    `JOIN ${quoteTableIdentifier(database, 'SQL Server')}.sys.tables t ON t.object_id = c.object_id`,
    `WHERE t.name = ${tableLiteral} AND c.name = ${columnLiteral};`,
    `IF @sqltool_default IS NOT NULL EXEC(N'ALTER TABLE ' + QUOTENAME(${databaseLiteral}) + N'.[dbo].' + QUOTENAME(${tableLiteral}) + N' DROP CONSTRAINT ' + QUOTENAME(@sqltool_default));`,
  ].join('\n')
}

export function buildSqlServerAlterPlan(
  database: string,
  original: TableDefinition,
  definition: TableDefinition,
): TableStructurePlan {
  const quote = (value: string) => quoteTableIdentifier(value, 'SQL Server')
  let table = tableReference('SQL Server', database, original.name)
  const statements: string[] = []

  original.foreignKeys.forEach(foreignKey => {
    statements.push(
      `ALTER TABLE ${table} DROP CONSTRAINT ${quote(foreignKey.name)}`,
    )
  })
  original.indexes.forEach(index => {
    statements.push(`DROP INDEX ${quote(index.name)} ON ${table}`)
  })
  if (original.fields.some(field => field.primary)) {
    statements.push(
      `ALTER TABLE ${table} DROP CONSTRAINT ${quote(original.primaryKeyName || `PK_${original.name}`)}`,
    )
  }

  const retainedNames = new Set(
    definition.fields
      .map(field => field.originalName)
      .filter((name): name is string => Boolean(name)),
  )
  original.fields
    .filter(field => !retainedNames.has(field.name))
    .forEach(field => {
      if (field.defaultValue) {
        statements.push(
          dropDefaultConstraintSql(database, original.name, field.name),
        )
      }
      statements.push(`ALTER TABLE ${table} DROP COLUMN ${quote(field.name)}`)
    })

  definition.fields.forEach(field => {
    if (!field.originalName) {
      statements.push(
        `ALTER TABLE ${table} ADD ${buildColumnDefinition('SQL Server', field)}`,
      )
      return
    }
    const originalField = original.fields.find(
      item => item.name === field.originalName,
    )
    if (!originalField) throw new Error(`原字段不存在: ${field.originalName}`)
    if (field.autoIncrement !== originalField.autoIncrement) {
      throw new Error(`SQL Server 不支持直接修改字段“${field.name}”的标识属性`)
    }
    if (field.defaultValue || originalField.defaultValue) {
      statements.push(
        dropDefaultConstraintSql(database, original.name, field.originalName),
      )
    }
    if (field.originalName !== field.name) {
      statements.push(
        `EXEC sp_rename N'dbo.${original.name.replace(/'/g, "''")}.${field.originalName.replace(/'/g, "''")}', N'${field.name.replace(/'/g, "''")}', 'COLUMN'`,
      )
    }
    statements.push(
      `ALTER TABLE ${table} ALTER COLUMN ${quote(field.name)} ${field.type} ${field.notNull || field.primary ? 'NOT NULL' : 'NULL'}`,
    )
    if (field.defaultValue) {
      statements.push(
        `ALTER TABLE ${table} ADD CONSTRAINT ${quote(`DF_${definition.name}_${field.name}`)} DEFAULT ${field.defaultValue} FOR ${quote(field.name)}`,
      )
    }
  })

  if (definition.name !== original.name) {
    statements.push(
      `EXEC sp_rename N'dbo.${original.name.replace(/'/g, "''")}', N'${definition.name.replace(/'/g, "''")}'`,
    )
    table = tableReference('SQL Server', database, definition.name)
  }

  const primaryFields = definition.fields.filter(field => field.primary)
  if (primaryFields.length > 0) {
    statements.push(
      `ALTER TABLE ${table} ADD CONSTRAINT ${quote(definition.primaryKeyName || `PK_${definition.name}`)} PRIMARY KEY (${primaryFields.map(field => quote(field.name)).join(', ')})`,
    )
  }
  definition.foreignKeys.forEach(foreignKey => {
    statements.push(
      `ALTER TABLE ${table} ADD ${buildForeignKeyClause('SQL Server', foreignKey)}`,
    )
  })
  definition.indexes.forEach(index => {
    statements.push(buildCreateIndexStatement(
      'SQL Server',
      database,
      definition.name,
      index,
    ))
  })

  const hasComments = definition.fields.some(field => field.comment)
  return {
    mode: 'alter',
    statements,
    warnings: hasComments
      ? ['SQL Server 字段注释暂不参与结构保存，现有扩展属性不会被删除']
      : [],
  }
}
