const assert = require('node:assert/strict')
const {
  MySQLAdapter,
} = require('../dist/main/database/adapters')

function createConnection() {
  const calls = []
  const tableRows = {
    first_db: [
      { object_name: 'first_table' },
      { object_name: 'shared_table' },
    ],
    second_db: [
      { object_name: 'second_table' },
      { object_name: 'shared_table' },
    ],
  }

  return {
    calls,
    async execute(sql, parameters = []) {
      calls.push({ sql, parameters })
      const database = parameters[0]

      // 模拟两个数据库并发读取，验证结果不依赖连接当前 USE 上下文。
      if (database === 'first_db') {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      if (sql.includes('information_schema.TABLES')) {
        return [tableRows[database] || [], []]
      }
      if (sql.includes('information_schema.VIEWS')) {
        return [[{ object_name: `${database}_view` }], []]
      }
      if (sql.includes('information_schema.ROUTINES')) {
        const suffix = sql.includes("'PROCEDURE'")
          ? 'procedure'
          : 'function'
        return [[{ object_name: `${database}_${suffix}` }], []]
      }
      if (sql.includes('information_schema.EVENTS')) {
        return [[{ object_name: `${database}_event` }], []]
      }
      throw new Error(`未处理的测试 SQL: ${sql}`)
    },
  }
}

async function main() {
  const adapter = new MySQLAdapter()
  const connection = createConnection()

  const [firstTables, secondTables] = await Promise.all([
    adapter.getTables(connection, 'first_db'),
    adapter.getTables(connection, 'second_db'),
  ])
  assert.deepEqual(firstTables, ['first_table', 'shared_table'])
  assert.deepEqual(secondTables, ['second_table', 'shared_table'])

  assert.deepEqual(
    await adapter.getViews(connection, 'second_db'),
    ['second_db_view'],
  )
  assert.deepEqual(
    await adapter.getProcedures(connection, 'second_db'),
    ['second_db_procedure'],
  )
  assert.deepEqual(
    await adapter.getFunctions(connection, 'second_db'),
    ['second_db_function'],
  )
  assert.deepEqual(
    await adapter.getEvents(connection, 'second_db'),
    ['second_db_event'],
  )

  assert.equal(
    connection.calls.some(call => /\bUSE\b|\bSHOW\s+TABLES\b/i.test(call.sql)),
    false,
    '对象元数据查询不应依赖会话数据库或 SHOW TABLES 预编译缓存',
  )
  assert.equal(
    connection.calls.every(call => call.parameters.length === 1),
    true,
    '每次对象查询都应显式传入数据库名称',
  )

  console.log('[数据库对象元数据测试] 全部通过')
}

main().catch(error => {
  console.error('[数据库对象元数据测试] 失败', error)
  process.exitCode = 1
})
