import type {
  SaveTableStructureRequest,
  TableDatabaseType,
  TableDefinition,
} from './tableStructureTypes'

const FORBIDDEN_TYPE_PATTERN = /["`;]|--|\/\*|\*\//
const FORBIDDEN_DEFAULT_PATTERN = /;|--|\/\*|\*\//
const MYSQL_ENUM_SET_PATTERN =
  /^(?:enum|set)\s*\(\s*'(?:[^']|'')*'(?:\s*,\s*'(?:[^']|'')*')*\s*\)$/i

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function assertIdentifier(value: string, label: string): void {
  const name = value?.trim()
  if (!name) throw new Error(`${label}不能为空`)
  if (name.length > 128) throw new Error(`${label}不能超过 128 个字符`)
  if (/[\u0000-\u001f]/.test(name)) {
    throw new Error(`${label}不能包含控制字符`)
  }
}

function assertUniqueNames(
  values: string[],
  label: string,
): void {
  const names = new Set<string>()
  values.forEach(value => {
    const normalized = normalizeName(value)
    if (names.has(normalized)) throw new Error(`${label}“${value}”重复`)
    names.add(normalized)
  })
}

function assertFieldReferences(
  values: string[],
  fields: Set<string>,
  label: string,
): void {
  if (values.length === 0) throw new Error(`${label}至少需要一个字段`)
  values.forEach(value => {
    if (!fields.has(normalizeName(value))) {
      throw new Error(`${label}引用了不存在的字段“${value}”`)
    }
  })
}

function validateFields(
  databaseType: TableDatabaseType,
  definition: TableDefinition,
): void {
  if (definition.fields.length === 0) {
    throw new Error('数据表至少需要一个字段')
  }
  assertUniqueNames(definition.fields.map(field => field.name), '字段名')

  definition.fields.forEach((field, index) => {
    const label = `第 ${index + 1} 个字段`
    assertIdentifier(field.name, `${label}名称`)
    const type = field.type?.trim()
    if (!type) throw new Error(`${label}的数据类型不能为空`)
    // ENUM/SET 的单引号属于合法类型语法，仅允许严格的值列表形式。
    const hasInvalidSingleQuote = (
      type.includes("'")
      && !(databaseType === 'MySQL' && MYSQL_ENUM_SET_PATTERN.test(type))
    )
    if (
      type.length > 100
      || FORBIDDEN_TYPE_PATTERN.test(type)
      || hasInvalidSingleQuote
    ) {
      throw new Error(`${label}的数据类型包含不支持的内容`)
    }
    if (field.defaultValue?.length > 500) {
      throw new Error(`${label}的默认值表达式过长`)
    }
    if (FORBIDDEN_DEFAULT_PATTERN.test(field.defaultValue || '')) {
      throw new Error(`${label}的默认值不能包含多条 SQL 或注释`)
    }
    if (field.autoIncrement && !field.primary) {
      throw new Error(`${label}启用自动递增时必须同时设为主键`)
    }
  })

  const autoFields = definition.fields.filter(field => field.autoIncrement)
  if (autoFields.length > 1) throw new Error('一张表最多只能有一个自动递增字段')
  if (
    databaseType === 'SQLite'
    && autoFields.some(field => !/^integer$/i.test(field.type.trim()))
  ) {
    throw new Error('SQLite 自动递增字段的数据类型必须是 INTEGER')
  }
}

function validateRelations(definition: TableDefinition): void {
  const fields = new Set(definition.fields.map(field => normalizeName(field.name)))
  assertUniqueNames(definition.indexes.map(index => index.name), '索引名')
  definition.indexes.forEach((index, position) => {
    assertIdentifier(index.name, `第 ${position + 1} 个索引名称`)
    assertFieldReferences(index.fields, fields, `索引“${index.name}”`)
    assertUniqueNames(index.fields, `索引“${index.name}”的字段`)
  })

  assertUniqueNames(
    definition.foreignKeys.map(foreignKey => foreignKey.name),
    '外键名',
  )
  definition.foreignKeys.forEach((foreignKey, position) => {
    assertIdentifier(foreignKey.name, `第 ${position + 1} 个外键名称`)
    assertIdentifier(
      foreignKey.referencedTable,
      `外键“${foreignKey.name}”的引用表`,
    )
    assertFieldReferences(
      foreignKey.fields,
      fields,
      `外键“${foreignKey.name}”`,
    )
    if (
      foreignKey.fields.length !== foreignKey.referencedFields.length
      || foreignKey.referencedFields.length === 0
    ) {
      throw new Error(`外键“${foreignKey.name}”的本地字段与引用字段数量不一致`)
    }
    foreignKey.referencedFields.forEach(field => {
      assertIdentifier(field, `外键“${foreignKey.name}”的引用字段`)
    })
  })
}

export function validateTableStructureRequest(
  databaseType: TableDatabaseType,
  request: SaveTableStructureRequest,
): SaveTableStructureRequest {
  if (!request?.definition) throw new Error('表结构请求格式无效')
  assertIdentifier(request.definition.name, '表名')
  if (request.definition.primaryKeyName) {
    assertIdentifier(request.definition.primaryKeyName, '主键约束名')
  }
  if (request.originalName !== undefined) {
    assertIdentifier(request.originalName, '原表名')
  }
  validateFields(databaseType, request.definition)
  validateRelations(request.definition)

  return {
    originalName: request.originalName?.trim(),
    definition: {
      name: request.definition.name.trim(),
      primaryKeyName: request.definition.primaryKeyName?.trim() || undefined,
      fields: request.definition.fields.map(field => ({
        ...field,
        originalName: field.originalName?.trim() || undefined,
        name: field.name.trim(),
        type: field.type.trim(),
        defaultValue: field.defaultValue?.trim() || '',
        comment: field.comment?.trim() || '',
      })),
      indexes: request.definition.indexes.map(index => ({
        ...index,
        originalName: index.originalName?.trim() || undefined,
        name: index.name.trim(),
        fields: index.fields.map(field => field.trim()),
      })),
      foreignKeys: request.definition.foreignKeys.map(foreignKey => ({
        ...foreignKey,
        originalName: foreignKey.originalName?.trim() || undefined,
        name: foreignKey.name.trim(),
        fields: foreignKey.fields.map(field => field.trim()),
        referencedTable: foreignKey.referencedTable.trim(),
        referencedFields: foreignKey.referencedFields.map(
          field => field.trim(),
        ),
      })),
    },
  }
}
