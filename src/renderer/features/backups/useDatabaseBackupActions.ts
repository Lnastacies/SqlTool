import { useState } from 'react'
import { message } from 'antd'
import type {
  ConnectionData,
  CreateDatabaseBackupRequest,
  DatabaseModel,
  RestoreDatabaseBackupRequest,
  RestoreDatabaseBackupResult,
} from '../../types'
import {
  backupResponseError,
  writeBackupActionLog,
  type DatabaseBackupTarget,
} from './databaseBackupActionSupport'
import { useDatabaseBackupManagement } from './useDatabaseBackupManagement'

export interface DatabaseBackupContext {
  connection: ConnectionData
  database: string
}

interface BackupDialogState extends DatabaseBackupContext {
  loading: boolean
  model?: DatabaseModel
  error?: string
}

interface RestoreDialogState extends DatabaseBackupContext {
  target?: DatabaseBackupTarget
}

interface DatabaseBackupActionsOptions {
  onChanged: (context: DatabaseBackupContext) => Promise<void>
}

export function useDatabaseBackupActions(
  options: DatabaseBackupActionsOptions,
) {
  const [dialog, setDialog] = useState<BackupDialogState>()
  const [restoreDialog, setRestoreDialog] = useState<RestoreDialogState>()
  const management = useDatabaseBackupManagement(options)

  const openCreate = async (context: DatabaseBackupContext) => {
    setDialog({ ...context, loading: true })
    writeBackupActionLog(
      'info',
      `打开新建备份窗口: 连接=${context.connection.id}, 数据库=${context.database}`,
    )
    const response = await window.database.getDatabaseModel(
      context.connection.id,
      context.database,
    )
    if (!response.success || !response.data) {
      const error = backupResponseError(response, '读取数据库对象失败').message
      setDialog({ ...context, loading: false, error })
      writeBackupActionLog(
        'error',
        `备份对象读取失败: 数据库=${context.database}, 原因=${error}`,
      )
      return
    }
    setDialog({ ...context, loading: false, model: response.data })
  }

  const create = async (request: CreateDatabaseBackupRequest) => {
    if (!dialog) throw new Error('备份窗口上下文已失效')
    writeBackupActionLog(
      'info',
      `提交创建备份: 数据库=${dialog.database}, 追踪=${request.operationId}, 模式=${request.mode}`,
    )
    const response = await window.database.createBackup(
      dialog.connection.id,
      dialog.database,
      request,
    )
    if (!response.success || !response.data) {
      throw backupResponseError(response, '创建备份失败')
    }
    const record = response.data.record
    management.markCreatedBackupValid(record)
    await options.onChanged(dialog)
    message.success(`备份“${record.name}”已创建`)
    return response.data
  }

  const openRestore = (
    context: DatabaseBackupContext,
    target?: DatabaseBackupTarget,
  ) => {
    writeBackupActionLog(
      'info',
      `打开备份还原窗口: 数据库=${context.database}, 备份=${target?.id || '外部文件'}`,
    )
    setRestoreDialog({ ...context, target })
  }

  const restore = async (
    request: RestoreDatabaseBackupRequest,
  ): Promise<RestoreDatabaseBackupResult> => {
    if (!restoreDialog) throw new Error('还原窗口上下文已失效')
    writeBackupActionLog(
      'info',
      `提交备份还原: 数据库=${restoreDialog.database}, 备份=${request.backupId || '外部文件'}, 追踪=${request.operationId}`,
    )
    const response = await window.database.restoreBackup(
      restoreDialog.connection.id,
      restoreDialog.database,
      request,
    )
    if (!response.success || !response.data) {
      throw backupResponseError(response, '还原备份失败')
    }
    if (!response.data.cancelled) {
      if (restoreDialog.target) {
        management.markBackupValid(
          restoreDialog.target,
          '还原前完整性校验通过',
        )
      }
      await options.onChanged(restoreDialog)
    }
    return response.data
  }

  return {
    dialog,
    restoreDialog,
    ...management,
    openCreate,
    create,
    openRestore,
    restore,
    closeDialog: () => setDialog(undefined),
    closeRestoreDialog: () => setRestoreDialog(undefined),
  }
}
