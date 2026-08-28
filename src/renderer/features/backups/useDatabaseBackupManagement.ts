import { useState } from 'react'
import { message } from 'antd'
import {
  backupResponseError,
  writeBackupActionLog,
  type DatabaseBackupTarget,
  type DatabaseBackupVerification,
} from './databaseBackupActionSupport'
import {
  confirmBackupDelete,
  promptBackupRename,
} from './databaseBackupPrompts'
import type { DatabaseBackupContext } from './useDatabaseBackupActions'

interface DatabaseBackupManagementOptions {
  onChanged: (context: DatabaseBackupContext) => Promise<void>
}

export function useDatabaseBackupManagement({
  onChanged,
}: DatabaseBackupManagementOptions) {
  const [verification, setVerification] = useState<
    Record<string, DatabaseBackupVerification>
  >({})

  const markBackupValid = (
    target: DatabaseBackupTarget,
    statusMessage: string,
  ) => {
    setVerification(previous => ({
      ...previous,
      [target.id]: {
        status: 'valid',
        message: statusMessage,
        checkedAt: new Date().toISOString(),
      },
    }))
  }

  const markCreatedBackupValid = (target: DatabaseBackupTarget) => {
    markBackupValid(target, '创建时已完成 SHA-256 校验值写入')
  }

  const extract = async (
    context: DatabaseBackupContext,
    target?: DatabaseBackupTarget,
  ) => {
    writeBackupActionLog(
      'info',
      `开始提取备份 SQL: 数据库=${context.database}, 备份=${target?.id || '外部文件'}`,
    )
    const response = await window.database.extractBackupSql(
      context.connection.id,
      context.database,
      target?.id,
    )
    if (!response.success || !response.data) {
      throw backupResponseError(response, '提取备份 SQL 失败')
    }
    if (!response.data.cancelled) {
      if (target) {
        markBackupValid(target, '提取前完整性校验通过')
      }
      writeBackupActionLog(
        'info',
        `备份 SQL 提取完成: 数据库=${context.database}, 目标=${response.data.filePath || '未知'}`,
      )
      message.success('备份 SQL 已提取')
    }
  }

  const remove = async (
    context: DatabaseBackupContext,
    target: DatabaseBackupTarget,
  ): Promise<boolean> => {
    if (!await confirmBackupDelete(target)) return false
    writeBackupActionLog(
      'info',
      `确认删除备份: 数据库=${context.database}, 备份=${target.id}`,
    )
    const response = await window.database.deleteBackup(
      context.connection.id,
      context.database,
      target.id,
    )
    if (!response.success) {
      throw backupResponseError(response, '删除备份失败')
    }
    setVerification(previous => {
      const next = { ...previous }
      delete next[target.id]
      return next
    })
    await onChanged(context)
    message.success('备份已删除')
    return true
  }

  const rename = async (
    context: DatabaseBackupContext,
    target: DatabaseBackupTarget,
  ) => {
    const name = await promptBackupRename(target)
    if (!name || name === target.name) return undefined
    const response = await window.database.renameBackup(
      context.connection.id,
      context.database,
      target.id,
      name,
    )
    if (!response.success || !response.data) {
      throw backupResponseError(response, '重命名备份失败')
    }
    await onChanged(context)
    message.success(`备份已重命名为“${response.data.record.name}”`)
    return response.data.record
  }

  const verify = async (
    context: DatabaseBackupContext,
    target: DatabaseBackupTarget,
  ) => {
    setVerification(previous => ({
      ...previous,
      [target.id]: { status: 'checking', message: '正在校验备份文件' },
    }))
    writeBackupActionLog(
      'info',
      `开始校验备份: 数据库=${context.database}, 备份=${target.id}`,
    )
    const response = await window.database.verifyBackup(
      context.connection.id,
      context.database,
      target.id,
    )
    if (!response.success || !response.data) {
      const error = backupResponseError(response, '校验备份失败')
      setVerification(previous => ({
        ...previous,
        [target.id]: {
          status: 'invalid',
          message: error.message,
          checkedAt: new Date().toISOString(),
        },
      }))
      throw error
    }
    setVerification(previous => ({
      ...previous,
      [target.id]: {
        status: 'valid',
        message: '备份文件完整有效',
        checkedAt: new Date().toISOString(),
      },
    }))
    message.success('备份文件完整性校验通过')
    return response.data
  }

  const showFolder = async (context: DatabaseBackupContext) => {
    const response = await window.database.showBackupFolder(
      context.connection.id,
      context.database,
    )
    if (!response.success) {
      throw backupResponseError(response, '打开备份目录失败')
    }
  }

  return {
    verification,
    markBackupValid,
    markCreatedBackupValid,
    extract,
    remove,
    rename,
    verify,
    showFolder,
  }
}
