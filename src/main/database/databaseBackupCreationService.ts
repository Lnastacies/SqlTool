import { promises as fs } from 'fs'
import { logger } from '../logger'
import type { ActiveConnection } from './databaseConnectionRegistry'
import {
  createDatabaseBackupFailure,
  describeDatabaseBackupFailure,
} from './databaseBackupError'
import {
  validateBackupRequest,
  validateBackupScope,
  validateGeneratedBackup,
} from './databaseBackupCreationValidation'
import { loadDatabaseBackupObjectDdls } from './databaseBackupObjectDdl'
import type { DatabaseBackupStore } from './databaseBackupStore'
import type {
  CreateDatabaseBackupRequest,
  CreateDatabaseBackupResult,
  DatabaseBackupProgressReporter,
} from './databaseBackupTypes'
import { writeDatabaseDumpToPath } from './databaseDumpService'
import type {
  DatabaseModel,
  DatabaseModelTable,
} from './databaseManagementTypes'

interface BackupPage {
  rows: Record<string, unknown>[]
  total: number
}

export interface CreateBackupContext {
  connectionId: string
  database: string
  active: ActiveConnection
  model: DatabaseModel
  request: CreateDatabaseBackupRequest
  loadPage: (
    table: DatabaseModelTable,
    page: number,
    pageSize: number,
  ) => Promise<BackupPage>
}

export async function createDatabaseBackup(
  store: DatabaseBackupStore,
  context: CreateBackupContext,
  report: DatabaseBackupProgressReporter,
): Promise<CreateDatabaseBackupResult> {
  const { connectionId, database, active, request } = context
  const startedAt = Date.now()
  validateBackupRequest(request)
  const scope = validateBackupScope(context.model, request)
  const model: DatabaseModel = {
    ...context.model,
    tables: context.model.tables.filter(
      table => scope.tables.includes(table.name),
    ),
  }
  logger.info(
    'DatabaseBackup',
    `开始创建托管备份: 连接=${connectionId}, 数据库=${database}, 模式=${request.mode}, 表=${scope.tables.length}, 压缩=${request.options.compressed}`,
  )
  report({
    operationId: request.operationId,
    phase: 'prepare',
    percent: 1,
    level: 'info',
    message: '正在读取所选数据库对象定义',
  })
  let rawPath: string | undefined
  let destinationFilePath: string | undefined
  try {
    const objectDdls = request.mode === 'data'
      ? []
      : await loadDatabaseBackupObjectDdls(active, database, scope)
    const destination = await store.createDestination(
      connectionId,
      database,
      request.name,
      request.options.compressed,
    )
    destinationFilePath = destination.filePath
    rawPath = request.options.compressed
      ? `${destination.filePath}.${process.pid}.sql.tmp`
      : destination.filePath

    const dump = await writeDatabaseDumpToPath(
      model,
      request.mode,
      { loadPage: context.loadPage },
      rawPath,
      {
        ...request.options,
        objectDdls,
        onProgress: (phase, percent, message) => report({
          operationId: request.operationId,
          phase,
          percent: request.options.compressed
            ? Math.min(92, Math.round(percent * 0.92))
            : percent,
          level: 'info',
          message,
        }),
      },
    )
    await validateGeneratedBackup(rawPath, active.connData.type)
    if (request.options.compressed) {
      report({
        operationId: request.operationId,
        phase: 'compress',
        percent: 94,
        level: 'info',
        message: '正在压缩 SQL 备份',
      })
      await store.compress(rawPath, destination.filePath)
      await fs.rm(rawPath, { force: true })
    }
    const record = await store.saveRecord(destination, {
      id: destination.id,
      connectionId,
      database,
      name: request.name.trim(),
      description: request.description.trim().slice(0, 500),
      fileName: destination.fileName,
      createdAt: destination.createdAt,
      databaseType: active.connData.type,
      mode: request.mode,
      compressed: request.options.compressed,
      tableCount: dump.tableCount,
      objectCount: objectDdls.length,
      rowCount: dump.rowCount,
    })
    report({
      operationId: request.operationId,
      phase: 'complete',
      percent: 100,
      level: 'info',
      message: `备份完成：${record.fileName}`,
    })
    logger.info(
      'DatabaseBackup',
      `托管备份创建完成: 数据库=${database}, 文件=${record.fileName}, 大小=${record.size}, 行=${record.rowCount}, 耗时=${Date.now() - startedAt}ms`,
    )
    return { record }
  } catch (error) {
    if (rawPath) {
      await fs.rm(rawPath, { force: true }).catch(() => undefined)
    }
    if (destinationFilePath) {
      await fs.rm(destinationFilePath, { force: true }).catch(() => undefined)
    }
    const detail = describeDatabaseBackupFailure(error)
    report({
      operationId: request.operationId,
      phase: 'complete',
      percent: 0,
      level: 'error',
      message: `备份失败：${detail}`,
    })
    logger.error(
      'DatabaseBackup',
      `托管备份创建失败: 数据库=${database}, 原因=${detail}, 耗时=${Date.now() - startedAt}ms`,
      error instanceof Error ? error : undefined,
    )
    throw createDatabaseBackupFailure(error, detail)
  }
}
