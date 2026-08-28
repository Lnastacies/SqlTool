const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

const originalLoad = Module._load
Module._load = function loadWithElectronMock(request, parent, isMain) {
  if (request === 'electron') return { dialog: {} }
  return originalLoad.call(this, request, parent, isMain)
}
const {
  writeDatabaseDumpToPath,
} = require('../dist/main/database/databaseDumpService')
const {
  splitSqlScript,
} = require('../dist/main/database/databaseBackupScriptParser')
Module._load = originalLoad

function field(name, options = {}) {
  return {
    name,
    type: options.type || 'integer',
    not_null: Boolean(options.primary),
    default: null,
    default_expression: '',
    primary: Boolean(options.primary),
    auto_increment: Boolean(options.identity),
    comment: '',
  }
}

async function createDump(tempDirectory, model, objectDdls = []) {
  const outputPath = path.join(tempDirectory, `${model.type}.sql`)
  await writeDatabaseDumpToPath(
    model,
    'structure-data',
    {
      loadPage: async table => ({
        total: 1,
        rows: table.name === 'account'
          ? [{ id: 1, name: '主账号' }]
          : [{ id: 10, account_id: 1 }],
      }),
    },
    outputPath,
    {
      includeDropStatements: true,
      disableForeignKeyChecks: true,
      stripDefiners: true,
      objectDdls,
    },
  )
  return fs.promises.readFile(outputPath, 'utf8')
}

async function testSqlServerGeneration(tempDirectory) {
  const sql = await createDump(tempDirectory, {
    name: 'backup_db',
    type: 'SQL Server',
    tables: [
      {
        name: 'account',
        fields: [
          field('id', { type: 'int', primary: true, identity: true }),
          field('name', { type: 'nvarchar(100)' }),
        ],
        indexes: [],
        foreignKeys: [],
        ddl: '',
      },
      {
        name: 'audit',
        fields: [
          field('id', { type: 'int', primary: true }),
          field('account_id', { type: 'int' }),
        ],
        indexes: [],
        foreignKeys: [{
          name: 'FK_audit_account',
          fields: ['account_id'],
          referenced_table: 'account',
          referenced_fields: ['id'],
        }],
        ddl: '',
      },
    ],
    views: [],
    functions: [],
    procedures: [],
    events: [],
  }, [{
    name: 'audit_update',
    kind: 'trigger',
    ddl: [
      'CREATE TRIGGER [dbo].[audit_update] ON [dbo].[audit]',
      'AFTER UPDATE AS BEGIN',
      "  INSERT INTO [dbo].[audit_log] ([message]) VALUES ('first;step');",
      '  UPDATE [dbo].[stats] SET [count] = [count] + 1;',
      'END',
    ].join('\n'),
  }])

  assert.match(
    sql,
    /SET IDENTITY_INSERT \[backup_db\]\.\[dbo\]\.\[account\] ON;/,
  )
  assert.match(
    sql,
    /SET IDENTITY_INSERT \[backup_db\]\.\[dbo\]\.\[account\] OFF;/,
  )
  const insertPosition = sql.indexOf('INSERT INTO [audit]')
  const constraintPosition = sql.indexOf(
    'ALTER TABLE [backup_db].[dbo].[audit] ADD CONSTRAINT',
  )
  assert.ok(insertPosition > 0 && constraintPosition > insertPosition)

  const trigger = splitSqlScript(sql).find(
    statement => statement.includes('CREATE TRIGGER [dbo].[audit_update]'),
  )
  assert.ok(trigger)
  assert.match(trigger, /first;step/)
  assert.match(trigger, /UPDATE \[dbo\]\.\[stats\]/)
}

async function testPostgreSqlGeneration(tempDirectory) {
  const sql = await createDump(tempDirectory, {
    name: 'backup_db',
    type: 'PostgreSQL',
    tables: [{
      name: 'account',
      fields: [
        field('id', { type: 'integer', primary: true, identity: true }),
        field('name', { type: 'text' }),
      ],
      indexes: [],
      foreignKeys: [],
      ddl: '',
    }],
    views: [],
    functions: [],
    procedures: [],
    events: [],
  })

  assert.match(
    sql,
    /INSERT INTO "account" \("id", "name"\) OVERRIDING SYSTEM VALUE VALUES/,
  )
  assert.match(
    sql,
    /pg_get_serial_sequence\('public\."account"', 'id'\)/,
  )
  assert.ok(
    sql.indexOf('SELECT setval(') > sql.indexOf('INSERT INTO "account"'),
  )
}

async function main() {
  const tempDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'sqltool-backup-sql-'),
  )
  try {
    await testSqlServerGeneration(tempDirectory)
    await testPostgreSqlGeneration(tempDirectory)
    console.log('[数据库备份 SQL 生成测试] 全部通过')
  } finally {
    await fs.promises.rm(tempDirectory, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error('[数据库备份 SQL 生成测试] 失败', error)
  process.exitCode = 1
})
