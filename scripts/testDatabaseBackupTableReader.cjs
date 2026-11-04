/**
 * 备份表读取器回归测试（M2）：
 * 1) 数值主键走 keyset 分页时，主键值必须通过参数占位符传递，不能拼成 SQL 字面量；
 * 2) 无主键表必须固定 ORDER BY（按全列排序），避免 OFFSET 跨页出现重复/丢行；
 * 3) 不同数据库使用各自的占位符语法（? / $n / @pn）。
 */
const assert = require('node:assert/strict')
const {
  createBackupTableReader,
} = require('../dist/main/database/databaseBackupTableReader')

function table(fields, name = 'account') {
  return {
    name,
    fields: fields.map(([fieldName, type, primary]) => ({ name: fieldName, type, primary })),
    foreignKeys: [],
    ddl: '',
  }
}

function activeConnection(type) {
  return {
    adapter: { executeSQL: async () => ({ success: true, rows: [] }) },
    connection: {},
    connData: { type },
  }
}

/** 记录 COUNT 与数据批次 SQL，并按照调用顺序返回预设数据 */
function recordingExecute(batches) {
  const calls = []
  let batchIndex = 0
  const execute = async (_connection, _database, sql, parameters) => {
    if (/COUNT\(\*\)/i.test(sql)) {
      calls.push({ sql, parameters, count: true })
      return { success: true, rows: [{ __sqltool_total: 3 }], message: 'ok' }
    }
    const index = batchIndex++
    calls.push({ sql, parameters, count: false })
    return { success: true, rows: batches[index] || [], message: 'ok' }
  }
  return { execute, calls }
}

async function testKeysetParameterized(type, expectedWhere, expectedParameter) {
  const tableModel = table([['id', 'INTEGER', true], ['name', 'TEXT', false]])
  const { execute, calls } = recordingExecute([[{ id: 1 }, { id: 2 }], [{ id: 3 }]])
  const active = activeConnection(type)
  active.adapter.executeSQL = execute

  const reader = await createBackupTableReader(
    active,
    type === 'PostgreSQL' ? '' : 'main',
    tableModel,
    2,
  )
  assert.equal(reader.total, 3)

  const first = await reader.readNext()
  assert.equal(first.length, 2)
  await reader.readNext()

  const dataCalls = calls.filter(call => !call.count)
  // 首批无 WHERE；第二批必须使用占位符而不是内联主键值
  assert.ok(!/`id`\s*>\s*\d|"id"\s*>\s*\d|\[id\]\s*>\s*\d/.test(dataCalls[1].sql), '主键值不能内联为 SQL 字面量')
  assert.ok(
    dataCalls[1].sql.includes(expectedWhere),
    `应使用占位符 ${expectedWhere}，实际 SQL: ${dataCalls[1].sql}`,
  )
  assert.deepEqual(dataCalls[1].parameters, [expectedParameter])
  assert.equal(dataCalls[0].parameters.length, 0)
}

async function testOrderByWithoutPrimaryKey() {
  // 无主键：OFFSET 翻页必须按所有可见列固定排序
  const tableModel = table([['code', 'TEXT', false], ['amount', 'INTEGER', false]], 'ledger')
  const { execute, calls } = recordingExecute([[{ code: 'b', amount: 2 }]])
  const active = activeConnection('MySQL')
  active.adapter.executeSQL = execute

  const reader = await createBackupTableReader(active, 'main', tableModel, 2)
  await reader.readNext()
  const dataCall = calls.find(call => !call.count)
  assert.match(
    dataCall.sql,
    /ORDER BY `code` ASC, `amount` ASC/,
    '无主键表必须按全列排序以尽量稳定分页顺序',
  )
}

async function main() {
  await testKeysetParameterized('MySQL', '`id` > ?', 2)
  await testKeysetParameterized('PostgreSQL', '"id" > $1', 2)
  await testKeysetParameterized('SQL Server', '[id] > @p0', 2)
  await testOrderByWithoutPrimaryKey()
  console.log('[备份表读取器回归测试] 全部通过')
}

main().catch(error => {
  console.error('[备份表读取器回归测试] 失败', error)
  process.exitCode = 1
})
