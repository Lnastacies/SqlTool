import {
  quoteSqlString,
  quoteTableIdentifier,
  tableReference,
} from './tableStructureSqlCommon'
import { sqlValue } from './tableTransferValueFormat'
import type {
  DatabaseModel,
  DatabaseModelTable,
} from './databaseManagementTypes'

interface BackupTableDataSql {
  before: string
  after: string
}

function postgresSequenceResetSql(
  database: string,
  table: DatabaseModelTable,
): string {
  const tableRef = tableReference('PostgreSQL', database, table.name)
  const sequenceTable = quoteSqlString(
    `public.${quoteTableIdentifier(table.name, 'PostgreSQL')}`,
  )
  return table.fields
    .filter(field => field.auto_increment)
    .map(field => {
      const column = quoteTableIdentifier(field.name, 'PostgreSQL')
      return [
        'SELECT setval(',
        `  pg_get_serial_sequence(${sequenceTable}, ${quoteSqlString(field.name)}),`,
        `  COALESCE(MAX(${column}), 1),`,
        `  MAX(${column}) IS NOT NULL`,
        `) FROM ${tableRef};`,
      ].join('\n')
    })
    .join('\n')
}

export function backupTableDataSql(
  model: Pick<DatabaseModel, 'name' | 'type'>,
  table: DatabaseModelTable,
): BackupTableDataSql {
  if (
    model.type === 'SQL Server'
    && table.fields.some(field => field.auto_increment)
  ) {
    const tableRef = tableReference(
      'SQL Server',
      model.name,
      table.name,
    )
    return {
      before: `SET IDENTITY_INSERT ${tableRef} ON;\n`,
      after: `SET IDENTITY_INSERT ${tableRef} OFF;\n`,
    }
  }
  if (model.type === 'PostgreSQL') {
    const resetSql = postgresSequenceResetSql(model.name, table)
    return {
      before: '',
      after: resetSql ? `${resetSql}\n` : '',
    }
  }
  return { before: '', after: '' }
}

// 单条 INSERT 合并的最大行数：兼顾服务端 max_allowed_packet 限制与回导解析效率。
// 按常规行宽估算单条语句在数百 KB 量级，远低于各数据库默认包大小上限。
const BACKUP_INSERT_BATCH_ROWS = 300

/**
 * 生成批量 INSERT 语句（多行 VALUES 合并）。
 * 相比逐行 INSERT：文件体积缩减约 70%，写盘次数与回导读取/解析次数同步下降。
 */
export function backupInsertRowsSql(
  databaseType: DatabaseModel['type'],
  tableName: string,
  columns: string[],
  rows: Record<string, unknown>[],
  options?: { overrideSystemValue?: boolean },
): string {
  if (rows.length === 0) return ''
  const quote = (value: string) => quoteTableIdentifier(value, databaseType)
  const table = quote(tableName)
  const columnList = columns.map(quote).join(', ')
  const identityOverride = (
    databaseType === 'PostgreSQL'
    && options?.overrideSystemValue
  )
    ? ' OVERRIDING SYSTEM VALUE'
    : ''
  const statements: string[] = []
  for (let start = 0; start < rows.length; start += BACKUP_INSERT_BATCH_ROWS) {
    const batch = rows.slice(start, start + BACKUP_INSERT_BATCH_ROWS)
    const values = batch.map(row => (
      `(${columns.map(column => sqlValue(databaseType, row[column])).join(', ')})`
    )).join(',\n')
    statements.push(
      `INSERT INTO ${table} (${columnList})${identityOverride} VALUES\n${values};\n`,
    )
  }
  return statements.join('')
}
