import type { ConnectionData, TableMetadata } from './adapters'

export type TableDatabaseType = ConnectionData['type']

export interface TableFieldDefinition {
  originalName?: string
  name: string
  type: string
  notNull: boolean
  primary: boolean
  autoIncrement: boolean
  defaultValue: string
  comment: string
}

export interface TableIndexDefinition {
  originalName?: string
  name: string
  fields: string[]
  unique: boolean
}

export interface TableForeignKeyDefinition {
  originalName?: string
  name: string
  fields: string[]
  referencedTable: string
  referencedFields: string[]
}

export interface TableDefinition {
  name: string
  primaryKeyName?: string
  fields: TableFieldDefinition[]
  indexes: TableIndexDefinition[]
  foreignKeys: TableForeignKeyDefinition[]
}

export interface SaveTableStructureRequest {
  originalName?: string
  definition: TableDefinition
}

export interface TableStructurePlan {
  mode: 'create' | 'alter'
  statements: string[]
  /** 用于结构预览，不参与已有表的变更执行。 */
  definitionStatements?: string[]
  warnings: string[]
}

export interface SaveTableStructureResult {
  tableName: string
  mode: TableStructurePlan['mode']
  statementCount: number
  warnings: string[]
}

export function metadataToTableDefinition(
  tableName: string,
  metadata: TableMetadata,
): TableDefinition {
  const primaryIndexNames = new Set(
    metadata.indexes
      .filter(index => (
        index.name.toUpperCase() === 'PRIMARY'
        || (
          index.unique
          && index.fields.length > 0
          && index.fields.every(field => metadata.fields.some(
            item => item.name === field && item.primary,
          ))
        )
      ))
      .map(index => index.name),
  )

  return {
    name: tableName,
    primaryKeyName: metadata.primary_key_name,
    fields: metadata.fields.map(field => ({
      originalName: field.name,
      name: field.name,
      type: field.type,
      notNull: field.not_null,
      primary: field.primary,
      autoIncrement: Boolean(field.auto_increment),
      defaultValue: field.default_expression || '',
      comment: field.comment || '',
    })),
    indexes: metadata.indexes
      .filter(index => !primaryIndexNames.has(index.name))
      .map(index => ({
        originalName: index.name,
        name: index.name,
        fields: [...index.fields],
        unique: index.unique,
      })),
    foreignKeys: metadata.foreign_keys.map(foreignKey => ({
      originalName: foreignKey.name,
      name: foreignKey.name,
      fields: [...foreignKey.fields],
      referencedTable: foreignKey.referenced_table,
      referencedFields: [...foreignKey.referenced_fields],
    })),
  }
}
