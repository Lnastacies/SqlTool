import type { TableMutationBatch } from './tableMutationTypes'

function keyFingerprint(
  originalKey: Record<string, unknown>,
  primaryKeys: string[],
): string {
  return primaryKeys.map(key => {
    const value = originalKey[key]
    let serialized: string
    try {
      serialized = JSON.stringify(value)
    } catch {
      serialized = String(value)
    }
    return `${key}:${typeof value}:${serialized}`
  }).join('|')
}

export function validateTableMutationBatch(
  batch: TableMutationBatch,
  fields: Set<string>,
  primaryKeys: string[],
  maxOperations: number = 500,
): number {
  if (
    !batch
    || !Array.isArray(batch.inserts)
    || !Array.isArray(batch.updates)
    || !Array.isArray(batch.deletes)
  ) {
    throw new Error('数据修改请求格式无效')
  }

  const operationCount = (
    batch.inserts.length
    + batch.updates.length
    + batch.deletes.length
  )
  if (operationCount === 0) throw new Error('没有需要提交的数据修改')
  if (operationCount > maxOperations) {
    throw new Error(`单次最多提交 ${maxOperations} 行修改`)
  }
  if (
    primaryKeys.length === 0
    && (batch.updates.length > 0 || batch.deletes.length > 0)
  ) {
    throw new Error('该表没有主键，禁止直接修改数据')
  }

  batch.inserts.forEach((insert, index) => {
    const columns = Object.keys(insert?.values || {})
    if (!columns.every(field => fields.has(field))) {
      throw new Error(`第 ${index + 1} 个新增行包含不存在的字段`)
    }
  })

  const changedKeys = new Set<string>()
  batch.updates.forEach((update, index) => {
    const changedFields = Object.keys(update?.changes || {})
    if (changedFields.length === 0) {
      throw new Error(`第 ${index + 1} 个更新行没有有效修改`)
    }
    if (!changedFields.every(field => fields.has(field))) {
      throw new Error(`第 ${index + 1} 个更新行包含不存在的字段`)
    }
    assertCompleteKey(update?.originalKey, primaryKeys, `第 ${index + 1} 个更新行`)
    const fingerprint = keyFingerprint(update.originalKey, primaryKeys)
    if (changedKeys.has(fingerprint)) {
      throw new Error(`第 ${index + 1} 个更新行重复提交`)
    }
    changedKeys.add(fingerprint)
  })

  batch.deletes.forEach((deletion, index) => {
    assertCompleteKey(
      deletion?.originalKey,
      primaryKeys,
      `第 ${index + 1} 个删除行`,
    )
    const fingerprint = keyFingerprint(deletion.originalKey, primaryKeys)
    if (changedKeys.has(fingerprint)) {
      throw new Error(`第 ${index + 1} 个删除行同时存在更新操作`)
    }
    if (changedKeys.has(`delete:${fingerprint}`)) {
      throw new Error(`第 ${index + 1} 个删除行重复提交`)
    }
    changedKeys.add(`delete:${fingerprint}`)
  })

  return operationCount
}

function assertCompleteKey(
  originalKey: Record<string, unknown> | undefined,
  primaryKeys: string[],
  rowLabel: string,
): void {
  if (!primaryKeys.every(key =>
    Object.prototype.hasOwnProperty.call(originalKey || {}, key)
  )) {
    throw new Error(`${rowLabel}缺少完整主键`)
  }
}
