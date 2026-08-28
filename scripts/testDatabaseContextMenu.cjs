const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, fileName) => {
    const source = fs.readFileSync(fileName, 'utf8')
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName,
    }).outputText
    module._compile(output, fileName)
  }
}

const {
  buildDatabaseContextMenu,
} = require('../src/renderer/features/databases/databaseContextMenu.tsx')
const {
  buildAlterDatabaseStatement,
  buildDropDatabaseStatement,
} = require('../dist/main/database/databaseManagementSql')
const {
  buildDatabasePrintHtml,
} = require('../dist/main/database/databasePrintService')

function createMenu(type = 'MySQL') {
  const calls = []
  const callback = name => () => calls.push(name)
  const items = buildDatabaseContextMenu({
    connection: {
      id: 'connection-1',
      name: '测试连接',
      type,
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '',
      database: '',
    },
    onClose: callback('close'),
    onEdit: callback('edit'),
    onCreate: callback('create'),
    onDelete: callback('delete'),
    onNewQuery: callback('query'),
    onOpenTerminal: callback('terminal'),
    onRunSqlFile: callback('sqlFile'),
    onDump: callback('dump'),
    onPrint: callback('print'),
    onReverseModel: callback('model'),
    onSearch: callback('search'),
    onRefresh: callback('refresh'),
  })
  return { items, calls }
}

function findItem(items, key) {
  return items.find(item => item && item.key === key)
}

function labels(items) {
  return items
    .filter(item => item && item.type !== 'divider')
    .map(item => item.label)
}

function testMenu() {
  const { items, calls } = createMenu()
  assert.deepEqual(labels(items), [
    '关闭数据库',
    '编辑数据库...',
    '新建数据库...',
    '删除数据库',
    '新建查询',
    '命令列界面...',
    '运行SQL文件...',
    '转储SQL文件',
    '打印数据库',
    '逆向数据库到模型...',
    '在数据库中查找',
    '刷新',
  ])
  for (const key of [
    'close-database',
    'edit-database',
    'create-database',
    'delete-database',
    'new-query',
    'terminal',
    'run-sql-file',
    'dump-database',
    'print-database',
    'reverse-model',
    'search-database',
    'refresh',
  ]) findItem(items, key).onClick()
  assert.deepEqual(calls, [
    'close', 'edit', 'create', 'delete', 'query', 'terminal',
    'sqlFile', 'dump', 'print', 'model', 'search', 'refresh',
  ])

  const sqlite = createMenu('SQLite').items
  assert.equal(findItem(sqlite, 'create-database'), undefined)
  assert.equal(findItem(sqlite, 'delete-database').disabled, true)
}

function testManagementSql() {
  assert.equal(
    buildDropDatabaseStatement('MySQL', 'app`data'),
    'DROP DATABASE `app``data`',
  )
  assert.equal(
    buildDropDatabaseStatement('PostgreSQL', 'app"data'),
    'DROP DATABASE "app""data"',
  )
  assert.equal(
    buildAlterDatabaseStatement('SQL Server', 'old]db', { name: 'new]db' }).statement,
    'ALTER DATABASE [old]]db] MODIFY NAME = [new]]db]',
  )
  assert.equal(
    buildAlterDatabaseStatement('MySQL', 'app', {
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
    }).statement,
    'ALTER DATABASE `app` DEFAULT CHARACTER SET = utf8mb4 DEFAULT COLLATE = utf8mb4_unicode_ci',
  )
  assert.throws(
    () => buildDropDatabaseStatement('PostgreSQL', 'postgres'),
    /系统数据库/,
  )
  assert.throws(
    () => buildAlterDatabaseStatement('SQLite', 'main', { name: 'next' }),
    /SQLite/,
  )
}

function testPrintHtml() {
  const html = buildDatabasePrintHtml({
    name: '<sales>',
    type: 'MySQL',
    tables: [{
      name: 'order&item',
      fields: [{
        name: 'id',
        type: 'int',
        not_null: true,
        default: null,
        primary: true,
        comment: '"key"',
      }],
      foreignKeys: [],
      ddl: 'CREATE TABLE',
    }],
    views: [],
    functions: [],
    procedures: [],
    events: [],
  })
  assert.match(html, /&lt;sales&gt;/)
  assert.match(html, /order&amp;item/)
  assert.match(html, /&quot;key&quot;/)
  assert.doesNotMatch(html, /<sales>/)
}

testMenu()
testManagementSql()
testPrintHtml()
console.log('[数据库实例右键菜单测试] 全部通过')
