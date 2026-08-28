import type { ConnectionData, TableMetadata } from './adapters'
import {
  metadataToTableDefinition,
  type TableDefinition,
} from './tableStructureTypes'

type DatabaseType = ConnectionData['type']

export interface MappedTableDefinition {
  definition: TableDefinition
  warnings: string[]
}

function normalizedDefinition(definition: TableDefinition): unknown {
  const normalizeText = (value: string | undefined) => (
    (value || '').trim().replace(/\s+/g, ' ').toLowerCase()
  )
  return {
    name: definition.name,
    primaryKeyName: normalizeText(definition.primaryKeyName),
    fields: definition.fields.map(field => ({
      name: field.name,
      type: normalizeText(field.type),
      notNull: field.notNull,
      primary: field.primary,
      autoIncrement: field.autoIncrement,
      defaultValue: normalizeText(field.defaultValue),
      comment: field.comment || '',
    })),
    indexes: definition.indexes
      .map(index => ({
        name: index.name,
        fields: index.fields,
        unique: index.unique,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    foreignKeys: definition.foreignKeys
      .map(foreignKey => ({
        name: foreignKey.name,
        fields: foreignKey.fields,
        referencedTable: foreignKey.referencedTable,
        referencedFields: foreignKey.referencedFields,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  }
}

export function tableStructureMatches(
  desired: TableDefinition,
  targetMetadata: TableMetadata,
): boolean {
  const current = metadataToTableDefinition(desired.name, targetMetadata)
  return JSON.stringify(normalizedDefinition(desired))
    === JSON.stringify(normalizedDefinition(current))
}

function portableDefault(
  expression: string | undefined,
  sourceType: DatabaseType,
  targetType: DatabaseType,
): string {
  const value = (expression || '').trim()
  if (!value || sourceType === targetType) return value
  if (/^(?:null|current_(?:date|time|timestamp))$/i.test(value)) return value
  if (/^[+-]?\d+(?:\.\d+)?$/.test(value)) return value
  if (/^'(?:[^']|'')*'$/.test(value)) return value
  if (/^(?:true|false)$/i.test(value)) {
    return targetType === 'SQL Server' || targetType === 'MySQL'
      ? (/^true$/i.test(value) ? '1' : '0')
      : value.toUpperCase()
  }
  return ''
}

function withSize(type: string, fallback: number): string {
  const match = type.match(/\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\)/)
  if (!match) return `(${fallback})`
  return match[2] ? `(${match[1]},${match[2]})` : `(${match[1]})`
}

export function mapDatabaseType(
  sourceTypeName: string,
  targetType: DatabaseType,
): string {
  const type = sourceTypeName.trim()
  const normalized = type
    .toUpperCase()
    .replace(/\bUNSIGNED\b|\bZEROFILL\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (targetType === 'SQLite') {
    if (/BLOB|BINARY|BYTEA|IMAGE/.test(normalized)) return 'BLOB'
    if (/INT|SERIAL|IDENTITY|BOOL|BIT/.test(normalized)) return 'INTEGER'
    if (/REAL|FLOAT|DOUBLE/.test(normalized)) return 'REAL'
    if (/DECIMAL|NUMERIC|MONEY/.test(normalized)) return 'NUMERIC'
    return 'TEXT'
  }

  const integer = /BIGINT|BIGSERIAL/.test(normalized)
    ? 'BIGINT'
    : /SMALLINT|TINYINT|SMALLSERIAL/.test(normalized)
      ? 'SMALLINT'
      : 'INT'
  const decimal = `DECIMAL${withSize(normalized, 18)}`
  const characterSize = withSize(normalized, 255)

  if (targetType === 'MySQL') {
    if (/^ENUM\s*\(|^SET\s*\(/.test(normalized)) return type
    if (/BOOL|BIT/.test(normalized)) return 'TINYINT(1)'
    if (/INT|SERIAL|IDENTITY/.test(normalized)) return integer
    if (/DECIMAL|NUMERIC|MONEY/.test(normalized)) return decimal
    if (/REAL|FLOAT|DOUBLE/.test(normalized)) return 'DOUBLE'
    if (/BLOB|BINARY|BYTEA|IMAGE/.test(normalized)) return 'LONGBLOB'
    if (/JSON/.test(normalized)) return 'JSON'
    if (/UUID|UNIQUEIDENTIFIER/.test(normalized)) return 'CHAR(36)'
    if (/DATE(?!TIME)/.test(normalized)) return 'DATE'
    if (/TIME(?!STAMP)/.test(normalized)) return 'TIME'
    if (/TIMESTAMP|DATETIME/.test(normalized)) return 'DATETIME'
    if (/CHAR|VARCHAR/.test(normalized) && !/MAX/.test(normalized)) {
      return `VARCHAR${characterSize}`
    }
    return 'LONGTEXT'
  }

  if (targetType === 'PostgreSQL') {
    if (/BOOL|BIT/.test(normalized)) return 'BOOLEAN'
    if (/INT|SERIAL|IDENTITY/.test(normalized)) return integer
    if (/DECIMAL|NUMERIC|MONEY/.test(normalized)) return decimal
    if (/REAL|FLOAT|DOUBLE/.test(normalized)) return 'DOUBLE PRECISION'
    if (/BLOB|BINARY|BYTEA|IMAGE/.test(normalized)) return 'BYTEA'
    if (/JSON/.test(normalized)) return 'JSONB'
    if (/UUID|UNIQUEIDENTIFIER/.test(normalized)) return 'UUID'
    if (/DATE(?!TIME)/.test(normalized)) return 'DATE'
    if (/TIME(?!STAMP)/.test(normalized)) return 'TIME'
    if (/TIMESTAMP|DATETIME/.test(normalized)) return 'TIMESTAMP'
    if (/CHAR|VARCHAR/.test(normalized) && !/MAX/.test(normalized)) {
      return `VARCHAR${characterSize}`
    }
    return 'TEXT'
  }

  if (/BOOL/.test(normalized)) return 'BIT'
  if (/INT|SERIAL|IDENTITY/.test(normalized)) return integer
  if (/DECIMAL|NUMERIC|MONEY/.test(normalized)) return decimal
  if (/REAL|FLOAT|DOUBLE/.test(normalized)) return 'FLOAT'
  if (/BLOB|BINARY|BYTEA|IMAGE/.test(normalized)) return 'VARBINARY(MAX)'
  if (/UUID|UNIQUEIDENTIFIER/.test(normalized)) return 'UNIQUEIDENTIFIER'
  if (/DATE(?!TIME)/.test(normalized)) return 'DATE'
  if (/TIME(?!STAMP)/.test(normalized)) return 'TIME'
  if (/TIMESTAMP|DATETIME/.test(normalized)) return 'DATETIME2'
  if (/CHAR|VARCHAR/.test(normalized) && !/MAX/.test(normalized)) {
    return `NVARCHAR${characterSize}`
  }
  return 'NVARCHAR(MAX)'
}

export function buildTargetTableDefinition(
  tableName: string,
  source: TableMetadata,
  sourceType: DatabaseType,
  targetType: DatabaseType,
  target?: TableMetadata,
): MappedTableDefinition {
  const warnings: string[] = []
  const targetFields = new Set(target?.fields.map(field => field.name) || [])
  const targetIndexes = new Set(target?.indexes.map(index => index.name) || [])
  const targetForeignKeys = new Set(
    target?.foreign_keys.map(foreignKey => foreignKey.name) || [],
  )
  const sourcePrimaryFields = new Set(
    source.fields.filter(field => field.primary).map(field => field.name),
  )

  const fields = source.fields.map(field => {
    const defaultValue = portableDefault(
      field.default_expression,
      sourceType,
      targetType,
    )
    if (
      sourceType !== targetType
      && field.default_expression
      && !defaultValue
    ) {
      warnings.push(`字段“${field.name}”的默认值不兼容，已在目标结构中省略`)
    }
    return {
      originalName: targetFields.has(field.name) ? field.name : undefined,
      name: field.name,
      type: sourceType === targetType
        ? field.type
        : mapDatabaseType(field.type, targetType),
      notNull: field.not_null,
      primary: field.primary,
      autoIncrement: Boolean(field.auto_increment),
      defaultValue,
      comment: field.comment || '',
    }
  })

  return {
    definition: {
      name: tableName,
      primaryKeyName: source.primary_key_name,
      fields,
      indexes: source.indexes
        .filter(index => !(
          index.name.toUpperCase() === 'PRIMARY'
          || (
            index.unique
            && index.fields.length > 0
            && index.fields.every(field => sourcePrimaryFields.has(field))
          )
        ))
        .map(index => ({
          originalName: targetIndexes.has(index.name) ? index.name : undefined,
          name: index.name,
          fields: [...index.fields],
          unique: index.unique,
        })),
      foreignKeys: source.foreign_keys.map(foreignKey => ({
        originalName: targetForeignKeys.has(foreignKey.name)
          ? foreignKey.name
          : undefined,
        name: foreignKey.name,
        fields: [...foreignKey.fields],
        referencedTable: foreignKey.referenced_table,
        referencedFields: [...foreignKey.referenced_fields],
      })),
    },
    warnings,
  }
}
