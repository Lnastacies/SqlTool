const assert = require('node:assert/strict')
const {
  loadDatabaseBackupObjectDdls,
} = require('../dist/main/database/databaseBackupObjectDdl')
const {
  buildDropObjectSql,
} = require('../dist/main/database/databaseBackupSql')

function active(type, executeSQL) {
  return {
    adapter: { executeSQL },
    connection: {},
    connData: { type },
  }
}

function emptyScope(tables) {
  return {
    tables,
    views: [],
    functions: [],
    procedures: [],
    events: [],
  }
}

async function testPostgreSqlTriggers() {
  const calls = []
  const objects = await loadDatabaseBackupObjectDdls(
    active('PostgreSQL', async (_connection, database, sql, parameters) => {
      calls.push({ database, sql, parameters })
      return {
        success: true,
        message: 'ok',
        rows: [{
          name: 'account_audit',
          ddl: 'CREATE TRIGGER account_audit AFTER UPDATE ON public.account EXECUTE FUNCTION audit_account()',
        }],
      }
    }),
    'app_data',
    emptyScope(['account']),
  )

  assert.equal(objects.length, 1)
  assert.equal(objects[0].kind, 'trigger')
  assert.equal(calls[0].database, '')
  assert.deepEqual(calls[0].parameters, [['account']])
  assert.equal(
    buildDropObjectSql('PostgreSQL', objects[0]),
    '',
  )
}

async function testSqlServerTriggers() {
  const calls = []
  const objects = await loadDatabaseBackupObjectDdls(
    active('SQL Server', async (_connection, database, sql) => {
      calls.push({ database, sql })
      return {
        success: true,
        message: 'ok',
        rows: [{
          name: 'account_audit',
          ddl: 'CREATE TRIGGER [dbo].[account_audit] ON [dbo].[account] AFTER UPDATE AS SELECT 1',
        }],
      }
    }),
    'app-data',
    emptyScope(["account's"]),
  )

  assert.equal(objects.length, 1)
  assert.match(calls[0].sql, /USE \[app-data]/)
  assert.match(calls[0].sql, /IN \('account''s'\)/)
  assert.equal(
    buildDropObjectSql('SQL Server', objects[0]),
    'DROP TRIGGER IF EXISTS [dbo].[account_audit];',
  )
}

async function testMySqlObjectOrder() {
  const objects = await loadDatabaseBackupObjectDdls(
    active('MySQL', async (_connection, _database, sql) => {
      if (/information_schema\.TRIGGERS/i.test(sql)) {
        return {
          success: true,
          message: 'ok',
          rows: [{ name: 'account_audit' }],
        }
      }
      const match = sql.match(/SHOW CREATE (FUNCTION|VIEW|TRIGGER)/i)
      const kind = match?.[1]?.toLowerCase()
      const labels = {
        function: 'Function',
        view: 'View',
        trigger: 'Trigger',
      }
      return {
        success: true,
        message: 'ok',
        rows: [{
          [`Create ${labels[kind]}`]: `CREATE ${kind.toUpperCase()} sample`,
        }],
      }
    }),
    'app_data',
    {
      ...emptyScope(['account']),
      functions: ['calculate_total'],
      views: ['active_account'],
    },
  )

  assert.deepEqual(
    objects.map(object => object.kind),
    ['function', 'view', 'trigger'],
  )
}

async function main() {
  await testPostgreSqlTriggers()
  await testSqlServerTriggers()
  await testMySqlObjectOrder()
  console.log('[数据库备份对象测试] 全部通过')
}

main().catch(error => {
  console.error('[数据库备份对象测试] 失败', error)
  process.exitCode = 1
})
