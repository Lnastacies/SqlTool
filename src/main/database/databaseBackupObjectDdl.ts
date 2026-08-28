import { logger } from '../logger'
import type { ActiveConnection } from './databaseConnectionRegistry'
import type {
  DatabaseBackupObjectDdl,
  DatabaseBackupObjectKind,
  DatabaseBackupScope,
} from './databaseBackupTypes'
import {
  backupStringLiteral,
  queryBackupRows,
  quoteBackupIdentifier,
  readBackupRowValue,
} from './databaseBackupObjectDdlHelpers'

async function loadMySqlDdl(
  active: ActiveConnection,
  database: string,
  kind: DatabaseBackupObjectKind,
  names: string[],
): Promise<DatabaseBackupObjectDdl[]> {
  const databaseRef = quoteBackupIdentifier(database, '`')
  const keyword = kind === 'view'
    ? 'VIEW'
    : kind === 'procedure'
      ? 'PROCEDURE'
      : kind === 'function'
        ? 'FUNCTION'
        : kind === 'event'
          ? 'EVENT'
          : 'TRIGGER'
  const ddlKey = `Create ${keyword[0]}${keyword.slice(1).toLowerCase()}`
  const objects: DatabaseBackupObjectDdl[] = []
  for (const name of names) {
    const objectRef = quoteBackupIdentifier(name, '`')
    const rows = await queryBackupRows(
      active,
      database,
      `SHOW CREATE ${keyword} ${databaseRef}.${objectRef}`,
    )
    const ddl = rows[0]
      ? readBackupRowValue(rows[0], [ddlKey, `Create ${keyword}`])
      : ''
    if (ddl) objects.push({ name, kind, ddl })
  }
  return objects
}

async function loadPostgresDdl(
  active: ActiveConnection,
  database: string,
  kind: DatabaseBackupObjectKind,
  names: string[],
): Promise<DatabaseBackupObjectDdl[]> {
  const objects: DatabaseBackupObjectDdl[] = []
  for (const name of names) {
    if (kind === 'view') {
      const rows = await queryBackupRows(active, database, `
        SELECT pg_get_viewdef(c.oid, true) AS definition
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1
      `, [name])
      const definition = rows[0]
        ? readBackupRowValue(rows[0], ['definition'])
        : ''
      if (definition) {
        objects.push({
          name,
          kind,
          ddl: `CREATE OR REPLACE VIEW "public".${quoteBackupIdentifier(name, '"')} AS\n${definition}`,
        })
      }
      continue
    }
    const prokind = kind === 'procedure' ? 'p' : 'f'
    const rows = await queryBackupRows(active, database, `
      SELECT pg_get_functiondef(p.oid) AS ddl
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $1 AND p.prokind = $2
      ORDER BY p.oid
    `, [name, prokind])
    rows.forEach(row => {
      const ddl = readBackupRowValue(row, ['ddl'])
      if (ddl) objects.push({ name, kind, ddl })
    })
  }
  return objects
}

async function loadSqlServerDdl(
  active: ActiveConnection,
  database: string,
  kind: DatabaseBackupObjectKind,
  names: string[],
): Promise<DatabaseBackupObjectDdl[]> {
  const databaseRef = quoteBackupIdentifier(database, '[')
  const objects: DatabaseBackupObjectDdl[] = []
  for (const name of names) {
    const qualified = `[dbo].${quoteBackupIdentifier(name, '[')}`
    const rows = await queryBackupRows(
      active,
      database,
      `USE ${databaseRef}; SELECT OBJECT_DEFINITION(OBJECT_ID(N${backupStringLiteral(qualified)})) AS ddl`,
    )
    const ddl = rows[0] ? readBackupRowValue(rows[0], ['ddl']) : ''
    if (ddl) objects.push({ name, kind, ddl })
  }
  return objects
}

async function loadSqliteDdl(
  active: ActiveConnection,
  database: string,
  kind: DatabaseBackupObjectKind,
  names: string[],
): Promise<DatabaseBackupObjectDdl[]> {
  const objects: DatabaseBackupObjectDdl[] = []
  for (const name of names) {
    const rows = await queryBackupRows(
      active,
      database,
      'SELECT sql AS ddl FROM sqlite_master WHERE name = ?',
      [name],
    )
    const ddl = rows[0] ? readBackupRowValue(rows[0], ['ddl']) : ''
    if (ddl) objects.push({ name, kind, ddl })
  }
  return objects
}

async function loadTableTriggers(
  active: ActiveConnection,
  database: string,
  tables: string[],
): Promise<DatabaseBackupObjectDdl[]> {
  if (tables.length === 0 || active.connData.type === 'SQLite') return []
  if (active.connData.type === 'MySQL') {
    const placeholders = tables.map(() => '?').join(', ')
    const rows = await queryBackupRows(active, database, `
      SELECT TRIGGER_NAME AS name
      FROM information_schema.TRIGGERS
      WHERE TRIGGER_SCHEMA = ? AND EVENT_OBJECT_TABLE IN (${placeholders})
      ORDER BY TRIGGER_NAME
    `, [database, ...tables])
    const names = rows
      .map(row => readBackupRowValue(row, ['name']))
      .filter(Boolean)
    return loadMySqlDdl(active, database, 'trigger', names)
  }
  if (active.connData.type === 'PostgreSQL') {
    const rows = await queryBackupRows(active, database, `
      SELECT t.tgname AS name, pg_get_triggerdef(t.oid, true) AS ddl
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal
        AND n.nspname = 'public'
        AND c.relname = ANY($1::text[])
      ORDER BY t.tgname
    `, [tables])
    return rows.flatMap(row => {
      const name = readBackupRowValue(row, ['name'])
      const ddl = readBackupRowValue(row, ['ddl'])
      return name && ddl ? [{ name, kind: 'trigger' as const, ddl }] : []
    })
  }

  const databaseRef = quoteBackupIdentifier(database, '[')
  const tableLiterals = tables.map(backupStringLiteral).join(', ')
  const rows = await queryBackupRows(active, database, `
    USE ${databaseRef};
    SELECT tr.name AS name, OBJECT_DEFINITION(tr.object_id) AS ddl
    FROM sys.triggers tr
    JOIN sys.tables tb ON tb.object_id = tr.parent_id
    JOIN sys.schemas sc ON sc.schema_id = tb.schema_id
    WHERE tr.is_ms_shipped = 0
      AND sc.name = N'dbo'
      AND tb.name IN (${tableLiterals})
    ORDER BY tr.name
  `)
  return rows.flatMap(row => {
    const name = readBackupRowValue(row, ['name'])
    const ddl = readBackupRowValue(row, ['ddl'])
    return name && ddl ? [{ name, kind: 'trigger' as const, ddl }] : []
  })
}

export async function loadDatabaseBackupObjectDdls(
  active: ActiveConnection,
  database: string,
  scope: DatabaseBackupScope,
): Promise<DatabaseBackupObjectDdl[]> {
  const selections: Array<[DatabaseBackupObjectKind, string[]]> = [
    ['function', scope.functions],
    ['procedure', scope.procedures],
    ['view', scope.views],
    [active.connData.type === 'SQLite' ? 'trigger' : 'event', scope.events],
  ]
  const objects: DatabaseBackupObjectDdl[] = []
  for (const [kind, names] of selections) {
    if (names.length === 0) continue
    const loaded = active.connData.type === 'MySQL'
      ? await loadMySqlDdl(active, database, kind, names)
      : active.connData.type === 'PostgreSQL'
        ? await loadPostgresDdl(active, database, kind, names)
        : active.connData.type === 'SQL Server'
          ? await loadSqlServerDdl(active, database, kind, names)
          : await loadSqliteDdl(active, database, kind, names)
    const loadedNames = new Set(loaded.map(item => item.name))
    const missing = names.filter(name => !loadedNames.has(name))
    if (missing.length > 0) {
      throw new Error(
        `无法读取备份对象定义: 类型=${kind}, 对象=${missing.join(', ')}`,
      )
    }
    objects.push(...loaded)
  }
  objects.push(...await loadTableTriggers(active, database, scope.tables))
  const uniqueObjects = Array.from(new Map(objects.map(object => [
    `${object.kind}\u0000${object.name}\u0000${object.ddl}`,
    object,
  ])).values())
  logger.info(
    'DatabaseBackup',
    `附属对象 DDL 读取完成: 数据库=${database}, 对象=${uniqueObjects.length}`,
  )
  return uniqueObjects
}
