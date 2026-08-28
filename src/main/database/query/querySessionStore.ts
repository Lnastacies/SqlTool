import { logger } from '../../logger'
import type { ConnectionData } from '../adapters'
import type { ActiveConnection } from '../databaseConnectionRegistry'
import { createQueryExecutor } from './queryExecutorFactory'
import type { QuerySession } from './querySessionTypes'

interface PendingQuerySession {
  connId: string
  database: string
  promise: Promise<QuerySession>
}

export class QuerySessionStore {
  private sessions = new Map<string, QuerySession>()
  private pendingSessions = new Map<string, PendingQuerySession>()
  private sqliteTransactionOwners = new Map<string, string>()

  constructor(
    private readonly resolveBaseConnection: (
      connId: string,
    ) => ActiveConnection | undefined,
  ) {}

  get(sessionId: string): QuerySession | undefined {
    return this.sessions.get(sessionId)
  }

  async resolve(
    sessionId: string,
    connId: string,
    database: string,
    closeExisting: (session: QuerySession) => Promise<void>,
  ): Promise<QuerySession> {
    const existing = this.sessions.get(sessionId)
    if (
      existing
      && existing.connId === connId
      && existing.database === database
    ) {
      return existing
    }
    if (existing) {
      if (existing.activeRequest) {
        throw new Error('查询执行期间不能切换连接或数据库')
      }
      if (existing.transactionState !== 'idle') {
        throw new Error('请先提交或回滚当前事务，再切换连接或数据库')
      }
      await closeExisting(existing)
    }

    const pending = this.pendingSessions.get(sessionId)
    if (pending) {
      if (pending.connId === connId && pending.database === database) {
        return pending.promise
      }
      await pending.promise.catch(() => undefined)
      return this.resolve(
        sessionId,
        connId,
        database,
        closeExisting,
      )
    }

    const promise = this.createSession(sessionId, connId, database)
    this.pendingSessions.set(sessionId, {
      connId,
      database,
      promise,
    })
    try {
      return await promise
    } finally {
      const current = this.pendingSessions.get(sessionId)
      if (current?.promise === promise) {
        this.pendingSessions.delete(sessionId)
      }
    }
  }

  async waitForPending(sessionId: string): Promise<void> {
    await this.pendingSessions.get(sessionId)?.promise.catch(() => undefined)
  }

  async waitForConnection(connId: string): Promise<void> {
    const pending = Array.from(this.pendingSessions.values())
      .filter(item => item.connId === connId)
      .map(item => item.promise.catch(() => undefined))
    await Promise.all(pending)
  }

  async waitForDatabase(connId: string, database: string): Promise<void> {
    const pending = Array.from(this.pendingSessions.values())
      .filter(item => item.connId === connId && item.database === database)
      .map(item => item.promise.catch(() => undefined))
    await Promise.all(pending)
  }

  async waitForAll(): Promise<void> {
    await Promise.all(
      Array.from(this.pendingSessions.values())
        .map(item => item.promise.catch(() => undefined)),
    )
  }

  idsForConnection(connId: string): string[] {
    return Array.from(this.sessions.values())
      .filter(session => session.connId === connId)
      .map(session => session.id)
  }

  idsForDatabase(connId: string, database: string): string[] {
    return Array.from(this.sessions.values())
      .filter(session => (
        session.connId === connId
        && session.database === database
      ))
      .map(session => session.id)
  }

  allIds(): string[] {
    return Array.from(this.sessions.keys())
  }

  remove(session: QuerySession): void {
    if (this.sessions.get(session.id) !== session) return
    if (this.sqliteTransactionOwners.get(session.connId) === session.id) {
      this.sqliteTransactionOwners.delete(session.connId)
    }
    this.sessions.delete(session.id)
  }

  assertSQLiteAccess(session: QuerySession): void {
    if (session.connData.type !== 'SQLite') return
    const owner = this.sqliteTransactionOwners.get(session.connId)
    if (owner && owner !== session.id) {
      throw new Error('另一个查询页签正在占用此 SQLite 连接事务')
    }
  }

  syncSQLiteTransactionOwner(session: QuerySession): void {
    if (session.connData.type !== 'SQLite') return
    if (session.transactionState === 'idle') {
      if (this.sqliteTransactionOwners.get(session.connId) === session.id) {
        this.sqliteTransactionOwners.delete(session.connId)
      }
      return
    }
    this.sqliteTransactionOwners.set(session.connId, session.id)
  }

  persistSQLiteWhenIdle(session: QuerySession): void {
    if (
      session.connData.type === 'SQLite'
      && session.transactionState === 'idle'
      && typeof session.connection.saveToDisk === 'function'
    ) {
      session.connection.saveToDisk()
      logger.debug(
        'QuerySession',
        `SQLite 查询会话已持久化: 会话=${session.id}`,
      )
    }
  }

  private async createSession(
    sessionId: string,
    connId: string,
    database: string,
  ): Promise<QuerySession> {
    const base = this.resolveBaseConnection(connId)
    if (!base) throw new Error('连接不存在或尚未连接')
    const targetDatabase = database || base.connData.database || ''
    const connData: ConnectionData = {
      ...base.connData,
      database: targetDatabase,
      multipleStatements: base.connData.type === 'MySQL',
      rowsAsArray: base.connData.type === 'MySQL',
    }
    const ownsConnection = base.connData.type !== 'SQLite'
    logger.info(
      'QuerySession',
      `创建查询会话: 会话=${sessionId}, 连接=${connId}, 数据库=${targetDatabase || '默认'}, 独立连接=${ownsConnection ? '是' : '否'}`,
    )
    const connection = ownsConnection
      ? await base.adapter.connect(connData)
      : base.connection
    const session: QuerySession = {
      id: sessionId,
      connId,
      database,
      connData,
      adapter: base.adapter,
      connection,
      ownsConnection,
      executor: createQueryExecutor(base.connData.type),
      transactionState: 'idle',
    }
    this.sessions.set(sessionId, session)
    return session
  }
}
