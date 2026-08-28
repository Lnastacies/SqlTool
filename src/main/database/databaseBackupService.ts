import { dialog, shell } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import { logger } from '../logger'
import type { ActiveConnection } from './databaseConnectionRegistry'
import {
  createDatabaseBackup,
  type CreateBackupContext,
} from './databaseBackupCreationService'
import { executeDatabaseBackupRestore } from './databaseBackupRestoreExecutor'
import { DatabaseBackupStore } from './databaseBackupStore'
import type {
  CreateDatabaseBackupResult,
  DatabaseBackupProgressReporter,
  DatabaseBackupRecord,
  DeleteDatabaseBackupResult,
  ExtractDatabaseBackupResult,
  RenameDatabaseBackupResult,
  RestoreDatabaseBackupRequest,
  RestoreDatabaseBackupResult,
  VerifyDatabaseBackupResult,
} from './databaseBackupTypes'

export class DatabaseBackupService {
  private readonly store: DatabaseBackupStore

  constructor(rootDirectory: string) {
    this.store = new DatabaseBackupStore(rootDirectory)
  }

  async list(
    connectionId: string,
    database: string,
  ): Promise<DatabaseBackupRecord[]> {
    const records = await this.store.list(connectionId, database)
    logger.info(
      'DatabaseBackup',
      `备份清单读取完成: 连接=${connectionId}, 数据库=${database}, 数量=${records.length}`,
    )
    return records
  }

  async create(
    context: CreateBackupContext,
    report: DatabaseBackupProgressReporter,
  ): Promise<CreateDatabaseBackupResult> {
    return createDatabaseBackup(this.store, context, report)
  }

  async restore(
    active: ActiveConnection,
    connectionId: string,
    database: string,
    request: RestoreDatabaseBackupRequest,
    report: DatabaseBackupProgressReporter,
  ): Promise<RestoreDatabaseBackupResult> {
    const selected = request.backupId
      ? await this.store.resolve(connectionId, database, request.backupId)
      : await this.selectBackupFile('选择要还原的备份')
    if (!selected) {
      logger.info(
        'DatabaseBackup',
        `用户取消备份还原文件选择: 数据库=${database}, 追踪=${request.operationId}`,
      )
      return {
        cancelled: true,
        statementCount: 0,
        completedStatements: 0,
        failedStatements: 0,
      }
    }
    const filePath = typeof selected === 'string' ? selected : selected.filePath
    let sql: string
    try {
      report({
        operationId: request.operationId,
        phase: 'prepare',
        percent: 1,
        level: 'info',
        message: '正在校验并读取备份文件',
      })
      if (typeof selected !== 'string') {
        await this.store.verify(selected)
        logger.info(
          'DatabaseBackup',
          `托管备份完整性校验通过: 数据库=${database}, 文件=${selected.fileName}`,
        )
      }
      sql = await this.store.readSql(filePath)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      report({
        operationId: request.operationId,
        phase: 'restore',
        percent: 0,
        level: 'error',
        message: `备份文件校验失败：${detail}`,
      })
      throw error
    }
    return executeDatabaseBackupRestore(
      active,
      database,
      path.basename(filePath),
      sql,
      request,
      report,
    )
  }

  async extract(
    connectionId: string,
    database: string,
    backupId?: string,
  ): Promise<ExtractDatabaseBackupResult> {
    logger.info(
      'DatabaseBackup',
      `开始提取备份 SQL: 数据库=${database}, 备份=${backupId || '外部文件'}`,
    )
    const selected = backupId
      ? await this.store.resolve(connectionId, database, backupId)
      : await this.selectBackupFile('选择要提取 SQL 的备份')
    if (!selected) {
      logger.info(
        'DatabaseBackup',
        `用户取消备份 SQL 提取文件选择: 数据库=${database}`,
      )
      return { cancelled: true }
    }
    const sourcePath = typeof selected === 'string' ? selected : selected.filePath
    if (typeof selected !== 'string') {
      await this.store.verify(selected)
    }
    const sql = await this.store.readSql(sourcePath)
    const defaultName = path.basename(sourcePath).replace(/\.sql\.gz$/i, '.sql')
    const target = await dialog.showSaveDialog({
      title: '提取备份 SQL',
      defaultPath: defaultName,
      filters: [{ name: 'SQL 文件', extensions: ['sql'] }],
    })
    if (target.canceled || !target.filePath) {
      logger.info(
        'DatabaseBackup',
        `用户取消备份 SQL 保存位置选择: 数据库=${database}`,
      )
      return { cancelled: true }
    }
    await fs.writeFile(target.filePath, sql, 'utf8')
    logger.info(
      'DatabaseBackup',
      `备份 SQL 提取完成: 源=${path.basename(sourcePath)}, 目标=${path.basename(target.filePath)}`,
    )
    return { cancelled: false, filePath: target.filePath }
  }

  async delete(
    connectionId: string,
    database: string,
    backupId: string,
  ): Promise<DeleteDatabaseBackupResult> {
    logger.info(
      'DatabaseBackup',
      `开始删除托管备份: 数据库=${database}, 备份=${backupId}`,
    )
    const record = await this.store.resolve(connectionId, database, backupId)
    await this.store.delete(record)
    logger.info(
      'DatabaseBackup',
      `备份删除完成: 数据库=${database}, 文件=${record.fileName}`,
    )
    return { backupId, fileName: record.fileName }
  }

  async rename(
    connectionId: string,
    database: string,
    backupId: string,
    name: string,
  ): Promise<RenameDatabaseBackupResult> {
    logger.info(
      'DatabaseBackup',
      `开始重命名托管备份: 数据库=${database}, 备份=${backupId}`,
    )
    const record = await this.store.resolve(connectionId, database, backupId)
    const updated = await this.store.rename(record, name)
    logger.info(
      'DatabaseBackup',
      `备份重命名完成: 数据库=${database}, 原文件=${record.fileName}, 新文件=${updated.fileName}`,
    )
    return { record: updated }
  }

  async verify(
    connectionId: string,
    database: string,
    backupId: string,
  ): Promise<VerifyDatabaseBackupResult> {
    const record = await this.store.resolve(connectionId, database, backupId)
    logger.info(
      'DatabaseBackup',
      `开始校验托管备份: 数据库=${database}, 文件=${record.fileName}`,
    )
    await this.store.verify(record)
    await this.store.readSql(record.filePath)
    logger.info(
      'DatabaseBackup',
      `托管备份校验完成: 数据库=${database}, 文件=${record.fileName}`,
    )
    return { backupId, fileName: record.fileName, valid: true }
  }

  async showFolder(connectionId: string, database: string): Promise<{ path: string }> {
    const directory = this.store.directory(connectionId, database)
    logger.info(
      'DatabaseBackup',
      `请求打开备份目录: 数据库=${database}, 目录=${directory}`,
    )
    await fs.mkdir(directory, { recursive: true })
    const error = await shell.openPath(directory)
    if (error) throw new Error(error)
    logger.info(
      'DatabaseBackup',
      `已打开备份目录: 数据库=${database}, 目录=${directory}`,
    )
    return { path: directory }
  }

  private async selectBackupFile(title: string): Promise<string | undefined> {
    const selection = await dialog.showOpenDialog({
      title,
      properties: ['openFile'],
      filters: [
        { name: 'SQLTool 备份', extensions: ['sql', 'gz'] },
      ],
    })
    return selection.canceled ? undefined : selection.filePaths[0]
  }
}
