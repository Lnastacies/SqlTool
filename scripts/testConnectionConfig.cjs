const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  ConnectionConfigStore,
} = require('../dist/main/database/connectionConfigStore')

function draft(overrides = {}) {
  return {
    name: '本地测试库',
    type: 'MySQL',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: 'test-secret',
    database: '',
    timeout: 30,
    charset: 'utf8mb4',
    ...overrides,
  }
}

function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sqltool-config-'))
  const storage = path.join(root, 'user-data')
  const legacyFile = path.join(root, 'legacy-connections.json')
  const legacyKey = path.join(root, 'legacy.key')
  fs.mkdirSync(storage, { recursive: true })

  try {
    let store = new ConnectionConfigStore(storage, legacyFile, legacyKey)
    assert.deepEqual(store.getCatalog(), { connections: [], groups: [] })

    let catalog = store.createGroup('生产环境')
    const groupId = catalog.groups[0].id
    catalog = store.createConnection(draft({ groupId, color: '#3578c4' }))
    const connectionId = catalog.connections[0].id
    assert.equal(catalog.connections[0].password, 'test-secret')
    assert.equal(catalog.connections[0].color, '#3578C4')

    const persisted = JSON.parse(
      fs.readFileSync(path.join(storage, 'connections.json'), 'utf8'),
    )
    assert.match(persisted.connections[0].password, /^enc:v1:/)
    assert.notEqual(persisted.connections[0].password, 'test-secret')
    assert.equal(persisted.connections[0].color, '#3578C4')

    store = new ConnectionConfigStore(storage, legacyFile, legacyKey)
    assert.equal(store.getConnection(connectionId).password, 'test-secret')
    assert.equal(store.getConnection(connectionId).color, '#3578C4')
    assert.throws(
      () => store.updateConnection(
        connectionId,
        draft({ name: '非法颜色连接', groupId, color: 'red' }),
      ),
      /连接颜色格式无效/,
    )
    assert.throws(
      () => store.createConnection(draft()),
      /连接名称已存在/,
    )
    assert.equal(store.getCatalog().connections.length, 1)

    catalog = store.updateConnection(
      connectionId,
      draft({ name: '本地测试库-已编辑', groupId }),
    )
    assert.equal(catalog.connections[0].name, '本地测试库-已编辑')
    catalog = store.deleteGroup(groupId)
    assert.equal(catalog.connections[0].groupId, undefined)
    catalog = store.deleteConnection(connectionId)
    assert.equal(catalog.connections.length, 0)

    const migrationStorage = path.join(root, 'migration-user-data')
    fs.mkdirSync(migrationStorage, { recursive: true })
    fs.writeFileSync(legacyFile, JSON.stringify({
      connections: {
        legacy: draft({ name: '旧连接', password: '' }),
      },
      groups: {
        '旧分组': ['legacy'],
      },
    }))
    const migrated = new ConnectionConfigStore(
      migrationStorage,
      legacyFile,
      legacyKey,
    ).getCatalog()
    assert.equal(migrated.groups[0].name, '旧分组')
    assert.equal(migrated.connections[0].groupId, migrated.groups[0].id)
    assert.equal(
      JSON.parse(fs.readFileSync(
        path.join(migrationStorage, 'connections.json'),
        'utf8',
      )).version,
      2,
    )

    console.log('[连接配置测试] 全部通过')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

main()
