import type {
  TableFieldMetadata,
  TableImportMapping,
  TableImportPreview,
  TableImportRequest,
} from '../../types'

export interface TableImportMappingDraft {
  source: string
  target?: string
}

function requiredTargetFields(fields: TableFieldMetadata[]): string[] {
  return fields
    .filter(field => (
      field.not_null
      && !field.auto_increment
      && !field.default_expression
      && (field.default === null || field.default === undefined)
    ))
    .map(field => field.name)
}

export function createImportMappings(
  sourceColumns: string[],
  targetFields: TableFieldMetadata[],
): TableImportMappingDraft[] {
  const exactTargets = new Set(targetFields.map(field => field.name))
  const targetsByLowerName = new Map(
    targetFields.map(field => [field.name.toLowerCase(), field.name]),
  )
  const usedTargets = new Set<string>()
  return sourceColumns.map(source => {
    const candidate = exactTargets.has(source)
      ? source
      : targetsByLowerName.get(source.toLowerCase())
    const target = candidate && !usedTargets.has(candidate)
      ? candidate
      : undefined
    if (target) usedTargets.add(target)
    return { source, target }
  })
}

export function validateImportMappings(
  mappings: TableImportMappingDraft[],
  targetFields: TableFieldMetadata[],
): string | null {
  const selected = mappings.filter(
    (mapping): mapping is TableImportMapping => Boolean(mapping.target),
  )
  if (selected.length === 0) return '请至少映射一个目标字段'
  const targetNames = selected.map(mapping => mapping.target)
  if (new Set(targetNames).size !== targetNames.length) {
    return '同一个目标字段不能被重复映射'
  }
  const mappedTargets = new Set(targetNames)
  const missingRequired = requiredTargetFields(targetFields)
    .filter(field => !mappedTargets.has(field))
  if (missingRequired.length > 0) {
    return `以下必填字段尚未映射：${missingRequired.join('、')}`
  }
  return null
}

export function buildTableImportRequest(
  preview: TableImportPreview,
  mappings: TableImportMappingDraft[],
  emptyStringAsNull: boolean,
): TableImportRequest {
  return {
    fileName: preview.fileName,
    format: preview.format,
    rows: preview.rows,
    mappings: mappings
      .filter((mapping): mapping is TableImportMapping => Boolean(mapping.target))
      .map(mapping => ({
        source: mapping.source,
        target: mapping.target,
      })),
    emptyStringAsNull,
  }
}

export function formatPreviewValue(value: unknown): string {
  if (value === null) return 'NULL'
  if (value === undefined) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}
