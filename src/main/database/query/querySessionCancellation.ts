import { logger } from '../../logger'
import type { QuerySessionStore } from './querySessionStore'
import type { QueryCancelResult } from './queryTypes'

export class QuerySessionCancellation {
  constructor(private readonly store: QuerySessionStore) {}

  async cancel(
    sessionId: string,
    requestId: string,
  ): Promise<QueryCancelResult> {
    const session = this.store.get(sessionId)
    const active = session?.activeRequest
    if (!session || !active || active.requestId !== requestId) {
      return {
        sessionId,
        requestId,
        accepted: false,
        message: '当前请求已经结束或不存在',
      }
    }
    if (!session.executor.capabilities.supportsCancel) {
      logger.warn(
        'QuerySession',
        `查询不支持中断: 会话=${sessionId}, 请求=${requestId}, 数据库类型=${session.connData.type}`,
      )
      return {
        sessionId,
        requestId,
        accepted: false,
        message: '当前数据库驱动不支持中断正在运行的语句',
      }
    }
    if (!active.cancelHandler) {
      return {
        sessionId,
        requestId,
        accepted: false,
        message: '查询尚未进入可取消阶段',
      }
    }

    active.cancelRequested = true
    logger.info(
      'QuerySession',
      `请求停止查询: 会话=${sessionId}, 请求=${requestId}`,
    )
    try {
      await active.cancelHandler()
      return {
        sessionId,
        requestId,
        accepted: true,
        message: '停止请求已发送',
      }
    } catch (error) {
      active.cancelRequested = false
      const detail = error instanceof Error ? error.message : String(error)
      logger.error(
        'QuerySession',
        `停止查询失败: 会话=${sessionId}, 请求=${requestId}, 原因=${detail}`,
        error instanceof Error ? error : undefined,
      )
      return {
        sessionId,
        requestId,
        accepted: false,
        message: `停止查询失败: ${detail}`,
      }
    }
  }
}
