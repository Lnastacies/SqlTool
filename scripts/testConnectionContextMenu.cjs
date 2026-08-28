const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

function registerTypeScriptLoader(extension) {
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

registerTypeScriptLoader('.ts')
registerTypeScriptLoader('.tsx')

const {
  buildConnectionContextMenu,
} = require('../src/renderer/features/connections/connectionContextMenu.tsx')
const {
  formatTerminalResult,
} = require('../src/renderer/features/connections/terminalResultFormatter.ts')

function createMenu(type = 'MySQL') {
  const calls = []
  const connection = {
    id: 'connection-1',
    name: '测试连接',
    type,
    groupId: 'group-1',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: '',
    database: '',
    color: '#3578C4',
  }
  const callback = name => value => calls.push([name, value])
  const items = buildConnectionContextMenu({
    connection,
    groups: [
      { id: 'group-1', name: '开发组' },
      { id: 'group-2', name: '生产组' },
    ],
    active: true,
    onConnect: callback('connect'),
    onDisconnect: callback('disconnect'),
    onEdit: callback('edit'),
    onNewConnection: callback('newConnection'),
    onDelete: callback('delete'),
    onDuplicate: callback('duplicate'),
    onCreateDatabase: callback('createDatabase'),
    onNewQuery: callback('newQuery'),
    onOpenTerminal: callback('terminal'),
    onRunSqlFile: callback('runSqlFile'),
    onRefresh: callback('refresh'),
    onMoveToGroup: callback('moveToGroup'),
    onNewGroup: callback('newGroup'),
    onSetColor: callback('setColor'),
  })
  return { items, calls }
}

function findItem(items, key) {
  return items.find(item => item && item.key === key)
}

function visibleLabels(items) {
  return items
    .filter(item => item && item.type !== 'divider')
    .map(item => item.label)
    .filter(label => typeof label === 'string')
}

function testMenu() {
  const { items, calls } = createMenu()
  assert.deepEqual(visibleLabels(items), [
    '关闭连接',
    '编辑连接...',
    '新建连接',
    '删除连接',
    '复制连接...',
    '新建数据库...',
    '新建查询',
    '命令列界面...',
    '运行SQL文件...',
    '刷新',
    '管理组',
    '颜色',
  ])

  findItem(items, 'duplicate').onClick()
  findItem(items, 'terminal').onClick()
  findItem(items, 'run-sql-file').onClick()
  findItem(items, 'manage-group').children
    .find(item => item.key === 'group:group-2').onClick()
  findItem(items, 'color').children
    .find(item => item.key === 'color:green').onClick()
  assert.deepEqual(calls, [
    ['duplicate', undefined],
    ['terminal', undefined],
    ['runSqlFile', undefined],
    ['moveToGroup', 'group-2'],
    ['setColor', '#3F9D63'],
  ])

  const sqliteMenu = createMenu('SQLite').items
  assert.equal(findItem(sqliteMenu, 'create-database'), undefined)
}

function testTerminalFormatting() {
  assert.deepEqual(formatTerminalResult({
    success: true,
    columns: ['id', 'name'],
    rows: [{ id: 1, name: '测试' }],
    affected_rows: 0,
    message: '执行成功',
    execution_time: 0.0123,
  }), [
    '执行成功',
    'id\tname',
    '--------\t--------',
    '1\t测试',
    '返回 1 行',
    '执行耗时 0.0123 秒',
  ])
}

testMenu()
testTerminalFormatting()
console.log('[连接右键菜单测试] 全部通过')
