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
  runDatabaseObjectCategoryAction,
} = require('../src/renderer/features/database-objects/databaseObjectCategoryActions.tsx')

const logs = []
global.window = {
  logger: {
    write: async (...entry) => {
      logs.push(entry)
    },
  },
}

const connection = {
  id: 'connection-1',
  name: '测试连接',
  type: 'MySQL',
}

function createRecorder() {
  const calls = []
  const record = (name, detail) => {
    calls.push({ name, detail })
  }
  return {
    calls,
    options: {
      onFocus: context => record('focus', context.category),
      onCreateTable: context => record('createTable', context.category),
      onSelectTransferTarget: (context, action) => {
        record('transfer', `${context.category}:${action}`)
      },
      onOpenQueryDocument: (context, input) => {
        record('queryDocument', `${context.category}:${input.name}`)
      },
      onOpenSqlFiles: context => record('sqlFiles', context.category),
      onSearch: context => record('search', context.category),
      onOpenBackup: context => record('backup', context.category),
      onRestoreBackup: context => record('restoreBackup', context.category),
      onExtractBackupSql: context => record('extractBackupSql', context.category),
      onCreateGroup: (context, name) => {
        record('createGroup', `${context.category}:${name}`)
      },
      onShowInFolder: context => record('folder', context.category),
      onRefresh: context => record('refresh', context.category),
    },
  }
}

async function runAction(category, action) {
  const recorder = createRecorder()
  await runDatabaseObjectCategoryAction(
    { connection, database: 'app', category },
    action,
    recorder.options,
  )
  return recorder.calls
}

function withoutFocus(calls) {
  assert.equal(calls[0]?.name, 'focus', '菜单动作执行前应先同步当前对象分类')
  return calls.slice(1)
}

async function testCreateActions() {
  const expected = {
    tables: ['createTable', 'tables'],
    views: ['queryDocument', 'views:新建视图.sql'],
    functions: ['queryDocument', 'functions:新建函数.sql'],
    events: ['queryDocument', 'events:新建事件.sql'],
    queries: ['queryDocument', 'queries:新建查询.sql'],
    reports: ['queryDocument', 'reports:新建报表.sql'],
    backups: ['backup', 'backups'],
  }

  for (const [category, route] of Object.entries(expected)) {
    const calls = withoutFocus(await runAction(category, 'create'))
    assert.deepEqual(
      calls.map(call => [call.name, call.detail]),
      [route],
      `${category} 新建动作路由不正确`,
    )
  }
}

async function testOperationalActions() {
  const cases = [
    ['tables', 'import', 'transfer', 'tables:import'],
    ['tables', 'export', 'transfer', 'tables:export'],
    ['views', 'export', 'transfer', 'views:export'],
    ['tables', 'runSqlFile', 'sqlFiles', 'tables'],
    ['queries', 'openArchive', 'sqlFiles', 'queries'],
    ['reports', 'openArchive', 'sqlFiles', 'reports'],
    ['backups', 'restore', 'restoreBackup', 'backups'],
    ['backups', 'extractSql', 'extractBackupSql', 'backups'],
    ['tables', 'search', 'search', 'tables'],
    ['queries', 'showInFolder', 'folder', 'queries'],
    ['reports', 'showInFolder', 'folder', 'reports'],
    ['backups', 'showInFolder', 'folder', 'backups'],
    ['events', 'refresh', 'refresh', 'events'],
  ]

  for (const [category, action, expectedName, expectedDetail] of cases) {
    const calls = withoutFocus(await runAction(category, action))
    assert.deepEqual(
      calls,
      [{ name: expectedName, detail: expectedDetail }],
      `${category}.${action} 动作路由不正确`,
    )
  }
}

async function testDisabledActionFallback() {
  logs.length = 0
  const calls = withoutFocus(await runAction('tables', 'paste'))
  assert.deepEqual(calls, [], '禁用的粘贴动作不应调用业务处理器')
  assert.equal(
    logs.some(entry => entry[0] === 'warn' && entry[2].includes('动作=paste')),
    true,
    '未处理动作应写入本地警告日志',
  )
}

async function testDetailedInfoLogs() {
  logs.length = 0
  await runAction('events', 'refresh')
  const messages = logs
    .filter(entry => entry[0] === 'info')
    .map(entry => entry[2])
    .join('\n')

  assert.match(messages, /追踪=[^,]+/, '详细日志应包含单次动作追踪 ID')
  assert.match(messages, /阶段=开始/, '详细日志应记录动作开始')
  assert.match(
    messages,
    /阶段=上下文同步完成.*路由=onFocus/,
    '详细日志应记录上下文同步路由',
  )
  assert.match(
    messages,
    /阶段=完成.*路由=onRefresh/,
    '详细日志应记录最终业务路由',
  )
  assert.match(messages, /耗时=\d+ms/, '详细日志应记录动作耗时')
}

async function main() {
  console.log('[数据库对象分类动作测试] 开始')
  await testCreateActions()
  await testOperationalActions()
  await testDetailedInfoLogs()
  await testDisabledActionFallback()
  console.log('[数据库对象分类动作测试] 全部通过')
}

main().catch(error => {
  console.error('[数据库对象分类动作测试] 失败', error)
  process.exitCode = 1
})
