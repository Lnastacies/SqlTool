import type {
  CreateDatabaseBackupRequest,
  DatabaseBackupProgress,
  DatabaseBackupScope,
  DatabaseDumpMode,
  DatabaseModel,
} from '../../types'

export interface BackupDialogForm {
  name: string
  description: string
  mode: DatabaseDumpMode
  scope: DatabaseBackupScope
  compressed: boolean
  includeDropStatements: boolean
  disableForeignKeyChecks: boolean
  stripDefiners: boolean
}

export function initialBackupForm(
  database: string,
  model?: DatabaseModel,
): BackupDialogForm {
  return {
    name: `${database}_完整备份`,
    description: '',
    mode: 'structure-data',
    scope: {
      tables: model?.tables.map(table => table.name) || [],
      views: [...(model?.views || [])],
      functions: [...(model?.functions || [])],
      procedures: [...(model?.procedures || [])],
      events: [...(model?.events || [])],
    },
    compressed: true,
    includeDropStatements: true,
    disableForeignKeyChecks: true,
    stripDefiners: true,
  }
}

export function buildBackupRequest(
  operationId: string,
  form: BackupDialogForm,
): CreateDatabaseBackupRequest {
  const scope = form.mode === 'data'
    ? {
      ...form.scope,
      views: [],
      functions: [],
      procedures: [],
      events: [],
    }
    : form.scope
  return {
    operationId,
    name: form.name.trim(),
    description: form.description.trim(),
    mode: form.mode,
    scope,
    options: {
      compressed: form.compressed,
      includeDropStatements: form.includeDropStatements,
      disableForeignKeyChecks: form.disableForeignKeyChecks,
      stripDefiners: form.stripDefiners,
    },
  }
}

export interface BackupDialogLog extends DatabaseBackupProgress {
  id: string
}
