import type { DatabaseType } from '../../types'
import {
  supportsAutoIncrement,
  type TableDefinitionDraft,
} from './tableDesignerModel'
import { validateTableDataType } from './tableDataTypeModel'

function duplicateNames(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  values.forEach(value => {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return
    if (seen.has(normalized)) duplicates.add(value.trim())
    seen.add(normalized)
  })
  return Array.from(duplicates)
}

export function validateTableDefinitionDraft(
  databaseType: DatabaseType,
  draft: TableDefinitionDraft,
  /** 是否为新建表；编辑表不允许变更 TDSQL 分片属性，无需校验 SHARDKEY */
  isNewTable = true,
): string[] {
  const issues: string[] = []
  if (!draft.name.trim()) issues.push('表名不能为空')
  if (draft.fields.length === 0) issues.push('至少需要一个字段')

  draft.fields.forEach((field, index) => {
    const position = `第 ${index + 1} 个字段`
    if (!field.name.trim()) issues.push(`${position}缺少字段名`)
    if (!field.type.trim()) {
      issues.push(`${position}缺少数据类型`)
    } else {
      const typeIssue = validateTableDataType(databaseType, field.type)
      if (typeIssue) issues.push(`${position}的数据类型${typeIssue}`)
    }
    if (
      field.autoIncrement
      && !supportsAutoIncrement(databaseType, field.type)
    ) {
      issues.push(`字段“${field.name || index + 1}”的数据类型不支持自动递增`)
    }
  })
  const duplicateFields = duplicateNames(
    draft.fields.map(field => field.name),
  )
  if (duplicateFields.length > 0) {
    issues.push(`字段名重复：${duplicateFields.join(', ')}`)
  }
  if (draft.fields.filter(field => field.autoIncrement).length > 1) {
    issues.push('一张表最多只能有一个自动递增字段')
  }

  const fieldNames = new Set(
    draft.fields.map(field => field.name.trim().toLowerCase()).filter(Boolean),
  )

  // TDSQL 分表（shard）必须指定存在的 SHARDKEY 字段，否则会静默建成单表。
  // 仅新建表强制；编辑表不支持变更分片属性（控件在编辑态禁用）。
  if (isNewTable && databaseType === 'TDSQL' && draft.tdsql) {
    if (draft.tdsql.tableType === 'shard') {
      const shardKey = draft.tdsql.shardKey?.trim()
      if (!shardKey) {
        issues.push('TDSQL 分表必须指定 SHARDKEY 分片键')
      } else if (!fieldNames.has(shardKey.toLowerCase())) {
        issues.push(`SHARDKEY 分片键字段“${shardKey}”不存在`)
      }
    }
  }

  draft.indexes.forEach((index, position) => {
    if (!index.name.trim()) issues.push(`第 ${position + 1} 个索引缺少名称`)
    if (index.fields.length === 0) {
      issues.push(`索引“${index.name || position + 1}”尚未选择字段`)
    } else if (index.fields.some(field => !fieldNames.has(field.trim().toLowerCase()))) {
      issues.push(`索引“${index.name || position + 1}”引用了无效字段`)
    }
  })
  const duplicateIndexes = duplicateNames(
    draft.indexes.map(index => index.name),
  )
  if (duplicateIndexes.length > 0) {
    issues.push(`索引名重复：${duplicateIndexes.join(', ')}`)
  }

  draft.foreignKeys.forEach((foreignKey, position) => {
    const label = foreignKey.name || String(position + 1)
    if (!foreignKey.name.trim()) issues.push(`第 ${position + 1} 个外键缺少名称`)
    if (foreignKey.fields.length === 0) {
      issues.push(`外键“${label}”尚未选择本地字段`)
    } else if (foreignKey.fields.some(field => !fieldNames.has(field.trim().toLowerCase()))) {
      issues.push(`外键“${label}”引用了无效的本地字段`)
    }
    if (!foreignKey.referencedTable.trim()) {
      issues.push(`外键“${label}”缺少引用表`)
    }
    if (
      foreignKey.fields.length === 0
      || foreignKey.fields.length !== foreignKey.referencedFields.length
    ) {
      issues.push(`外键“${label}”的本地字段与引用字段数量不一致`)
    }
  })
  const duplicateForeignKeys = duplicateNames(
    draft.foreignKeys.map(foreignKey => foreignKey.name),
  )
  if (duplicateForeignKeys.length > 0) {
    issues.push(`外键名重复：${duplicateForeignKeys.join(', ')}`)
  }

  return issues
}
