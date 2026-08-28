import { useCallback, useEffect, useState } from 'react'
import { message } from 'antd'
import type { RecentSqlFile } from '../../types'
import type {
  QueryWorkspaceDocument,
  WorkspaceDocument,
} from '../../workspace/workspaceTypes'

export interface OpenQueryFileInput {
  connId: string
  database: string
  name: string
  filePath: string
  sql: string
}

interface SqlFileCommandsOptions {
  activeDocument?: WorkspaceDocument
  defaultContext: { connId: string; database: string }
  openQueryFile: (input: OpenQueryFileInput) => void
  updateQuery: (
    documentId: string,
    patch: Partial<QueryWorkspaceDocument>,
  ) => void
}

export function useSqlFileCommands({
  activeDocument,
  defaultContext,
  openQueryFile,
  updateQuery,
}: SqlFileCommandsOptions) {
  const [recentFiles, setRecentFiles] = useState<RecentSqlFile[]>([])

  const refreshRecentFiles = useCallback(async () => {
    try {
      const response = await window.sqlFile.getRecent()
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || '读取最近文件失败')
      }
      setRecentFiles(response.data)
    } catch (error) {
      void window.logger.write(
        'warn',
        'SqlFile',
        `读取最近文件失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }, [])

  useEffect(() => {
    void refreshRecentFiles()
  }, [refreshRecentFiles])

  const openSqlFiles = useCallback(async (
    context?: { connId: string; database: string },
  ) => {
    try {
      const targetContext = context || defaultContext
      const response = await window.sqlFile.open()
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || '打开 SQL 文件失败')
      }
      if (response.data.cancelled) return

      response.data.files.forEach(file => {
        openQueryFile({
          ...targetContext,
          name: file.name,
          filePath: file.filePath,
          sql: file.content,
        })
      })
      await refreshRecentFiles()
      void window.logger.write(
        'info',
        'SqlFile',
        `从指定连接打开 SQL 文件: 连接=${targetContext.connId || '未选择'}, 数据库=${targetContext.database || '服务器级'}, 文件数=${response.data.files.length}`,
      )
      message.success(`已打开 ${response.data.files.length} 个 SQL 文件`)
    } catch (error) {
      message.error(
        `打开 SQL 文件失败: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }, [defaultContext, openQueryFile, refreshRecentFiles])

  const saveQueryDocument = useCallback(async (
    document: QueryWorkspaceDocument,
    forceDialog = false,
  ) => {
    try {
      const response = await window.sqlFile.save({
        filePath: forceDialog ? undefined : document.filePath,
        suggestedName: document.name,
        content: document.sql,
        forceDialog,
      })
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || '保存 SQL 文件失败')
      }
      if (response.data.cancelled) return false
      if (!response.data.filePath || !response.data.name) {
        throw new Error('保存 SQL 文件后未返回有效路径')
      }

      updateQuery(document.id, {
        filePath: response.data.filePath,
        name: response.data.name,
        dirty: false,
      })
      await refreshRecentFiles()
      message.success(`已保存 ${response.data.name}`)
      return true
    } catch (error) {
      message.error(
        `保存 SQL 文件失败: ${error instanceof Error ? error.message : String(error)}`,
      )
      return false
    }
  }, [refreshRecentFiles, updateQuery])

  const saveActiveSqlFile = useCallback(async (forceDialog = false) => {
    if (activeDocument?.kind !== 'query') {
      message.info('当前窗口不是查询文档，无法保存 SQL 文件')
      return false
    }
    return saveQueryDocument(activeDocument, forceDialog)
  }, [activeDocument, saveQueryDocument])

  const openRecentSqlFile = useCallback(async (filePath: string) => {
    try {
      const response = await window.sqlFile.openRecent(filePath)
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || '打开最近文件失败')
      }
      openQueryFile({
        ...defaultContext,
        ...response.data,
        sql: response.data.content,
      })
      await refreshRecentFiles()
      message.success(`已打开 ${response.data.name}`)
    } catch (error) {
      await refreshRecentFiles()
      message.error(
        `打开最近文件失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }, [defaultContext, openQueryFile, refreshRecentFiles])

  const clearRecentFiles = useCallback(async () => {
    const response = await window.sqlFile.clearRecent()
    if (!response.success) {
      message.error(response.error?.message || '清空最近文件失败')
      return
    }
    setRecentFiles([])
    message.success('最近文件已清空')
  }, [])

  return {
    recentFiles,
    openSqlFiles,
    openRecentSqlFile,
    clearRecentFiles,
    saveQueryDocument,
    saveActiveSqlFile: async () => {
      await saveActiveSqlFile(false)
    },
    saveActiveSqlFileAs: async () => {
      await saveActiveSqlFile(true)
    },
  }
}
