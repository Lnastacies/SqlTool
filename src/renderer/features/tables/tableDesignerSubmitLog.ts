import type {
  DatabaseType,
  SaveTableStructureRequest,
} from '../../types'

const DETAIL_CHUNK_LIMIT = 3000
const COMMENT_PREVIEW_LIMIT = 500
const DETAIL_SEPARATOR = ' | '

export interface TableDesignerSubmitLogContext {
  database: string
  databaseType: DatabaseType
  validationIssues: string[]
}

function chunkDetail(section: string, lines: string[]): string[] {
  if (lines.length === 0) return []
  const chunks: string[][] = []
  let current: string[] = []
  let currentLength = 0

  lines.forEach(line => {
    const nextLength = (
      currentLength
      + line.length
      + (current.length > 0 ? DETAIL_SEPARATOR.length : 0)
    )
    if (current.length > 0 && nextLength > DETAIL_CHUNK_LIMIT) {
      chunks.push(current)
      current = []
      currentLength = 0
    }
    current.push(line)
    currentLength += (
      line.length
      + (current.length > 1 ? DETAIL_SEPARATOR.length : 0)
    )
  })
  if (current.length > 0) chunks.push(current)

  return chunks.map((chunk, index) => (
    `表结构提交前${section}(${index + 1}/${chunks.length}): ${chunk.join(DETAIL_SEPARATOR)}`
  ))
}

export function buildTableDesignerSubmitLogs(
  context: TableDesignerSubmitLogContext,
  request: SaveTableStructureRequest,
): string[] {
  const { definition } = request
  const messages = [
    `表结构提交前摘要: ${JSON.stringify({
      mode: request.originalName ? 'alter' : 'create',
      databaseType: context.databaseType,
      database: context.database,
      originalName: request.originalName || null,
      tableName: definition.name,
      primaryKeyName: definition.primaryKeyName || null,
      fieldCount: definition.fields.length,
      indexCount: definition.indexes.length,
      foreignKeyCount: definition.foreignKeys.length,
      validationIssues: context.validationIssues,
    })}`,
  ]

  const fieldLines = definition.fields.map((field, index) => (
    `字段[${index + 1}]=${JSON.stringify({
      originalName: field.originalName || null,
      name: field.name,
      type: field.type,
      notNull: field.notNull,
      primary: field.primary,
      autoIncrement: field.autoIncrement,
      defaultValue: field.defaultValue,
      commentLength: field.comment.length,
      commentPreview: field.comment.slice(0, COMMENT_PREVIEW_LIMIT),
    })}`
  ))
  messages.push(...chunkDetail('字段明细', fieldLines))

  const indexLines = definition.indexes.map((index, position) => (
    `索引[${position + 1}]=${JSON.stringify({
      originalName: index.originalName || null,
      name: index.name,
      fields: index.fields,
      unique: index.unique,
    })}`
  ))
  messages.push(...chunkDetail('索引明细', indexLines))

  const foreignKeyLines = definition.foreignKeys.map(
    (foreignKey, position) => (
      `外键[${position + 1}]=${JSON.stringify({
        originalName: foreignKey.originalName || null,
        name: foreignKey.name,
        fields: foreignKey.fields,
        referencedTable: foreignKey.referencedTable,
        referencedFields: foreignKey.referencedFields,
      })}`
    ),
  )
  messages.push(...chunkDetail('外键明细', foreignKeyLines))
  return messages
}
