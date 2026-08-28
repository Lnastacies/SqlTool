import { logger } from '../logger'
import type { ActiveConnection } from './databaseConnectionRegistry'
import { QuerySessionCancellation } from './query/querySessionCancellation'
import { QuerySessionExecution } from './query/querySessionExecution'
import { QuerySessionStore } from './query/querySessionStore'
import { QuerySessionTransactions } from './query/querySessionTransactions'
import type { QueryTransactionAction } from './query/querySessionTypes'
import type {
  QueryCancelResult,
  QueryExecutionRequest,
  QueryExecutionResult,
  QuerySessionActionResult,
} from './query/queryTypes'

export class QuerySessionManager {
  private readonly store: QuerySessionStore
  private readonly execution: QuerySessionExecution
  private readonly cancellation: QuerySessionCancellation
  private readonly transactions: QuerySessionTransactions
  private readonly closingSessions = new Map<string, Promise<void>>()
  private readonly closingConnectionIds = new Set<string>()
  private readonly closingConnections = new Map<string, Promise<void>>()
  private readonly closingDatabaseKeys = new Set<string>()
  private readonly closingDatabases = new Map<string, Promise<void>>()
  private closingAll = false
  private closeAllPromise?: Promise<void>

  constructor(
    resolveBaseConnection: (
      connId: string,
    ) => ActiveConnection | undefined,
  ) {
    this.store = new QuerySessionStore(resolveBaseConnection)
    this.execution = new QuerySessionExecution(this.store)
    this.cancellation = new QuerySessionCancellation(this.store)
    this.transactions = new QuerySessionTransactions(this.store)
  }

  async execute(
    request: QueryExecutionRequest,
  ): Promise<QueryExecutionResult> {
    this.validateRequest(request)
    this.assertConnectionAvailable(request.connId)
    this.assertDatabaseAvailable(request.connId, request.database)
    const session = await this.store.resolve(
      request.sessionId,
      request.connId,
      request.database,
      existing => this.closeSession(existing.id),
    )
    try {
      this.assertConnectionAvailable(request.connId)
      this.assertDatabaseAvailable(request.connId, request.database)
    } catch (error) {
      await this.closeSession(session.id)
      throw error
    }
    return this.execution.execute(session, request)
  }

  cancel(
    sessionId: string,
    requestId: string,
  ): Promise<QueryCancelResult> {
    return this.cancellation.cancel(sessionId, requestId)
  }

  begin(
    sessionId: string,
    connId: string,
    database: string,
  ): Promise<QuerySessionActionResult> {
    return this.runTransactionAction(
      'begin',
      sessionId,
      connId,
      database,
    )
  }

  commit(
    sessionId: string,
    connId: string,
    database: string,
  ): Promise<QuerySessionActionResult> {
    return this.runTransactionAction(
      'commit',
      sessionId,
      connId,
      database,
    )
  }

  rollback(
    sessionId: string,
    connId: string,
    database: string,
  ): Promise<QuerySessionActionResult> {
    return this.runTransactionAction(
      'rollback',
      sessionId,
      connId,
      database,
    )
  }

  async closeSession(sessionId: string): Promise<void> {
    const current = this.closingSessions.get(sessionId)
    if (current) return current

    const closing = this.performCloseSession(sessionId)
    this.closingSessions.set(sessionId, closing)
    try {
      await closing
    } finally {
      if (this.closingSessions.get(sessionId) === closing) {
        this.closingSessions.delete(sessionId)
      }
    }
  }

  async closeByConnection(connId: string): Promise<void> {
    const current = this.closingConnections.get(connId)
    if (current) return current

    this.closingConnectionIds.add(connId)
    const closing = this.performCloseByConnection(connId)
    this.closingConnections.set(connId, closing)
    try {
      await closing
    } finally {
      this.closingConnections.delete(connId)
      this.closingConnectionIds.delete(connId)
    }
  }

  async closeByDatabase(connId: string, database: string): Promise<void> {
    const key = this.databaseKey(connId, database)
    const current = this.closingDatabases.get(key)
    if (current) return current

    this.closingDatabaseKeys.add(key)
    const closing = this.performCloseByDatabase(connId, database)
    this.closingDatabases.set(key, closing)
    try {
      await closing
    } finally {
      this.closingDatabases.delete(key)
      this.closingDatabaseKeys.delete(key)
    }
  }

  closeAll(): Promise<void> {
    if (this.closeAllPromise) return this.closeAllPromise
    this.closingAll = true
    this.closeAllPromise = this.performCloseAll()
    return this.closeAllPromise
  }

  private async runTransactionAction(
    action: QueryTransactionAction,
    sessionId: string,
    connId: string,
    database: string,
  ): Promise<QuerySessionActionResult> {
    this.validateIdentifier(sessionId, '会话 ID')
    this.validateIdentifier(connId, '连接 ID')
    this.assertConnectionAvailable(connId)
    this.assertDatabaseAvailable(connId, database)
    const session = await this.store.resolve(
      sessionId,
      connId,
      database,
      existing => this.closeSession(existing.id),
    )
    try {
      this.assertConnectionAvailable(connId)
      this.assertDatabaseAvailable(connId, database)
    } catch (error) {
      await this.closeSession(session.id)
      throw error
    }
    return this.transactions.run(session, action)
  }

  private async performCloseSession(sessionId: string): Promise<void> {
    await this.store.waitForPending(sessionId)
    const session = this.store.get(sessionId)
    if (!session) return

    if (session.activeRequest) {
      await this.cancellation.cancel(
        session.id,
        session.activeRequest.requestId,
      )
      await session.activeRequest.completion
    }
    if (session.transactionState !== 'idle') {
      try {
        await session.executor.rollback(session.connection)
        logger.info(
          'QuerySession',
          `关闭会话前已回滚事务: 会话=${session.id}`,
        )
      } catch (error) {
        logger.error(
          'QuerySession',
          `关闭会话时回滚失败: 会话=${session.id}`,
          error instanceof Error ? error : undefined,
        )
      }
    }

    try {
      if (session.ownsConnection) {
        await session.adapter.close(session.connection)
      }
    } catch (error) {
      logger.error(
        'QuerySession',
        `关闭查询专用连接失败: 会话=${session.id}`,
        error instanceof Error ? error : undefined,
      )
    } finally {
      this.store.remove(session)
    }
    logger.info(
      'QuerySession',
      `查询会话已关闭: 会话=${session.id}, 连接=${session.connId}`,
    )
  }

  private async performCloseByConnection(connId: string): Promise<void> {
    await this.store.waitForConnection(connId)
    await Promise.all(
      this.store.idsForConnection(connId)
        .map(sessionId => this.closeSession(sessionId)),
    )
  }

  private async performCloseByDatabase(
    connId: string,
    database: string,
  ): Promise<void> {
    await this.store.waitForDatabase(connId, database)
    const sessionIds = this.store.idsForDatabase(connId, database)
    await Promise.all(
      sessionIds.map(sessionId => this.closeSession(sessionId)),
    )
    if (sessionIds.length > 0) {
      logger.info(
        'QuerySession',
        `数据库查询会话已全部关闭: 连接=${connId}, 数据库=${database}, 数量=${sessionIds.length}`,
      )
    }
  }

  private async performCloseAll(): Promise<void> {
    await this.store.waitForAll()
    await Promise.all(
      this.store.allIds()
        .map(sessionId => this.closeSession(sessionId)),
    )
  }

  private assertConnectionAvailable(connId: string): void {
    if (this.closingAll) {
      throw new Error('应用正在关闭，不能创建新的查询会话')
    }
    if (this.closingConnectionIds.has(connId)) {
      throw new Error('连接正在断开，不能执行查询')
    }
  }

  private assertDatabaseAvailable(connId: string, database: string): void {
    if (this.closingDatabaseKeys.has(this.databaseKey(connId, database))) {
      throw new Error('数据库正在关闭，不能执行查询')
    }
  }

  private databaseKey(connId: string, database: string): string {
    return `${connId}\u0000${database}`
  }

  private validateRequest(request: QueryExecutionRequest): void {
    this.validateIdentifier(request.sessionId, '会话 ID')
    this.validateIdentifier(request.requestId, '请求 ID')
    this.validateIdentifier(request.connId, '连接 ID')
    if (!request.sql.trim()) throw new Error('SQL 内容不能为空')
    if (request.sql.length > 5_000_000) {
      throw new Error('单次执行的 SQL 内容不能超过 5 MB')
    }
  }

  private validateIdentifier(value: string, label: string): void {
    if (!value || value.length > 160 || !/^[A-Za-z0-9_.:-]+$/.test(value)) {
      throw new Error(`${label}格式无效`)
    }
  }
}
