const DATABASE_DISCONNECTION_MARKERS = [
  'econnreset',
  'econnrefused',
  'protocol_connection_lost',
  'connection is in closed state',
  'connection lost',
  'socket hang up',
]

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function describeDatabaseBackupFailure(error: unknown): string {
  const originalMessage = readErrorMessage(error)
  const normalizedMessage = originalMessage.toLowerCase()
  const disconnected = DATABASE_DISCONNECTION_MARKERS.some(
    marker => normalizedMessage.includes(marker),
  )
  if (!disconnected) return originalMessage

  return [
    '数据库服务连接已中断，服务端可能已退出或重启',
    '请先检查数据库服务日志并重新连接后再试',
    `原始错误: ${originalMessage}`,
  ].join('；')
}

export function createDatabaseBackupFailure(
  error: unknown,
  detail: string,
): Error {
  if (error instanceof Error && error.message === detail) return error
  return new Error(detail)
}
