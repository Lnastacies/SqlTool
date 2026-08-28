import {
  buildColumnDefinition,
  buildForeignKeyClause,
  normalizedSqlValue,
  quoteTableIdentifier,
  tableReference,
} from './tableStructureSqlCommon'
import type {
  TableDefinition,
  TableFieldDefinition,
  TableForeignKeyDefinition,
  TableIndexDefinition,
  TableStructurePlan,
} from './tableStructureTypes'

function sameValues(left: string[], right: string[]): boolean {
  return (
    left.length === right.length
    && left.every((value, index) => value === right[index])
  )
}

function sameField(
  original: TableFieldDefinition,
  current: TableFieldDefinition,
): boolean {
  return (
    original.name === current.name
    && normalizedSqlValue(original.type) === normalizedSqlValue(current.type)
    && (original.notNull || original.primary)
      === (current.notNull || current.primary)
    && original.autoIncrement === current.autoIncrement
    && normalizedSqlValue(original.defaultValue)
      === normalizedSqlValue(current.defaultValue)
    && original.comment === current.comment
  )
}

function sameIndex(
  original: TableIndexDefinition,
  current: TableIndexDefinition,
): boolean {
  return (
    original.name === current.name
    && original.unique === current.unique
    && sameValues(original.fields, current.fields)
  )
}

function sameForeignKey(
  original: TableForeignKeyDefinition,
  current: TableForeignKeyDefinition,
): boolean {
  return (
    original.name === current.name
    && original.referencedTable === current.referencedTable
    && sameValues(original.fields, current.fields)
    && sameValues(original.referencedFields, current.referencedFields)
  )
}

export function buildMySQLAlterPlan(
  database: string,
  original: TableDefinition,
  definition: TableDefinition,
): TableStructurePlan {
  const quote = (value: string) => quoteTableIdentifier(value, 'MySQL')
  const clauses: string[] = []

  original.foreignKeys.forEach(foreignKey => {
    const current = definition.foreignKeys.find(
      item => item.originalName === foreignKey.name,
    )
    if (!current || !sameForeignKey(foreignKey, current)) {
      clauses.push(`DROP FOREIGN KEY ${quote(foreignKey.name)}`)
    }
  })
  original.indexes.forEach(index => {
    const current = definition.indexes.find(
      item => item.originalName === index.name,
    )
    if (!current || !sameIndex(index, current)) {
      clauses.push(`DROP INDEX ${quote(index.name)}`)
    }
  })

  const originalPrimary = original.fields
    .filter(field => field.primary)
    .map(field => field.name)
  const currentPrimary = definition.fields
    .filter(field => field.primary)
    .map(field => field.name)
  const primaryChanged = !sameValues(originalPrimary, currentPrimary)
  if (primaryChanged && originalPrimary.length > 0) {
    clauses.push('DROP PRIMARY KEY')
  }

  const retainedNames = new Set(
    definition.fields
      .map(field => field.originalName)
      .filter((name): name is string => Boolean(name)),
  )
  original.fields
    .filter(field => !retainedNames.has(field.name))
    .forEach(field => clauses.push(`DROP COLUMN ${quote(field.name)}`))

  definition.fields.forEach(field => {
    const column = buildColumnDefinition('MySQL', field)
    if (field.originalName) {
      const originalField = original.fields.find(
        item => item.name === field.originalName,
      )
      if (!originalField) throw new Error(`原字段不存在: ${field.originalName}`)
      if (!sameField(originalField, field)) {
        clauses.push(`CHANGE COLUMN ${quote(field.originalName)} ${column}`)
      }
    } else {
      clauses.push(`ADD COLUMN ${column}`)
    }
  })

  const primaryFields = definition.fields.filter(field => field.primary)
  if (primaryChanged && primaryFields.length > 0) {
    clauses.push(
      `ADD PRIMARY KEY (${primaryFields.map(field => quote(field.name)).join(', ')})`,
    )
  }
  definition.indexes.forEach(index => {
    const originalIndex = index.originalName
      ? original.indexes.find(item => item.name === index.originalName)
      : undefined
    if (!originalIndex || !sameIndex(originalIndex, index)) {
      clauses.push(
        `ADD ${index.unique ? 'UNIQUE ' : ''}INDEX ${quote(index.name)} (${index.fields.map(quote).join(', ')})`,
      )
    }
  })
  definition.foreignKeys.forEach(foreignKey => {
    const originalForeignKey = foreignKey.originalName
      ? original.foreignKeys.find(
        item => item.name === foreignKey.originalName,
      )
      : undefined
    if (
      !originalForeignKey
      || !sameForeignKey(originalForeignKey, foreignKey)
    ) {
      clauses.push(`ADD ${buildForeignKeyClause('MySQL', foreignKey)}`)
    }
  })
  if (definition.name !== original.name) {
    clauses.push(
      `RENAME TO ${tableReference('MySQL', database, definition.name)}`,
    )
  }

  return {
    mode: 'alter',
    statements: clauses.length > 0
      ? [
        `ALTER TABLE ${tableReference('MySQL', database, original.name)}\n  ${clauses.join(',\n  ')}`,
      ]
      : [],
    warnings: [],
  }
}
