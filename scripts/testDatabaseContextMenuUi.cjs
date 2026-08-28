const assert = require('node:assert/strict')

const port = Number(process.env.SQLTOOL_DEBUG_PORT || 9222)
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

class CdpClient {
  constructor(url) {
    this.url = url
    this.nextId = 1
    this.pending = new Map()
    this.errors = []
  }

  async connect() {
    this.socket = new WebSocket(this.url)
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data))
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        if (message.error) pending.reject(new Error(message.error.message))
        else pending.resolve(message.result)
        return
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const detail = message.params.exceptionDetails
        this.errors.push(detail.exception?.description || detail.text)
      }
    })
    await this.send('Runtime.enable')
  }

  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description
        || response.exceptionDetails.text)
    }
    return response.result.value
  }

  close() {
    this.socket.close()
  }
}

async function waitFor(action, label, timeout = 12000) {
  const deadline = Date.now() + timeout
  let lastValue
  while (Date.now() < deadline) {
    lastValue = await action()
    if (lastValue) return lastValue
    await delay(250)
  }
  throw new Error(`等待超时: ${label}; 最后结果=${JSON.stringify(lastValue)}`)
}

/** 通过 Escape 键关闭页面上残留的浮层菜单（如上一测试遗留的右键菜单）。 */
async function closeFloatingMenus(client) {
  for (const type of ['keyDown', 'keyUp']) {
    await client.send('Input.dispatchKeyEvent', {
      type,
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    })
  }
  await delay(300)
}

async function waitForConnectionTree(client) {
  try {
    await waitFor(
      () => client.evaluate(`document.querySelectorAll('.connection-tree').length > 0`),
      '连接树容器加载',
    )
    await client.evaluate(`(() => {
      const groups = [...document.querySelectorAll('.ant-tree-treenode')]
        .filter(row => row.querySelector('.tree-icon--group'))
      groups.forEach(row => {
        const switcher = row.querySelector('.ant-tree-switcher')
        if (switcher && !switcher.classList.contains('ant-tree-switcher_open')) {
          switcher.click()
        }
      })
    })()`)
    await waitFor(
      () => client.evaluate(`document.querySelectorAll('.tree-icon--connection').length > 0`),
      '分组内连接节点加载',
    )
  } catch (error) {
    // UI 回归失败时保留页面状态，避免仅凭超时信息猜测根因。
    const diagnostics = await client.evaluate(`(() => ({
      readyState: document.readyState,
      bodyText: document.body?.innerText?.slice(0, 500) || '',
      rootChildren: document.querySelector('#root')?.children.length || 0,
      treeCount: document.querySelectorAll('.connection-tree').length,
      connectionCount: document.querySelectorAll('.tree-icon--connection').length,
    }))()`)
    throw new Error(
      `${error.message}; 页面诊断=${JSON.stringify(diagnostics)}; `
      + `运行时异常=${JSON.stringify(client.errors)}`,
    )
  }
}

async function connectAndExpandFirstConnection(client) {
  const connectionName = await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')].find(item =>
      item.querySelector('.tree-icon--connection')
    )
    const title = row?.querySelector('.tree-node-title')
    if (!title) return ''
    title.click()
    return row.querySelector('.tree-node-label')?.textContent?.trim() || ''
  })()`)
  assert.ok(connectionName, '未找到可连接的数据库连接节点')

  await waitFor(
    () => client.evaluate(`(() => {
      const row = [...document.querySelectorAll('.ant-tree-treenode')].find(item =>
        item.querySelector('.tree-icon--connection')
      )
      return Boolean(row?.querySelector('.tree-node-status')
        && row?.querySelector('.ant-tree-switcher'))
    })()`),
    `连接 ${connectionName} 建立`,
    20000,
  )
  await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')].find(item =>
      item.querySelector('.tree-icon--connection')
    )
    const switcher = row?.querySelector('.ant-tree-switcher')
    if (switcher && !switcher.classList.contains('ant-tree-switcher_open')) {
      switcher.click()
    }
  })()`)
}

async function openDatabaseMenu(client, database) {
  const opened = await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')].find(item =>
      item.querySelector('.tree-icon--database')
      && item.querySelector('.tree-node-label')?.textContent?.trim() === ${JSON.stringify(database)}
    )
    const target = row?.querySelector('.tree-node-title')
    if (!target) return false
    const rect = target.getBoundingClientRect()
    target.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 20,
      clientY: rect.top + 10,
      button: 2,
    }))
    return true
  })()`)
  assert.equal(opened, true, `未找到数据库节点: ${database}`)
  await waitFor(
    () => client.evaluate(`document.querySelectorAll('.ant-dropdown-menu-item').length >= 12`),
    '数据库右键菜单',
  )
}

async function clickMenu(client, label) {
  const clicked = await client.evaluate(`(() => {
    const item = [...document.querySelectorAll('.ant-dropdown-menu-item')].find(node =>
      node.textContent?.trim() === ${JSON.stringify(label)}
    )
    if (!item) return false
    item.click()
    return true
  })()`)
  assert.equal(clicked, true, `菜单项不可点击: ${label}`)
}

async function closeDialog(client) {
  const result = await client.evaluate(`(() => {
    const dialogs = [...document.querySelectorAll('.ant-modal-wrap')].filter(node => {
      const style = getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0
    })
    const dialog = dialogs.at(-1)
    if (!dialog) return { closed: false, reason: '未找到可见对话框' }
    const buttons = [...dialog.querySelectorAll('button')]
    const action = buttons.find(button =>
      ['取消', '关闭'].includes(
        (button.textContent || '').replaceAll(/\s/g, ''),
      )
    ) || dialog.querySelector('.ant-modal-confirm-btns button:not(.ant-btn-dangerous)')
    const button = action || dialog.querySelector('.ant-modal-close')
    if (!button) {
      return {
        closed: false,
        reason: '未找到关闭按钮',
        title: dialog.querySelector('.ant-modal-title')?.textContent?.trim() || '',
        buttons: buttons.map(item => item.textContent?.trim() || ''),
      }
    }
    button.click()
    return { closed: true }
  })()`)
  assert.equal(
    result.closed,
    true,
    `无法关闭当前对话框: ${JSON.stringify(result)}`,
  )
  await delay(350)
}

async function verifyDialog(client, database, menuLabel, titleText) {
  await openDatabaseMenu(client, database)
  await clickMenu(client, menuLabel)
  await waitFor(
    () => client.evaluate(
      `[...document.querySelectorAll('.ant-modal-title')].some(node => node.textContent?.includes(${JSON.stringify(titleText)}))`,
    ),
    `${menuLabel} 对话框`,
  )
  await closeDialog(client)
}

async function main() {
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json())
  const target = targets.find(item => item.type === 'page' && item.title.includes('SQLTool'))
  assert.ok(target?.webSocketDebuggerUrl, '未找到 SQLTool Electron 调试页面')

  const client = new CdpClient(target.webSocketDebuggerUrl)
  await client.connect()
  try {
    // 清理上一测试残留的浮层菜单，避免污染本测试的菜单项断言
    await closeFloatingMenus(client)
    await waitForConnectionTree(client)
    await connectAndExpandFirstConnection(client)
    const database = await waitFor(
      () => client.evaluate(`(() => {
        const protectedNames = new Set([
          'information_schema', 'mysql', 'performance_schema', 'sys',
          'postgres', 'template0', 'template1', 'master', 'model', 'msdb', 'tempdb',
        ])
        return [...document.querySelectorAll('.ant-tree-treenode')]
          .filter(row => row.querySelector('.tree-icon--database'))
          .map(row => row.querySelector('.tree-node-label')?.textContent?.trim())
          .find(name => name && !protectedNames.has(name.toLowerCase())) || ''
      })()`),
      '非系统数据库实例加载',
      20000,
    )

    await openDatabaseMenu(client, database)
    const labels = await client.evaluate(
      `[...document.querySelectorAll('.ant-dropdown-menu-item')].map(node => node.textContent?.trim())`,
    )
    assert.deepEqual(labels, [
      '关闭数据库', '编辑数据库...', '新建数据库...', '删除数据库',
      '新建查询', '命令列界面...', '运行SQL文件...', '转储SQL文件',
      '打印数据库', '逆向数据库到模型...', '在数据库中查找', '刷新',
    ])

    await verifyDialog(client, database, '编辑数据库...', '编辑数据库')
    await verifyDialog(client, database, '新建数据库...', '新建数据库')
    await verifyDialog(client, database, '删除数据库', '删除数据库')
    await verifyDialog(client, database, '转储SQL文件', '转储 SQL 文件')
    await verifyDialog(client, database, '逆向数据库到模型...', '数据库模型')
    await verifyDialog(client, database, '在数据库中查找', '在数据库中查找')
    await verifyDialog(client, database, '命令列界面...', '命令列界面')

    assert.deepEqual(client.errors, [], `界面运行异常: ${client.errors.join('\n')}`)
    console.log(`[数据库实例菜单界面测试] 全部通过: 数据库=${database}`)
  } finally {
    // 结束时关闭浮层，避免影响后续测试
    await closeFloatingMenus(client).catch(() => {})
    client.close()
  }
}

main().catch(error => {
  console.error('[数据库实例菜单界面测试] 失败', error)
  process.exitCode = 1
})
