const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  buildCreateDatabaseStatement,
  normalizeDatabaseName,
} = require('../dist/main/database/databaseCreation')
const { MySQLAdapter } = require('../dist/main/database/adapters')

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
}

function testEncodingControls() {
  const optionsSource = source(
    'src/renderer/features/databases/createDatabaseEncodingOptions.ts',
  )
  const mysqlBlock = optionsSource.match(
    /const MYSQL_CHARSETS = \[([\s\S]*?)\]\s*\n/,
  )?.[1] || ''
  const charsetCount = (mysqlBlock.match(/'[^']+'/g) || []).length
  assert.ok(charsetCount >= 40, `MySQL 回退字符集不完整: ${charsetCount}`)
  assert.match(mysqlBlock, /'utf8mb4'/)
  assert.match(mysqlBlock, /'gb18030'/)
  assert.match(mysqlBlock, /'big5'/)

  const connectionDialog = source(
    'src/renderer/components/ConnectionDialog.tsx',
  )
  assert.match(connectionDialog, /mysqlCharsetOptions/)
  assert.doesNotMatch(
    connectionDialog,
    /<Input placeholder="utf8mb4"/,
  )

  const createDialog = source(
    'src/renderer/components/CreateDatabaseDialog.tsx',
  )
  const editDialog = source(
    'src/renderer/features/databases/DatabaseEditDialog.tsx',
  )
  assert.match(createDialog, /getDatabaseEncodingCatalog/)
  assert.match(editDialog, /getDatabaseEncodingCatalog/)
  assert.match(editDialog, /form\.setFieldsValue/)
}

async function main() {
  testEncodingControls()
  assert.equal(
    buildCreateDatabaseStatement('MySQL', 'order`data'),
    'CREATE DATABASE `order``data`',
  )
  assert.equal(
    buildCreateDatabaseStatement('PostgreSQL', 'order"data'),
    'CREATE DATABASE "order""data"',
  )
  assert.equal(
    buildCreateDatabaseStatement('SQL Server', 'order]data'),
    'CREATE DATABASE [order]]data]',
  )
  assert.equal(
    buildCreateDatabaseStatement('MySQL', 'app_data', {
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
    }),
    'CREATE DATABASE `app_data` DEFAULT CHARACTER SET = utf8mb4 DEFAULT COLLATE = utf8mb4_unicode_ci',
  )
  assert.equal(
    buildCreateDatabaseStatement('PostgreSQL', 'app_data', {
      encoding: 'UTF8',
      collation: "zh_CN.UTF-8",
    }),
    "CREATE DATABASE \"app_data\" WITH ENCODING = 'UTF8' LC_COLLATE = 'zh_CN.UTF-8' LC_CTYPE = 'zh_CN.UTF-8' TEMPLATE = template0",
  )
  assert.equal(
    buildCreateDatabaseStatement('SQL Server', 'app_data', {
      collation: 'Chinese_PRC_100_CI_AS_SC_UTF8',
    }),
    'CREATE DATABASE [app_data] COLLATE Chinese_PRC_100_CI_AS_SC_UTF8',
  )

  assert.throws(
    () => normalizeDatabaseName('MySQL', '   '),
    /不能为空/,
  )
  assert.throws(
    () => normalizeDatabaseName('PostgreSQL', '数'.repeat(22)),
    /63 字节/,
  )
  assert.throws(
    () => normalizeDatabaseName('SQLite', 'local'),
    /不支持/,
  )
  assert.throws(
    () => buildCreateDatabaseStatement('MySQL', 'app_data', {
      charset: 'utf8mb4; DROP DATABASE app_data',
    }),
    /只能包含/,
  )

  const calls = []
  const connection = {
    async query(sql) {
      calls.push(sql)
      return [[], []]
    },
  }
  await new MySQLAdapter().createDatabase(connection, 'app_data', {
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  assert.deepEqual(calls, [
    'CREATE DATABASE `app_data` DEFAULT CHARACTER SET = utf8mb4 DEFAULT COLLATE = utf8mb4_unicode_ci',
  ])

  console.log('[新建数据库测试] 全部通过')
}

main().catch(error => {
  console.error('[新建数据库测试] 失败', error)
  process.exitCode = 1
})
