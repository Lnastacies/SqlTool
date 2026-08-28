import type { DatabaseBackupRecord } from '../../types'

export type DatabaseBackupTarget = Pick<
  DatabaseBackupRecord,
  'id' | 'name' | 'fileName'
>

export interface DatabaseBackupVerification {
  status: 'checking' | 'valid' | 'invalid'
  message: string
  checkedAt?: string
}

export function backupResponseError(
  response: { error?: { message?: string; detail?: string } },
  fallback: string,
): Error {
  return new Error(response.error?.detail || response.error?.message || fallback)
}

export function newBackupOperationId(prefix: string): string {
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${id}`
}

export function writeBackupActionLog(
  level: 'info' | 'warn' | 'error',
  message: string,
): void {
  void window.logger.write(level, 'DatabaseBackup', message)
}
