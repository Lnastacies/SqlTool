import {
  ConnectionData,
  DatabaseSummary,
  getAdapter,
  ExecuteResult,
  TableDataPage,
  TableMetadata,
  TableSummary,
} from './adapters'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../logger'
import { isConnectionLostError } from '../errors'
import { ConnectionConfigStore } from './connectionConfigStore'
import {
  CreateDatabaseResult,
  normalizeDatabaseName,
  type CreateDatabaseOptions,
} from './databaseCreation'
import {
  buildAlterDatabaseStatement,
  buildDropDatabaseStatement,
} from './databaseManagementSql'
import {
  buildDropDatabaseObjectSql,
  buildExecuteRoutineSql,
  buildToggleEventSql,
  objectKindLabel,
  type DroppableObjectKind,
} from './databaseObjectMutationSql'
import type {
  AlterDatabaseRequest,
  AlterDatabaseResult,
  CloseDatabaseResult,
  DatabaseDumpMode,
  DatabaseDumpResult,
  DatabaseEncodingCatalog,
  DatabaseModel,
  DropDatabaseResult,
} from './databaseManagementTypes'
import { loadDatabaseEncodingCatalog } from './databaseEncodingCatalog'
import { writeDatabaseDumpFile } from './databaseDumpService'
import { loadDatabaseModel } from './databaseModelService'
import { DatabaseBackupService } from './databaseBackupService'
import type {
  CreateDatabaseBackupRequest,
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
import type {
  ConnectionCatalog,
  ConnectionDraft,
} from './connectionConfigTypes'
import {
  applyTableMutations,
  TableMutationBatch,
  TableMutationResult,
  TableRowUpdate,
} from './tableDataMutations'
import {
  ActiveConnection,
  DatabaseConnectionRegistry,
} from './databaseConnectionRegistry'
import { validateTableMutationBatch } from './tableMutationValidation'
import {
  buildTableDataQuery,
  TableDataQuery,
} from './tableDataQuery'
import { QuerySessionManager } from './querySessionManager'
import type {
  QueryCancelResult,
  QueryExecutionRequest,
  QueryExecutionResult,
  QuerySessionActionResult,
} from './query/queryTypes'
import {
  buildDropTableStatement,
  buildTableStructurePlan,
  buildTruncateTableStatement,
} from './tableStructureSql'
import {
  metadataToTableDefinition,
  SaveTableStructureRequest,
  SaveTableStructureResult,
  TableStructurePlan,
} from './tableStructureTypes'
import { validateTableStructureRequest } from './tableStructureValidation'
import {
  openTableImportFile,
  parseTableImportFile,
  writeTableExportToPath,
} from './tableTransferService'
import { selectTableExportTargets } from './tableTransferDestination'
import type {
  DatabaseExportObjectType,
  TableExportBatchRequest,
  TableExportBatchResult,
  TableExportFormat,
  TableExportObjectMetadata,
  TableExportOptions,
  TableExportResult,
  TableImportOptions,
  TableImportPreview,
  TableImportRequest,
  TableImportResult,
} from './tableTransferTypes'
import {
  MAX_TABLE_IMPORT_ROWS,
} from './tableTransferTypes'
import { buildTableImportBatch } from './tableTransferValidation'

export class ConnectionManager {
  private connections: Map<string, ActiveConnection> = new Map()
  /** 进行中的建立连接流程，按连接 ID 去重复用，防止并发重复建连 */
  private connectingPromises: Map<string, Promise<{ success: boolean; message: string }>> = new Map()
  private databaseConnections = new DatabaseConnectionRegistry()
  private querySessions: QuerySessionManager
  private readonly configStore: ConnectionConfigStore
  private readonly backupService: DatabaseBackupService

  constructor(
    storageDirectory: string,
    backupDirectory = path.join(storageDirectory, 'Backups'),
  ) {
    if (!path.isAbsolute(storageDirectory)) {
      throw new Error('连接配置存储目录必须是绝对路径')
    }
    fs.mkdirSync(storageDirectory, { recursive: true })
    this.configStore = new ConnectionConfigStore(
      storageDirectory,
      path.join(__dirname, '../../connections.json'),
      path.join(__dirname, '../../encryption.key'),
    )
    this.backupService = new DatabaseBackupService(backupDirectory)
    logger.info(
      'ConnectionManager',
      `初始化连接管理器, 配置目录: ${storageDirectory}`,
    )
    this.querySessions = new QuerySessionManager(
      connId => this.connections.get(connId),
    )
  }

  getConnectionCatalog(): ConnectionCatalog {
    return this.configStore.getCatalog()
  }

  createSavedConnection(draft: ConnectionDraft): ConnectionCatalog {
    return this.configStore.createConnection(draft)
  }

  async updateSavedConnection(
    id: string,
    draft: ConnectionDraft,
  ): Promise<ConnectionCatalog> {
    const current = this.configStore.getConnection(id)
    if (!current) throw new Error('要编辑的连接不存在')
    const reconnectRequired = this.connectionSettingsChanged(current, draft)
    if (this.connections.has(id) && reconnectRequired) {
      logger.info('ConnectionManager', `编辑前断开活动连接: ID=${id}`)
      await this.disconnect(id)
    }
    const catalog = this.configStore.updateConnection(id, draft)
    const active = this.connections.get(id)
    const updated = this.configStore.getConnection(id)
    if (active && updated) active.connData = updated
    return catalog
  }

  async deleteSavedConnection(id: string): Promise<ConnectionCatalog> {
    if (this.connections.has(id)) {
      logger.info('ConnectionManager', `删除前断开活动连接: ID=${id}`)
      await this.disconnect(id)
    }
    return this.configStore.deleteConnection(id)
  }
    
  createConnectionGroup(name: string): ConnectionCatalog {
    return this.configStore.createGroup(name)
  }

  renameConnectionGroup(id: string, name: string): ConnectionCatalog {
    return this.configStore.renameGroup(id, name)
  }

  deleteConnectionGroup(id: string): ConnectionCatalog {
    return this.configStore.deleteGroup(id)
  }

  private connectionSettingsChanged(
    current: ConnectionData,
    draft: ConnectionDraft,
  ): boolean {
    const fields: Array<keyof ConnectionDraft> = [
      'type',
      'host',
      'port',
      'username',
      'password',
      'database',
      'timeout',
      'charset',
    ]
    return fields.some(field => current[field] !== draft[field])
  }

  async testConnection(draft: ConnectionDraft): Promise<{ success: boolean; message: string }> {
    const connData: ConnectionData = { ...draft, id: 'connection-test' }
    const startTime = Date.now()
    logger.info('ConnectionManager', `开始测试连接: ${connData.name} (${connData.type})`)
    logger.debug('ConnectionManager', `连接参数: ${connData.host}:${connData.port}, 数据库: ${connData.database || '无'}, 用户: ${connData.username}`)
    
    try {
      const adapter = getAdapter(connData.type)
      logger.debug('ConnectionManager', `使用适配器: ${connData.type}Adapter`)
      const success = await adapter.testConnection(connData)
      const duration = Date.now() - startTime
      logger.info('ConnectionManager', `测试连接完成: ${connData.name}, 结果: ${success ? '成功' : '失败'}, 耗时: ${duration}ms`)
      return { success, message: success ? '连接成功' : '连接失败' }
    } catch (error: any) {
      const duration = Date.now() - startTime
      logger.error('ConnectionManager', `测试连接失败: ${connData.name}, 错误: ${error.message}, 耗时: ${duration}ms`, error)
      return { success: false, message: error.message }
    }
  }

  async connect(connId: string): Promise<{ success: boolean; message: string }> {
    // 防抖去重：同一连接的并发触发（如快速双击引起的两次 expand）只建立一次连接，
    // 后续调用复用进行中的建立过程，避免竞态覆盖导致的底层连接泄漏
    const inFlight = this.connectingPromises.get(connId)
    if (inFlight) {
      logger.info('ConnectionManager', `检测到重复的连接请求，复用进行中的连接流程: ID=${connId}`)
      return await inFlight
    }
    const connectPromise = this.doConnect(connId)
    this.connectingPromises.set(connId, connectPromise)
    try {
      return await connectPromise
    } finally {
      this.connectingPromises.delete(connId)
    }
  }

  private async doConnect(connId: string): Promise<{ success: boolean; message: string }> {
    const connData = this.configStore.getConnection(connId)
    if (!connData) {
      logger.warn('ConnectionManager', `建立连接失败: 配置不存在, ID=${connId}`)
      return { success: false, message: '连接配置不存在或已删除' }
    }
    const startTime = Date.now()
    logger.info('ConnectionManager', `开始建立连接: ${connData.name} (${connData.type})`)
    logger.debug('ConnectionManager', `连接参数: ${connData.host}:${connData.port}, 数据库: ${connData.database || '无'}, 用户: ${connData.username}`)

    try {
      if (this.connections.has(connData.id)) {
        logger.info(
          'ConnectionManager',
          `连接已存在，先关闭旧会话: ${connData.name}, ID: ${connData.id}`,
        )
        await this.disconnect(connData.id)
      }
      const adapter = getAdapter(connData.type)
      logger.debug('ConnectionManager', `使用适配器: ${connData.type}Adapter`)
      const connection = await adapter.connect(connData)
      const duration = Date.now() - startTime

      this.connections.set(connData.id, {
        adapter,
        connection,
        connData
      })

      logger.info('ConnectionManager', `连接建立成功: ${connData.name}, ID: ${connData.id}, 耗时: ${duration}ms`)
      logger.info('ConnectionManager', `当前活跃连接数: ${this.connections.size}`)
      return { success: true, message: '连接成功' }
    } catch (error: any) {
      const duration = Date.now() - startTime
      logger.error('ConnectionManager', `连接建立失败: ${connData.name}, 错误: ${error.message}, 耗时: ${duration}ms`, error)
      return { success: false, message: error.message }
    }
  }

  /**
   * 释放连接：无论底层驱动连接是否还能响应，都必须释放本地资源并移除注册项，
   * 否则残留的僵尸连接会让后续所有操作持续报错（也无法再次关闭）。
   */
  private async evictConnection(connId: string, reason: string): Promise<void> {
    const activeConn = this.connections.get(connId)
    // 先摘除注册项，确保后续请求不会再复用这条失效连接
    this.connections.delete(connId)
    if (activeConn) {
      try {
        await this.querySessions.closeByConnection(connId)
      } catch (error) {
        logger.warn('ConnectionManager', `剔出失效连接时关闭查询会话异常: ID=${connId}, 原因=${(error as Error).message}`)
      }
      try {
        await this.databaseConnections.close(connId)
      } catch (error) {
        logger.warn('ConnectionManager', `剔出失效连接时关闭数据库会话异常: ID=${connId}, 原因=${(error as Error).message}`)
      }
      try {
        await activeConn.adapter.close(activeConn.connection)
      } catch (error) {
        // 底层连接已断开时 end/destroy 可能抛错，属预期情况，忽略即可
        logger.warn('ConnectionManager', `剔出失效连接时释放底层连接异常(已忽略): ID=${connId}, 原因=${(error as Error).message}`)
      }
    }
    logger.warn(
      'ConnectionManager',
      `已释放连接: ${activeConn?.connData.name || connId}, ID=${connId}, 类型=${activeConn?.connData.type || '未知'}, 原因=${reason}, 当前活跃连接数=${this.connections.size}`,
    )
  }

  async disconnect(connId: string): Promise<void> {
    const activeConn = this.connections.get(connId)
    if (!activeConn) {
      logger.warn('ConnectionManager', `断开连接失败: 连接ID ${connId} 不存在`)
      return
    }
    logger.info('ConnectionManager', `断开连接: ${activeConn.connData.name}, ID: ${connId}`)
    // 关闭是尽力而为操作：即使底层驱动在已断开的连接上抛错，也必须完成本地清理并视为成功，
    // 否则用户会看到“关闭失败: 不能再已断开的连接执行命令”。
    try {
      await this.evictConnection(connId, '用户主动断开连接')
    } catch (error) {
      this.connections.delete(connId)
      logger.warn(
        'ConnectionManager',
        `断开连接清理异常(已忽略，连接仍视为已关闭): ID=${connId}, 原因=${(error as Error)?.message || String(error)}`,
      )
    }
    logger.info('ConnectionManager', `连接已断开: ${activeConn.connData.name}, 当前活跃连接数: ${this.connections.size}`)
  }

  async getDatabases(connId: string): Promise<string[]> {
    const activeConn = this.connections.get(connId)
    if (!activeConn) throw new Error('连接不存在')
    try {
      return await activeConn.adapter.getDatabases(activeConn.connection)
    } catch (error) {
      await this.evictOnConnectionLost(connId, '读取数据库列表', error)
      throw error
    }
  }

  /** 读到连接已失效的错误时顺带把僵尸连接剔出，避免其继续阻塞后续操作 */
  private async evictOnConnectionLost(
    connId: string,
    action: string,
    error: unknown,
  ): Promise<boolean> {
    if (!isConnectionLostError(error)) return false
    await this.evictConnection(connId, `${action}时检测到连接已失效`)
    return true
  }

  async getDatabaseSummaries(connId: string): Promise<DatabaseSummary[]> {
    const activeConn = this.connections.get(connId)
    if (!activeConn) throw new Error('连接不存在')

    const startedAt = Date.now()
    logger.info(
      'ConnectionManager',
      `开始读取数据库摘要: 连接=${connId}, 类型=${activeConn.connData.type}`,
    )
    try {
      const summaries = await activeConn.adapter.getDatabaseSummaries(
        activeConn.connection,
      )
      const totalSize = summaries.reduce(
        (total, item) => total + (item.sizeBytes || 0),
        0,
      )
      logger.info(
        'ConnectionManager',
        `数据库摘要读取完成: 连接=${connId}, 数量=${summaries.length}, 总大小=${totalSize}, 耗时=${Date.now() - startedAt}ms`,
      )
      return summaries
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `数据库摘要读取失败: 连接=${connId}, 耗时=${Date.now() - startedAt}ms`,
        error instanceof Error ? error : undefined,
      )
      await this.evictOnConnectionLost(connId, '读取数据库摘要', error)
      throw error
    }
  }

  async getDatabaseEncodingCatalog(
    connId: string,
    database?: string,
  ): Promise<DatabaseEncodingCatalog> {
    const activeConn = this.connections.get(connId)
    if (!activeConn) throw new Error('请先建立数据库连接')

    const startedAt = Date.now()
    logger.info(
      'ConnectionManager',
      `开始读取数据库编码目录: 连接=${connId}, 类型=${activeConn.connData.type}, 数据库=${database || '未指定'}`,
    )
    try {
      const catalog = await loadDatabaseEncodingCatalog(
        activeConn.connData,
        activeConn.adapter,
        activeConn.connection,
        database,
      )
      logger.info(
        'ConnectionManager',
        `数据库编码目录读取完成: 连接=${connId}, 数据库=${database || '未指定'}, 字符集=${catalog.charsets.length}, 排序规则=${catalog.collations.length}, 当前字符集=${catalog.charset || '无'}, 当前排序规则=${catalog.collation || '无'}, 耗时=${Date.now() - startedAt}ms`,
      )
      return catalog
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `数据库编码目录读取失败: 连接=${connId}, 数据库=${database || '未指定'}, 耗时=${Date.now() - startedAt}ms`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  async createDatabase(
    connId: string,
    databaseName: string,
    options: CreateDatabaseOptions = {},
  ): Promise<CreateDatabaseResult> {
    const activeConn = this.connections.get(connId)
    if (!activeConn) throw new Error('请先建立数据库连接')

    const name = normalizeDatabaseName(
      activeConn.connData.type,
      databaseName,
    )
    const startedAt = Date.now()
    logger.info(
      'ConnectionManager',
      `开始新建数据库: 连接=${connId}, 类型=${activeConn.connData.type}, 数据库=${name}, 编码选项=${JSON.stringify(options)}`,
    )
    try {
      await activeConn.adapter.createDatabase(activeConn.connection, name, options)
      logger.info(
        'ConnectionManager',
        `新建数据库完成: 连接=${connId}, 数据库=${name}, 耗时=${Date.now() - startedAt}ms`,
      )
      return { name }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      logger.error(
        'ConnectionManager',
        `新建数据库失败: 连接=${connId}, 数据库=${name}, 原因=${detail}, 耗时=${Date.now() - startedAt}ms`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  async closeDatabase(
    connId: string,
    database: string,
  ): Promise<CloseDatabaseResult> {
    const startedAt = Date.now()
    logger.info(
      'ConnectionManager',
      `开始关闭数据库上下文: 连接=${connId}, 数据库=${database}`,
    )
    try {
      const baseConnection = this.connections.get(connId)
      if (!baseConnection) throw new Error('连接不存在或尚未连接')

      // 远端存在性校验需要真实连接，但“关闭数据库”本质是本地会话清理；
      // 连接已失效时不允许它阻塞关闭流程，只登记失效、随后统一剔除。
      const accessible = await this.verifyDatabaseAccessible(
        baseConnection,
        database,
      )
      // 本地资源清理同样是尽力而为：连接已失效时，关闭会话内部可能抛断连错误，
      // 不能让它中断“关闭数据库”这个本地操作。
      try {
        await this.querySessions.closeByDatabase(connId, database)
      } catch (error) {
        logger.warn(
          'ConnectionManager',
          `关闭数据库时清理查询会话异常(已忽略): 连接=${connId}, 数据库=${database}, 原因=${(error as Error)?.message || String(error)}`,
        )
      }
      try {
        await this.databaseConnections.closeDatabase(connId, database)
      } catch (error) {
        logger.warn(
          'ConnectionManager',
          `关闭数据库时清理数据会话异常(已忽略): 连接=${connId}, 数据库=${database}, 原因=${(error as Error)?.message || String(error)}`,
        )
      }

      if (accessible === 'invalid') {
        await this.evictConnection(
          connId,
          `关闭数据库时检测到连接已失效(数据库=${database})`,
        )
        logger.warn(
          'ConnectionManager',
          `连接已失效，已退化为本地清理并剔除连接: 连接=${connId}, 数据库=${database}, 耗时=${Date.now() - startedAt}ms`,
        )
        return { name: database, connectionInvalidated: true }
      }

      logger.info(
        'ConnectionManager',
        `数据库上下文已关闭: 连接=${connId}, 数据库=${database}, 耗时=${Date.now() - startedAt}ms`,
      )
      return { name: database }
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `关闭数据库上下文失败: 连接=${connId}, 数据库=${database}, 耗时=${Date.now() - startedAt}ms`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  /**
   * 校验数据库在服务端确实存在。
   * 连接已失效时返回 'invalid' 而不是抛错，让调用方决定是继续本地清理还是中断。
   */
  private async verifyDatabaseAccessible(
    baseConnection: ActiveConnection,
    database: string,
  ): Promise<'ok' | 'invalid'> {
    try {
      const databases = await baseConnection.adapter.getDatabases(
        baseConnection.connection,
      )
      if (!databases.includes(database)) {
        throw new Error(`数据库不存在或当前账号不可访问: ${database}`)
      }
      return 'ok'
    } catch (error) {
      if (isConnectionLostError(error)) return 'invalid'
      throw error
    }
  }

  async alterDatabase(
    connId: string,
    database: string,
    request: AlterDatabaseRequest,
  ): Promise<AlterDatabaseResult> {
    const startedAt = Date.now()
    logger.info(
      'ConnectionManager',
      `开始编辑数据库: 连接=${connId}, 数据库=${database}`,
    )
    try {
      const baseConnection = await this.requireExistingDatabase(connId, database)
      const { statement, nextName } = buildAlterDatabaseStatement(
        baseConnection.connData.type,
        database,
        request,
      )
      const renaming = nextName !== database
      if (renaming) {
        await this.querySessions.closeByDatabase(connId, database)
        await this.databaseConnections.closeDatabase(connId, database)
      }
      const result = await baseConnection.adapter.executeSQL(
        baseConnection.connection,
        '',
        statement,
      )
      if (!result.success) {
        throw new Error(result.message || '编辑数据库失败')
      }
      logger.info(
        'ConnectionManager',
        `编辑数据库完成: 连接=${connId}, 原名称=${database}, 新名称=${nextName}, 耗时=${Date.now() - startedAt}ms`,
      )
      return { previousName: database, name: nextName }
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `编辑数据库失败: 连接=${connId}, 数据库=${database}, 耗时=${Date.now() - startedAt}ms`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  async dropDatabase(
    connId: string,
    database: string,
  ): Promise<DropDatabaseResult> {
    const startedAt = Date.now()
    logger.info(
      'ConnectionManager',
      `开始删除数据库: 连接=${connId}, 数据库=${database}`,
    )
    try {
      const baseConnection = await this.requireExistingDatabase(connId, database)
      const statement = buildDropDatabaseStatement(
        baseConnection.connData.type,
        database,
      )
      await this.querySessions.closeByDatabase(connId, database)
      await this.databaseConnections.closeDatabase(connId, database)
      const result = await baseConnection.adapter.executeSQL(
        baseConnection.connection,
        '',
        statement,
      )
      if (!result.success) {
        throw new Error(result.message || '删除数据库失败')
      }
      logger.info(
        'ConnectionManager',
        `删除数据库完成: 连接=${connId}, 数据库=${database}, 耗时=${Date.now() - startedAt}ms`,
      )
      return { name: database }
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `删除数据库失败: 连接=${connId}, 数据库=${database}, 耗时=${Date.now() - startedAt}ms`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  async getDatabaseModel(
    connId: string,
    database: string,
  ): Promise<DatabaseModel> {
    await this.requireExistingDatabase(connId, database)
    const activeConnection = await this.resolveActiveConnection(
      connId,
      database,
    )
    return loadDatabaseModel(activeConnection, database)
  }

  async dumpDatabase(
    connId: string,
    database: string,
    mode: DatabaseDumpMode,
  ): Promise<DatabaseDumpResult> {
    if (!['structure-data', 'structure', 'data'].includes(mode)) {
      throw new Error(`不支持的数据库转储模式: ${String(mode)}`)
    }
    const startedAt = Date.now()
    logger.info(
      'ConnectionManager',
      `开始转储数据库: 连接=${connId}, 数据库=${database}, 模式=${mode}`,
    )
    try {
      const model = await this.getDatabaseModel(connId, database)
      const result = await writeDatabaseDumpFile(model, mode, {
        loadPage: async (table, page, pageSize) => {
          const pageResult = await this.getTableData(
            connId,
            database,
            table.name,
            page,
            pageSize,
          )
          return { rows: pageResult.rows, total: pageResult.total }
        },
      })
      logger.info(
        'ConnectionManager',
        `${result.cancelled ? '取消' : '完成'}数据库转储: 连接=${connId}, 数据库=${database}, 模式=${mode}, 表=${result.tableCount}, 行=${result.rowCount}, 耗时=${Date.now() - startedAt}ms`,
      )
      return result
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `数据库转储失败: 连接=${connId}, 数据库=${database}, 模式=${mode}, 耗时=${Date.now() - startedAt}ms`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  async listDatabaseBackups(
    connId: string,
    database: string,
  ): Promise<DatabaseBackupRecord[]> {
    await this.requireExistingDatabase(connId, database)
    return this.backupService.list(connId, database)
  }

  async createDatabaseBackup(
    connId: string,
    database: string,
    request: CreateDatabaseBackupRequest,
    report: DatabaseBackupProgressReporter,
  ): Promise<CreateDatabaseBackupResult> {
    if (!request?.operationId) throw new Error('备份操作缺少追踪 ID')
    const model = await this.getDatabaseModel(connId, database)
    const active = await this.resolveActiveConnection(connId, database)
    return this.backupService.create({
      connectionId: connId,
      database,
      active,
      model,
      request,
      loadPage: async (table, page, pageSize) => {
        const result = await this.getTableData(
          connId,
          database,
          table.name,
          page,
          pageSize,
        )
        return { rows: result.rows, total: result.total }
      },
    }, report)
  }

  async restoreDatabaseBackup(
    connId: string,
    database: string,
    request: RestoreDatabaseBackupRequest,
    report: DatabaseBackupProgressReporter,
  ): Promise<RestoreDatabaseBackupResult> {
    if (!request?.operationId) throw new Error('还原操作缺少追踪 ID')
    await this.requireExistingDatabase(connId, database)
    const active = await this.resolveActiveConnection(connId, database)
    return this.backupService.restore(
      active,
      connId,
      database,
      request,
      report,
    )
  }

  async extractDatabaseBackup(
    connId: string,
    database: string,
    backupId?: string,
  ): Promise<ExtractDatabaseBackupResult> {
    return this.backupService.extract(connId, database, backupId)
  }

  async deleteDatabaseBackup(
    connId: string,
    database: string,
    backupId: string,
  ): Promise<DeleteDatabaseBackupResult> {
    return this.backupService.delete(connId, database, backupId)
  }

  async renameDatabaseBackup(
    connId: string,
    database: string,
    backupId: string,
    name: string,
  ): Promise<RenameDatabaseBackupResult> {
    return this.backupService.rename(connId, database, backupId, name)
  }

  async verifyDatabaseBackup(
    connId: string,
    database: string,
    backupId: string,
  ): Promise<VerifyDatabaseBackupResult> {
    return this.backupService.verify(connId, database, backupId)
  }

  async showDatabaseBackupFolder(
    connId: string,
    database: string,
  ): Promise<{ path: string }> {
    return this.backupService.showFolder(connId, database)
  }

  async getTables(connId: string, database: string): Promise<string[]> {
    const activeConn = await this.resolveActiveConnection(connId, database)
    return await activeConn.adapter.getTables(activeConn.connection, database)
  }

  async getTableSummaries(
    connId: string,
    database: string,
  ): Promise<TableSummary[]> {
    const startedAt = Date.now()
    const activeConn = await this.resolveActiveConnection(connId, database)
    logger.info(
      'ConnectionManager',
      `开始读取表明细: 连接=${connId}, 数据库=${database}, 类型=${activeConn.connData.type}`,
    )
    try {
      const summaries = await activeConn.adapter.getTableSummaries(
        activeConn.connection,
        database,
      )
      logger.info(
        'ConnectionManager',
        `表明细读取完成: 连接=${connId}, 数据库=${database}, 数量=${summaries.length}, 耗时=${Date.now() - startedAt}ms`,
      )
      return summaries
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `表明细读取失败: 连接=${connId}, 数据库=${database}, 耗时=${Date.now() - startedAt}ms`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  async getViews(connId: string, database: string): Promise<string[]> {
    const activeConn = await this.resolveActiveConnection(connId, database)
    return await activeConn.adapter.getViews(activeConn.connection, database)
  }

  async getProcedures(connId: string, database: string): Promise<string[]> {
    const activeConn = await this.resolveActiveConnection(connId, database)
    return await activeConn.adapter.getProcedures(activeConn.connection, database)
  }

  async getFunctions(connId: string, database: string): Promise<string[]> {
    const activeConn = await this.resolveActiveConnection(connId, database)
    return await activeConn.adapter.getFunctions(activeConn.connection, database)
  }

  async getEvents(connId: string, database: string): Promise<string[]> {
    const activeConn = await this.resolveActiveConnection(connId, database)
    return await activeConn.adapter.getEvents(activeConn.connection, database)
  }

  async getTableMetadata(connId: string, database: string, tableName: string): Promise<TableMetadata> {
    const activeConn = await this.resolveActiveConnection(connId, database)
    return await activeConn.adapter.getTableMetadata(activeConn.connection, database, tableName)
  }

  async previewTableStructure(
    connId: string,
    database: string,
    request: SaveTableStructureRequest,
  ): Promise<TableStructurePlan> {
    const { plan } = await this.prepareTableStructurePlan(
      connId,
      database,
      request,
    )
    logger.info(
      'ConnectionManager',
      `预览表结构变更: 连接=${connId}, 数据库=${database}, 表=${request.definition.name}, 模式=${plan.mode}, 语句数=${plan.statements.length}`,
    )
    return plan
  }

  async saveTableStructure(
    connId: string,
    database: string,
    request: SaveTableStructureRequest,
  ): Promise<SaveTableStructureResult> {
    const { activeConn, plan, normalizedRequest } = (
      await this.prepareTableStructurePlan(connId, database, request)
    )
    logger.info(
      'ConnectionManager',
      `开始保存表结构: 连接=${connId}, 数据库=${database}, 原表=${normalizedRequest.originalName || '新建'}, 新表=${normalizedRequest.definition.name}, 模式=${plan.mode}, 语句数=${plan.statements.length}`,
    )
    try {
      await this.executeTableStructurePlan(
        activeConn,
        database,
        normalizedRequest,
        plan,
      )
      logger.info(
        'ConnectionManager',
        `表结构保存完成: 数据库=${database}, 表=${normalizedRequest.definition.name}, 模式=${plan.mode}`,
      )
      return {
        tableName: normalizedRequest.definition.name,
        mode: plan.mode,
        statementCount: plan.statements.length,
        warnings: plan.warnings,
      }
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `表结构保存失败: 数据库=${database}, 表=${normalizedRequest.definition.name}`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  async dropTable(
    connId: string,
    database: string,
    tableName: string,
  ): Promise<{ tableName: string }> {
    const baseConnection = this.connections.get(connId)
    if (!baseConnection) throw new Error('连接不存在')
    const activeConn = await this.resolveActiveConnection(connId, database)
    const tables = await activeConn.adapter.getTables(
      activeConn.connection,
      database,
    )
    if (!tables.includes(tableName)) {
      throw new Error(`数据表不存在或当前账号不可访问: ${tableName}`)
    }
    logger.info(
      'ConnectionManager',
      `开始删除表: 连接=${connId}, 数据库=${database}, 表=${tableName}`,
    )
    const statement = buildDropTableStatement(
      activeConn.connData.type,
      database,
      tableName,
    )
    const result = await activeConn.adapter.executeSQL(
      activeConn.connection,
      database,
      statement,
    )
    if (!result.success) throw new Error(result.message || '删除表失败')
    logger.info(
      'ConnectionManager',
      `删除表完成: 数据库=${database}, 表=${tableName}`,
    )
    return { tableName }
  }

  async truncateTable(
    connId: string,
    database: string,
    tableName: string,
  ): Promise<{ tableName: string; affectedRows: number }> {
    const startedAt = Date.now()
    logger.info(
      'ConnectionManager',
      `开始清空表: 连接=${connId}, 数据库=${database}, 表=${tableName}`,
    )
    try {
      const { activeConn } = await this.resolveExistingTable(
        connId,
        database,
        tableName,
      )
      const statement = buildTruncateTableStatement(
        activeConn.connData.type,
        database,
        tableName,
      )
      const executionDatabase = activeConn.connData.type === 'PostgreSQL'
        ? ''
        : database
      const result = await activeConn.adapter.executeSQL(
        activeConn.connection,
        executionDatabase,
        statement,
      )
      if (!result.success) throw new Error(result.message || '清空表失败')
      const affectedRows = result.affected_rows || 0
      logger.info(
        'ConnectionManager',
        `清空表完成: 连接=${connId}, 数据库=${database}, 表=${tableName}, 影响行数=${affectedRows}, 耗时=${Date.now() - startedAt}ms`,
      )
      return { tableName, affectedRows }
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `清空表失败: 连接=${connId}, 数据库=${database}, 表=${tableName}, 耗时=${Date.now() - startedAt}ms`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  async openTableImport(
    connId: string,
    database: string,
    tableName: string,
  ): Promise<TableImportPreview> {
    await this.resolveExistingTable(connId, database, tableName)
    logger.info(
      'ConnectionManager',
      `打开表数据导入文件: 连接=${connId}, 数据库=${database}, 表=${tableName}`,
    )
    try {
      const preview = await openTableImportFile()
      if (preview.cancelled) {
        logger.info(
          'ConnectionManager',
          `取消表数据导入: 数据库=${database}, 表=${tableName}`,
        )
      } else {
        logger.info(
          'ConnectionManager',
          `导入文件解析完成: 数据库=${database}, 表=${tableName}, 文件=${preview.fileName}, 字段=${preview.columns.length}, 数据行=${preview.totalRows}`,
        )
      }
      return preview
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `导入文件解析失败: 数据库=${database}, 表=${tableName}`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  async reloadTableImport(
    connId: string,
    database: string,
    tableName: string,
    filePath: string,
    options: TableImportOptions,
  ): Promise<TableImportPreview> {
    await this.resolveExistingTable(connId, database, tableName)
    logger.info(
      'ConnectionManager',
      `按配置重新解析导入文件: 连接=${connId}, 数据库=${database}, 表=${tableName}, 文件=${path.basename(filePath)}, 格式=${options.format.toUpperCase()}, 编码=${options.text?.encoding || '自动'}`,
    )
    try {
      return await parseTableImportFile(filePath, options)
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `重新解析导入文件失败: 数据库=${database}, 表=${tableName}, 文件=${path.basename(filePath)}`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  async importTableRows(
    connId: string,
    database: string,
    tableName: string,
    request: TableImportRequest,
  ): Promise<TableImportResult> {
    const { activeConn, metadata } = await this.resolveExistingTable(
      connId,
      database,
      tableName,
    )
    const batch = buildTableImportBatch(request, metadata)
    const fields = new Set(metadata.fields.map(field => field.name))
    const primaryKeys = metadata.fields
      .filter(field => field.primary)
      .map(field => field.name)
    const operationCount = validateTableMutationBatch(
      batch,
      fields,
      primaryKeys,
      MAX_TABLE_IMPORT_ROWS,
    )
    const safeFileName = path.basename(request.fileName || '未命名文件')
      .replace(/[\r\n]/g, ' ')
    logger.info(
      'ConnectionManager',
      `开始导入表数据: 连接=${connId}, 数据库=${database}, 表=${tableName}, 文件=${safeFileName}, 数据行=${operationCount}, 映射字段=${request.mappings.length}`,
    )
    try {
      const result = await applyTableMutations(
        activeConn.connData.type,
        activeConn.connection,
        database,
        tableName,
        batch,
      )
      logger.info(
        'ConnectionManager',
        `表数据导入完成: 数据库=${database}, 表=${tableName}, 导入=${result.insertedRows}`,
      )
      return { importedRows: result.insertedRows }
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `表数据导入失败并已回滚: 数据库=${database}, 表=${tableName}, 文件=${safeFileName}`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  async exportTableData(
    connId: string,
    database: string,
    tableName: string,
    format: TableExportFormat,
    objectType: DatabaseExportObjectType = 'table',
  ): Promise<TableExportResult> {
    const { metadata } = await this.resolveExistingDataObject(
      connId,
      database,
      tableName,
      objectType,
    )
    const options: Omit<TableExportOptions, 'columns'> = {
      format,
      binaryEncoding: 'base64',
      text: format === 'csv' || format === 'txt'
        ? {
          includeHeader: true,
          delimiter: format === 'txt' ? '\t' : ',',
          recordDelimiter: '\r\n',
          quote: '"',
          encoding: 'utf8bom',
        }
        : undefined,
      xml: { prettyPrint: true },
      excel: { freezeHeader: true, autoFilter: true },
      sql: { includeTransaction: false },
    }
    const result = await this.exportTableBatch(connId, database, {
      objects: [{
        name: tableName,
        objectType,
        columns: metadata.fields.map(field => field.name),
      }],
      options,
    })
    const file = result.files[0]
    return {
      cancelled: result.cancelled,
      filePath: file?.filePath,
      rowCount: file?.rowCount || 0,
    }
  }

  async getTableExportObjects(
    connId: string,
    database: string,
    objectType: DatabaseExportObjectType,
  ): Promise<TableExportObjectMetadata[]> {
    const baseConnection = this.connections.get(connId)
    if (!baseConnection) throw new Error('连接不存在')
    const activeConn = await this.resolveActiveConnection(connId, database)
    const names = objectType === 'view'
      ? await activeConn.adapter.getViews(activeConn.connection, database)
      : await activeConn.adapter.getTables(activeConn.connection, database)
    logger.info(
      'ConnectionManager',
      `开始读取导出对象字段: 连接=${connId}, 数据库=${database}, 类型=${objectType}, 对象数=${names.length}`,
    )
    const objects: TableExportObjectMetadata[] = []
    for (const name of names) {
      const metadata = objectType === 'view'
        ? await this.resolveViewMetadata(activeConn, database, name)
        : await activeConn.adapter.getTableMetadata(
          activeConn.connection,
          database,
          name,
        )
      objects.push({
        name,
        objectType,
        columns: metadata.fields.map(field => field.name),
      })
    }
    logger.info(
      'ConnectionManager',
      `导出对象字段读取完成: 数据库=${database}, 类型=${objectType}, 对象数=${objects.length}, 字段总数=${objects.reduce((sum, item) => sum + item.columns.length, 0)}`,
    )
    return objects
  }

  async exportTableBatch(
    connId: string,
    database: string,
    request: TableExportBatchRequest,
  ): Promise<TableExportBatchResult> {
    const supportedFormats: TableExportFormat[] = [
      'txt',
      'csv',
      'html',
      'xlsx',
      'sql',
      'xml',
      'json',
    ]
    if (!request?.objects?.length) throw new Error('请至少选择一个导出对象')
    if (!supportedFormats.includes(request.options?.format)) {
      throw new Error(`不支持的导出格式: ${String(request.options?.format)}`)
    }
    if (request.objects.length > 100) throw new Error('单次最多导出 100 个对象')
    const objectKeys = request.objects.map(
      item => `${item.objectType}:${item.name.toLowerCase()}`,
    )
    if (new Set(objectKeys).size !== objectKeys.length) {
      throw new Error('导出对象不能重复选择')
    }

    logger.info(
      'ConnectionManager',
      `开始准备批量导出: 连接=${connId}, 数据库=${database}, 格式=${request.options.format.toUpperCase()}, 对象数=${request.objects.length}, 二进制=${request.options.binaryEncoding}`,
    )
    try {
      const prepared = []
      for (const item of request.objects) {
        const { activeConn, metadata } = await this.resolveExistingDataObject(
          connId,
          database,
          item.name,
          item.objectType,
        )
        const availableColumns = new Set(
          metadata.fields.map(field => field.name),
        )
        if (!item.columns.length) {
          throw new Error(`对象“${item.name}”没有选择任何字段`)
        }
        const missingColumn = item.columns.find(
          column => !availableColumns.has(column),
        )
        if (missingColumn) {
          throw new Error(`对象“${item.name}”不存在字段“${missingColumn}”`)
        }
        const source = await this.createTableExportSource(
          activeConn,
          database,
          item.name,
          item.objectType,
          metadata,
          item.columns,
        )
        prepared.push({ item, activeConn, source })
      }

      const targets = await selectTableExportTargets(
        prepared.map(entry => entry.item.name),
        request.options.format,
      )
      if (!targets) {
        logger.info(
          'ConnectionManager',
          `用户取消批量导出: 数据库=${database}, 格式=${request.options.format.toUpperCase()}, 对象数=${request.objects.length}`,
        )
        return {
          cancelled: true,
          objectCount: 0,
          rowCount: 0,
          files: [],
        }
      }

      const files: TableExportBatchResult['files'] = []
      for (let index = 0; index < prepared.length; index += 1) {
        const { item, activeConn, source } = prepared[index]
        const target = targets[index]
        const options: TableExportOptions = {
          ...request.options,
          columns: item.columns,
        }
        const rowCount = await writeTableExportToPath(
          activeConn.connData.type,
          item.name,
          item.columns,
          options,
          source,
          target.filePath,
        )
        files.push({
          objectName: item.name,
          filePath: target.filePath,
          rowCount,
        })
        logger.info(
          'ConnectionManager',
          `批量导出对象完成: 数据库=${database}, 对象=${item.name}, 序号=${index + 1}/${prepared.length}, 行数=${rowCount}, 文件=${path.basename(target.filePath)}`,
        )
      }
      const result = {
        cancelled: false,
        directoryPath: files.length > 1
          ? path.dirname(files[0].filePath)
          : undefined,
        objectCount: files.length,
        rowCount: files.reduce((sum, file) => sum + file.rowCount, 0),
        files,
      }
      logger.info(
        'ConnectionManager',
        `批量导出完成: 数据库=${database}, 格式=${request.options.format.toUpperCase()}, 对象数=${result.objectCount}, 总行数=${result.rowCount}`,
      )
      return result
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `批量导出失败: 数据库=${database}, 格式=${request.options.format.toUpperCase()}, 对象数=${request.objects.length}`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  private async createTableExportSource(
    activeConn: ActiveConnection,
    database: string,
    objectName: string,
    objectType: DatabaseExportObjectType,
    metadata: TableMetadata,
    columns: string[],
  ) {
    const objectLabel = objectType === 'view' ? '视图' : '表'
    const tableReference = this.buildTableReference(
      activeConn.connData.type,
      database,
      objectName,
    )
    const executionDatabase = activeConn.connData.type === 'PostgreSQL'
      ? ''
      : database
    const countQuery = buildTableDataQuery({
      databaseType: activeConn.connData.type,
      tableReference,
      fields: metadata.fields,
      page: 1,
      pageSize: 500,
    })
    const countResult = await activeConn.adapter.executeSQL(
      activeConn.connection,
      executionDatabase,
      countQuery.countSql,
      countQuery.parameters,
    )
    if (!countResult.success) throw new Error(countResult.message)
    const totalRows = Number(countResult.rows?.[0]?.__sqltool_total || 0)
    if (!Number.isFinite(totalRows) || totalRows < 0) {
      throw new Error(`无法读取${objectLabel}“${objectName}”的数据总行数`)
    }
    if (totalRows > 500 && !metadata.fields.some(field => field.primary)) {
      logger.warn(
        'ConnectionManager',
        `无主键${objectLabel}将采用数据库默认顺序分页导出: 数据库=${database}, 对象=${objectName}, 总行数=${totalRows}`,
      )
    }
    logger.info(
      'ConnectionManager',
      `导出对象预检查完成: 数据库=${database}, 类型=${objectLabel}, 对象=${objectName}, 字段=${columns.length}, 总行数=${totalRows}`,
    )
    return {
      totalRows,
      loadPage: async (page: number, pageSize: number) => {
        const query = buildTableDataQuery({
          databaseType: activeConn.connData.type,
          tableReference,
          fields: metadata.fields,
          page,
          pageSize,
        })
        const pageResult = await activeConn.adapter.executeSQL(
          activeConn.connection,
          executionDatabase,
          query.dataSql,
          query.parameters,
        )
        if (!pageResult.success) throw new Error(pageResult.message)
        const rows = (pageResult.rows || []).map(row => Object.fromEntries(
          columns.map(column => [column, row[column]]),
        ))
        logger.debug(
          'ConnectionManager',
          `导出分页读取完成: 类型=${objectLabel}, 对象=${objectName}, 页码=${page}, 行数=${rows.length}`,
        )
        return rows
      },
    }
  }

  async getTableData(
    connId: string,
    database: string,
    tableName: string,
    page: number,
    pageSize: number,
    query?: TableDataQuery,
  ): Promise<TableDataPage> {
    const baseConnection = this.connections.get(connId)
    if (!baseConnection) throw new Error('连接不存在')

    const safePage = Math.max(1, Math.floor(page))
    const safePageSize = Math.min(500, Math.max(20, Math.floor(pageSize)))
    logger.info(
      'ConnectionManager',
      `读取表数据: 连接=${connId}, 数据库=${database}, 表=${tableName}, 页码=${safePage}, 每页=${safePageSize}, 排序=${query?.sorts?.length || 0}, 筛选=${query?.filters?.length || 0}`,
    )

    const databases = await baseConnection.adapter.getDatabases(
      baseConnection.connection,
    )
    if (baseConnection.connData.type !== 'SQLite' && !databases.includes(database)) {
      throw new Error(`数据库不存在或当前账号不可访问: ${database}`)
    }
    const activeConn = await this.resolveActiveConnection(connId, database)

    const tables = await activeConn.adapter.getTables(
      activeConn.connection,
      database,
    )
    if (!tables.includes(tableName)) {
      throw new Error(`数据表不存在或当前账号不可访问: ${tableName}`)
    }

    const metadata = await activeConn.adapter.getTableMetadata(
      activeConn.connection,
      database,
      tableName,
    )
    const primaryKeys = metadata.fields
      .filter(field => field.primary)
      .map(field => field.name)
    const tableRef = this.buildTableReference(
      activeConn.connData.type,
      database,
      tableName,
    )
    const builtQuery = buildTableDataQuery({
      databaseType: activeConn.connData.type,
      tableReference: tableRef,
      fields: metadata.fields,
      page: safePage,
      pageSize: safePageSize,
      query,
    })
    logger.debug(
      'ConnectionManager',
      `结构化查询已构建: 排序字段=${builtQuery.query.sorts.map(sort => sort.field).join(',') || '默认'}, 筛选字段=${builtQuery.query.filters.map(filter => filter.field).join(',') || '无'}, 条件逻辑=${builtQuery.query.filterLogic.toUpperCase()}`,
    )
    const executionDatabase = activeConn.connData.type === 'PostgreSQL'
      ? ''
      : database

    // 单连接适配器（尤其 tedious）不允许并发请求，分页查询按顺序执行。
    const countResult = await activeConn.adapter.executeSQL(
      activeConn.connection,
      executionDatabase,
      builtQuery.countSql,
      builtQuery.parameters,
    )
    const dataResult = await activeConn.adapter.executeSQL(
      activeConn.connection,
      executionDatabase,
      builtQuery.dataSql,
      builtQuery.parameters,
    )
    if (!countResult.success) {
      throw new Error(countResult.message)
    }
    if (!dataResult.success) {
      throw new Error(dataResult.message)
    }

    const totalValue = countResult.rows?.[0]?.__sqltool_total
    const result = {
      columns: dataResult.columns || metadata.fields.map(field => field.name),
      fields: metadata.fields,
      rows: dataResult.rows || [],
      total: Number(totalValue || 0),
      page: safePage,
      pageSize: safePageSize,
      primaryKeys,
      editable: primaryKeys.length > 0,
    }
    logger.info(
      'ConnectionManager',
      `表数据读取完成: 表=${tableName}, 当前页=${result.rows.length} 行, 总计=${result.total} 行, 可编辑=${result.editable ? '是' : '否'}`,
    )
    return result
  }

  private buildTableReference(
    type: ConnectionData['type'],
    database: string,
    tableName: string,
  ): string {
    if (type === 'MySQL') {
      return `${this.quoteIdentifier(database, '`')}.${this.quoteIdentifier(tableName, '`')}`
    }
    if (type === 'SQL Server') {
      return `${this.quoteIdentifier(database, '[')}.[dbo].${this.quoteIdentifier(tableName, '[')}`
    }
    if (type === 'PostgreSQL') {
      return `"public".${this.quoteIdentifier(tableName, '"')}`
    }
    return this.quoteIdentifier(tableName, '"')
  }

  private quoteIdentifier(value: string, quote: '`' | '"' | '['): string {
    if (quote === '[') {
      return `[${value.replace(/]/g, ']]')}]`
    }
    return `${quote}${value.replace(
      new RegExp(quote, 'g'),
      `${quote}${quote}`,
    )}${quote}`
  }

  async updateTableRows(
    connId: string,
    database: string,
    tableName: string,
    updates: TableRowUpdate[],
  ): Promise<{ affectedRows: number }> {
    const result = await this.mutateTableRows(
      connId,
      database,
      tableName,
      { inserts: [], updates, deletes: [] },
    )
    return { affectedRows: result.affectedRows }
  }

  async mutateTableRows(
    connId: string,
    database: string,
    tableName: string,
    batch: TableMutationBatch,
  ): Promise<TableMutationResult> {
    const baseConnection = this.connections.get(connId)
    if (!baseConnection) throw new Error('连接不存在')

    const databases = await baseConnection.adapter.getDatabases(
      baseConnection.connection,
    )
    if (baseConnection.connData.type !== 'SQLite' && !databases.includes(database)) {
      throw new Error(`数据库不存在或当前账号不可访问: ${database}`)
    }
    const activeConn = await this.resolveActiveConnection(connId, database)
    const tables = await activeConn.adapter.getTables(
      activeConn.connection,
      database,
    )
    if (!tables.includes(tableName)) {
      throw new Error(`数据表不存在或当前账号不可访问: ${tableName}`)
    }

    const metadata = await activeConn.adapter.getTableMetadata(
      activeConn.connection,
      database,
      tableName,
    )
    const fields = new Set(metadata.fields.map(field => field.name))
    const primaryKeys = metadata.fields
      .filter(field => field.primary)
      .map(field => field.name)
    const operationCount = validateTableMutationBatch(
      batch,
      fields,
      primaryKeys,
    )

    logger.info(
      'ConnectionManager',
      `提交表数据修改: 连接=${connId}, 数据库=${database}, 表=${tableName}, 操作数=${operationCount}, 新增=${batch.inserts.length}, 更新=${batch.updates.length}, 删除=${batch.deletes.length}`,
    )
    try {
      const result = await applyTableMutations(
        activeConn.connData.type,
        activeConn.connection,
        database,
        tableName,
        batch,
      )
      logger.info(
        'ConnectionManager',
        `表数据修改提交完成: 表=${tableName}, 新增=${result.insertedRows}, 更新=${result.updatedRows}, 删除=${result.deletedRows}, 总影响=${result.affectedRows}`,
      )
      return result
    } catch (error) {
      logger.error(
        'ConnectionManager',
        `表数据修改提交失败并已回滚: 数据库=${database}, 表=${tableName}`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  private async prepareTableStructurePlan(
    connId: string,
    database: string,
    request: SaveTableStructureRequest,
  ): Promise<{
    activeConn: ActiveConnection
    normalizedRequest: SaveTableStructureRequest
    plan: TableStructurePlan
  }> {
    const baseConnection = this.connections.get(connId)
    if (!baseConnection) throw new Error('连接不存在')
    const normalizedRequest = validateTableStructureRequest(
      baseConnection.connData.type,
      request,
    )
    const activeConn = await this.resolveActiveConnection(connId, database)
    const tables = await activeConn.adapter.getTables(
      activeConn.connection,
      database,
    )
    const originalName = normalizedRequest.originalName
    let originalDefinition

    if (originalName) {
      if (!tables.includes(originalName)) {
        throw new Error(`要设计的数据表不存在: ${originalName}`)
      }
      if (
        normalizedRequest.definition.name !== originalName
        && tables.includes(normalizedRequest.definition.name)
      ) {
        throw new Error(`数据表已存在: ${normalizedRequest.definition.name}`)
      }
      const metadata = await activeConn.adapter.getTableMetadata(
        activeConn.connection,
        database,
        originalName,
      )
      originalDefinition = metadataToTableDefinition(originalName, metadata)
    } else if (tables.includes(normalizedRequest.definition.name)) {
      throw new Error(`数据表已存在: ${normalizedRequest.definition.name}`)
    }

    const plan = buildTableStructurePlan(
      activeConn.connData.type,
      database,
      normalizedRequest.definition,
      originalDefinition,
    )
    if (activeConn.connData.type === 'SQLite' && originalName) {
      const triggers = this.readSQLiteTableTriggers(
        activeConn.connection,
        originalName,
      )
      if (triggers.length > 0) {
        const targetName = normalizedRequest.definition.name
        const isRename = originalName !== targetName
        if (isRename) {
          // 表重命名场景：需要先 DROP 触发器，重建表后再 CREATE 绑定到新表名
          const dropTriggerStatements = triggers.map(
            trigger => `DROP TRIGGER IF EXISTS ${trigger.name}`,
          )
          const rewrittenCreateStatements = triggers.map(trigger => {
            const rewritten = this.rewriteSQLiteTriggerSql(
              trigger.sql,
              originalName,
              targetName,
            )
            return rewritten.endsWith(';') ? rewritten : `${rewritten};`
          })
          // 在 DROP TABLE 之前插入 DROP TRIGGER
          const dropTableIndex = plan.statements.findIndex(statement =>
            statement.trim().toUpperCase().startsWith('DROP TABLE'),
          )
          if (dropTableIndex >= 0) {
            plan.statements.splice(dropTableIndex, 0, ...dropTriggerStatements)
          }
          // 在 ALTER TABLE ... RENAME TO 之后插入重写的 CREATE TRIGGER
          const renameIndex = plan.statements.findIndex(statement =>
            statement.trim().toUpperCase().startsWith('ALTER TABLE'),
          )
          if (renameIndex >= 0) {
            plan.statements.splice(
              renameIndex + 1,
              0,
              ...rewrittenCreateStatements,
            )
          }
          logger.info(
            'ConnectionManager',
            `SQLite 表重命名并保留触发器: 表=${originalName} -> ${targetName}, 触发器数=${triggers.length}`,
          )
        } else {
          // 未重命名：保持原逻辑，在 COMMIT 之前重新创建触发器
          const triggerSqls = triggers.map(trigger => trigger.sql)
          const commitIndex = plan.statements.findIndex(
            statement => statement.trim().toUpperCase() === 'COMMIT',
          )
          if (commitIndex >= 0) {
            plan.statements.splice(commitIndex, 0, ...triggerSqls)
          }
        }
      }
    }
    return { activeConn, normalizedRequest, plan }
  }

  private readSQLiteTableTriggers(
    connection: any,
    tableName: string,
  ): Array<{ name: string; sql: string }> {
    const escapedTable = tableName.replace(/'/g, "''")
    const result = connection.exec(
      `SELECT name, sql FROM sqlite_master
       WHERE type = 'trigger' AND tbl_name = '${escapedTable}'
         AND sql IS NOT NULL
       ORDER BY name`,
    )
    if (result.length === 0) return []
    return result[0].values
      .map((row: unknown[]) => ({
        name: String(row[0] || '').trim(),
        sql: String(row[1] || '').trim(),
      }))
      .filter((item: { name: string; sql: string }) => item.name && item.sql)
  }

  /**
   * 重写 SQLite 触发器 SQL 中的表名引用，用于表重命名场景。
   * 仅替换 `ON old_table` 子句中的表名，保留 OLD./NEW. 行引用。
   * 注意：通过后瞻断言确保表名完整匹配，避免 user 误匹配 users 等前缀。
   */
  private rewriteSQLiteTriggerSql(
    triggerSql: string,
    oldTableName: string,
    newTableName: string,
  ): string {
    const escapedName = oldTableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // 匹配 CREATE TRIGGER ... ON <table> 形式
    // - 引号包裹：ON `table` / ON "table" / ON [table]，开闭引号必须成对
    // - 裸名：ON table（后接空白、换行或语句结束）
    const quotedPattern = new RegExp(
      `(ON\\s+)([\`"\\[])${escapedName}([\`"\\]])(?=\\s)`,
      'gi',
    )
    const barePattern = new RegExp(
      `(ON\\s+)${escapedName}(?=\\s|$)`,
      'gi',
    )
    let result = triggerSql.replace(
      quotedPattern,
      (_match, prefix, openQuote, closeQuote) => (
        `${prefix}${openQuote}${newTableName}${closeQuote}`
      ),
    )
    result = result.replace(
      barePattern,
      (_match, prefix) => `${prefix}${newTableName}`,
    )
    return result
  }

  private async executeTableStructurePlan(
    activeConn: ActiveConnection,
    database: string,
    request: SaveTableStructureRequest,
    plan: TableStructurePlan,
  ): Promise<void> {
    if (activeConn.connData.type === 'SQLite') {
      this.executeSQLiteTableStructurePlan(activeConn.connection, plan)
      return
    }

    const transactional = (
      activeConn.connData.type === 'PostgreSQL'
      || activeConn.connData.type === 'SQL Server'
    )
    if (transactional) {
      await this.executeStructureStatement(activeConn, database, 'BEGIN TRANSACTION')
    }
    try {
      for (const [index, statement] of plan.statements.entries()) {
        logger.debug(
          'ConnectionManager',
          `执行表结构语句: 表=${request.definition.name}, 序号=${index + 1}/${plan.statements.length}, SQL=${statement.replace(/\s+/g, ' ').slice(0, 180)}`,
        )
        await this.executeStructureStatement(activeConn, database, statement)
      }
      if (transactional) {
        await this.executeStructureStatement(activeConn, database, 'COMMIT')
      }
    } catch (error) {
      if (transactional) {
        try {
          await this.executeStructureStatement(activeConn, database, 'ROLLBACK')
        } catch (rollbackError) {
          logger.error(
            'ConnectionManager',
            '表结构变更回滚失败',
            rollbackError instanceof Error ? rollbackError : undefined,
          )
        }
      }
      throw error
    }
  }

  private async executeStructureStatement(
    activeConn: ActiveConnection,
    database: string,
    statement: string,
  ): Promise<void> {
    const result = await activeConn.adapter.executeSQL(
      activeConn.connection,
      database,
      statement,
    )
    if (!result.success) {
      throw new Error(result.message || '表结构语句执行失败')
    }
  }

  private executeSQLiteTableStructurePlan(
    connection: any,
    plan: TableStructurePlan,
  ): void {
    const managesTransaction = plan.statements.some(
      statement => statement.trim().toUpperCase().startsWith('BEGIN'),
    )
    let transactionStarted = false
    try {
      if (!managesTransaction) {
        connection.run('BEGIN IMMEDIATE')
        transactionStarted = true
      }
      for (const [index, statement] of plan.statements.entries()) {
        logger.debug(
          'ConnectionManager',
          `执行 SQLite 表结构语句: 序号=${index + 1}/${plan.statements.length}, SQL=${statement.replace(/\s+/g, ' ').slice(0, 180)}`,
        )
        connection.run(statement)
        const normalized = statement.trim().toUpperCase()
        if (normalized.startsWith('BEGIN')) transactionStarted = true
        if (normalized === 'COMMIT') transactionStarted = false
      }
      if (!managesTransaction) {
        connection.run('COMMIT')
        transactionStarted = false
      }
      if (typeof connection.saveToDisk === 'function') connection.saveToDisk()
    } catch (error) {
      if (transactionStarted) {
        try {
          connection.run('ROLLBACK')
        } catch {
          // 保留原始结构变更异常，回滚失败由上层日志记录。
        }
      }
      try {
        connection.run('PRAGMA foreign_keys = ON')
      } finally {
        if (typeof connection.saveToDisk === 'function') connection.saveToDisk()
      }
      throw error
    }
  }

  async executeSQL(connId: string, database: string, sql: string): Promise<ExecuteResult> {
    const baseConnection = this.connections.get(connId)
    if (!baseConnection) return { success: false, message: '连接不存在' }
    const activeConn = await this.resolveActiveConnection(connId, database)
    return await activeConn.adapter.executeSQL(activeConn.connection, database, sql)
  }

  /**
   * 删除数据库对象（视图、函数、存储过程、事件）。
   * 对象存在性校验通过后构建 DROP 语句执行。
   * PostgreSQL 函数/存储过程因重载需要参数签名，返回 skipped=true 提示用户手动处理。
   */
  async dropDatabaseObject(
    connId: string,
    database: string,
    kind: DroppableObjectKind,
    objectName: string,
  ): Promise<{ objectName: string; skipped: boolean }> {
    const baseConnection = this.connections.get(connId)
    if (!baseConnection) throw new Error('连接不存在')
    const activeConn = await this.resolveActiveConnection(connId, database)
    const label = objectKindLabel(kind)

    // 校验对象是否存在，避免误删或权限不足时给出明确提示
    const existingNames = await this.fetchObjectNames(
      activeConn,
      database,
      kind,
    )
    if (!existingNames.includes(objectName)) {
      throw new Error(`${label}不存在或当前账号不可访问: ${objectName}`)
    }

    const statement = buildDropDatabaseObjectSql(
      activeConn.connData.type,
      kind,
      objectName,
    )
    // PostgreSQL 函数/存储过程无法自动生成安全的 DROP 语句
    if (!statement) {
      logger.warn(
        'ConnectionManager',
        `跳过删除${label}: 数据库类型=${activeConn.connData.type}, 对象=${objectName}（需手动指定参数签名）`,
      )
      return { objectName, skipped: true }
    }

    logger.info(
      'ConnectionManager',
      `开始删除${label}: 连接=${connId}, 数据库=${database}, 对象=${objectName}`,
    )
    const result = await activeConn.adapter.executeSQL(
      activeConn.connection,
      database,
      statement,
    )
    if (!result.success) {
      throw new Error(result.message || `删除${label}失败`)
    }
    logger.info(
      'ConnectionManager',
      `删除${label}完成: 数据库=${database}, 对象=${objectName}`,
    )
    return { objectName, skipped: false }
  }

  /**
   * 启用/停用 MySQL 事件调度。
   * 仅 MySQL 支持 ALTER EVENT ... ENABLE/DISABLE 语法。
   */
  async toggleDatabaseEvent(
    connId: string,
    database: string,
    eventName: string,
    enable: boolean,
  ): Promise<{ eventName: string; enabled: boolean }> {
    const baseConnection = this.connections.get(connId)
    if (!baseConnection) throw new Error('连接不存在')
    const activeConn = await this.resolveActiveConnection(connId, database)

    // 校验事件存在
    const events = await activeConn.adapter.getEvents(
      activeConn.connection,
      database,
    )
    if (!events.includes(eventName)) {
      throw new Error(`事件不存在或当前账号不可访问: ${eventName}`)
    }

    const statement = buildToggleEventSql(
      activeConn.connData.type,
      eventName,
      enable,
    )
    logger.info(
      'ConnectionManager',
      `开始${enable ? '启用' : '停用'}事件: 连接=${connId}, 数据库=${database}, 事件=${eventName}`,
    )
    const result = await activeConn.adapter.executeSQL(
      activeConn.connection,
      database,
      statement,
    )
    if (!result.success) {
      throw new Error(result.message || `${enable ? '启用' : '停用'}事件失败`)
    }
    logger.info(
      'ConnectionManager',
      `${enable ? '启用' : '停用'}事件完成: 数据库=${database}, 事件=${eventName}`,
    )
    return { eventName, enabled: enable }
  }

  /**
   * 运行函数或存储过程，返回执行结果。
   * 函数使用 SELECT 调用，存储过程使用 CALL/EXEC 调用。
   */
  async executeDatabaseRoutine(
    connId: string,
    database: string,
    kind: 'function' | 'procedure',
    routineName: string,
  ): Promise<ExecuteResult> {
    const baseConnection = this.connections.get(connId)
    if (!baseConnection) throw new Error('连接不存在')
    const activeConn = await this.resolveActiveConnection(connId, database)
    const label = kind === 'function' ? '函数' : '存储过程'

    // 校验对象存在
    const existingNames = await this.fetchObjectNames(
      activeConn,
      database,
      kind,
    )
    if (!existingNames.includes(routineName)) {
      throw new Error(`${label}不存在或当前账号不可访问: ${routineName}`)
    }

    const statement = buildExecuteRoutineSql(
      activeConn.connData.type,
      kind,
      routineName,
    )
    logger.info(
      'ConnectionManager',
      `开始运行${label}: 连接=${connId}, 数据库=${database}, 对象=${routineName}`,
    )
    const result = await activeConn.adapter.executeSQL(
      activeConn.connection,
      database,
      statement,
    )
    logger.info(
      'ConnectionManager',
      `运行${label}完成: 数据库=${database}, 对象=${routineName}, 成功=${result.success}`,
    )
    return result
  }

  /**
   * 获取指定类型对象名称列表，用于删除/运行前的存在性校验。
   * 函数类型同时包含函数和存储过程，以兼容 MySQL 将存储过程归入函数列表的情况。
   */
  private async fetchObjectNames(
    activeConn: ActiveConnection,
    database: string,
    kind: DroppableObjectKind,
  ): Promise<string[]> {
    if (kind === 'view') {
      return activeConn.adapter.getViews(activeConn.connection, database)
    }
    if (kind === 'function') {
      const functions = await activeConn.adapter.getFunctions(
        activeConn.connection,
        database,
      )
      const procedures = await activeConn.adapter.getProcedures(
        activeConn.connection,
        database,
      )
      return [...functions, ...procedures]
    }
    if (kind === 'procedure') {
      return activeConn.adapter.getProcedures(activeConn.connection, database)
    }
    return activeConn.adapter.getEvents(activeConn.connection, database)
  }

  executeQuery(
    request: QueryExecutionRequest,
  ): Promise<QueryExecutionResult> {
    return this.querySessions.execute(request)
  }

  cancelQuery(
    sessionId: string,
    requestId: string,
  ): Promise<QueryCancelResult> {
    return this.querySessions.cancel(sessionId, requestId)
  }

  beginQueryTransaction(
    sessionId: string,
    connId: string,
    database: string,
  ): Promise<QuerySessionActionResult> {
    return this.querySessions.begin(sessionId, connId, database)
  }

  commitQueryTransaction(
    sessionId: string,
    connId: string,
    database: string,
  ): Promise<QuerySessionActionResult> {
    return this.querySessions.commit(sessionId, connId, database)
  }

  rollbackQueryTransaction(
    sessionId: string,
    connId: string,
    database: string,
  ): Promise<QuerySessionActionResult> {
    return this.querySessions.rollback(sessionId, connId, database)
  }

  closeQuerySession(sessionId: string): Promise<void> {
    return this.querySessions.closeSession(sessionId)
  }

  async closeAll(): Promise<void> {
    await this.querySessions.closeAll()
    for (const connId of Array.from(this.connections.keys())) {
      await this.disconnect(connId)
    }
  }

  private async requireExistingDatabase(
    connId: string,
    database: string,
  ): Promise<ActiveConnection> {
    const baseConnection = this.connections.get(connId)
    if (!baseConnection) throw new Error('连接不存在或尚未连接')
    let databases: string[]
    try {
      databases = await baseConnection.adapter.getDatabases(
        baseConnection.connection,
      )
    } catch (error) {
      // 连接已被服务端断开时顺带剔除，避免僵尸连接阻塞后续所有操作
      await this.evictOnConnectionLost(connId, '校验数据库', error)
      throw error
    }
    if (!databases.includes(database)) {
      throw new Error(`数据库不存在或当前账号不可访问: ${database}`)
    }
    return baseConnection
  }

  private async resolveActiveConnection(
    connId: string,
    database: string,
  ): Promise<ActiveConnection> {
    const baseConnection = this.connections.get(connId)
    if (!baseConnection) throw new Error('连接不存在')
    return this.databaseConnections.resolve(connId, database, baseConnection)
  }

  private async resolveExistingTable(
    connId: string,
    database: string,
    tableName: string,
  ): Promise<{ activeConn: ActiveConnection; metadata: TableMetadata }> {
    return this.resolveExistingDataObject(
      connId,
      database,
      tableName,
      'table',
    )
  }

  private async resolveExistingDataObject(
    connId: string,
    database: string,
    objectName: string,
    objectType: DatabaseExportObjectType,
  ): Promise<{ activeConn: ActiveConnection; metadata: TableMetadata }> {
    const baseConnection = this.connections.get(connId)
    if (!baseConnection) throw new Error('连接不存在')
    const databases = await baseConnection.adapter.getDatabases(
      baseConnection.connection,
    )
    if (
      baseConnection.connData.type !== 'SQLite'
      && !databases.includes(database)
    ) {
      throw new Error(`数据库不存在或当前账号不可访问: ${database}`)
    }
    const activeConn = await this.resolveActiveConnection(connId, database)
    const objectNames = objectType === 'view'
      ? await activeConn.adapter.getViews(activeConn.connection, database)
      : await activeConn.adapter.getTables(activeConn.connection, database)
    if (!objectNames.includes(objectName)) {
      const objectLabel = objectType === 'view' ? '视图' : '数据表'
      throw new Error(`${objectLabel}不存在或当前账号不可访问: ${objectName}`)
    }
    const metadata = objectType === 'view'
      ? await this.resolveViewMetadata(activeConn, database, objectName)
      : await activeConn.adapter.getTableMetadata(
        activeConn.connection,
        database,
        objectName,
      )
    return { activeConn, metadata }
  }

  private async resolveViewMetadata(
    activeConn: ActiveConnection,
    database: string,
    viewName: string,
  ): Promise<TableMetadata> {
    try {
      const metadata = await activeConn.adapter.getTableMetadata(
        activeConn.connection,
        database,
        viewName,
      )
      if (metadata.fields.length > 0) return metadata
    } catch (error) {
      logger.warn(
        'ConnectionManager',
        `按表结构方式读取视图字段失败，改用空结果查询: 数据库=${database}, 视图=${viewName}, 原因=${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const reference = this.buildTableReference(
      activeConn.connData.type,
      database,
      viewName,
    )
    const executionDatabase = activeConn.connData.type === 'PostgreSQL'
      ? ''
      : database
    const result = await activeConn.adapter.executeSQL(
      activeConn.connection,
      executionDatabase,
      `SELECT * FROM ${reference} WHERE 1 = 0`,
    )
    if (!result.success) throw new Error(result.message)
    return {
      fields: (result.columns || []).map(name => ({
        name,
        type: '',
        not_null: false,
        default: null,
        primary: false,
        auto_increment: false,
        comment: '',
      })),
      indexes: [],
      foreign_keys: [],
      ddl: '',
    }
  }
}
