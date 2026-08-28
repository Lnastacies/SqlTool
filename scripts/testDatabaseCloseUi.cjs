const assert = require('node:assert/strict')
const {
  delay,
  ElectronCdpTestClient,
  waitFor,
} = require('./electronCdpTestClient.cjs')

const port = Number(process.env.SQLTOOL_DEBUG_PORT || 9222)

async function connectFirstConnection(client) {
  await waitFor(
    () => client.evaluate(
      `document.querySelectorAll('.connection-tree').length > 0`,
    ),
    '连接树加载',
  )
  await client.evaluate(`(() => {
    const groupRows = [...document.querySelectorAll('.ant-tree-treenode')]
      .filter(row => row.querySelector('.tree-icon--group'))
    groupRows.forEach(row => {
      const switcher = row.querySelector('.ant-tree-switcher')
      if (!switcher?.classList.contains('ant-tree-switcher_open')) {
        switcher?.click()
      }
    })
  })()`)
  await waitFor(
    () => client.evaluate(
      `document.querySelectorAll('.tree-icon--connection').length > 0`,
    ),
    '分组内连接加载',
  )
  await client.evaluate(`(() => {
    const connectionRow = [...document.querySelectorAll('.ant-tree-treenode')]
      .find(row => row.querySelector('.tree-icon--connection'))
    connectionRow?.querySelector('.tree-node-title')?.click()
  })()`)
  await waitFor(
    () => client.evaluate(`(() => {
      const row = [...document.querySelectorAll('.ant-tree-treenode')]
        .find(item => item.querySelector('.tree-icon--connection'))
      return Boolean(row?.querySelector('.tree-node-status'))
    })()`),
    '数据库连接建立',
  )
  await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')]
      .find(item => item.querySelector('.tree-icon--connection'))
    const switcher = row?.querySelector('.ant-tree-switcher')
    if (!switcher?.classList.contains('ant-tree-switcher_open')) switcher?.click()
  })()`)
}

async function readTestDatabases(client) {
  return waitFor(
    () => client.evaluate(`(() => {
      const protectedNames = new Set([
        'information_schema', 'mysql', 'performance_schema', 'sys',
        'postgres', 'template0', 'template1', 'master', 'model', 'msdb', 'tempdb',
      ])
      const names = [...document.querySelectorAll('.ant-tree-treenode')]
        .filter(row => row.querySelector('.tree-icon--database'))
        .map(row => row.querySelector('.tree-node-label')?.textContent?.trim())
        .filter(name => name && !protectedNames.has(name.toLowerCase()))
      return names.length >= 2 ? names.slice(0, 2) : null
    })()`),
    '两个非系统数据库实例',
  )
}

async function openDatabase(client, database) {
  const clicked = await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')].find(item =>
      item.querySelector('.tree-icon--database')
      && item.querySelector('.tree-node-label')?.textContent?.trim()
        === ${JSON.stringify(database)}
    )
    row?.querySelector('.tree-node-title')?.click()
    return Boolean(row)
  })()`)
  assert.equal(clicked, true, `未找到数据库节点: ${database}`)
  await waitFor(
    () => client.evaluate(`(() => {
      const labels = [...document.querySelectorAll(
        '.tree-node-label--database-open'
      )]
      return labels.some(item =>
        item.textContent?.trim() === ${JSON.stringify(database)}
      )
    })()`),
    `数据库 ${database} 打开`,
  )
}

async function closeDatabaseFromMenu(client, database) {
  const opened = await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')].find(item =>
      item.querySelector('.tree-icon--database')
      && item.querySelector('.tree-node-label')?.textContent?.trim()
        === ${JSON.stringify(database)}
    )
    const target = row?.querySelector('.tree-node-title')
    if (!target) return false
    const rect = target.getBoundingClientRect()
    target.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 8,
      clientY: rect.top + 7,
      button: 2,
    }))
    return true
  })()`)
  assert.equal(opened, true, `无法打开数据库右键菜单: ${database}`)
  await waitFor(
    () => client.evaluate(
      `[...document.querySelectorAll('.ant-dropdown-menu-item')]
        .some(item => item.textContent?.trim() === '关闭数据库')`,
    ),
    '关闭数据库菜单项',
  )
  await client.evaluate(`(() => {
    const item = [...document.querySelectorAll('.ant-dropdown-menu-item')]
      .find(node => node.textContent?.trim() === '关闭数据库')
    item?.click()
  })()`)
}

async function readCloseState(client, closedDatabase, selectedDatabase) {
  return client.evaluate(`(() => {
    const openNames = [...document.querySelectorAll(
      '.tree-node-label--database-open'
    )].map(item => item.textContent?.trim())
    const title = document.querySelector('.table-overview__titlebar')
      ?.textContent?.replace(/\\s+/g, ' ').trim() || ''
    return {
      closed: !openNames.includes(${JSON.stringify(closedDatabase)}),
      selectedRemainsOpen: openNames.includes(${JSON.stringify(selectedDatabase)}),
      title,
    }
  })()`)
}

async function main() {
  console.log('[关闭数据库界面测试] 开始')
  const targets = await fetch(
    `http://127.0.0.1:${port}/json/list`,
  ).then(response => response.json())
  const target = targets.find(
    item => item.type === 'page' && item.title.includes('SQLTool'),
  )
  assert.ok(target?.webSocketDebuggerUrl, '未找到 SQLTool Electron 调试页面')

  const client = new ElectronCdpTestClient(target.webSocketDebuggerUrl)
  await client.connect()
  try {
    await connectFirstConnection(client)
    const [closedDatabase, selectedDatabase] = await readTestDatabases(client)
    await openDatabase(client, closedDatabase)
    await openDatabase(client, selectedDatabase)
    await closeDatabaseFromMenu(client, closedDatabase)

    const state = await waitFor(
      async () => {
        const current = await readCloseState(
          client,
          closedDatabase,
          selectedDatabase,
        )
        return current.closed && current.selectedRemainsOpen ? current : null
      },
      '数据库树节点一次关闭',
    )
    await delay(800)
    const stableState = await readCloseState(
      client,
      closedDatabase,
      selectedDatabase,
    )
    assert.equal(stableState.closed, true, '已关闭数据库被异步加载重新展开')
    assert.equal(stableState.selectedRemainsOpen, true, '当前数据库状态被误清理')
    assert.equal(
      state.title.replace(/\s*@\s*/, ' @ '),
      `表 @ ${selectedDatabase}`,
    )
    assert.deepEqual(client.errors, [], `界面运行异常: ${client.errors.join('\n')}`)
    console.log(
      `[关闭数据库界面测试] 全部通过: 关闭=${closedDatabase}, 保持=${selectedDatabase}`,
    )
  } finally {
    client.close()
  }
}

main().catch(error => {
  console.error('[关闭数据库界面测试] 失败', error)
  process.exitCode = 1
})
