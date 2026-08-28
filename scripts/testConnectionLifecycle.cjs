const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  ConnectionManager,
} = require('../dist/main/database/connectionManager')

function sqliteDraft(database, overrides = {}) {
  return {
    name: 'SQLite 生命周期测试',
    type: 'SQLite',
    host: '',
    port: 0,
    username: '',
    password: '',
    database,
    timeout: 30,
    charset: 'utf8mb4',
    ...overrides,
  }
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sqltool-lifecycle-'))
  const storage = path.join(root, 'user-data')
  const firstDatabase = path.join(root, 'first.sqlite')
  const secondDatabase = path.join(root, 'second.sqlite')
  const manager = new ConnectionManager(storage)

  try {
    const testResult = await manager.testConnection(
      sqliteDraft(firstDatabase),
    )
    assert.equal(testResult.success, true)

    let catalog = manager.createSavedConnection(
      sqliteDraft(firstDatabase),
    )
    const connectionId = catalog.connections[0].id

    assert.equal((await manager.connect(connectionId)).success, true)
    assert.deepEqual(await manager.getDatabases(connectionId), ['main'])
    const createResult = await manager.executeSQL(
      connectionId,
      'main',
      'CREATE TABLE lifecycle_test (id INTEGER PRIMARY KEY, name TEXT)',
    )
    assert.equal(createResult.success, true)
    assert.deepEqual(
      await manager.getTables(connectionId, 'main'),
      ['lifecycle_test'],
    )
    const databaseSummaries = await manager.getDatabaseSummaries(connectionId)
    assert.equal(databaseSummaries.length, 1)
    assert.equal(databaseSummaries[0].name, 'main')
    assert.equal(databaseSummaries[0].tableCount, 1)
    assert.ok(
      databaseSummaries[0].sizeBytes > 0,
      'SQLite 数据库摘要应包含有效大小',
    )
    const triggerResult = await manager.executeSQL(
      connectionId,
      'main',
      `CREATE TRIGGER lifecycle_event
       AFTER INSERT ON lifecycle_test
       BEGIN
         UPDATE lifecycle_test SET name = name WHERE id = NEW.id;
       END`,
    )
    assert.equal(triggerResult.success, true)
    assert.deepEqual(
      await manager.getEvents(connectionId, 'main'),
      ['lifecycle_event'],
    )

    catalog = await manager.updateSavedConnection(
      connectionId,
      sqliteDraft(firstDatabase, { name: 'SQLite 生命周期测试-已改名' }),
    )
    assert.equal(catalog.connections[0].name, 'SQLite 生命周期测试-已改名')
    assert.deepEqual(await manager.getDatabases(connectionId), ['main'])

    await manager.updateSavedConnection(
      connectionId,
      sqliteDraft(secondDatabase, { name: 'SQLite 生命周期测试-已改名' }),
    )
    await assert.rejects(
      () => manager.getDatabases(connectionId),
      /连接不存在/,
    )

    assert.equal((await manager.connect(connectionId)).success, true)
    assert.deepEqual(await manager.getDatabases(connectionId), ['main'])
    catalog = await manager.deleteSavedConnection(connectionId)
    assert.equal(catalog.connections.length, 0)
    assert.equal((await manager.connect(connectionId)).success, false)

    console.log('[连接生命周期测试] 全部通过')
  } finally {
    await manager.closeAll()
    fs.rmSync(root, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error('[连接生命周期测试] 失败', error)
  process.exitCode = 1
})
