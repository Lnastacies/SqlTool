const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

const originalLoad = Module._load
Module._load = function loadWithElectronMock(request, parent, isMain) {
  if (request === 'electron') {
    return {
      dialog: {},
      shell: {},
    }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const {
  createDatabaseBackup,
} = require('../dist/main/database/databaseBackupCreationService')
const {
  executeDatabaseBackupRestore,
} = require('../dist/main/database/databaseBackupRestoreExecutor')
const {
  DatabaseBackupStore,
} = require('../dist/main/database/databaseBackupStore')
const {
  backupTimestampToken,
} = require('../dist/main/database/databaseBackupFileName')
Module._load = originalLoad

function sqliteActive(execute) {
  return {
    adapter: { executeSQL: execute },
    connection: {},
    connData: { type: 'SQLite' },
  }
}

async function testCreateVerifyAndDelete(tempDirectory) {
  const store = new DatabaseBackupStore(path.join(tempDirectory, 'backups'))
  const progress = []
  const result = await createDatabaseBackup(store, {
    connectionId: 'sqlite-local',
    database: 'main',
    active: sqliteActive(async () => ({
      success: true,
      message: 'ok',
    })),
    model: {
      name: 'main',
      type: 'SQLite',
      tables: [{
        name: 'account',
        fields: [
          { name: 'id', type: 'INTEGER', primary: true },
          { name: 'name', type: 'TEXT', primary: false },
        ],
        foreignKeys: [],
        ddl: 'CREATE TABLE "account" ("id" INTEGER PRIMARY KEY, "name" TEXT)',
      }],
      views: [],
      functions: [],
      procedures: [],
      events: [],
    },
    request: {
      operationId: 'create-test',
      name: '完整备份',
      description: '自动化测试',
      mode: 'structure-data',
      scope: {
        tables: ['account'],
        views: [],
        functions: [],
        procedures: [],
        events: [],
      },
      options: {
        compressed: true,
        includeDropStatements: true,
        disableForeignKeyChecks: true,
        stripDefiners: true,
      },
    },
    openTable: async () => {
      const rows = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: '中文数据' },
      ]
      let sent = false
      return {
        total: rows.length,
        readNext: async () => {
          if (sent) return []
          sent = true
          return rows
        },
      }
    },
  }, event => progress.push(event))

  assert.equal(result.record.compressed, true)
  assert.equal(result.record.tableCount, 1)
  assert.equal(result.record.rowCount, 2)
  const timestamp = backupTimestampToken(new Date(result.record.createdAt))
  assert.match(
    result.record.fileName,
    new RegExp(`^完整备份_${timestamp}_[0-9a-f]{8}\\.sql\\.gz$`),
  )
  assert.ok(result.record.checksumSha256.length === 64)
  assert.equal(progress.at(-1).percent, 100)

  const records = await store.list('sqlite-local', 'main')
  assert.equal(records.length, 1)
  await store.verify(records[0])
  const sql = await store.readSql(records[0].filePath)
  assert.match(sql, /CREATE TABLE "account"/)
  assert.match(sql, /中文数据/)

  const originalPath = records[0].filePath
  const renamed = await store.rename(records[0], '重命名备份')
  assert.equal(renamed.id, records[0].id)
  assert.equal(renamed.name, '重命名备份')
  assert.match(
    renamed.fileName,
    new RegExp(`^重命名备份_${timestamp}_[0-9a-f]{8}\\.sql\\.gz$`),
  )
  assert.equal(fs.existsSync(originalPath), false)
  assert.equal(fs.existsSync(`${renamed.filePath}.backup.json`), true)
  assert.equal((await store.list('sqlite-local', 'main'))[0].name, '重命名备份')
  await store.verify(renamed)

  await fs.promises.appendFile(renamed.filePath, 'tampered')
  await assert.rejects(
    () => store.verify(renamed),
    /完整性校验失败/,
  )
  await store.delete(renamed)
  assert.equal((await store.list('sqlite-local', 'main')).length, 0)
}

async function testRestoreTransactions() {
  const successCalls = []
  const success = await executeDatabaseBackupRestore(
    sqliteActive(async (_connection, _database, sql) => {
      successCalls.push(sql.trim())
      return { success: true, message: 'ok' }
    }),
    'main',
    'success.sql',
    [
      '-- 类型: SQLite',
      'PRAGMA foreign_keys = OFF;',
      'CREATE TABLE "sample" ("id" INTEGER);',
      'INSERT INTO "sample" VALUES (1);',
      'PRAGMA foreign_keys = ON;',
    ].join('\n'),
    {
      operationId: 'restore-success',
      continueOnError: false,
      useTransaction: true,
    },
    () => undefined,
  )
  assert.equal(success.completedStatements, 2)
  assert.ok(successCalls.includes('BEGIN TRANSACTION'))
  assert.ok(successCalls.includes('COMMIT'))
  assert.equal(successCalls.at(-1), 'PRAGMA foreign_keys = ON')
  assert.equal(
    successCalls.filter(sql => /^PRAGMA foreign_keys/.test(sql)).length,
    2,
  )

  const failureCalls = []
  await assert.rejects(
    () => executeDatabaseBackupRestore(
      sqliteActive(async (_connection, _database, sql) => {
        failureCalls.push(sql.trim())
        return /BROKEN/.test(sql)
          ? { success: false, message: '模拟执行失败' }
          : { success: true, message: 'ok' }
      }),
      'main',
      'failure.sql',
      '-- 类型: SQLite\nCREATE TABLE test(id INTEGER);\nBROKEN SQL;',
      {
        operationId: 'restore-failure',
        continueOnError: false,
        useTransaction: true,
      },
      () => undefined,
    ),
    /模拟执行失败/,
  )
  assert.ok(failureCalls.includes('ROLLBACK'))
  assert.ok(!failureCalls.includes('COMMIT'))
  assert.equal(failureCalls.at(-1), 'PRAGMA foreign_keys = ON')

  const continuedCalls = []
  const continued = await executeDatabaseBackupRestore(
    sqliteActive(async (_connection, _database, sql) => {
      continuedCalls.push(sql.trim())
      return /BROKEN/.test(sql)
        ? { success: false, message: '模拟执行失败' }
        : { success: true, message: 'ok' }
    }),
    'main',
    'continue.sql',
    [
      '-- 类型: SQLite',
      'CREATE TABLE first_table(id INTEGER);',
      'BROKEN SQL;',
      'CREATE TABLE last_table(id INTEGER);',
    ].join('\n'),
    {
      operationId: 'restore-continue',
      continueOnError: true,
      useTransaction: true,
    },
    () => undefined,
  )
  assert.equal(continued.completedStatements, 2)
  assert.equal(continued.failedStatements, 1)
  assert.ok(continuedCalls.includes('CREATE TABLE last_table(id INTEGER)'))
  assert.ok(!continuedCalls.includes('BEGIN TRANSACTION'))
}

async function main() {
  const tempDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'sqltool-database-backup-'),
  )
  try {
    await testCreateVerifyAndDelete(tempDirectory)
    await testRestoreTransactions()
    console.log('[数据库备份生命周期测试] 全部通过')
  } finally {
    await fs.promises.rm(tempDirectory, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error('[数据库备份生命周期测试] 失败', error)
  process.exitCode = 1
})
