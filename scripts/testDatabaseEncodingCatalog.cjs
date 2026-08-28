const assert = require('node:assert/strict')
const {
  loadDatabaseEncodingCatalog,
} = require('../dist/main/database/databaseEncodingCatalog')

function mysqlConnectionData() {
  return {
    id: 'mysql-1',
    name: '测试连接',
    type: 'MySQL',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: '',
    database: '',
  }
}

async function testMySqlCatalog() {
  const calls = []
  const adapter = {
    async executeSQL(_connection, database, sql, parameters) {
      calls.push({ database, sql, parameters })
      if (sql.includes('information_schema.CHARACTER_SETS')) {
        return {
          success: true,
          message: '',
          rows: [
            {
              CHARSET: 'utf8mb4',
              DEFAULT_COLLATION: 'utf8mb4_0900_ai_ci',
              DESCRIPTION: 'UTF-8 Unicode',
            },
            {
              CHARSET: 'gbk',
              DEFAULT_COLLATION: 'gbk_chinese_ci',
              DESCRIPTION: 'GBK Simplified Chinese',
            },
          ],
        }
      }
      if (sql.includes('information_schema.COLLATIONS')) {
        return {
          success: true,
          message: '',
          rows: [
            { COLLATION: 'gbk_chinese_ci', CHARSET: 'gbk' },
            { COLLATION: 'utf8mb4_0900_ai_ci', CHARSET: 'utf8mb4' },
            { COLLATION: 'utf8mb4_bin', CHARSET: 'utf8mb4' },
          ],
        }
      }
      return {
        success: true,
        message: '',
        rows: [{
          CHARSET: 'utf8mb4',
          COLLATION: 'utf8mb4_0900_ai_ci',
        }],
      }
    },
  }

  const catalog = await loadDatabaseEncodingCatalog(
    mysqlConnectionData(),
    adapter,
    {},
    'app_data',
  )
  assert.equal(catalog.charset, 'utf8mb4')
  assert.equal(catalog.collation, 'utf8mb4_0900_ai_ci')
  assert.equal(catalog.charsets.length, 2)
  assert.equal(catalog.collations.length, 3)
  assert.match(catalog.charsets[0].label, /UTF-8 Unicode/)
  assert.deepEqual(calls[2].parameters, ['app_data'])
  assert.ok(calls.every(call => call.database === ''))
}

async function testUnsupportedType() {
  let called = false
  const catalog = await loadDatabaseEncodingCatalog(
    { ...mysqlConnectionData(), type: 'PostgreSQL' },
    {
      async executeSQL() {
        called = true
        throw new Error('不应执行查询')
      },
    },
    {},
  )
  assert.deepEqual(catalog, { charsets: [], collations: [] })
  assert.equal(called, false)
}

async function main() {
  await testMySqlCatalog()
  await testUnsupportedType()
  console.log('[数据库编码目录测试] 全部通过')
}

main().catch(error => {
  console.error('[数据库编码目录测试] 失败', error)
  process.exitCode = 1
})
