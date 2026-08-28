import { logger } from '../../logger'
import { errorMessage } from './queryResultUtils'
import type {
  ActiveQueryRequest,
  QuerySession,
} from './querySessionTypes'
import type { QuerySessionStore } from './querySessionStore'
import { inferTransactionState } from './sqlTransactionState'
import type {
  QueryExecutionRequest,
  QueryExecutionResult,
  QueryTransactionState,
} from './queryTypes'

export class QuerySessionExecution {
  constructor(private readonly store: QuerySessionStore) {}

  async execute(
    session: QuerySession,
    request: QueryExecutionRequest,
  ): Promise<QueryExecutionResult> {
    this.store.assertSQLiteAccess(session)
    if (session.activeRequest) {
      throw new Error('当前查询页签已有正在执行的请求')
    }

    const startedAt = Date.now()
    const activeRequest: ActiveQueryRequest = {
      requestId: request.requestId,
      cancelRequested: false,
      completion: Promise.resolve(),
    }
    session.activeRequest = activeRequest
    const proposedState = inferTransactionState(
      request.sql,
      session.transactionState,
    )
    logger.info(
      'QuerySession',
      `开始执行查询: 会话=${session.id}, 请求=${request.requestId}, 连接=${session.connId}, 数据库=${session.database || '默认'}, SQL长度=${request.sql.length}`,
    )

    try {
      const execution = session.executor.execute(
        session.connection,
        request.sql,
        session.connData,
        {
          requestId: request.requestId,
          setCancelHandler: handler => {
            activeRequest.cancelHandler = handler
          },
          isCancelRequested: () => activeRequest.cancelRequested,
        },
      )
      activeRequest.completion = execution.then(
        () => undefined,
        () => undefined,
      )
      const output = await execution
      session.transactionState = proposedState
      this.store.syncSQLiteTransactionOwner(session)
      this.store.persistSQLiteWhenIdle(session)
      const executionTime = (Date.now() - startedAt) / 1000
      logger.info(
        'QuerySession',
        `查询执行完成: 会话=${session.id}, 请求=${request.requestId}, 结果集=${output.resultSets.length}, 影响行=${output.affectedRows}, 耗时=${executionTime.toFixed(3)}s, 事务=${session.transactionState}`,
      )
      return {
        sessionId: session.id,
        requestId: request.requestId,
        success: true,
        cancelled: false,
        resultSets: output.resultSets,
        messages: output.messages,
        affectedRows: output.affectedRows,
        executionTime,
        transactionState: session.transactionState,
        capabilities: session.executor.capabilities,
      }
    } catch (error) {
      return this.buildFailure(
        session,
        request.requestId,
        startedAt,
        proposedState,
        activeRequest.cancelRequested,
        error,
      )
    } finally {
      if (session.activeRequest === activeRequest) {
        session.activeRequest = undefined
      }
    }
  }

  private buildFailure(
    session: QuerySession,
    requestId: string,
    startedAt: number,
    proposedState: QueryTransactionState,
    cancelRequested: boolean,
    error: unknown,
  ): QueryExecutionResult {
    const detail = error instanceof Error ? error.message : String(error)
    const cancelled = cancelRequested || this.isCancellationError(error)
    session.transactionState = this.failureTransactionState(
      session,
      proposedState,
    )
    this.store.syncSQLiteTransactionOwner(session)
    const executionTime = (Date.now() - startedAt) / 1000
    logger.error(
      'QuerySession',
      `${cancelled ? '查询已取消' : '查询执行失败'}: 会话=${session.id}, 请求=${requestId}, 耗时=${executionTime.toFixed(3)}s, 事务=${session.transactionState}, 原因=${detail}`,
      error instanceof Error ? error : undefined,
    )
    return {
      sessionId: session.id,
      requestId,
      success: false,
      cancelled,
      resultSets: [],
      messages: [
        errorMessage(cancelled ? '查询已由用户停止' : `执行失败: ${detail}`),
      ],
      affectedRows: 0,
      executionTime,
      transactionState: session.transactionState,
      capabilities: session.executor.capabilities,
    }
  }

  private failureTransactionState(
    session: QuerySession,
    proposedState: QueryTransactionState,
  ): QueryTransactionState {
    if (
      session.connData.type === 'PostgreSQL'
      && (
        session.transactionState !== 'idle'
        || proposedState !== 'idle'
      )
    ) {
      return 'failed'
    }
    return proposedState
  }

  private isCancellationError(error: unknown): boolean {
    const code = String((error as any)?.code || '').toUpperCase()
    const message = error instanceof Error ? error.message : String(error)
    return code === 'ECANCEL'
      || code === '57014'
      || /cancel|取消|interrupt/i.test(message)
  }
}
