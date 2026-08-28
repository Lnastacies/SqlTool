import { logger } from '../logger'
import type { ActiveConnection } from './databaseConnectionRegistry'
import type {
  DatabaseBackupProgressReporter,
  RestoreDatabaseBackupRequest,
  RestoreDatabaseBackupResult,
} from './databaseBackupTypes'
import { splitSqlScript } from './databaseBackupScriptParser'

function backupDatabaseType(sql: string): string {
  return sql.match(/^-- 类型:\s*(.+)$/mi)?.[1]?.trim() || ''
}

async function executeControlSql(
  active: ActiveConnection,
  database: string,
  statement: string,
): Promise<void> {
  const result = await active.adapter.executeSQL(
    active.connection,
    active.connData.type === 'PostgreSQL' ? '' : database,
    statement,
  )
  if (!result.success) throw new Error(result.message)
}

function foreignKeyStatement(
  active: ActiveConnection,
  enabled: boolean,
): string {
  if (active.connData.type === 'MySQL') {
    return `SET FOREIGN_KEY_CHECKS = ${enabled ? 1 : 0}`
  }
  if (active.connData.type === 'SQLite') {
    return `PRAGMA foreign_keys = ${enabled ? 'ON' : 'OFF'}`
  }
  if (active.connData.type === 'PostgreSQL') {
    return `SET session_replication_role = ${enabled ? 'origin' : 'replica'}`
  }
  return enabled
    ? "EXEC sp_MSforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL'"
    : "EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL'"
}

function transactionStatement(
  active: ActiveConnection,
  action: 'begin' | 'commit' | 'rollback',
): string {
  if (action === 'begin') {
    return active.connData.type === 'PostgreSQL'
      ? 'BEGIN'
      : 'BEGIN TRANSACTION'
  }
  return action === 'commit' ? 'COMMIT' : 'ROLLBACK'
}

function scriptControlsTransaction(statements: string[]): boolean {
  return statements.some(statement => (
    /^(?:BEGIN(?:\s+TRANSACTION)?|START\s+TRANSACTION|COMMIT|ROLLBACK)\b/i
      .test(statement.trim())
  ))
}

function executableSql(statement: string): string {
  return statement.replace(
    /^\s*(?:(?:--|#)[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/\s*)*/,
    '',
  ).trim()
}

function isManagedForeignKeyStatement(statement: string): boolean {
  const sql = executableSql(statement)
  return (
    /^SET\s+FOREIGN_KEY_CHECKS\s*=/i.test(sql)
    || /^PRAGMA\s+foreign_keys\s*=/i.test(sql)
    || /^SET\s+session_replication_role\s*=/i.test(sql)
    || (
      /^ALTER\s+TABLE\b/i.test(sql)
      && /\b(?:NOCHECK|WITH\s+CHECK\s+CHECK)\s+CONSTRAINT\s+ALL\s*$/i
        .test(sql)
    )
  )
}

function identityInsertState(
  statement: string,
): { key: string; offStatement: string; enabled: boolean } | undefined {
  const match = executableSql(statement).match(
    /^SET\s+IDENTITY_INSERT\s+(.+?)\s+(ON|OFF)\s*$/i,
  )
  if (!match) return undefined
  const tableRef = match[1].trim()
  return {
    key: tableRef.toLocaleLowerCase(),
    offStatement: `SET IDENTITY_INSERT ${tableRef} OFF`,
    enabled: match[2].toUpperCase() === 'ON',
  }
}

async function prepareDatabaseContext(
  active: ActiveConnection,
  database: string,
): Promise<void> {
  if (active.connData.type !== 'SQL Server') return
  const databaseRef = `[${database.replace(/]/g, ']]')}]`
  await executeControlSql(active, database, `USE ${databaseRef}`)
}

export async function executeDatabaseBackupRestore(
  active: ActiveConnection,
  database: string,
  fileName: string,
  sql: string,
  request: RestoreDatabaseBackupRequest,
  report: DatabaseBackupProgressReporter,
): Promise<RestoreDatabaseBackupResult> {
  const sourceType = backupDatabaseType(sql)
  if (sourceType && sourceType !== active.connData.type) {
    throw new Error(
      `备份类型为 ${sourceType}，不能还原到 ${active.connData.type} 数据库`,
    )
  }
  const parsedStatements = splitSqlScript(sql)
  const statements = parsedStatements.filter(
    statement => !isManagedForeignKeyStatement(statement),
  )
  if (statements.length === 0) throw new Error('备份文件中没有可执行 SQL')
  const useTransaction = request.useTransaction !== false
    && !request.continueOnError
    && active.connData.type !== 'MySQL'
    && !scriptControlsTransaction(statements)

  logger.info(
    'DatabaseBackup',
    `开始还原备份: 数据库=${database}, 文件=${fileName}, 语句=${statements.length}, 托管外键语句=${parsedStatements.length - statements.length}, 遇错继续=${request.continueOnError}, 事务=${useTransaction}`,
  )
  report({
    operationId: request.operationId,
    phase: 'restore',
    percent: 2,
    level: 'info',
    message: `已解析 ${statements.length} 条 SQL，开始还原`,
  })

  let completedStatements = 0
  let failedStatements = 0
  let transactionStarted = false
  let contextPrepared = false
  const pendingIdentityInsert = new Map<string, string>()
  const reportInterval = Math.max(1, Math.floor(statements.length / 100))
  try {
    await prepareDatabaseContext(active, database)
    contextPrepared = true
    try {
      await executeControlSql(
        active,
        database,
        foreignKeyStatement(active, false),
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      logger.warn(
        'DatabaseBackup',
        `还原前暂停外键检查失败，将按原约束继续: 数据库=${database}, 原因=${detail}`,
      )
      report({
        operationId: request.operationId,
        phase: 'restore',
        percent: 3,
        level: 'warn',
        message: `未能暂停外键检查：${detail}`,
      })
    }
    if (useTransaction) {
      await executeControlSql(
        active,
        database,
        transactionStatement(active, 'begin'),
      )
      transactionStarted = true
    }

    for (const [index, statement] of statements.entries()) {
      const result = await active.adapter.executeSQL(
        active.connection,
        active.connData.type === 'PostgreSQL' ? '' : database,
        statement,
      )
      if (!result.success) {
        failedStatements += 1
        logger.error(
          'DatabaseBackup',
          `还原 SQL 执行失败: 数据库=${database}, 序号=${index + 1}/${statements.length}, 原因=${result.message}`,
        )
        report({
          operationId: request.operationId,
          phase: 'restore',
          percent: 5 + Math.round(((index + 1) / statements.length) * 90),
          level: 'error',
          message: `第 ${index + 1} 条 SQL 执行失败：${result.message}`,
        })
        if (!request.continueOnError) throw new Error(result.message)
      } else {
        completedStatements += 1
        const identityState = identityInsertState(statement)
        if (identityState?.enabled) {
          pendingIdentityInsert.set(
            identityState.key,
            identityState.offStatement,
          )
        } else if (identityState) {
          pendingIdentityInsert.delete(identityState.key)
        }
      }
      if ((index + 1) % reportInterval === 0 || index === statements.length - 1) {
        report({
          operationId: request.operationId,
          phase: 'restore',
          percent: 5 + Math.round(((index + 1) / statements.length) * 90),
          level: 'info',
          message: `还原进度 ${index + 1}/${statements.length}`,
        })
      }
    }
    if (transactionStarted) {
      await executeControlSql(
        active,
        database,
        transactionStatement(active, 'commit'),
      )
      transactionStarted = false
    }
    if (typeof active.connection.saveToDisk === 'function') {
      active.connection.saveToDisk()
    }
  } catch (error) {
    if (transactionStarted) {
      try {
        await executeControlSql(
          active,
          database,
          transactionStatement(active, 'rollback'),
        )
        transactionStarted = false
        if (typeof active.connection.saveToDisk === 'function') {
          active.connection.saveToDisk()
        }
        logger.info(
          'DatabaseBackup',
          `备份还原失败，事务已回滚: 数据库=${database}`,
        )
      } catch (rollbackError) {
        logger.error(
          'DatabaseBackup',
          `备份还原事务回滚失败: 数据库=${database}`,
          rollbackError instanceof Error ? rollbackError : undefined,
        )
      }
    }
    const detail = error instanceof Error ? error.message : String(error)
    report({
      operationId: request.operationId,
      phase: 'restore',
      percent: 0,
      level: 'error',
      message: `还原失败：${detail}`,
    })
    logger.error(
      'DatabaseBackup',
      `备份还原失败: 数据库=${database}, 成功=${completedStatements}, 失败=${failedStatements}, 原因=${detail}`,
      error instanceof Error ? error : undefined,
    )
    throw error
  } finally {
    for (const offStatement of pendingIdentityInsert.values()) {
      try {
        await executeControlSql(active, database, offStatement)
        logger.info(
          'DatabaseBackup',
          `已清理未关闭的 IDENTITY_INSERT: 数据库=${database}`,
        )
      } catch (error) {
        logger.error(
          'DatabaseBackup',
          `清理 IDENTITY_INSERT 失败: 数据库=${database}`,
          error instanceof Error ? error : undefined,
        )
      }
    }
    if (contextPrepared) {
      try {
        await executeControlSql(
          active,
          database,
          foreignKeyStatement(active, true),
        )
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        logger.error(
          'DatabaseBackup',
          `恢复外键检查失败: 数据库=${database}, 原因=${detail}`,
          error instanceof Error ? error : undefined,
        )
        report({
          operationId: request.operationId,
          phase: 'restore',
          percent: 99,
          level: 'warn',
          message: `恢复外键检查失败，请手动检查：${detail}`,
        })
      }
    }
  }

  logger.info(
    'DatabaseBackup',
    `备份还原完成: 数据库=${database}, 成功=${completedStatements}, 失败=${failedStatements}`,
  )
  report({
    operationId: request.operationId,
    phase: 'complete',
    percent: 100,
    level: failedStatements > 0 ? 'warn' : 'info',
    message: `还原完成：成功 ${completedStatements} 条，失败 ${failedStatements} 条`,
  })
  return {
    cancelled: false,
    fileName,
    statementCount: statements.length,
    completedStatements,
    failedStatements,
  }
}
