const assert = require('node:assert/strict')
const {
  DataTransferService,
} = require('../dist/main/database/dataTransferService')
const {
  DataSyncService,
} = require('../dist/main/database/dataSyncService')

function createMetadata(table, foreignKeys = []) {
  const fields = [{
    name: 'id',
    type: 'int',
    not_null: true,
    default: null,
    default_expression: '',
    primary: true,
    auto_increment: false,
    comment: '',
  }]
  if (table === 'child') {
    fields.push({
      name: 'parent_id',
      type: 'int',
      not_null: true,
      default: null,
      default_expression: '',
      primary: false,
      auto_increment: false,
      comment: '',
    })
  }
  return {
    primary_key_name: `pk_${table}`,
    fields,
    indexes: [],
    foreign_keys: foreignKeys,
    ddl: '',
  }
}

function createGateway(sourceRows, targetRows, calls) {
  const metadata = new Map([
    ['parent', createMetadata('parent')],
    ['child', createMetadata('child', [{
      name: 'fk_child_parent',
      fields: ['parent_id'],
      referenced_table: 'parent',
      referenced_fields: ['id'],
    }])],
  ])
  return {
    getConnectionCatalog() {
      return {
        connections: [
          { id: 'source', type: 'MySQL' },
          { id: 'target', type: 'MySQL' },
        ],
        groups: [],
      }
    },
    async getTables() {
      return ['parent', 'child']
    },
    async getTableMetadata(_connId, _database, table) {
      return metadata.get(table)
    },
    async getTableData(connId, _database, table) {
      const rows = connId === 'source'
        ? sourceRows[table]
        : targetRows[table]
      return { rows, total: rows.length }
    },
    async mutateTableRows(_connId, _database, table, batch) {
      const operation = batch.inserts.length > 0
        ? 'insert'
        : batch.updates.length > 0 ? 'update' : 'delete'
      calls.push(`${operation}:${table}`)
      return {
        insertedRows: batch.inserts.length,
        updatedRows: batch.updates.length,
        deletedRows: batch.deletes.length,
        affectedRows: (
          batch.inserts.length
          + batch.updates.length
          + batch.deletes.length
        ),
      }
    },
    async executeSQL(_connId, _database, sql) {
      const table = sql.includes('`child`') ? 'child' : 'parent'
      calls.push(`clear:${table}`)
      return { success: true, message: '' }
    },
    async saveTableStructure() {
      throw new Error('测试数据中的目标表均已存在，不应执行建表')
    },
  }
}

async function testTransferDependencyOrder() {
  const calls = []
  const gateway = createGateway(
    {
      parent: [{ id: 2 }],
      child: [{ id: 20, parent_id: 2 }],
    },
    {
      parent: [{ id: 1 }],
      child: [{ id: 10, parent_id: 1 }],
    },
    calls,
  )
  const service = new DataTransferService(gateway)
  await service.execute({
    source: { connId: 'source', database: 'source_db' },
    target: { connId: 'target', database: 'target_db' },
    tables: ['child', 'parent'],
    strategy: 'replace',
    createMissing: false,
    batchSize: 20,
  })
  assert.deepEqual(calls, [
    'clear:child',
    'clear:parent',
    'insert:parent',
    'insert:child',
  ])
}

async function testDataSyncDependencyPhases() {
  const calls = []
  const gateway = createGateway(
    {
      parent: [{ id: 2 }],
      child: [{ id: 20, parent_id: 2 }],
    },
    {
      parent: [{ id: 1 }],
      child: [{ id: 10, parent_id: 1 }],
    },
    calls,
  )
  const service = new DataSyncService(gateway)
  const result = await service.execute({
    source: { connId: 'source', database: 'source_db' },
    target: { connId: 'target', database: 'target_db' },
    tables: ['child', 'parent'],
    options: { insert: true, update: true, delete: true },
    batchSize: 20,
  })
  assert.deepEqual(calls, [
    'insert:parent',
    'insert:child',
    'delete:child',
    'delete:parent',
  ])
  assert.deepEqual(
    {
      insertedRows: result.insertedRows,
      updatedRows: result.updatedRows,
      deletedRows: result.deletedRows,
    },
    { insertedRows: 2, updatedRows: 0, deletedRows: 2 },
  )
}

async function main() {
  await testTransferDependencyOrder()
  await testDataSyncDependencyPhases()
  console.log('[数据库工具执行测试] 外键依赖执行顺序全部通过')
}

main().catch(error => {
  console.error('[数据库工具执行测试] 失败', error)
  process.exitCode = 1
})
