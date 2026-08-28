import { ConnectionData, DatabaseAdapter, getAdapter } from './adapters'
import { logger } from '../logger'

export interface PoolConfig {
  maxConnections: number
  minIdleConnections: number
  idleTimeout: number
  connectionTimeout: number
}

export interface PoolConnection {
  connection: any
  adapter: DatabaseAdapter
  connData: ConnectionData
  lastUsed: number
  inUse: boolean
}

export class ConnectionPool {
  private pools: Map<string, Map<string, PoolConnection>> = new Map()
  private config: PoolConfig

  constructor(config?: Partial<PoolConfig>) {
    this.config = {
      maxConnections: config?.maxConnections || 10,
      minIdleConnections: config?.minIdleConnections || 2,
      idleTimeout: config?.idleTimeout || 300000,
      connectionTimeout: config?.connectionTimeout || 30000
    }

    this.startIdleCleanup()
  }

  private startIdleCleanup(): void {
    setInterval(() => {
      void this.cleanupIdleConnections()
    }, 60000)
  }

  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now()
    let cleanedCount = 0

    for (const [connId, pool] of this.pools.entries()) {
      for (const [key, poolConn] of pool.entries()) {
        if (!poolConn.inUse && now - poolConn.lastUsed > this.config.idleTimeout) {
          try {
            await poolConn.adapter.close(poolConn.connection)
            pool.delete(key)
            cleanedCount++
            logger.debug('ConnectionPool', `回收空闲连接: ${connId}, key: ${key}`)
          } catch (e) {
            logger.warn('ConnectionPool', `回收连接失败: ${(e as Error).message}`)
          }
        }
      }

      if (pool.size === 0) {
        this.pools.delete(connId)
      }
    }

    if (cleanedCount > 0) {
      logger.info('ConnectionPool', `空闲连接清理完成，共回收 ${cleanedCount} 个连接`)
    }
  }

  async getConnection(connData: ConnectionData): Promise<{ connection: any; adapter: DatabaseAdapter; release: () => void }> {
    const pool = this.getOrCreatePool(connData.id)

    const idleConn = this.findIdleConnection(pool)
    if (idleConn) {
      idleConn.inUse = true
      idleConn.lastUsed = Date.now()
      logger.debug('ConnectionPool', `复用连接: ${connData.id}, 当前池大小: ${pool.size}`)
      return {
        connection: idleConn.connection,
        adapter: idleConn.adapter,
        release: () => this.releaseConnection(connData.id, idleConn)
      }
    }

    if (pool.size >= this.config.maxConnections) {
      throw new Error(`连接池已满，最大连接数: ${this.config.maxConnections}`)
    }

    const newConn = await this.createConnection(connData)
    pool.set(`${Date.now()}`, {
      ...newConn,
      connData,
      inUse: true,
      lastUsed: Date.now()
    })

    logger.info('ConnectionPool', `创建新连接: ${connData.id}, 当前池大小: ${pool.size}`)
    return {
      connection: newConn.connection,
      adapter: newConn.adapter,
      release: () => this.releaseConnection(connData.id, pool.get(`${Date.now()}`)!)
    }
  }

  private getOrCreatePool(connId: string): Map<string, PoolConnection> {
    if (!this.pools.has(connId)) {
      this.pools.set(connId, new Map())
    }
    return this.pools.get(connId)!
  }

  private findIdleConnection(pool: Map<string, PoolConnection>): PoolConnection | undefined {
    for (const conn of pool.values()) {
      if (!conn.inUse) {
        return conn
      }
    }
    return undefined
  }

  private async createConnection(connData: ConnectionData): Promise<{ connection: any; adapter: DatabaseAdapter }> {
    const adapter = getAdapter(connData.type)
    const connection = await adapter.connect(connData)
    return { connection, adapter }
  }

  private releaseConnection(connId: string, poolConn: PoolConnection): void {
    if (!poolConn) return
    
    poolConn.inUse = false
    poolConn.lastUsed = Date.now()
    logger.debug('ConnectionPool', `释放连接: ${connId}`)

    const pool = this.pools.get(connId)
    if (!pool || pool.size === 0) {
      this.pools.delete(connId)
    }
  }

  async closeConnection(connId: string): Promise<void> {
    const pool = this.pools.get(connId)
    if (!pool) return

    for (const [key, poolConn] of pool.entries()) {
      try {
        await poolConn.adapter.close(poolConn.connection)
        pool.delete(key)
      } catch (e) {
        logger.warn('ConnectionPool', `关闭连接失败: ${(e as Error).message}`)
      }
    }

    this.pools.delete(connId)
    logger.info('ConnectionPool', `关闭连接池: ${connId}`)
  }

  async closeAllConnections(): Promise<void> {
    for (const [connId, pool] of this.pools.entries()) {
      for (const [key, poolConn] of pool.entries()) {
        try {
          await poolConn.adapter.close(poolConn.connection)
        } catch (e) {
          logger.warn('ConnectionPool', `关闭连接失败: ${(e as Error).message}`)
        }
      }
      pool.clear()
    }
    this.pools.clear()
    logger.info('ConnectionPool', '所有连接池已关闭')
  }

  getPoolSize(connId: string): number {
    const pool = this.pools.get(connId)
    return pool ? pool.size : 0
  }

  getTotalConnections(): number {
    let total = 0
    for (const pool of this.pools.values()) {
      total += pool.size
    }
    return total
  }

  getStats(): { connId: string; size: number; active: number }[] {
    const stats: { connId: string; size: number; active: number }[] = []
    for (const [connId, pool] of this.pools.entries()) {
      const active = Array.from(pool.values()).filter(c => c.inUse).length
      stats.push({ connId, size: pool.size, active })
    }
    return stats
  }
}

export const connectionPool = new ConnectionPool()
