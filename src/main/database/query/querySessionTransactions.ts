import { logger } from '../../logger'
import type { QuerySession } from './querySessionTypes'
import type { QuerySessionStore } from './querySessionStore'
import type {
  QuerySessionActionResult,
  QueryTransactionState,
} from './queryTypes'
import type { QueryTransactionAction } from './querySessionTypes'

export class QuerySessionTransactions {
  constructor(private readonly store: QuerySessionStore) {}

  async run(
    session: QuerySession,
    action: QueryTransactionAction,
  ): Promise<QuerySessionActionResult> {
    this.store.assertSQLiteAccess(session)
    if (session.activeRequest) {
      throw new Error('查询执行期间不能切换事务状态')
    }
    if (!session.executor.capabilities.supportsTransactions) {
      throw new Error('当前数据库驱动不支持事务控制')
    }
    this.validateState(session.transactionState, action)

    const previousState = session.transactionState
    logger.info(
      'QuerySession',
      `执行事务操作: 会话=${session.id}, 操作=${action}, 当前状态=${previousState}`,
    )
    try {
      await session.executor[action](session.connection)
    } catch (error) {
      if (action !== 'begin' && previousState !== 'idle') {
        session.transactionState = 'failed'
        this.store.syncSQLiteTransactionOwner(session)
      }
      const detail = error instanceof Error ? error.message : String(error)
      logger.error(
        'QuerySession',
        `事务操作失败: 会话=${session.id}, 操作=${action}, 状态=${session.transactionState}, 原因=${detail}`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }

    session.transactionState = action === 'begin' ? 'active' : 'idle'
    this.store.syncSQLiteTransactionOwner(session)
    if (action === 'commit') this.store.persistSQLiteWhenIdle(session)
    const labels: Record<QueryTransactionAction, string> = {
      begin: '事务已开始',
      commit: '事务已提交',
      rollback: '事务已回滚',
    }
    logger.info(
      'QuerySession',
      `事务操作完成: 会话=${session.id}, 操作=${action}, 状态=${session.transactionState}`,
    )
    return {
      sessionId: session.id,
      transactionState: session.transactionState,
      capabilities: session.executor.capabilities,
      message: labels[action],
    }
  }

  private validateState(
    state: QueryTransactionState,
    action: QueryTransactionAction,
  ): void {
    if (action === 'begin' && state !== 'idle') {
      throw new Error('当前查询会话已经处于事务中')
    }
    if (action === 'commit' && state === 'failed') {
      throw new Error('当前事务已失败，请执行回滚')
    }
    if ((action === 'commit' || action === 'rollback') && state === 'idle') {
      throw new Error('当前查询会话没有活动事务')
    }
  }
}
