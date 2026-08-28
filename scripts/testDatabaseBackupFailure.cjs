const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

const originalLoad = Module._load
Module._load = function loadWithElectronMock(request, parent, isMain) {
  if (request === 'electron') return { dialog: {}, shell: {} }
  return originalLoad.call(this, request, parent, isMain)
}

const {
  createDatabaseBackup,
} = require('../dist/main/database/databaseBackupCreationService')
const {
  DatabaseBackupStore,
} = require('../dist/main/database/databaseBackupStore')
Module._load = originalLoad

function createMySqlContext(executeSQL) {
  return {
    connectionId: 'mysql-disconnect',
    database: 'business',
    active: {
      adapter: { executeSQL },
      connection: {},
      connData: { type: 'MySQL' },
    },
    model: {
      name: 'business',
      type: 'MySQL',
      tables: [{
        name: 'account',
        fields: [{ name: 'id', type: 'BIGINT', primary: true }],
        foreignKeys: [],
        ddl: 'CREATE TABLE `account` (`id` BIGINT PRIMARY KEY)',
      }],
      views: [],
      functions: [],
      procedures: [],
      events: [],
    },
    request: {
      operationId: 'disconnect-test',
      name: '断连测试',
      description: '',
      mode: 'structure-data',
      scope: {
        tables: ['account'],
        views: [],
        functions: [],
        procedures: [],
        events: [],
      },
      options: {
        compressed: true,
        includeDropStatements: true,
        disableForeignKeyChecks: true,
        stripDefiners: true,
      },
    },
    loadPage: async () => {
      throw new Error('服务断连后不应继续读取表数据')
    },
  }
}

async function listFiles(directory) {
  const entries = await fs.promises.readdir(
    directory,
    { withFileTypes: true },
  )
  const files = []
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(entryPath))
    } else {
      files.push(entryPath)
    }
  }
  return files
}

async function assertDisconnectFailure(store, context, progress) {
  await assert.rejects(
    () => createDatabaseBackup(
      store,
      context,
      event => progress.push(event),
    ),
    error => {
      assert.match(error.message, /数据库服务连接已中断/)
      assert.match(error.message, /ECONNRESET/)
      return true
    },
  )
  assert.equal(progress.at(-1).phase, 'complete')
  assert.equal(progress.at(-1).level, 'error')
  assert.equal(progress.at(-1).percent, 0)
  assert.match(progress.at(-1).message, /数据库服务连接已中断/)
}

async function main() {
  const tempDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'sqltool-backup-failure-'),
  )
  const store = new DatabaseBackupStore(path.join(tempDirectory, 'backups'))
  const progress = []
  let executedSql = ''

  try {
    const context = createMySqlContext(
      async (_connection, _database, sql) => {
        executedSql = sql
        return { success: false, message: '执行失败: read ECONNRESET' }
      },
    )
    await assertDisconnectFailure(store, context, progress)

    assert.match(executedSql, /information_schema\.TRIGGERS/)
    assert.equal(
      (await store.list(context.connectionId, context.database)).length,
      0,
    )

    // 模拟已创建备份目标后，读取首批表数据时数据库服务退出。
    const midstreamContext = createMySqlContext(async () => {
      throw new Error('仅数据备份不应读取对象 DDL')
    })
    midstreamContext.request.operationId = 'midstream-disconnect-test'
    midstreamContext.request.mode = 'data'
    midstreamContext.loadPage = async () => {
      throw new Error('读取表数据失败: read ECONNRESET')
    }
    const midstreamProgress = []
    await assertDisconnectFailure(
      store,
      midstreamContext,
      midstreamProgress,
    )
    assert.deepEqual(
      await listFiles(path.join(tempDirectory, 'backups')),
      [],
      '写入中途断连后不应遗留备份文件或临时文件',
    )
    console.log('[数据库备份断连测试] 全部通过')
  } finally {
    await fs.promises.rm(tempDirectory, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error('[数据库备份断连测试] 失败', error)
  process.exitCode = 1
})
