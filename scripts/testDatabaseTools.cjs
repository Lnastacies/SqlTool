const assert = require('node:assert/strict')
const {
  compareTableRows,
  splitMutationBatch,
} = require('../dist/main/database/databaseToolData')
const {
  buildTargetTableDefinition,
  mapDatabaseType,
} = require('../dist/main/database/databaseToolStructure')
const {
  buildClearTableSql,
} = require('../dist/main/database/databaseToolValidation')
const {
  orderTablesByForeignKeys,
} = require('../dist/main/database/databaseToolDependencies')
const {
  MySQLAdapter,
} = require('../dist/main/database/adapters')

function testDataTypeMapping() {
  assert.equal(mapDatabaseType('bigint unsigned', 'PostgreSQL'), 'BIGINT')
  assert.equal(mapDatabaseType('nvarchar(max)', 'MySQL'), 'LONGTEXT')
  assert.equal(mapDatabaseType('bytea', 'SQL Server'), 'VARBINARY(MAX)')
  assert.equal(mapDatabaseType('datetime(6)', 'SQLite'), 'TEXT')

  const mapped = buildTargetTableDefinition(
    'orders',
    {
      primary_key_name: 'pk_orders',
      fields: [
        {
          name: 'id',
          type: 'bigint unsigned',
          not_null: true,
          default: null,
          default_expression: '',
          primary: true,
          auto_increment: true,
          comment: '主键',
        },
        {
          name: 'created_at',
          type: 'datetime',
          not_null: true,
          default: null,
          default_expression: 'CURRENT_TIMESTAMP',
          primary: false,
          comment: '',
        },
        {
          name: 'token',
          type: 'varchar(40)',
          not_null: false,
          default: null,
          default_expression: 'uuid()',
          primary: false,
          comment: '',
        },
      ],
      indexes: [{
        name: 'idx_created',
        type: 'INDEX',
        fields: ['created_at'],
        unique: false,
      }],
      foreign_keys: [],
      ddl: '',
    },
    'MySQL',
    'PostgreSQL',
  )
  assert.equal(mapped.definition.fields[0].type, 'BIGINT')
  assert.equal(mapped.definition.fields[1].defaultValue, 'CURRENT_TIMESTAMP')
  assert.equal(mapped.definition.fields[2].defaultValue, '')
  assert.match(mapped.warnings.join('\n'), /默认值不兼容/)
}

function testPrimaryKeyComparison() {
  const compared = compareTableRows(
    [
      { id: 1, name: '保留', payload: Buffer.from([1, 2]) },
      { id: 2, name: '更新后', payload: null },
      { id: 3, name: '新增', payload: null },
    ],
    [
      { id: '1', name: '保留', payload: Buffer.from([1, 2]) },
      { id: '2', name: '更新前', payload: null },
      { id: '4', name: '删除', payload: null },
    ],
    ['id'],
    ['id', 'name', 'payload'],
  )
  assert.equal(compared.unchangedRows, 1)
  assert.deepEqual(compared.batch.inserts, [{
    values: { id: 3, name: '新增', payload: null },
  }])
  assert.deepEqual(compared.batch.updates, [{
    originalKey: { id: '2' },
    changes: { name: '更新后' },
  }])
  assert.deepEqual(compared.batch.deletes, [{
    originalKey: { id: '4' },
  }])
}

function testBatchSplittingAndSqlSafety() {
  const inserts = Array.from({ length: 520 }, (_, id) => ({
    values: { id },
  }))
  const chunks = splitMutationBatch(
    { inserts, updates: [], deletes: [] },
    200,
  )
  assert.deepEqual(chunks.map(chunk => chunk.inserts.length), [200, 200, 120])
  assert.equal(
    buildClearTableSql('MySQL', 'sales-db', 'order`items'),
    'DELETE FROM `sales-db`.`order``items`',
  )
  assert.equal(
    buildClearTableSql('SQL Server', 'sales-db', 'order]items'),
    'DELETE FROM [sales-db].[dbo].[order]]items]',
  )

  const metadata = new Map([
    ['order_items', {
      foreign_keys: [{ referenced_table: 'orders' }],
    }],
    ['orders', { foreign_keys: [] }],
  ])
  assert.deepEqual(
    orderTablesByForeignKeys(['order_items', 'orders'], metadata),
    { tables: ['orders', 'order_items'], hasCycle: false },
  )
}

async function testMySQLProtocolSelection() {
  const calls = []
  const connection = {
    async query(sql) {
      calls.push({ protocol: 'query', sql })
      return [{ affectedRows: 0 }, undefined]
    },
    async execute(sql, parameters) {
      calls.push({ protocol: 'execute', sql, parameters })
      return [[], []]
    },
  }
  const adapter = new MySQLAdapter()
  const ddlResult = await adapter.executeSQL(
    connection,
    'target_db',
    'CREATE TABLE `sample` (`id` int)',
  )
  const queryResult = await adapter.executeSQL(
    connection,
    'target_db',
    'SELECT * FROM `sample` WHERE `id` = ?',
    [1],
  )
  assert.equal(ddlResult.success, true)
  assert.equal(queryResult.success, true)
  assert.deepEqual(calls.map(call => call.protocol), [
    'query',
    'query',
    'query',
    'execute',
  ])
}

async function main() {
  testDataTypeMapping()
  testPrimaryKeyComparison()
  testBatchSplittingAndSqlSafety()
  await testMySQLProtocolSelection()
  console.log('[数据库工具测试] 数据传输、数据同步、结构同步核心逻辑全部通过')
}

main().catch(error => {
  console.error('[数据库工具测试] 失败', error)
  process.exitCode = 1
})
