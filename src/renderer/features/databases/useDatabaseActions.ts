import { useState } from 'react'
import { message } from 'antd'
import type {
  AlterDatabaseRequest,
  ConnectionData,
  DatabaseDumpMode,
} from '../../types'
import type { WorkspaceDocument } from '../../workspace/workspaceTypes'
import {
  closeDatabaseContext,
  confirmDatabaseDeletion,
  dumpDatabaseToFile,
  printDatabaseStructure,
  responseError,
  writeActionLog,
  type DatabaseActionContext,
} from './databaseActionRunners'

export type { DatabaseActionContext } from './databaseActionRunners'

interface DatabaseActionsOptions {
  documents: WorkspaceDocument[]
  closeDocumentSafely: (documentId: string) => Promise<boolean>
  onDisconnect: (connection: ConnectionData) => Promise<void>
  onConnectionInvalid: (connection: ConnectionData) => void
  onUnload: (context: DatabaseActionContext) => void
  onRenamed: (
    context: DatabaseActionContext,
    nextName: string,
  ) => Promise<void>
  onDeleted: (context: DatabaseActionContext) => Promise<void>
  onEditConnection: (connection: ConnectionData) => void
  onNewQuery: (context: DatabaseActionContext) => void
  onOpenTerminal: (context: DatabaseActionContext) => void
  onRunSqlFile: (context: DatabaseActionContext) => Promise<void>
  onRefresh: (context: DatabaseActionContext) => Promise<void>
}

export function useDatabaseActions(options: DatabaseActionsOptions) {
  const [editDialog, setEditDialog] = useState<DatabaseActionContext>()
  const [dumpDialog, setDumpDialog] = useState<DatabaseActionContext>()
  const [modelDialog, setModelDialog] = useState<DatabaseActionContext>()
  const [searchDialog, setSearchDialog] = useState<DatabaseActionContext>()

  const closeDocuments = async (context: DatabaseActionContext) => {
    const related = options.documents.filter(document => (
      document.connId === context.connection.id
      && document.database === context.database
    ))
    for (const document of related) {
      if (!await options.closeDocumentSafely(document.id)) {
        writeActionLog(
          'warn',
          '数据库操作已取消',
          context,
          `未关闭文档=${document.id}`,
        )
        return false
      }
    }
    return true
  }

  const closeDatabase = (context: DatabaseActionContext) => (
    closeDatabaseContext(context, {
      closeDocuments,
      onDisconnect: options.onDisconnect,
      onUnload: options.onUnload,
      onConnectionInvalid: options.onConnectionInvalid,
    })
  )

  const saveEdit = async (request: AlterDatabaseRequest) => {
    if (!editDialog) throw new Error('数据库编辑上下文已失效')
    writeActionLog('info', '开始保存数据库配置', editDialog)
    try {
      const renaming = Boolean(
        request.name && request.name.trim() !== editDialog.database,
      )
      if (renaming && !await closeDocuments(editDialog)) {
        throw new Error('已取消数据库重命名')
      }
      const result = await window.database.alterDatabase(
        editDialog.connection.id,
        editDialog.database,
        request,
      )
      if (!result.success || !result.data) {
        throw responseError(result, '编辑数据库失败')
      }
      await options.onRenamed(editDialog, result.data.name)
      writeActionLog(
        'info',
        '数据库配置保存完成',
        editDialog,
        `新名称=${result.data.name}`,
      )
      message.success(`数据库“${result.data.name}”已更新`)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      writeActionLog('error', '保存数据库配置失败', editDialog, `原因=${detail}`)
      throw error
    }
  }

  const deleteDatabase = (context: DatabaseActionContext) => (
    confirmDatabaseDeletion(context, closeDocuments, options.onDeleted)
  )

  const dumpDatabase = async (mode: DatabaseDumpMode) => {
    if (!dumpDialog) throw new Error('数据库转储上下文已失效')
    await dumpDatabaseToFile(dumpDialog, mode)
  }

  const printDatabase = (context: DatabaseActionContext) => (
    printDatabaseStructure(context)
  )

  const editDatabase = (context: DatabaseActionContext) => {
    if (context.connection.type === 'SQLite') {
      writeActionLog('info', '打开 SQLite 连接配置', context)
      options.onEditConnection(context.connection)
      return
    }
    writeActionLog('info', '打开数据库编辑窗口', context)
    setEditDialog(context)
  }

  return {
    editDialog,
    dumpDialog,
    modelDialog,
    searchDialog,
    closeDatabase,
    editDatabase,
    deleteDatabase,
    saveEdit,
    dumpDatabase,
    printDatabase,
    newQuery: options.onNewQuery,
    openTerminal: options.onOpenTerminal,
    runSqlFile: options.onRunSqlFile,
    refresh: options.onRefresh,
    openDump: (context: DatabaseActionContext) => {
      writeActionLog('info', '打开数据库转储窗口', context)
      setDumpDialog(context)
    },
    openModel: (context: DatabaseActionContext) => {
      writeActionLog('info', '打开数据库模型窗口', context)
      setModelDialog(context)
    },
    openSearch: (context: DatabaseActionContext) => {
      writeActionLog('info', '打开数据库查找窗口', context)
      setSearchDialog(context)
    },
    closeEdit: () => setEditDialog(undefined),
    closeDump: () => setDumpDialog(undefined),
    closeModel: () => setModelDialog(undefined),
    closeSearch: () => setSearchDialog(undefined),
  }
}
