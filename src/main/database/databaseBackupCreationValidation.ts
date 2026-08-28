import { promises as fs } from 'fs'
import { logger } from '../logger'
import type { CreateDatabaseBackupRequest } from './databaseBackupTypes'
import type { DatabaseModel } from './databaseManagementTypes'

const MAX_RESTORABLE_BACKUP_BYTES = 1024 * 1024 * 1024

function uniqueNames(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return [...new Set(values.flatMap(value => (
    typeof value === 'string' && value.trim() ? [value.trim()] : []
  )))]
}

export function validateBackupRequest(
  request: CreateDatabaseBackupRequest,
): void {
  const name = request.name?.trim()
  if (!name) throw new Error('备份名称不能为空')
  if (name.length > 80) throw new Error('备份名称不能超过 80 个字符')
  if ((request.description || '').length > 500) {
    throw new Error('备份备注不能超过 500 个字符')
  }
  if (!['structure-data', 'structure', 'data'].includes(request.mode)) {
    throw new Error(`不支持的备份模式: ${String(request.mode)}`)
  }
  if (!request.scope || !request.options) {
    throw new Error('备份配置不完整')
  }
}

export function validateBackupScope(
  model: DatabaseModel,
  request: CreateDatabaseBackupRequest,
): CreateDatabaseBackupRequest['scope'] {
  const scope = {
    tables: uniqueNames(request.scope.tables),
    views: uniqueNames(request.scope.views),
    functions: uniqueNames(request.scope.functions),
    procedures: uniqueNames(request.scope.procedures),
    events: uniqueNames(request.scope.events),
  }
  const catalogs = {
    tables: model.tables.map(table => table.name),
    views: model.views,
    functions: model.functions,
    procedures: model.procedures,
    events: model.events,
  }
  for (const key of Object.keys(scope) as Array<keyof typeof scope>) {
    const unknown = scope[key].filter(name => !catalogs[key].includes(name))
    if (unknown.length > 0) {
      throw new Error(`备份对象不存在: ${unknown.join(', ')}`)
    }
  }
  const objectCount = Object.values(scope).reduce(
    (total, values) => total + values.length,
    0,
  )
  if (objectCount === 0) throw new Error('至少选择一个备份对象')
  if (request.mode === 'data' && scope.tables.length === 0) {
    throw new Error('仅数据备份至少需要选择一个表')
  }
  return scope
}

export async function validateGeneratedBackup(
  filePath: string,
  databaseType: string,
): Promise<void> {
  const stat = await fs.stat(filePath)
  if (!stat.isFile() || stat.size === 0) {
    throw new Error('生成的备份文件为空')
  }
  if (stat.size > MAX_RESTORABLE_BACKUP_BYTES) {
    throw new Error('备份文件超过 1 GB，当前版本无法安全还原')
  }

  const handle = await fs.open(filePath, 'r')
  try {
    const header = Buffer.alloc(Math.min(4096, stat.size))
    await handle.read(header, 0, header.length, 0)
    const text = header.toString('utf8')
    if (
      !text.includes('-- SQLTool 数据库转储')
      || !text.includes(`-- 类型: ${databaseType}`)
    ) {
      throw new Error('生成的备份文件头校验失败')
    }
  } finally {
    await handle.close()
  }
  logger.info(
    'DatabaseBackup',
    `备份文件生成校验通过: 文件=${filePath}, 大小=${stat.size}, 类型=${databaseType}`,
  )
}
