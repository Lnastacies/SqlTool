import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { logger } from './logger'
import { handleError, SqlToolError } from './errors'

export type IPCChannel = 
  | 'sys:appInfo'
  | 'database:loadConnections'
  | 'database:createConnection'
  | 'database:updateConnection'
  | 'database:deleteConnection'
  | 'database:createGroup'
  | 'database:renameGroup'
  | 'database:deleteGroup'
  | 'database:testConnection'
  | 'database:connect'
  | 'database:disconnect'
  | 'database:getDatabases'
  | 'database:getDatabaseSummaries'
  | 'database:getDatabaseEncodingCatalog'
  | 'database:createDatabase'
  | 'database:closeDatabase'
  | 'database:alterDatabase'
  | 'database:dropDatabase'
  | 'database:dumpDatabase'
  | 'database:listBackups'
  | 'database:createBackup'
  | 'database:restoreBackup'
  | 'database:extractBackupSql'
  | 'database:deleteBackup'
  | 'database:renameBackup'
  | 'database:verifyBackup'
  | 'database:showBackupFolder'
  | 'database:getDatabaseModel'
  | 'database:printDatabase'
  | 'database:getTables'
  | 'database:getTableSummaries'
  | 'database:getViews'
  | 'database:getProcedures'
  | 'database:getFunctions'
  | 'database:getEvents'
  | 'database:getTableMetadata'
  | 'database:previewTableStructure'
  | 'database:saveTableStructure'
  | 'database:dropTable'
  | 'database:truncateTable'
  | 'database:openTableImport'
  | 'database:reloadTableImport'
  | 'database:importTableRows'
  | 'database:exportTableData'
  | 'database:getTableExportObjects'
  | 'database:exportTableBatch'
  | 'database:getTableData'
  | 'database:updateTableRows'
  | 'database:mutateTableRows'
  | 'database:executeSQL'
  | 'database:dropDatabaseObject'
  | 'database:toggleDatabaseEvent'
  | 'database:executeDatabaseRoutine'
  | 'databaseTool:previewTransfer'
  | 'databaseTool:executeTransfer'
  | 'databaseTool:previewDataSync'
  | 'databaseTool:executeDataSync'
  | 'databaseTool:previewStructureSync'
  | 'databaseTool:executeStructureSync'
  | 'query:execute'
  | 'query:cancel'
  | 'query:begin'
  | 'query:commit'
  | 'query:rollback'
  | 'query:closeSession'
  | 'file:openSql'
  | 'file:saveSql'
  | 'file:getRecentSql'
  | 'file:openRecentSql'
  | 'file:clearRecentSql'
  | 'result:exportCsv'
  | 'application:showDatabaseObjectFolder'
  | 'application:confirmClose'
  | 'queryHistory:get'
  | 'queryHistory:add'
  | 'queryHistory:delete'
  | 'queryHistory:clear'
  | 'snippet:get'
  | 'snippet:getCategories'
  | 'snippet:getById'
  | 'snippet:add'
  | 'snippet:update'
  | 'snippet:delete'
  | 'snippet:replaceVariables'
  | 'favorite:list'
  | 'favorite:add'
  | 'favorite:update'
  | 'favorite:delete'
  | 'logger:getLogFiles'
  | 'logger:getLogContent'
  | 'logger:clearLogs'
  | 'logger:write'
  | 'tdsql:getTableMetadata'
  | 'tdsql:getSessions'
  | 'tdsql:getDdlTasks'

export interface IPCResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    detail?: string
    suggestion?: string
  }
}

export interface IPCRequest<T = any> {
  channel: IPCChannel
  payload: T
}

export function registerIPC<Args extends any[], Result>(
  channel: IPCChannel,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<Result>
): void {
  ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: Args): Promise<IPCResponse<Result>> => {
    logger.debug('IPC', `收到请求: ${channel}`)
    
    try {
      const result = await handler(event, ...args)
      logger.debug('IPC', `请求成功: ${channel}`)
      return { success: true, data: result }
    } catch (error) {
      if (error instanceof SqlToolError) {
        logger.error('IPC', `请求失败: ${channel}, 错误码: ${error.code}`)
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            detail: error.detail,
            suggestion: error.suggestion
          }
        }
      }
      
      const errorInfo = handleError(error, `IPC:${channel}`)
      return {
        success: false,
        error: {
          code: errorInfo.code,
          message: errorInfo.message,
          detail: errorInfo.detail,
          suggestion: errorInfo.suggestion
        }
      }
    }
  })

  logger.info('IPC', `已注册通道: ${channel}`)
}

export function registerIPCHandlers(handlers: Record<IPCChannel, (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>>): void {
  for (const [channel, handler] of Object.entries(handlers)) {
    registerIPC(channel as IPCChannel, handler)
  }
}

export function sendToRenderer(channel: string, data?: any): void {
  const { BrowserWindow } = require('electron')
  const windows = BrowserWindow.getAllWindows()
  
  for (const window of windows) {
    try {
      window.webContents.send(channel, data)
      logger.debug('IPC', `发送到渲染进程: ${channel}`)
    } catch (error) {
      logger.warn('IPC', `发送失败: ${channel}, 错误: ${(error as Error).message}`)
    }
  }
}
