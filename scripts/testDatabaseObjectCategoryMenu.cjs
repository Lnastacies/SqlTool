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
  buildDatabaseObjectContextMenu,
} = require('../src/renderer/features/database-objects/databaseObjectContextMenu.tsx')
const {
  buildDatabaseObjectCreateDocument,
} = require('../src/renderer/features/database-objects/databaseObjectCreateTemplate.ts')
const {
  createDatabaseObjectGroup,
  loadDatabaseObjectGroups,
} = require('../src/renderer/features/database-objects/databaseObjectGroupStore.ts')
const {
  buildDatabaseObjectTree,
} = require('../src/renderer/features/database-objects/databaseObjectModel.ts')
const {
  buildDatabaseBackupContextMenu,
} = require('../src/renderer/features/backups/databaseBackupContextMenu.tsx')

const expectedMenus = {
  tables: [
    '新建表', '导入向导...', '导出向导...', '运行 SQL 文件...',
    '在数据库中查找', '新建组', '粘贴', '刷新',
  ],
  views: ['新建视图', '导出向导', '新建组', '粘贴', '刷新'],
  functions: ['新建函数', '新建组', '粘贴', '刷新'],
  events: ['新建事件', '新建组', '粘贴', '刷新'],
  queries: [
    '新建查询', '打开查询文件...', '新建组', '粘贴',
    '在文件夹中显示', '刷新',
  ],
  reports: [
    '新建报表', '打开报表存档', '新建组', '粘贴',
    '在文件夹中显示', '刷新',
  ],
  backups: [
    '新建备份', '还原备份从...', '提取 SQL 从...', '新建组',
    '粘贴', '在文件夹中显示', '刷新',
  ],
}

function visibleItems(items) {
  return items.filter(item => item && item.type !== 'divider')
}

function testMenus() {
  for (const [category, expectedLabels] of Object.entries(expectedMenus)) {
    const calls = []
    const items = buildDatabaseObjectContextMenu({
      category,
      onAction: action => calls.push(action),
    })
    const visible = visibleItems(items)
    assert.deepEqual(
      visible.map(item => item.label),
      expectedLabels,
      `${category} 菜单项顺序不正确`,
    )

    const paste = visible.find(item => item.key === 'paste')
    assert.equal(paste.disabled, true, `${category} 的粘贴菜单应保持禁用`)
    visible
      .filter(item => !item.disabled)
      .forEach(item => item.onClick())
    assert.deepEqual(
      calls,
      visible.filter(item => !item.disabled).map(item => item.key),
      `${category} 菜单动作分发不正确`,
    )
  }
}

function testBackupRecordMenu() {
  const calls = []
  const items = buildDatabaseBackupContextMenu({
    onAction: action => calls.push(action),
  })
  const visible = visibleItems(items)
  assert.deepEqual(
    visible.map(item => item.label),
    [
      '还原此备份...',
      '提取 SQL...',
      '重命名',
      '校验完整性',
      '在文件夹中显示',
      '删除备份',
    ],
  )
  visible.forEach(item => item.onClick())
  assert.deepEqual(
    calls,
    ['restore', 'extract', 'rename', 'verify', 'showInFolder', 'delete'],
  )
}

function testCreateDocuments() {
  assert.match(
    buildDatabaseObjectCreateDocument('MySQL', 'views').sql,
    /CREATE VIEW view_name AS/,
  )
  assert.match(
    buildDatabaseObjectCreateDocument('PostgreSQL', 'functions').sql,
    /LANGUAGE plpgsql/,
  )
  assert.match(
    buildDatabaseObjectCreateDocument('SQL Server', 'events').sql,
    /SQL Server Agent/,
  )
  assert.equal(
    buildDatabaseObjectCreateDocument('SQLite', 'queries').sql,
    '',
  )
  assert.equal(
    buildDatabaseObjectCreateDocument('MySQL', 'backups'),
    undefined,
  )
}

function createMemoryStorage() {
  let value = null
  return {
    getItem: () => value,
    setItem: (_key, nextValue) => {
      value = nextValue
    },
  }
}

function testObjectGroups() {
  const storage = createMemoryStorage()
  const context = {
    connId: 'connection-1',
    database: 'app',
    category: 'tables',
  }
  const group = createDatabaseObjectGroup(context, '  核心业务  ', storage)
  assert.equal(group.name, '核心业务')
  assert.deepEqual(
    loadDatabaseObjectGroups('connection-1', 'app', storage),
    [group],
  )
  assert.throws(
    () => createDatabaseObjectGroup(context, '核心业务', storage),
    /已存在/,
  )
  assert.throws(
    () => createDatabaseObjectGroup(context, '   ', storage),
    /不能为空/,
  )

  const tree = buildDatabaseObjectTree(
    'connection-1',
    'app',
    {
      tables: ['users'],
      views: [],
      functions: [],
      procedures: [],
      events: [],
      queries: [],
      reports: [],
      backups: [],
    },
    [group],
  )
  const tableCategory = tree.find(item => item.type === 'tables')
  assert.equal(tableCategory.children[0].type, 'objectGroup')
  assert.equal(tableCategory.children[0].title, '核心业务')
  assert.equal(tableCategory.children[1].title, 'users')

  const backupTree = buildDatabaseObjectTree(
    'connection-1',
    'app',
    {
      tables: [],
      views: [],
      functions: [],
      procedures: [],
      events: [],
      queries: [],
      reports: [],
      backups: ['daily.sql.gz'],
    },
    [],
    [{ id: 'backup-1', name: '每日备份', fileName: 'daily.sql.gz' }],
  )
  const backupNode = backupTree.find(item => item.type === 'backups').children[0]
  assert.equal(backupNode.key, 'database-backup:connection-1:app:backup-1')
  assert.equal(backupNode.objectId, 'backup-1')
  assert.equal(backupNode.objectName, '每日备份')
}

console.log('[数据库对象分类菜单测试] 开始')
testMenus()
testBackupRecordMenu()
testCreateDocuments()
testObjectGroups()
console.log('[数据库对象分类菜单测试] 全部通过')
