import type { ConnectionData } from './adapters'
import type {
  DatabaseBackupObjectDdl,
  DatabaseBackupObjectKind,
} from './databaseBackupTypes'
import { quoteTableIdentifier } from './tableStructureSqlCommon'

export function stripMySqlDefiner(ddl: string): string {
  return ddl.replace(
    /\s+DEFINER\s*=\s*(?:`[^`]*`@`[^`]*`|[^\s]+)/gi,
    '',
  )
}

function objectKeyword(kind: DatabaseBackupObjectKind): string {
  if (kind === 'procedure') return 'PROCEDURE'
  if (kind === 'function') return 'FUNCTION'
  if (kind === 'event') return 'EVENT'
  if (kind === 'trigger') return 'TRIGGER'
  return 'VIEW'
}

export function buildDropObjectSql(
  type: ConnectionData['type'],
  object: Pick<DatabaseBackupObjectDdl, 'name' | 'kind'>,
): string {
  const keyword = objectKeyword(object.kind)
  const name = quoteTableIdentifier(object.name, type)
  if (type === 'SQL Server') {
    return `DROP ${keyword} IF EXISTS [dbo].${name};`
  }
  if (type === 'PostgreSQL' && object.kind === 'view') {
    return `DROP VIEW IF EXISTS "public".${name} CASCADE;`
  }
  if (
    type === 'PostgreSQL'
    && (object.kind === 'function' || object.kind === 'procedure')
  ) {
    // PostgreSQL 重载例程需要参数签名，CREATE OR REPLACE 可直接覆盖，故不盲目删除。
    return ''
  }
  if (type === 'PostgreSQL' && object.kind === 'trigger') {
    // PostgreSQL 删除触发器必须带所属表；选中表随后会被删除并自动移除其触发器。
    return ''
  }
  return `DROP ${keyword} IF EXISTS ${name};`
}

export function formatObjectDdl(
  type: ConnectionData['type'],
  object: DatabaseBackupObjectDdl,
  stripDefiners: boolean,
): string {
  let ddl = object.ddl.trim().replace(/;+\s*$/, '')
  if (!ddl) return ''
  if (type === 'MySQL' && stripDefiners) ddl = stripMySqlDefiner(ddl)

  const containsBody = (
    object.kind === 'function'
    || object.kind === 'procedure'
    || object.kind === 'event'
    || object.kind === 'trigger'
  )
  if (type === 'MySQL' && containsBody) {
    return `DELIMITER $$\n${ddl}$$\nDELIMITER ;\n\n`
  }
  if (type === 'SQLite' && object.kind === 'trigger') {
    // 保持提取后的 SQL 可被 SQLite 客户端直接执行，同时避免内部解析器拆开触发器体。
    return [
      '-- SQLTOOL STATEMENT BEGIN',
      `${ddl};`,
      '-- SQLTOOL STATEMENT END',
      '',
      '',
    ].join('\n')
  }
  if (type === 'SQL Server') {
    // SQL Server 模块 DDL 必须独占批次，保护标记同时避免内部解析器按正文分号拆句。
    return [
      'GO',
      '-- SQLTOOL STATEMENT BEGIN',
      `${ddl};`,
      '-- SQLTOOL STATEMENT END',
      'GO',
      '',
      '',
    ].join('\n')
  }
  return `${ddl};\n\n`
}

export function foreignKeyGuardSql(
  type: ConnectionData['type'],
  tableNames: string[],
): { before: string; after: string } {
  if (type === 'MySQL') {
    return {
      before: 'SET FOREIGN_KEY_CHECKS = 0;\n\n',
      after: '\nSET FOREIGN_KEY_CHECKS = 1;\n',
    }
  }
  if (type === 'SQLite') {
    return {
      before: 'PRAGMA foreign_keys = OFF;\n\n',
      after: '\nPRAGMA foreign_keys = ON;\n',
    }
  }
  if (type === 'PostgreSQL') {
    return {
      before: 'SET session_replication_role = replica;\n\n',
      after: '\nSET session_replication_role = origin;\n',
    }
  }
  const references = tableNames.map(
    name => `[dbo].${quoteTableIdentifier(name, type)}`,
  )
  return {
    before: references
      .map(name => `ALTER TABLE ${name} NOCHECK CONSTRAINT ALL;`)
      .join('\n') + '\n\n',
    after: '\n' + references
      .map(name => `ALTER TABLE ${name} WITH CHECK CHECK CONSTRAINT ALL;`)
      .join('\n') + '\n',
  }
}
