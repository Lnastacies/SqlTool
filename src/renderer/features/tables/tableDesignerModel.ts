import type {
  DatabaseType,
  TableDefinition,
  TableFieldDefinition,
  TableForeignKeyDefinition,
  TableIndexDefinition,
  TableMetadata,
} from '../../types'

let draftSequence = 0

export interface TableFieldDraft extends TableFieldDefinition {
  key: string
}

export interface TableIndexDraft extends TableIndexDefinition {
  key: string
}

export interface TableForeignKeyDraft extends TableForeignKeyDefinition {
  key: string
}

export interface TableDefinitionDraft {
  name: string
  primaryKeyName?: string
  fields: TableFieldDraft[]
  indexes: TableIndexDraft[]
  foreignKeys: TableForeignKeyDraft[]
  /** TDSQL 建表选项，仅 databaseType === 'TDSQL' 时存在 */
  tdsql?: TDSQLTableOptions
}

/** TDSQL 建表选项 */
export interface TDSQLTableOptions {
  /** 表类型，默认 'shard' */
  tableType: 'shard' | 'noshard' | 'broadcast'
  /** SHARDKEY 字段名，仅 tableType='shard' 时有效 */
  shardKey?: string
}

export function supportsAutoIncrement(
  databaseType: DatabaseType,
  dataType: string,
): boolean {
  const type = dataType.trim().toLowerCase()
  if (databaseType === 'SQLite') return type === 'integer'
  if (databaseType === 'PostgreSQL') {
    return /^(smallint|integer|bigint|smallserial|serial|bigserial)$/.test(type)
  }
  if (databaseType === 'SQL Server') {
    return /^(tinyint|smallint|int|bigint|decimal\([^)]*\)|numeric\([^)]*\))$/.test(type)
  }
  return /^(tinyint|smallint|mediumint|int|integer|bigint)(\([^)]*\))?(\s+unsigned)?$/.test(type)
}

export function createDraftKey(prefix: string): string {
  draftSequence += 1
  return `${prefix}-${Date.now()}-${draftSequence}`
}

export function createDefaultField(
  databaseType: DatabaseType,
  name = 'id',
): TableFieldDraft {
  const type = databaseType === 'SQLite'
    ? 'INTEGER'
    : databaseType === 'PostgreSQL'
      ? 'integer'
      : databaseType === 'SQL Server'
        ? 'int'
        : 'INT'
  return {
    key: createDraftKey('field'),
    name,
    type,
    notNull: true,
    primary: true,
    autoIncrement: true,
    defaultValue: '',
    comment: '',
  }
}

export function createTableDefinitionDraft(
  databaseType: DatabaseType,
  tableName: string,
  metadata?: TableMetadata,
): TableDefinitionDraft {
  // TDSQL 默认按分表（shard）创建，需要后续指定 SHARDKEY
  const tdsqlDefaults = databaseType === 'TDSQL'
    ? { tableType: 'shard' as const }
    : undefined
  if (!metadata) {
    return {
      name: tableName,
      fields: [createDefaultField(databaseType)],
      indexes: [],
      foreignKeys: [],
      tdsql: tdsqlDefaults,
    }
  }
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
    tdsql: tdsqlDefaults,
    fields: metadata.fields.map(field => ({
      key: createDraftKey('field'),
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
        key: createDraftKey('index'),
        originalName: index.name,
        name: index.name,
        fields: [...index.fields],
        unique: index.unique,
      })),
    foreignKeys: metadata.foreign_keys.map(foreignKey => ({
      key: createDraftKey('foreign-key'),
      originalName: foreignKey.name,
      name: foreignKey.name,
      fields: [...foreignKey.fields],
      referencedTable: foreignKey.referenced_table,
      referencedFields: [...foreignKey.referenced_fields],
    })),
  }
}

export function remapFieldReferences(
  previous: TableDefinitionDraft,
  fields: TableFieldDraft[],
): TableDefinitionDraft {
  const namesByKey = new Map(
    previous.fields.map(field => [field.key, field.name]),
  )
  const replacements = new Map<string, string>()
  fields.forEach(field => {
    const previousName = namesByKey.get(field.key)
    if (previousName && previousName !== field.name) {
      replacements.set(previousName, field.name)
    }
  })
  const validNames = new Set(fields.map(field => field.name))
  const remap = (values: string[]) => values
    .map(value => replacements.get(value) || value)
    .filter(value => validNames.has(value))

  return {
    ...previous,
    fields,
    indexes: previous.indexes.map(index => ({
      ...index,
      fields: remap(index.fields),
    })),
    foreignKeys: previous.foreignKeys.map(foreignKey => ({
      ...foreignKey,
      fields: remap(foreignKey.fields),
    })),
  }
}

export function toTableDefinition(
  draft: TableDefinitionDraft,
): TableDefinition {
  const omitKey = <T extends { key: string }>(item: T): Omit<T, 'key'> => {
    const { key: _key, ...value } = item
    return value
  }
  return {
    name: draft.name,
    primaryKeyName: draft.primaryKeyName,
    fields: draft.fields.map(omitKey),
    indexes: draft.indexes.map(omitKey),
    foreignKeys: draft.foreignKeys.map(omitKey),
  }
}
