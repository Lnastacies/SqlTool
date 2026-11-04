/**
 * 回归测试：连接被服务端断开（空闲超时 / 被踢下线）后，
 * 手动“断开连接”“关闭数据库”“测试连接”都不能因为底层驱动抛错而失败。
 *
 * 覆盖三个高危修复：
 *  H1 PostgreSQL close 走底层 socket.destroy，而不是不存在的 client.destroy()
 *  H2 MySQL close 在 close() 不可用时降级 destroy()/end()，不再静默泄漏
 *  H3 testConnection 的 finally 不再让 close 异常覆盖 return false/true
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  ConnectionManager,
} = require('../dist/main/database/connectionManager')
const {
  MySQLAdapter,
  PostgreSQLAdapter,
  SQLiteAdapter,
} = require('../dist/main/database/adapters')

// mysql2 在连接已关闭时的真实错误文案
const CLOSED_ERROR = "Can't add new command when connection is in closed state"

function sqliteDraft(database, overrides = {}) {
  return {
    name: '连接失效关闭回归测试',
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

/** H1：pg.Client 没有 destroy()，必须销毁底层 connection.stream */
async function testPostgresClose() {
  const pg = new PostgreSQLAdapter()

  let destroyed = false
  let ended = false
  const fakeClient = {
    connection: { stream: { destroy: () => { destroyed = true } } },
    end: async () => { ended = true },
  }
  await pg.close(fakeClient)
  assert.equal(destroyed, true, 'PostgreSQL 关闭应销毁底层 socket')
  assert.equal(ended, false, '有 stream 时不应再走 end()')

  // 取不到 stream 且 end() 抛错：close 必须吞掉异常
  const brokenClient = {
    connection: {},
    end: async () => { throw new Error('Connection terminated unexpectedly') },
  }
  await assert.doesNotReject(() => pg.close(brokenClient))
}

/** H2：PromiseConnection 无 close()/destroy()，必须落到内部 BaseConnection */
async function testMysqlClose() {
  const my = new MySQLAdapter()

  // 模拟真实 mysql2 PromiseConnection：外层没有 close/destroy，内层 BaseConnection 有
  let rawClosed = false
  const promiseConn = {
    connection: {
      config: { host: '127.0.0.1', port: 3306 },
      close: () => { rawClosed = true },
    },
    end: async () => { throw new Error(CLOSED_ERROR) },
  }
  await my.close(promiseConn)
  assert.equal(rawClosed, true, 'MySQL 必须关闭内部的 BaseConnection')

  // close 抛错时应降级到 destroy
  let rawDestroyed = false
  const destructiveConn = {
    connection: {
      config: { host: '10.0.0.1', port: 3307 },
      close: () => { throw new Error(CLOSED_ERROR) },
      destroy: () => { rawDestroyed = true },
    },
  }
  await my.close(destructiveConn)
  assert.equal(rawDestroyed, true, 'close 失败后应降级 destroy')

  // 只有 end() 且必然抛错：close 不能向调用方抛错
  const endOnlyConn = { end: async () => { throw new Error(CLOSED_ERROR) } }
  await assert.doesNotReject(() => my.close(endOnlyConn))
}

async function testManagerCloseFlow() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sqltool-lost-close-'))
  const storage = path.join(root, 'user-data')
  const databaseFile = path.join(root, 'lost.sqlite')
  const manager = new ConnectionManager(storage)

  try {
    const catalog = manager.createSavedConnection(sqliteDraft(databaseFile))
    const connectionId = catalog.connections[0].id
    assert.equal((await manager.connect(connectionId)).success, true)

    // 把适配器替换为“已断开”行为：所有访问与关闭都抛驱动级错误
    const active = manager.connections.get(connectionId)
    assert.ok(active, '连接应已注册')
    const adapter = active.adapter
    adapter.getDatabases = async () => { throw new Error(CLOSED_ERROR) }
    adapter.close = async () => { throw new Error(CLOSED_ERROR) }

    // H3：适配器 close 抛错时 testConnection 仍应返回业务结果，而不是抛出 close 异常
    const originalClose = SQLiteAdapter.prototype.close
    SQLiteAdapter.prototype.close = async () => { throw new Error(CLOSED_ERROR) }
    try {
      const testResult = await manager.testConnection(sqliteDraft(databaseFile))
      assert.equal(testResult.success, true, 'testConnection 不应被 close 异常干扰')
    } finally {
      SQLiteAdapter.prototype.close = originalClose
    }

    // 断开连接：不抛错、注册表清空
    await assert.doesNotReject(() => manager.disconnect(connectionId))
    assert.equal(manager.connections.has(connectionId), false, '断开后应移除连接注册项')
    assert.equal(manager.connections.size, 0, '断开后不应残留连接')

    // 重复断开必须幂等
    await assert.doesNotReject(() => manager.disconnect(connectionId))
    assert.equal(manager.connections.size, 0)

    // 重连后关闭数据库：连接已失效 → 本地清理 + 标记失效，整体仍成功
    assert.equal((await manager.connect(connectionId)).success, true)
    // getAdapter 每次返回新实例，重连后需重新注入“已断开”行为
    const reconnected = manager.connections.get(connectionId)
    assert.ok(reconnected, '重连后连接应重新注册')
    reconnected.adapter.getDatabases = async () => { throw new Error(CLOSED_ERROR) }
    reconnected.adapter.close = async () => { throw new Error(CLOSED_ERROR) }
    const closeResult = await manager.closeDatabase(connectionId, 'main')
    assert.equal(closeResult.name, 'main')
    assert.equal(closeResult.connectionInvalidated, true, '应标记连接已失效')
    assert.equal(manager.connections.has(connectionId), false, '失效连接应被剔除')
    assert.equal(manager.databaseConnections.contexts.size, 0, '数据库上下文应清理干净')

    // 连接已被剔除后再次关闭：快速失败且错误语义明确（不会暴露底层驱动原文）
    await assert.rejects(
      () => manager.closeDatabase(connectionId, 'main'),
      /连接不存在|尚未连接/,
    )

    console.log('[连接失效关闭回归测试] 全部通过')
  } finally {
    await manager.closeAll()
    fs.rmSync(root, { recursive: true, force: true })
  }
}

/**
 * M1：连接/断开竞态。
 * “发起连接后立刻断开”时，disconnect 必须先等待在途建连结束再清理，
 * 否则建连完成后会残留一条没有 UI 归属的活连接。
 */
async function testConnectThenImmediateDisconnect() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sqltool-race-'))
  const manager = new ConnectionManager(path.join(root, 'user-data'))
  const databaseFile = path.join(root, 'race.sqlite')

  try {
    const catalog = manager.createSavedConnection(sqliteDraft(databaseFile, {
      name: '连接断开竞态回归测试',
    }))
    const connectionId = catalog.connections[0].id

    // 不等待建连结束，立刻触发断开
    const connecting = manager.connect(connectionId)
    const disconnecting = manager.disconnect(connectionId)
    await Promise.allSettled([connecting, disconnecting])

    assert.equal(
      manager.connections.has(connectionId),
      false,
      '连接后立即断开不能残留活动连接',
    )
    assert.equal(manager.connections.size, 0, '连接后立即断开应清空注册表')
    assert.equal(
      manager.connectingPromises.size,
      0,
      '建连流程结束后不应残留进行中的建连记录',
    )

    console.log('[连接断开竞态回归测试] 通过')
  } finally {
    await manager.closeAll()
    fs.rmSync(root, { recursive: true, force: true })
  }
}

async function main() {
  await testPostgresClose()
  await testMysqlClose()
  await testManagerCloseFlow()
  await testConnectThenImmediateDisconnect()
}

main().catch(error => {
  console.error('[连接失效关闭回归测试] 失败', error)
  process.exitCode = 1
})
