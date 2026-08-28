import {
  quoteSqlString,
  quoteTableIdentifier,
  tableReference,
} from './tableStructureSqlCommon'
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
