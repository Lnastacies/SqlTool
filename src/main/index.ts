import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  type IpcMainInvokeEvent,
} from 'electron'
import path from 'path'
import { ConnectionManager } from './database/connectionManager'
import { QueryHistoryManager } from './queryHistory'
import { SnippetManager } from './snippetManager'
import { FavoriteStore } from './favoriteStore'
import { logger } from './logger'
import { registerIPC } from './ipc'
import { SqlFileService } from './services/sqlFileService'
import { ResultExportService } from './services/resultExportService'
import { DatabaseObjectFileService } from './services/databaseObjectFileService'
import { DatabaseToolService } from './database/databaseToolService'
import { printDatabaseModel } from './database/databasePrintService'
import type {
  DatabaseBackupProgress,
  DatabaseBackupProgressReporter,
} from './database/databaseBackupTypes'

let mainWindow: BrowserWindow | null = null
let connectionManager: ConnectionManager
let queryHistoryManager: QueryHistoryManager
let snippetManager: SnippetManager
let favoriteStore: FavoriteStore
let sqlFileService: SqlFileService
let resultExportService: ResultExportService
let databaseObjectFileService: DatabaseObjectFileService
let databaseToolService: DatabaseToolService
let shutdownStarted = false
let allowWindowClose = false

function backupProgressReporter(
  event: IpcMainInvokeEvent,
): DatabaseBackupProgressReporter {
  return progress => {
    const payload: DatabaseBackupProgress = {
      ...progress,
      timestamp: new Date().toISOString(),
    }
    if (!event.sender.isDestroyed()) {
      event.sender.send('database:backupProgress', payload)
    }
    logger.info(
      'DatabaseBackup',
      `备份进度: 追踪=${payload.operationId}, 阶段=${payload.phase}, 进度=${payload.percent}%, 消息=${payload.message}`,
    )
  }
}

async function waitForDevServer(url: string, maxAttempts: number = 30, delay: number = 1000): Promise<void> {
  const https = require('https')
  const http = require('http')
  
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, delay))
    
    try {
      const protocol = url.startsWith('https') ? https : http
      await new Promise<void>((resolve, reject) => {
        const req = protocol.get(url, (res: any) => {
          if (res.statusCode === 200) {
            resolve()
          } else {
            reject(new Error(`Status code: ${res.statusCode}`))
          }
        })
        req.on('error', () => reject(new Error('Connection failed')))
        req.setTimeout(2000, () => {
          req.destroy()
          reject(new Error('Timeout'))
        })
      })
      logger.info('Main', `Dev server ready at ${url}`)
      return
    } catch (e) {
      logger.debug('Main', `Waiting for dev server... (attempt ${i + 1}/${maxAttempts})`)
    }
  }
  
  logger.warn('Main', `Dev server did not respond after ${maxAttempts} attempts, proceeding anyway`)
}

async function createWindow() {
  allowWindowClose = false
  mainWindow = new BrowserWindow({
    width: 1496,
    height: 960,
    minWidth: 1024,
    minHeight: 768,
    frame: true,
    autoHideMenuBar: true,
    title: 'SQLTool - Database Management Tool',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: process.env.NODE_ENV === 'development',
    },
  })

  logger.info('Main', `NODE_ENV: ${process.env.NODE_ENV}`)
  logger.info('Main', `__dirname: ${__dirname}`)
    
  if (process.env.NODE_ENV === 'development') {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    logger.info('Main', `Loading dev server: ${devServerUrl}`)
    await waitForDevServer(devServerUrl)
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    const htmlPath = path.join(__dirname, '../renderer/index.html')
    logger.info('Main', `Loading file: ${htmlPath}`)
    logger.info('Main', `File exists: ${require('fs').existsSync(htmlPath)}`)
    mainWindow.loadFile(htmlPath)
  }

  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('Main', 'Page loaded successfully')
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) {
      logger.error('Main', `页面加载失败: code=${errorCode}, url=${validatedURL}, detail=${errorDescription}`)
    }
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      logger.warn('Renderer', `控制台异常: ${message} (${sourceId}:${line})`)
    }
  })

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logger.error('Main', `Render process gone: ${JSON.stringify(details)}`)
  })

  mainWindow.webContents.on('crashed', () => {
    logger.error('Main', 'Render process crashed')
  })

  mainWindow.on('close', (event) => {
    if (allowWindowClose) return
    event.preventDefault()
    logger.info('Main', '收到窗口关闭请求，等待渲染进程检查未保存文档')
    mainWindow?.webContents.send('application:close-requested')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  logger.info('Main', '已关闭默认应用菜单，使用页面命令菜单')
  logger.info('Main', '初始化管理器...')

  // 应用信息（关于对话框使用），读取 package.json 中的作者与版本信息
  registerIPC('sys:appInfo', async () => {
    const fs = require('fs')
    const pkg = JSON.parse(
      fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf-8'),
    )
    const author = typeof pkg.author === 'object' ? pkg.author : {}
    return {
      name: pkg.name,
      productName: pkg.build?.productName || pkg.name || 'SQLTool',
      version: app.getVersion() || pkg.version || '1.0.0',
      description: pkg.description || '',
      author: author.name || '',
      authorEmail: author.email || '',
      company: author.company || '',
      homepage: pkg.homepage || '',
      license: pkg.license || 'MIT',
      copyright: `Copyright © ${new Date().getFullYear()} ${author.name || pkg.name || 'SQLTool'}`,
    }
  })

  connectionManager = new ConnectionManager(
    app.getPath('userData'),
    path.join(app.getPath('documents'), 'SQLTool', 'Backups'),
  )
  queryHistoryManager = new QueryHistoryManager()
  snippetManager = new SnippetManager()
  favoriteStore = new FavoriteStore()
  sqlFileService = new SqlFileService(app.getPath('userData'))
  resultExportService = new ResultExportService()
  databaseObjectFileService = new DatabaseObjectFileService(
    path.join(app.getPath('documents'), 'SQLTool'),
  )
  databaseToolService = new DatabaseToolService(connectionManager)
  logger.info('Main', '管理器初始化完成')
  
  registerIPC('database:loadConnections', async () => {
    return connectionManager.getConnectionCatalog()
  })

  registerIPC('database:createConnection', async (_event, draft) => {
    return connectionManager.createSavedConnection(draft)
  })

  registerIPC('database:updateConnection', async (_event, id, draft) => {
    return connectionManager.updateSavedConnection(id, draft)
  })

  registerIPC('database:deleteConnection', async (_event, id) => {
    return connectionManager.deleteSavedConnection(id)
  })

  registerIPC('database:createGroup', async (_event, name) => {
    return connectionManager.createConnectionGroup(name)
  })

  registerIPC('database:renameGroup', async (_event, id, name) => {
    return connectionManager.renameConnectionGroup(id, name)
  })

  registerIPC('database:deleteGroup', async (_event, id) => {
    return connectionManager.deleteConnectionGroup(id)
  })

  registerIPC('database:testConnection', async (_event, connData) => {
    return connectionManager.testConnection(connData)
  })

  registerIPC('database:connect', async (_event, connId) => {
    return connectionManager.connect(connId)
  })

  registerIPC('database:disconnect', async (_event, connId) => {
    return connectionManager.disconnect(connId)
  })

  registerIPC('database:getDatabases', async (_event, connId) => {
    return connectionManager.getDatabases(connId)
  })

  registerIPC('database:getDatabaseSummaries', async (_event, connId) => {
    return connectionManager.getDatabaseSummaries(connId)
  })

  registerIPC('database:getDatabaseEncodingCatalog', async (
    _event,
    connId,
    database,
  ) => {
    return connectionManager.getDatabaseEncodingCatalog(connId, database)
  })

  registerIPC('database:createDatabase', async (
    _event,
    connId,
    databaseName,
    options,
  ) => {
    return connectionManager.createDatabase(connId, databaseName, options)
  })

  registerIPC('database:closeDatabase', async (
    _event,
    connId,
    database,
  ) => {
    return connectionManager.closeDatabase(connId, database)
  })

  registerIPC('database:alterDatabase', async (
    _event,
    connId,
    database,
    request,
  ) => {
    return connectionManager.alterDatabase(connId, database, request)
  })

  registerIPC('database:dropDatabase', async (
    _event,
    connId,
    database,
  ) => {
    return connectionManager.dropDatabase(connId, database)
  })

  registerIPC('database:dumpDatabase', async (
    _event,
    connId,
    database,
    mode,
  ) => {
    return connectionManager.dumpDatabase(connId, database, mode)
  })

  registerIPC('database:listBackups', async (
    _event,
    connId,
    database,
  ) => {
    return connectionManager.listDatabaseBackups(connId, database)
  })

  registerIPC('database:createBackup', async (
    event,
    connId,
    database,
    request,
  ) => {
    return connectionManager.createDatabaseBackup(
      connId,
      database,
      request,
      backupProgressReporter(event),
    )
  })

  registerIPC('database:restoreBackup', async (
    event,
    connId,
    database,
    request,
  ) => {
    return connectionManager.restoreDatabaseBackup(
      connId,
      database,
      request,
      backupProgressReporter(event),
    )
  })

  registerIPC('database:extractBackupSql', async (
    _event,
    connId,
    database,
    backupId,
  ) => {
    return connectionManager.extractDatabaseBackup(
      connId,
      database,
      backupId,
    )
  })

  registerIPC('database:deleteBackup', async (
    _event,
    connId,
    database,
    backupId,
  ) => {
    return connectionManager.deleteDatabaseBackup(
      connId,
      database,
      backupId,
    )
  })

  registerIPC('database:renameBackup', async (
    _event,
    connId,
    database,
    backupId,
    name,
  ) => {
    return connectionManager.renameDatabaseBackup(
      connId,
      database,
      backupId,
      name,
    )
  })

  registerIPC('database:verifyBackup', async (
    _event,
    connId,
    database,
    backupId,
  ) => {
    return connectionManager.verifyDatabaseBackup(
      connId,
      database,
      backupId,
    )
  })

  registerIPC('database:showBackupFolder', async (
    _event,
    connId,
    database,
  ) => {
    return connectionManager.showDatabaseBackupFolder(connId, database)
  })

  registerIPC('database:getDatabaseModel', async (
    _event,
    connId,
    database,
  ) => {
    return connectionManager.getDatabaseModel(connId, database)
  })

  registerIPC('database:printDatabase', async (
    _event,
    connId,
    database,
  ) => {
    const model = await connectionManager.getDatabaseModel(connId, database)   
    return printDatabaseModel(model, mainWindow, app.getPath('temp'))
  })

  registerIPC('database:getTables', async (_event, connId, database) => {
    return connectionManager.getTables(connId, database)
  })

  registerIPC('database:getTableSummaries', async (
    _event,
    connId,
    database,
  ) => {
    return connectionManager.getTableSummaries(connId, database)
  })

  registerIPC('database:getViews', async (_event, connId, database) => {
    return connectionManager.getViews(connId, database)
  })

  registerIPC('database:getProcedures', async (_event, connId, database) => {
    return connectionManager.getProcedures(connId, database)
  })

  registerIPC('database:getFunctions', async (_event, connId, database) => {
    return connectionManager.getFunctions(connId, database)
  })

  registerIPC('database:getEvents', async (_event, connId, database) => {
    return connectionManager.getEvents(connId, database)
  })

  registerIPC('database:getTableMetadata', async (_event, connId, database, tableName) => {
    return connectionManager.getTableMetadata(connId, database, tableName)
  })

  registerIPC('database:previewTableStructure', async (
    _event,
    connId,
    database,
    request,
  ) => {
    return connectionManager.previewTableStructure(connId, database, request)
  })

  registerIPC('database:saveTableStructure', async (
    _event,
    connId,
    database,
    request,
  ) => {
    return connectionManager.saveTableStructure(connId, database, request)
  })

  registerIPC('database:dropTable', async (
    _event,
    connId,
    database,
    tableName,
  ) => {
    return connectionManager.dropTable(connId, database, tableName)
  })

  registerIPC('database:truncateTable', async (
    _event,
    connId,
    database,
    tableName,
  ) => {
    return connectionManager.truncateTable(connId, database, tableName)
  })

  registerIPC('database:openTableImport', async (
    _event,
    connId,
    database,
    tableName,
  ) => {
    return connectionManager.openTableImport(connId, database, tableName)
  })

  registerIPC('database:reloadTableImport', async (
    _event,
    connId,
    database,
    tableName,
    filePath,
    options,
  ) => {
    return connectionManager.reloadTableImport(
      connId,
      database,
      tableName,
      filePath,
      options,
    )
  })

  registerIPC('database:importTableRows', async (
    _event,
    connId,
    database,
    tableName,
    request,
  ) => {
    return connectionManager.importTableRows(
      connId,
      database,
      tableName,
      request,
    )
  })

  registerIPC('database:exportTableData', async (
    _event,
    connId,
    database,
    tableName,
    format,
    objectType,
  ) => {
    return connectionManager.exportTableData(
      connId,
      database,
      tableName,
      format,
      objectType,
    )
  })

  registerIPC('database:getTableExportObjects', async (
    _event,
    connId,
    database,
    objectType,
  ) => {
    return connectionManager.getTableExportObjects(
      connId,
      database,
      objectType,
    )
  })

  registerIPC('database:exportTableBatch', async (
    _event,
    connId,
    database,
    request,
  ) => {
    return connectionManager.exportTableBatch(connId, database, request)
  })

  registerIPC('database:getTableData', async (
    _event,
    connId,
    database,
    tableName,
    page,
    pageSize,
    query,
  ) => {
    return connectionManager.getTableData(
      connId,
      database,
      tableName,
      page,
      pageSize,
      query,
    )
  })

  registerIPC('database:updateTableRows', async (
    _event,
    connId,
    database,
    tableName,
    updates,
  ) => {
    return connectionManager.updateTableRows(
      connId,
      database,
      tableName,
      updates,
    )
  })

  registerIPC('database:mutateTableRows', async (
    _event,
    connId,
    database,
    tableName,
    batch,
  ) => {
    return connectionManager.mutateTableRows(
      connId,
      database,
      tableName,
      batch,
    )
  })

  registerIPC('databaseTool:previewTransfer', async (_event, request) => {
    return databaseToolService.previewTransfer(request)
  })

  registerIPC('databaseTool:executeTransfer', async (_event, request) => {
    return databaseToolService.executeTransfer(request)
  })

  registerIPC('databaseTool:previewDataSync', async (_event, request) => {
    return databaseToolService.previewDataSync(request)
  })

  registerIPC('databaseTool:executeDataSync', async (_event, request) => {
    return databaseToolService.executeDataSync(request)
  })

  registerIPC('databaseTool:previewStructureSync', async (_event, request) => {
    return databaseToolService.previewStructureSync(request)
  })

  registerIPC('databaseTool:executeStructureSync', async (_event, request) => {
    return databaseToolService.executeStructureSync(request)
  })

  registerIPC('database:executeSQL', async (_event, connId, database, sql) => {
    return connectionManager.executeSQL(connId, database, sql)
  })

  // 删除数据库对象（视图、函数、存储过程、事件）
  registerIPC('database:dropDatabaseObject', async (
    _event,
    connId: string,
    database: string,
    kind: 'view' | 'function' | 'procedure' | 'event',
    objectName: string,
  ) => {
    return connectionManager.dropDatabaseObject(
      connId,
      database,
      kind,
      objectName,
    )
  })

  // 启用/停用 MySQL 事件
  registerIPC('database:toggleDatabaseEvent', async (
    _event,
    connId: string,
    database: string,
    eventName: string,
    enable: boolean,
  ) => {
    return connectionManager.toggleDatabaseEvent(
      connId,
      database,
      eventName,
      enable,
    )
  })

  // 运行函数或存储过程
  registerIPC('database:executeDatabaseRoutine', async (
    _event,
    connId: string,
    database: string,
    kind: 'function' | 'procedure',
    routineName: string,
  ) => {
    return connectionManager.executeDatabaseRoutine(
      connId,
      database,
      kind,
      routineName,
    )
  })

  registerIPC('query:execute', async (_event, request) => {
    return connectionManager.executeQuery(request)
  })

  registerIPC('query:cancel', async (_event, sessionId, requestId) => {
    return connectionManager.cancelQuery(sessionId, requestId)
  })

  registerIPC('query:begin', async (_event, sessionId, connId, database) => {
    return connectionManager.beginQueryTransaction(
      sessionId,
      connId,
      database,
    )
  })

  registerIPC('query:commit', async (_event, sessionId, connId, database) => {
    return connectionManager.commitQueryTransaction(
      sessionId,
      connId,
      database,
    )
  })

  registerIPC('query:rollback', async (_event, sessionId, connId, database) => {
    return connectionManager.rollbackQueryTransaction(
      sessionId,
      connId,
      database,
    )
  })

  registerIPC('query:closeSession', async (_event, sessionId) => {
    return connectionManager.closeQuerySession(sessionId)
  })

  registerIPC('file:openSql', async () => {
    return sqlFileService.openFiles()
  })

  registerIPC('file:saveSql', async (_event, request) => {
    return sqlFileService.saveFile(request)
  })

  registerIPC('file:getRecentSql', async () => {
    return sqlFileService.getRecentFiles()
  })

  registerIPC('file:openRecentSql', async (_event, filePath) => {
    return sqlFileService.openRecentFile(filePath)
  })

  registerIPC('file:clearRecentSql', async () => {
    sqlFileService.clearRecentFiles()
    return true
  })

  registerIPC('result:exportCsv', async (_event, request) => {
    return resultExportService.exportCsv(request)
  })

  registerIPC('application:showDatabaseObjectFolder', async (
    _event,
    category,
  ) => {
    return databaseObjectFileService.showCategoryFolder(category)
  })

  registerIPC('application:confirmClose', async () => {
    allowWindowClose = true
    logger.info('Main', '未保存文档检查完成，允许关闭应用窗口')
    mainWindow?.close()
    return true
  })

  registerIPC('queryHistory:get', async (_event, filterText = '') => {
    return queryHistoryManager.getHistory(filterText)
  })

  registerIPC('queryHistory:add', async (_event, sql, connectionName, database, 
                                          executionTime, rowCount, success, error) => {
    queryHistoryManager.addQuery(sql, connectionName, database, executionTime, rowCount, success, error)
    return true
  })

  registerIPC('queryHistory:delete', async (_event, entryId) => {
    queryHistoryManager.deleteEntry(entryId)
    return true
  })

  registerIPC('queryHistory:clear', async () => {
    queryHistoryManager.clearHistory()
    return true
  })

  registerIPC('snippet:get', async (_event, filterText = '', category = '') => {
    return snippetManager.getSnippets(filterText, category)
  })

  registerIPC('snippet:getCategories', async () => {
    return snippetManager.getCategories()
  })

  registerIPC('snippet:getById', async (_event, id) => {
    return snippetManager.getSnippet(id)
  })

  registerIPC('snippet:add', async (_event, snippet) => {
    return snippetManager.addSnippet(snippet)
  })

  registerIPC('snippet:update', async (_event, id, updates) => {
    return snippetManager.updateSnippet(id, updates)
  })

  registerIPC('snippet:delete', async (_event, id) => {
    return snippetManager.deleteSnippet(id)
  })

  registerIPC('snippet:replaceVariables', async (_event, sql, variables) => {
    return snippetManager.replaceVariables(sql, variables)
  })

  // 收藏夹管理
  registerIPC('favorite:list', async () => {
    return favoriteStore.list()
  })

  registerIPC('favorite:add', async (_event, favorite) => {
    return favoriteStore.add(favorite)
  })

  registerIPC('favorite:update', async (_event, id, updates) => {
    return favoriteStore.update(id, updates)
  })

  registerIPC('favorite:delete', async (_event, id) => {
    return favoriteStore.remove(id)
  })

  registerIPC('logger:getLogFiles', async () => {
    return logger.getLogFiles()
  })

  registerIPC('logger:getLogContent', async (_event, fileName) => {
    return logger.getLogContent(fileName)
  })

  registerIPC('logger:clearLogs', async () => {
    logger.clearLogs()
    return true
  })

  registerIPC('logger:write', async (_event, level, module, message) => {
    const safeModule = String(module || 'Renderer').slice(0, 40)
    const safeMessage = String(message || '').slice(0, 4000)
    if (level === 'error') {
      logger.error(safeModule, safeMessage)
    } else if (level === 'warn') {
      logger.warn(safeModule, safeMessage)
    } else {
      logger.info(safeModule, safeMessage)
    }
    return true
  })

  // ======== TDSQL 分布式数据库 IPC 通道 ========

  registerIPC('tdsql:getTableMetadata', async (_event, connId, database, tableName) => {
    logger.info('IPC', `TDSQL 查询表元数据: 连接=${connId}, 数据库=${database}, 表=${tableName}`)
    return connectionManager.getTDSQLTableMetadata(connId, database, tableName)
  })

  registerIPC('tdsql:getDatabaseOverview', async (_event, connId, database) => {
    logger.info('IPC', `TDSQL 查询数据库概览: 连接=${connId}, 数据库=${database}`)
    return connectionManager.getTDSQLDatabaseOverview(connId, database)
  })

  registerIPC('tdsql:getSessions', async (_event, connId) => {
    logger.info('IPC', `TDSQL 查询会话列表: 连接=${connId}`)
    return connectionManager.getTDSQLSessions(connId)
  })

  registerIPC('tdsql:getDdlTasks', async (_event, connId) => {
    logger.info('IPC', `TDSQL 查询 DDL 任务: 连接=${connId}`)
    return connectionManager.getTDSQLDdlTasks(connId)
  })

  // 说明：分片透传查询（/*proxy*/）能力当前无功能入口且可对分片执行任意 SQL，
  // 出于最小权限考虑暂不注册 IPC 通道；TDSQLMonitorService 中保留实现，
  // 待后续功能落地时需补充只读/语句类型校验后再开放。

  logger.info('Main', 'IPC通道注册完成')
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  if (!connectionManager || shutdownStarted) return
  event.preventDefault()
  shutdownStarted = true
  logger.info('Main', '应用退出前关闭数据库和查询会话')
  void connectionManager.closeAll()
    .catch(error => {
      logger.error(
        'Main',
        '应用退出时关闭数据库会话失败',
        error instanceof Error ? error : undefined,
      )
    })
    .finally(() => app.quit())
})
