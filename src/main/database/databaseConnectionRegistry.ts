import { logger } from '../logger'
import type { ConnectionData, DatabaseAdapter } from './adapters'

export interface ActiveConnection {
  adapter: DatabaseAdapter
  connection: any
  connData: ConnectionData
}

/**
 * PostgreSQL 不支持在现有会话中切换数据库。
 * 这里按“连接 ID + 数据库名”缓存独立会话，让对象浏览、查询和数据编辑共享同一上下文。
 */
export class DatabaseConnectionRegistry {
  private contexts = new Map<string, ActiveConnection>()
  private pending = new Map<string, Promise<ActiveConnection>>()
  private versions = new Map<string, number>()

  async resolve(
    connId: string,
    database: string,
    base: ActiveConnection,
  ): Promise<ActiveConnection> {
    if (base.connData.type !== 'PostgreSQL') return base

    const targetDatabase = database || base.connData.database || 'postgres'
    const currentDatabase = base.connData.database || 'postgres'
    if (targetDatabase === currentDatabase) return base

    const key = this.buildKey(connId, targetDatabase)
    const cached = this.contexts.get(key)
    if (cached) {
      logger.debug(
        'DatabaseConnectionRegistry',
        `复用 PostgreSQL 数据库会话: 连接=${connId}, 数据库=${targetDatabase}`,
      )
      return cached
    }

    const pendingContext = this.pending.get(key)
    if (pendingContext) return pendingContext

    const version = this.versions.get(connId) || 0
    const contextPromise = this.createContext(
      connId,
      targetDatabase,
      base,
      version,
    )
    this.pending.set(key, contextPromise)
    try {
      return await contextPromise
    } finally {
      this.pending.delete(key)
    }
  }

  async close(connId: string): Promise<void> {
    this.versions.set(connId, (this.versions.get(connId) || 0) + 1)
    const prefix = `${connId}\u0000`
    let closedCount = 0
    for (const [key, context] of this.contexts.entries()) {
      if (!key.startsWith(prefix)) continue
      this.contexts.delete(key)
      try {
        await context.adapter.close(context.connection)
        closedCount += 1
      } catch (error) {
        logger.error(
          'DatabaseConnectionRegistry',
          `关闭 PostgreSQL 数据库会话失败: 连接=${connId}, 数据库=${context.connData.database}`,
          error instanceof Error ? error : undefined,
        )
      }
    }
    if (closedCount > 0) {
      logger.info(
        'DatabaseConnectionRegistry',
        `已关闭 PostgreSQL 数据库会话: 连接=${connId}, 数量=${closedCount}`,
      )
    }
  }

  async closeDatabase(connId: string, database: string): Promise<void> {
    const key = this.buildKey(connId, database)
    const pending = this.pending.get(key)
    if (pending) {
      await pending.catch(() => undefined)
    }
    const context = this.contexts.get(key)
    if (!context) return

    this.contexts.delete(key)
    await context.adapter.close(context.connection)
    logger.info(
      'DatabaseConnectionRegistry',
      `已关闭 PostgreSQL 数据库会话: 连接=${connId}, 数据库=${database}`,
    )
  }

  private async createContext(
    connId: string,
    database: string,
    base: ActiveConnection,
    version: number,
  ): Promise<ActiveConnection> {
    const startedAt = Date.now()
    logger.info(
      'DatabaseConnectionRegistry',
      `创建 PostgreSQL 数据库会话: 连接=${connId}, 数据库=${database}`,
    )
    try {
      const connection = await base.adapter.connect({
        ...base.connData,
        database,
      })
      const context: ActiveConnection = {
        adapter: base.adapter,
        connection,
        connData: { ...base.connData, database },
      }

      // 连接建立期间若用户断开或重连，立即释放过期会话，避免连接泄漏。
      if ((this.versions.get(connId) || 0) !== version) {
        await context.adapter.close(context.connection)
        throw new Error('连接状态已变化，已取消数据库会话创建')
      }

      this.contexts.set(this.buildKey(connId, database), context)
      logger.info(
        'DatabaseConnectionRegistry',
        `PostgreSQL 数据库会话创建成功: 连接=${connId}, 数据库=${database}, 耗时=${Date.now() - startedAt}ms`,
      )
      return context
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(
        'DatabaseConnectionRegistry',
        `PostgreSQL 数据库会话创建失败: 连接=${connId}, 数据库=${database}, 错误=${message}`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  private buildKey(connId: string, database: string): string {
    return `${connId}\u0000${database}`
  }
}
