import type { TableMetadata } from './adapters'
import type { TableMutationBatch } from './tableMutationTypes'
import {
  MAX_TABLE_IMPORT_ROWS,
  type TableImportRequest,
} from './tableTransferTypes'

function assertImportRequest(request: TableImportRequest): void {
  if (!request || !Array.isArray(request.rows) || !Array.isArray(request.mappings)) {
    throw new Error('导入请求格式无效')
  }
  if (request.rows.length === 0) throw new Error('没有可导入的数据行')
  if (request.rows.length > MAX_TABLE_IMPORT_ROWS) {
    throw new Error(`单次最多导入 ${MAX_TABLE_IMPORT_ROWS} 行数据`)
  }
  if (request.rows.some(row => (
    !row || typeof row !== 'object' || Array.isArray(row)
  ))) {
    throw new Error('导入数据必须是对象数组')
  }
  if (request.mappings.length === 0) throw new Error('请至少映射一个目标字段')
}

export function buildTableImportBatch(
  request: TableImportRequest,
  metadata: TableMetadata,
): TableMutationBatch {
  assertImportRequest(request)
  const sourceFields = new Set(request.rows.flatMap(row => Object.keys(row)))
  const targetFields = new Set(metadata.fields.map(field => field.name))
  const sourceMappings = new Set<string>()
  const targetMappings = new Set<string>()

  request.mappings.forEach((mapping, index) => {
    if (!mapping || !mapping.source?.trim() || !mapping.target?.trim()) {
      throw new Error(`第 ${index + 1} 个字段映射不完整`)
    }
    if (!sourceFields.has(mapping.source)) {
      throw new Error(`导入文件不存在源字段“${mapping.source}”`)
    }
    if (!targetFields.has(mapping.target)) {
      throw new Error(`目标表不存在字段“${mapping.target}”`)
    }
    if (sourceMappings.has(mapping.source)) {
      throw new Error(`源字段“${mapping.source}”被重复映射`)
    }
    if (targetMappings.has(mapping.target)) {
      throw new Error(`目标字段“${mapping.target}”被重复映射`)
    }
    sourceMappings.add(mapping.source)
    targetMappings.add(mapping.target)
  })

  const requiredFields = metadata.fields.filter(field => (
    field.not_null
    && !field.auto_increment
    && !field.default_expression
    && (field.default === null || field.default === undefined)
  ))
  const inserts = request.rows.map((row, rowIndex) => {
    const values: Record<string, unknown> = Object.create(null)
    request.mappings.forEach(mapping => {
      if (!Object.prototype.hasOwnProperty.call(row, mapping.source)) return
      const value = row[mapping.source]
      values[mapping.target] = request.emptyStringAsNull && value === ''
        ? null
        : value
    })
    const missingField = requiredFields.find(field => (
      !Object.prototype.hasOwnProperty.call(values, field.name)
      || values[field.name] === null
      || values[field.name] === undefined
    ))
    if (missingField) {
      throw new Error(
        `第 ${rowIndex + 1} 行缺少必填字段“${missingField.name}”`,
      )
    }
    return { values }
  })

  return { inserts, updates: [], deletes: [] }
}
