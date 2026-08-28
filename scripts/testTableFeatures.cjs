const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  ConnectionManager,
} = require('../dist/main/database/connectionManager')
const {
  applyTableMutations,
} = require('../dist/main/database/tableDataMutations')
const {
  exportRowsChunk,
  parseTableImportContent,
} = require('../dist/main/database/tableTransferFormat')
const {
  replaceExportFile,
} = require('../dist/main/database/tableTransferService')
const {
  buildTableImportBatch,
} = require('../dist/main/database/tableTransferValidation')
const {
  validateTableStructureRequest,
} = require('../dist/main/database/tableStructureValidation')
const {
  buildTableStructurePlan,
  buildTruncateTableStatement,
} = require('../dist/main/database/tableStructureSql')

function sqliteDraft(database) {
  return {
    name: 'SQLite 表功能测试',
    type: 'SQLite',
    host: '',
    port: 0,
    username: '',
    password: '',
    database,
    timeout: 30,
    charset: 'utf8mb4',
  }
}

async function testMySQLTransactionSyntax() {
  const calls = []
  const connection = {
    async query(sql) {
      calls.push(sql)
      return [[], []]
    },
    async execute() {
      return [{ affectedRows: 1 }]
    },
  }
  await applyTableMutations(
    'MySQL',
    connection,
    'demo',
    'items',
    {
      inserts: [{ values: { id: 1, name: '测试' } }],
      updates: [],
      deletes: [],
    },
  )
  assert.deepEqual(calls, ['START TRANSACTION', 'COMMIT'])
}

function testTableStructureTypeValidation() {
  const requestForType = type => ({
    definition: {
      name: 'type_test',
      fields: [{
        name: 'status',
        type,
        notNull: true,
        primary: false,
        autoIncrement: false,
        defaultValue: '',
        comment: '',
      }],
      indexes: [],
      foreignKeys: [],
    },
  })

  assert.doesNotThrow(() => validateTableStructureRequest(
    'MySQL',
    requestForType("ENUM('草稿','启用')"),
  ))
  assert.throws(
    () => validateTableStructureRequest(
      'MySQL',
      requestForType("ENUM('草稿'); DROP TABLE users"),
    ),
    /数据类型包含不支持的内容/,
  )
}

function testTruncateSqlGeneration() {
  assert.equal(
    buildTruncateTableStatement('MySQL', 'demo', 'items'),
    'TRUNCATE TABLE `demo`.`items`',
  )
  assert.equal(
    buildTruncateTableStatement('PostgreSQL', 'demo', 'items'),
    'TRUNCATE TABLE "public"."items"',
  )
  assert.equal(
    buildTruncateTableStatement('SQL Server', 'demo', 'items'),
    'TRUNCATE TABLE [demo].[dbo].[items]',
  )
  assert.equal(
    buildTruncateTableStatement('SQLite', 'main', 'items'),
    'DELETE FROM "items"',
  )
}

function testTableStructurePreviewGeneration() {
  const original = {
    name: 'accounts',
    primaryKeyName: 'PRIMARY',
    fields: [
      {
        originalName: 'id',
        name: 'id',
        type: 'int(11)',
        notNull: true,
        primary: true,
        autoIncrement: true,
        defaultValue: '',
        comment: '主键',
      },
      {
        originalName: 'name',
        name: 'name',
        type: 'varchar(64)',
        notNull: false,
        primary: false,
        autoIncrement: false,
        defaultValue: '',
        comment: '名称',
      },
    ],
    indexes: [{
      originalName: 'idx_name',
      name: 'idx_name',
      fields: ['name'],
      unique: false,
    }],
    foreignKeys: [],
  }
  const unchanged = JSON.parse(JSON.stringify(original))
  const unchangedPlan = buildTableStructurePlan(
    'MySQL',
    'business',
    unchanged,
    original,
  )
  assert.equal(unchangedPlan.mode, 'alter')
  assert.deepEqual(unchangedPlan.statements, [])
  assert.match(unchangedPlan.definitionStatements[0], /^CREATE TABLE/)
  assert.match(unchangedPlan.definitionStatements[0], /`name` varchar\(64\)/)
  for (const databaseType of ['PostgreSQL', 'SQL Server', 'SQLite']) {
    const dialectPlan = buildTableStructurePlan(
      databaseType,
      'business',
      unchanged,
      original,
    )
    assert.deepEqual(
      dialectPlan.statements,
      [],
      `${databaseType} 未修改结构不应生成变更语句`,
    )
    assert.match(dialectPlan.definitionStatements[0], /^CREATE TABLE/)
  }

  const changed = JSON.parse(JSON.stringify(original))
  changed.fields[1].type = 'VARCHAR(128)'
  const changedPlan = buildTableStructurePlan(
    'MySQL',
    'business',
    changed,
    original,
  )
  assert.equal(changedPlan.statements.length, 1)
  assert.match(changedPlan.statements[0], /CHANGE COLUMN `name`/)
  assert.doesNotMatch(changedPlan.statements[0], /CHANGE COLUMN `id`/)
  assert.doesNotMatch(changedPlan.statements[0], /DROP PRIMARY KEY/)
  assert.doesNotMatch(changedPlan.statements[0], /DROP INDEX/)

  const createPlan = buildTableStructurePlan(
    'MySQL',
    'business',
    {
      ...changed,
      name: 'new_accounts',
      fields: changed.fields.map(field => ({
        ...field,
        originalName: undefined,
      })),
      indexes: changed.indexes.map(index => ({
        ...index,
        originalName: undefined,
      })),
    },
  )
  assert.equal(createPlan.mode, 'create')
  assert.match(createPlan.statements[0], /^CREATE TABLE/)
  assert.deepEqual(createPlan.definitionStatements, createPlan.statements)
}

function testTableTransferFormats() {
  const csv = parseTableImportContent(
    '.csv',
    '\uFEFFid,name,note\r\n1,"张三","包含,逗号"\r\n2,"李""四","跨行\r\n文本"\r\n',
  )
  assert.deepEqual(csv.columns, ['id', 'name', 'note'])
  assert.equal(csv.rows.length, 2)
  assert.equal(csv.rows[0].note, '包含,逗号')
  assert.equal(csv.rows[1].name, '李"四')
  assert.equal(csv.rows[1].note, '跨行\r\n文本')

  const json = parseTableImportContent(
    '.json',
    '[{"id":1,"name":"甲"},{"id":2,"extra":true}]',
  )
  assert.deepEqual(json.columns, ['id', 'name', 'extra'])
  assert.equal(json.totalRows, 2)

  const metadata = {
    fields: [
      {
        name: 'id',
        type: 'INTEGER',
        not_null: true,
        default: null,
        primary: true,
        auto_increment: true,
        comment: '',
      },
      {
        name: 'name',
        type: 'TEXT',
        not_null: true,
        default: null,
        primary: false,
        comment: '',
      },
      {
        name: 'note',
        type: 'TEXT',
        not_null: false,
        default: null,
        primary: false,
        comment: '',
      },
    ],
    indexes: [],
    foreign_keys: [],
    ddl: '',
  }
  const batch = buildTableImportBatch({
    rows: [{ sourceName: '测试', sourceNote: '' }],
    mappings: [
      { source: 'sourceName', target: 'name' },
      { source: 'sourceNote', target: 'note' },
    ],
    emptyStringAsNull: true,
  }, metadata)
  assert.deepEqual({ ...batch.inserts[0].values }, {
    name: '测试',
    note: null,
  })

  const binary = Uint8Array.from([0xde, 0xad])
  assert.match(
    exportRowsChunk(
      'PostgreSQL',
      'items',
      ['enabled', 'payload'],
      [{ enabled: true, payload: binary }],
      'sql',
      0,
    ),
    /TRUE, decode\('dead', 'hex'\)/,
  )
  assert.match(
    exportRowsChunk(
      'SQL Server',
      'items',
      ['payload'],
      [{ payload: binary }],
      'sql',
      0,
    ),
    /0xdead/,
  )

  const mysqlDate = new Date(2024, 2, 18, 7, 45, 12, 123)
  const mysqlSpecialText = "路径\\中文\nO'Brien"
  const mysqlSql = exportRowsChunk(
    'MySQL',
    'events',
    ['created_at', 'content'],
    [{ created_at: mysqlDate, content: mysqlSpecialText }],
    'sql',
    0,
  )
  assert.match(mysqlSql, /'2024-03-18 07:45:12\.123'/)
  assert.doesNotMatch(mysqlSql, /2024-03-18T07:45:12/)
  assert.ok(mysqlSql.includes(
    `CONVERT(X'${Buffer.from(mysqlSpecialText, 'utf8').toString('hex')}' USING utf8mb4)`,
  ))

  const objectSql = exportRowsChunk(
    'PostgreSQL',
    'items',
    ['id', 'metadata'],
    [{
      id: 9007199254740993n,
      metadata: { owner: "O'Brien", count: 42n },
    }],
    'sql',
    0,
  )
  assert.match(objectSql, /9007199254740993/)
  assert.match(objectSql, /\{"owner":"O''Brien","count":"42"\}/)

  const jsonChunk = exportRowsChunk(
    'SQLite',
    'items',
    ['id', 'payload'],
    [{ id: 42n, payload: Buffer.from([0xde, 0xad]) }],
    'json',
    0,
  )
  assert.deepEqual(JSON.parse(jsonChunk), {
    id: '42',
    payload: '3q0=',
  })
}

async function testExportFileReplacement() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sqltool-export-'))
  const outputPath = path.join(root, 'items.csv')
  const pendingPath = path.join(root, '.items.csv.pending')
  try {
    fs.writeFileSync(outputPath, '旧内容', 'utf8')
    await assert.rejects(() => replaceExportFile(pendingPath, outputPath))
    assert.equal(fs.readFileSync(outputPath, 'utf8'), '旧内容')

    fs.writeFileSync(pendingPath, '新内容', 'utf8')
    await replaceExportFile(pendingPath, outputPath)
    assert.equal(fs.readFileSync(outputPath, 'utf8'), '新内容')
    assert.equal(fs.existsSync(`${pendingPath}.backup`), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

async function testSQLiteTableLifecycle() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sqltool-table-'))
  const database = path.join(root, 'table.sqlite')
  const manager = new ConnectionManager(path.join(root, 'user-data'))
  try {
    const catalog = manager.createSavedConnection(sqliteDraft(database))
    const connectionId = catalog.connections[0].id
    assert.equal((await manager.connect(connectionId)).success, true)

    const createRequest = {
      definition: {
        name: 'feature_table',
        fields: [
          {
            name: 'id',
            type: 'INTEGER',
            notNull: true,
            primary: true,
            autoIncrement: true,
            defaultValue: '',
            comment: '',
          },
          {
            name: 'name',
            type: 'TEXT',
            notNull: true,
            primary: false,
            autoIncrement: false,
            defaultValue: "'未命名'",
            comment: '',
          },
        ],
        indexes: [{
          name: 'idx_feature_name',
          fields: ['name'],
          unique: true,
        }],
        foreignKeys: [],
      },
    }
    const preview = await manager.previewTableStructure(
      connectionId,
      'main',
      createRequest,
    )
    assert.equal(preview.mode, 'create')
    assert.match(preview.statements[0], /CREATE TABLE/)
    await manager.saveTableStructure(connectionId, 'main', createRequest)

    let metadata = await manager.getTableMetadata(
      connectionId,
      'main',
      'feature_table',
    )
    assert.equal(metadata.fields.length, 2)
    assert.equal(metadata.fields[0].auto_increment, true)
    assert.deepEqual(metadata.indexes[0].fields, ['name'])

    await manager.mutateTableRows(
      connectionId,
      'main',
      'feature_table',
      {
        inserts: [{ values: { name: '第一行' } }],
        updates: [],
        deletes: [],
      },
    )
    const importResult = await manager.importTableRows(
      connectionId,
      'main',
      'feature_table',
      {
        fileName: 'feature.csv',
        rows: [
          { source_name: '导入第一行' },
          { source_name: '导入第二行' },
        ],
        mappings: [{ source: 'source_name', target: 'name' }],
        emptyStringAsNull: false,
      },
    )
    assert.equal(importResult.importedRows, 2)
    const triggerResult = await manager.executeSQL(
      connectionId,
      'main',
      `CREATE TRIGGER feature_trigger
       AFTER UPDATE ON feature_table
       BEGIN
         UPDATE feature_table SET name = name WHERE id = NEW.id;
       END`,
    )
    assert.equal(triggerResult.success, true)

    const alterRequest = {
      originalName: 'feature_table',
      definition: {
        name: 'feature_table',
        fields: [
          {
            originalName: 'id',
            name: 'id',
            type: 'INTEGER',
            notNull: true,
            primary: true,
            autoIncrement: true,
            defaultValue: '',
            comment: '',
          },
          {
            originalName: 'name',
            name: 'title',
            type: 'TEXT',
            notNull: true,
            primary: false,
            autoIncrement: false,
            defaultValue: "'未命名'",
            comment: '',
          },
          {
            name: 'created_at',
            type: 'TEXT',
            notNull: true,
            primary: false,
            autoIncrement: false,
            defaultValue: 'CURRENT_TIMESTAMP',
            comment: '',
          },
        ],
        indexes: [{
          originalName: 'idx_feature_name',
          name: 'idx_feature_title',
          fields: ['title'],
          unique: true,
        }],
        foreignKeys: [],
      },
    }
    await manager.saveTableStructure(connectionId, 'main', alterRequest)
    metadata = await manager.getTableMetadata(
      connectionId,
      'main',
      'feature_table',
    )
    assert.deepEqual(
      metadata.fields.map(field => field.name),
      ['id', 'title', 'created_at'],
    )
    assert.deepEqual(await manager.getEvents(connectionId, 'main'), [
      'feature_trigger',
    ])
    const page = await manager.getTableData(
      connectionId,
      'main',
      'feature_table',
      1,
      20,
    )
    assert.deepEqual(
      page.rows.map(row => row.title),
      ['第一行', '导入第一行', '导入第二行'],
    )
    assert.ok(page.rows.every(row => row.created_at))

    const truncateResult = await manager.truncateTable(
      connectionId,
      'main',
      'feature_table',
    )
    assert.equal(truncateResult.tableName, 'feature_table')
    const emptyPage = await manager.getTableData(
      connectionId,
      'main',
      'feature_table',
      1,
      20,
    )
    assert.equal(emptyPage.total, 0)
    assert.deepEqual(emptyPage.rows, [])

    await manager.dropTable(connectionId, 'main', 'feature_table')
    assert.deepEqual(await manager.getTables(connectionId, 'main'), [])
  } finally {
    await manager.closeAll()
    fs.rmSync(root, { recursive: true, force: true })
  }
}

async function main() {
  await testMySQLTransactionSyntax()
  testTableStructureTypeValidation()
  testTruncateSqlGeneration()
  testTableStructurePreviewGeneration()
  testTableTransferFormats()
  await testExportFileReplacement()
  await testSQLiteTableLifecycle()
  console.log('[表功能测试] 全部通过')
}

main().catch(error => {
  console.error('[表功能测试] 失败', error)
  process.exitCode = 1
})
