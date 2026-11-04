const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

let saveDialogResult = { canceled: true }
const originalLoad = Module._load
Module._load = function loadWithElectronMock(request, parent, isMain) {
  if (request === 'electron') {
    return {
      dialog: {
        showSaveDialog: async () => saveDialogResult,
      },
    }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const {
  writeDatabaseDumpFile,
} = require('../dist/main/database/databaseDumpService')
const {
  buildStructureResetSql,
} = require('../dist/main/database/databaseDumpSql')
Module._load = originalLoad

const {
  loadDatabaseModel,
} = require('../dist/main/database/databaseModelService')
const {
  DatabaseConnectionRegistry,
} = require('../dist/main/database/databaseConnectionRegistry')

function field(name, type = 'int') {
  return {
    name,
    type,
    not_null: true,
    default: null,
    primary: name === 'id',
  }
}

function modelTable(name, foreignKeys = []) {
  return {
    name,
    fields: [field('id'), field('label', 'varchar(50)')],
    foreignKeys,
    ddl: `CREATE TABLE \`${name}\` (\`id\` int PRIMARY KEY, \`label\` varchar(50))`,
  }
}

function databaseModel(type, tables) {
  return {
    name: 'app_data',
    type,
    tables,
    views: [],
    functions: [],
    procedures: [],
    events: [],
  }
}

async function testDatabaseDump(tempDirectory) {
  const outputPath = path.join(tempDirectory, 'database.sql')
  saveDialogResult = { canceled: false, filePath: outputPath }
  let pageCalls = 0
  const parent = modelTable('account')
  const child = modelTable('account_log', [{
    referenced_table: 'account',
  }])
  const result = await writeDatabaseDumpFile(
    databaseModel('MySQL', [parent, child]),
    'structure-data',
    {
      openTable: async () => {
        pageCalls += 1
        const rows = [
          { id: 1, label: 'Alpha' },
          { id: 2, label: "O'Reilly" },
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
    },
  )

  assert.equal(result.cancelled, false)
  assert.equal(result.rowCount, 4)
  assert.equal(pageCalls, 2)
  const content = await fs.promises.readFile(outputPath, 'utf8')
  assert.ok(
    content.indexOf('DROP TABLE IF EXISTS `account_log`;')
      < content.indexOf('DROP TABLE IF EXISTS `account`;'),
  )
  assert.ok(
    content.indexOf('DROP TABLE IF EXISTS `account`;')
      < content.indexOf('CREATE TABLE `account`'),
  )
  assert.match(content, /CREATE TABLE `account`/)
  assert.match(content, /INSERT INTO `account`/)
  assert.match(content, /O''Reilly/)

  const dataOutputPath = path.join(tempDirectory, 'database-data.sql')
  saveDialogResult = { canceled: false, filePath: dataOutputPath }
  await writeDatabaseDumpFile(
    databaseModel('MySQL', [modelTable('account')]),
    'data',
    {
      openTable: async () => {
        const rows = [{ id: 1, label: '保留结构' }]
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
    },
  )
  const dataContent = await fs.promises.readFile(dataOutputPath, 'utf8')
  assert.doesNotMatch(dataContent, /DROP TABLE|CREATE TABLE/)
  assert.match(dataContent, /INSERT INTO `account`/)

  saveDialogResult = { canceled: true }
  const cancelled = await writeDatabaseDumpFile(
    databaseModel('MySQL', [modelTable('account')]),
    'data',
    {
      openTable: async () => {
        throw new Error('取消保存后不应读取数据')
      },
    },
  )
  assert.equal(cancelled.cancelled, true)
}

function testStructureResetDialects() {
  assert.match(
    buildStructureResetSql(databaseModel('PostgreSQL', [modelTable('a"b')])),
    /DROP TABLE IF EXISTS "a""b";/,
  )
  assert.match(
    buildStructureResetSql(databaseModel('SQL Server', [modelTable('a]b')])),
    /DROP TABLE IF EXISTS \[a]]b];/,
  )
  assert.match(
    buildStructureResetSql(databaseModel('SQLite', [modelTable('a"b')])),
    /DROP TABLE IF EXISTS "a""b";/,
  )
  assert.equal(buildStructureResetSql(databaseModel('MySQL', [])), '')
}

async function testDatabaseModelSorting() {
  const metadata = {
    parent: {
      fields: [field('id')],
      foreign_keys: [],
      ddl: 'CREATE TABLE parent (id int)',
    },
    child: {
      fields: [field('id'), field('parent_id')],
      foreign_keys: [{
        name: 'fk_child_parent',
        fields: ['parent_id'],
        referenced_table: 'parent',
        referenced_fields: ['id'],
      }],
      ddl: 'CREATE TABLE child (id int, parent_id int)',
    },
  }
  const adapter = {
    getTables: async () => ['child', 'parent'],
    getViews: async () => ['active_child'],
    getFunctions: async () => ['calculate_child'],
    getProcedures: async () => [],
    getEvents: async () => [],
    getTableMetadata: async (_connection, _database, table) => metadata[table],
  }
  const model = await loadDatabaseModel({
    adapter,
    connection: {},
    connData: {
      id: 'connection-1',
      name: '测试连接',
      type: 'MySQL',
    },
  }, 'app_data')

  assert.deepEqual(model.tables.map(table => table.name), ['parent', 'child'])
  assert.deepEqual(model.views, ['active_child'])
  assert.equal(model.tables[1].foreignKeys[0].referenced_table, 'parent')
}

async function testPostgreSqlContextRelease() {
  const registry = new DatabaseConnectionRegistry()
  let connectCount = 0
  let closeCount = 0
  const adapter = {
    connect: async () => ({ sequence: ++connectCount }),
    close: async () => {
      closeCount += 1
    },
  }
  const base = {
    adapter,
    connection: { sequence: 0 },
    connData: {
      id: 'connection-1',
      name: 'PostgreSQL 测试连接',
      type: 'PostgreSQL',
      database: 'postgres',
    },
  }

  const first = await registry.resolve('connection-1', 'app_data', base)
  await registry.closeDatabase('connection-1', 'app_data')
  const second = await registry.resolve('connection-1', 'app_data', base)
  assert.notEqual(first.connection.sequence, second.connection.sequence)
  assert.equal(connectCount, 2)
  assert.equal(closeCount, 1)
  await registry.close('connection-1')
}

async function main() {
  const tempDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'sqltool-database-management-'),
  )
  try {
    await testDatabaseDump(tempDirectory)
    testStructureResetDialects()
    await testDatabaseModelSorting()
    await testPostgreSqlContextRelease()
    console.log('[数据库实例管理测试] 全部通过')
  } finally {
    await fs.promises.rm(tempDirectory, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error('[数据库实例管理测试] 失败', error)
  process.exitCode = 1
})
