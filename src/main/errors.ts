import { logger } from './logger'

export type ErrorCode = 
  | 'CONNECTION_FAILED'
  | 'CONNECTION_TIMEOUT'
  | 'AUTHENTICATION_ERROR'
  | 'DATABASE_NOT_FOUND'
  | 'TABLE_NOT_FOUND'
  | 'SQL_SYNTAX_ERROR'
  | 'PERMISSION_DENIED'
  | 'POOL_FULL'
  | 'CONNECTION_NOT_FOUND'
  | 'INVALID_CONFIG'
  | 'ENCRYPTION_ERROR'
  | 'FILE_NOT_FOUND'
  | 'IO_ERROR'
  | 'UNKNOWN_ERROR'

export interface ErrorInfo {
  code: ErrorCode
  message: string
  detail?: string
  retryable?: boolean
  suggestion?: string
}

export const ERROR_MESSAGES: Record<ErrorCode, ErrorInfo> = {
  CONNECTION_FAILED: {
    code: 'CONNECTION_FAILED',
    message: '数据库连接失败',
    suggestion: '请检查数据库服务器是否运行，网络连接是否正常'
  },
  CONNECTION_TIMEOUT: {
    code: 'CONNECTION_TIMEOUT',
    message: '连接超时',
    retryable: true,
    suggestion: '请增加连接超时时间，或检查网络状况'
  },
  AUTHENTICATION_ERROR: {
    code: 'AUTHENTICATION_ERROR',
    message: '认证失败',
    suggestion: '请检查用户名和密码是否正确'
  },
  DATABASE_NOT_FOUND: {
    code: 'DATABASE_NOT_FOUND',
    message: '数据库不存在',
    suggestion: '请确认数据库名称是否正确'
  },
  TABLE_NOT_FOUND: {
    code: 'TABLE_NOT_FOUND',
    message: '表不存在',
    suggestion: '请确认表名称是否正确'
  },
  SQL_SYNTAX_ERROR: {
    code: 'SQL_SYNTAX_ERROR',
    message: 'SQL语法错误',
    detail: '请检查SQL语句是否正确',
    suggestion: '请检查SQL语句语法'
  },
  PERMISSION_DENIED: {
    code: 'PERMISSION_DENIED',
    message: '权限不足',
    suggestion: '请确认用户是否有足够的权限'
  },
  POOL_FULL: {
    code: 'POOL_FULL',
    message: '连接池已满',
    retryable: true,
    suggestion: '请等待其他连接释放，或增加最大连接数'
  },
  CONNECTION_NOT_FOUND: {
    code: 'CONNECTION_NOT_FOUND',
    message: '连接不存在',
    suggestion: '请先建立数据库连接'
  },
  INVALID_CONFIG: {
    code: 'INVALID_CONFIG',
    message: '配置无效',
    suggestion: '请检查连接配置是否完整'
  },
  ENCRYPTION_ERROR: {
    code: 'ENCRYPTION_ERROR',
    message: '加密/解密失败',
    suggestion: '请检查密钥配置'
  },
  FILE_NOT_FOUND: {
    code: 'FILE_NOT_FOUND',
    message: '文件不存在',
    suggestion: '请确认文件路径是否正确'
  },
  IO_ERROR: {
    code: 'IO_ERROR',
    message: 'IO操作失败',
    suggestion: '请检查文件权限'
  },
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    message: '未知错误',
    suggestion: '请查看日志获取详细信息'
  }
}

export class SqlToolError extends Error {
  public code: ErrorCode
  public detail?: string
  public retryable: boolean
  public suggestion?: string

  constructor(code: ErrorCode, detail?: string) {
    const errorInfo = ERROR_MESSAGES[code]
    super(errorInfo.message)
    this.name = 'SqlToolError'
    this.code = code
    this.detail = detail || errorInfo.detail
    this.retryable = errorInfo.retryable || false
    this.suggestion = errorInfo.suggestion
  }

  toJSON(): ErrorInfo {
    return {
      code: this.code,
      message: this.message,
      detail: this.detail,
      retryable: this.retryable,
      suggestion: this.suggestion
    }
  }
}

export function createError(code: ErrorCode, detail?: string): SqlToolError {
  return new SqlToolError(code, detail)
}

export function handleError(error: any, context: string): ErrorInfo {
  if (error instanceof SqlToolError) {
    logger.error(context, `错误: ${error.code} - ${error.message}`, error)
    return error.toJSON()
  }

  const errorInfo = analyzeError(error)
  logger.error(context, `错误: ${errorInfo.code} - ${errorInfo.message}, 详情: ${error.message}`, error)
  return errorInfo
}

/**
 * 服务端已关闭该会话（空闲超时被断开、会话被踢下线）时的错误特征。
 * 命中即意味着该连接对象已不可复用，必须整体剔除后重建。
 * 各驱动表现不同：mysql2 为 "can't add new command when connection is closed"，
 * PostgreSQL 为 "Connection terminated unexpectedly"，SQL Server 为 "Connection is closed"。
 */
const CONNECTION_CLOSED_PATTERNS = [
  "can't add new command",
  'connection is in closed state',
  'connection is closed',
  'connection was closed',
  'connection is not open',
  'connection terminated',
  'connection ended',
]

/** 网络层面的连接丢失特征（服务端异常关闭、链路中断），同样不可复用 */
const CONNECTION_BROKEN_PATTERNS = [
  ...CONNECTION_CLOSED_PATTERNS,
  'connection lost',
  'protocol_connection_lost',
  'econnreset',
  'socket hang up',
]

export function isConnectionLostError(error: unknown): boolean {
  const message = (
    error instanceof Error ? error.message : String(error ?? '')
  ).toLowerCase()
  if (!message) return false
  return CONNECTION_BROKEN_PATTERNS.some(pattern => message.includes(pattern))
}

export function analyzeError(error: any): ErrorInfo {
  const message = (error?.message || '').toLowerCase()

  // 网络类错误优先识别，避免落入泛化的 UNKNOWN_ERROR
  if (CONNECTION_CLOSED_PATTERNS.some(pattern => message.includes(pattern))) {
    return {
      ...ERROR_MESSAGES.CONNECTION_FAILED,
      message: '数据库连接已失效',
      detail: error.message,
      retryable: true,
      suggestion: '连接已被服务端断开或超时关闭，请重新建立连接后再操作',
    }
  }

  if (message.includes('econnreset') || message.includes('protocol_connection_lost')
      || message.includes('socket hang up')) {
    return {
      ...ERROR_MESSAGES.CONNECTION_FAILED,
      message: '数据库连接被意外中断',
      detail: error.message,
      retryable: true,
      suggestion: '可能是服务端重启或网络闪断，请检查服务状态后重新建立连接',
    }
  }

  if (message.includes('econnrefused') || message.includes('ehostunreach')
      || message.includes('enetunreach')) {
    return {
      ...ERROR_MESSAGES.CONNECTION_FAILED,
      message: '无法连接到数据库服务器',
      detail: error.message,
      retryable: true,
      suggestion: '请确认主机、端口、服务是否启动以及防火墙是否放行',
    }
  }

  if (message.includes('timeout') || message.includes('time out')) {
    return { ...ERROR_MESSAGES.CONNECTION_TIMEOUT, detail: error.message }
  }

  if (message.includes('authentication') || message.includes('access denied') || 
      message.includes('password') || message.includes('login failed')) {
    return { ...ERROR_MESSAGES.AUTHENTICATION_ERROR, detail: error.message }
  }

  if (message.includes('database') && message.includes('not found')) {
    return { ...ERROR_MESSAGES.DATABASE_NOT_FOUND, detail: error.message }
  }

  if (message.includes('table') && message.includes('not found')) {
    return { ...ERROR_MESSAGES.TABLE_NOT_FOUND, detail: error.message }
  }

  if (message.includes('syntax') || message.includes('sql error')) {
    return { ...ERROR_MESSAGES.SQL_SYNTAX_ERROR, detail: error.message }
  }

  if (message.includes('permission') || message.includes('denied')) {
    return { ...ERROR_MESSAGES.PERMISSION_DENIED, detail: error.message }
  }

  if (message.includes('pool') && message.includes('full')) {
    return { ...ERROR_MESSAGES.POOL_FULL, detail: error.message }
  }

  if (message.includes('file') && message.includes('not found')) {
    return { ...ERROR_MESSAGES.FILE_NOT_FOUND, detail: error.message }
  }

  if (message.includes('enoent') || message.includes('eacces')) {
    return { ...ERROR_MESSAGES.IO_ERROR, detail: error.message }
  }

  if (message.includes('connection') && (message.includes('failed') || message.includes('rejected'))) {
    return { ...ERROR_MESSAGES.CONNECTION_FAILED, detail: error.message }
  }

  return { ...ERROR_MESSAGES.UNKNOWN_ERROR, detail: error.message }
}

export function wrapErrorHandler<T>(fn: (...args: any[]) => Promise<T>, context: string): (...args: any[]) => Promise<T> {
  return async (...args: any[]): Promise<T> => {
    try {
      return await fn(...args)
    } catch (error) {
      const errorInfo = handleError(error, context)
      throw new SqlToolError(errorInfo.code, errorInfo.detail)
    }
  }
}
