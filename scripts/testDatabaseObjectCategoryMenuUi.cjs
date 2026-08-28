const assert = require('node:assert/strict')
const {
  ElectronCdpTestClient,
  waitFor,
} = require('./electronCdpTestClient.cjs')
const port = Number(process.env.SQLTOOL_DEBUG_PORT || 9222)
const expectedMenus = {
  表: ['新建表', '导入向导...', '导出向导...', '运行 SQL 文件...', '在数据库中查找', '新建组', '粘贴', '刷新'],
  视图: ['新建视图', '导出向导', '新建组', '粘贴', '刷新'],
  函数: ['新建函数', '新建组', '粘贴', '刷新'],
  事件: ['新建事件', '新建组', '粘贴', '刷新'],
  查询: ['新建查询', '打开查询文件...', '新建组', '粘贴', '在文件夹中显示', '刷新'],
  报表: ['新建报表', '打开报表存档', '新建组', '粘贴', '在文件夹中显示', '刷新'],
  备份: ['新建备份', '还原备份从...', '提取 SQL 从...', '新建组', '粘贴', '在文件夹中显示', '刷新'],
}
const visibleMenuItems = `[...document.querySelectorAll('.ant-dropdown-menu-item')]
  .filter(item => {
    const rect = item.getBoundingClientRect()
    const style = getComputedStyle(item)
    return rect.width > 0 && rect.height > 0
      && style.display !== 'none' && style.visibility !== 'hidden'
  })`
async function closeFloatingMenu(client) {
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  })
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  })
}
async function prepareDatabaseTree(client) {
  await waitFor(
    () => client.evaluate(`document.querySelectorAll('.connection-tree').length > 0`),
    '连接树加载',
  )
  await client.evaluate(`(() => {
    [...document.querySelectorAll('.ant-tree-treenode')]
      .filter(row => row.querySelector('.tree-icon--group'))
      .forEach(row => {
        const switcher = row.querySelector('.ant-tree-switcher')
        if (switcher && !switcher.classList.contains('ant-tree-switcher_open')) switcher.click()
      })
  })()`)
  await waitFor(
    () => client.evaluate(`document.querySelectorAll('.tree-icon--connection').length > 0`),
    '连接节点加载',
  )
  await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')]
      .find(item => item.querySelector('.tree-icon--connection'))
    row?.querySelector('.tree-node-title')?.click()
  })()`)
  await waitFor(
    () => client.evaluate(`Boolean(document.querySelector('.tree-icon--connection')
      ?.closest('.ant-tree-treenode')?.querySelector('.tree-node-status'))`),
    '数据库连接建立',
  )
  await client.evaluate(`(() => {
    const row = document.querySelector('.tree-icon--connection')
      ?.closest('.ant-tree-treenode')
    const switcher = row?.querySelector('.ant-tree-switcher')
    if (switcher && !switcher.classList.contains('ant-tree-switcher_open')) switcher.click()
  })()`)
  await waitFor(
    () => client.evaluate(`document.querySelectorAll('.tree-icon--database').length > 0`),
    '数据库节点加载',
  )
  const database = await waitFor(
    () => client.evaluate(`(() => {
      const protectedNames = new Set([
        'information_schema', 'mysql', 'performance_schema', 'sys',
        'postgres', 'template0', 'template1', 'master', 'model', 'msdb', 'tempdb',
      ])
      const row = [...document.querySelectorAll('.ant-tree-treenode')]
        .find(item => {
          const name = item.querySelector('.tree-node-label')?.textContent?.trim() || ''
          return item.querySelector('.tree-icon--database')
            && name
            && !protectedNames.has(name.toLowerCase())
        })
      if (!row) return ''
      row.querySelector('.tree-node-title')?.click()
      return row.querySelector('.tree-node-label')?.textContent?.trim() || ''
    })()`),
    '可用数据库选择',
  )
  await waitFor(
    () => client.evaluate(`(() => {
      const row = [...document.querySelectorAll('.ant-tree-treenode')].find(item =>
        item.querySelector('.tree-icon--database')
        && item.querySelector('.tree-node-label')?.textContent?.trim() === ${JSON.stringify(database)}
      )
      return Boolean(row?.querySelector('.ant-tree-switcher'))
    })()`),
    '数据库对象加载',
  )
  await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')].find(item =>
      item.querySelector('.tree-icon--database')
      && item.querySelector('.tree-node-label')?.textContent?.trim() === ${JSON.stringify(database)}
    )
    const switcher = row?.querySelector('.ant-tree-switcher')
    if (switcher && !switcher.classList.contains('ant-tree-switcher_open')) switcher.click()
  })()`)
  return database
}
function matchingMenuExpression(expectedLabels) {
  return `(() => {
    const expected = ${JSON.stringify(expectedLabels)}
    const menus = [...document.querySelectorAll('.ant-dropdown-menu')]
    for (const menu of menus) {
      const rect = menu.getBoundingClientRect()
      const style = getComputedStyle(menu)
      if (rect.width === 0 || rect.height === 0
        || style.display === 'none' || style.visibility === 'hidden') continue
      const labels = [...menu.querySelectorAll('.ant-dropdown-menu-item')]
        .map(item => item.textContent?.trim())
      if (labels.length === expected.length
        && labels.every((label, index) => label === expected[index])) return labels
    }
    return null
  })()`
}
async function readCategoryMenu(client, categoryLabel, expectedLabels) {
  await closeFloatingMenu(client)
  const opened = await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')].find(item =>
      item.querySelector('.tree-node-label')?.textContent?.trim() === ${JSON.stringify(categoryLabel)}
    )
    const target = row?.querySelector('.tree-node-title')
    if (!target) return false
    const rect = target.getBoundingClientRect()
    target.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 24,
      clientY: rect.top + 10,
      button: 2,
    }))
    return true
  })()`)
  assert.equal(opened, true, `未找到对象分类节点: ${categoryLabel}`)
  const menuExpression = matchingMenuExpression(expectedLabels)
  let labels
  try {
    labels = await waitFor(
      () => client.evaluate(menuExpression),
      `${categoryLabel}右键菜单`,
    )
  } catch (error) {
    const diagnostics = await client.evaluate(`(() => ({
      visibleLabels: ${visibleMenuItems}.map(item => item.textContent?.trim()),
      allLabels: [...document.querySelectorAll('.ant-dropdown-menu-item')]
        .map(item => item.textContent?.trim()),
      categoryVisible: [...document.querySelectorAll('.ant-tree-treenode')].some(item =>
        item.querySelector('.tree-node-label')?.textContent?.trim() === ${JSON.stringify(categoryLabel)}
        && item.getBoundingClientRect().height > 0
      ),
    }))()`)
    throw new Error(`${error.message}; 页面诊断=${JSON.stringify(diagnostics)}`)
  }
  await closeFloatingMenu(client)
  return labels
}
async function main() {
  console.log('[数据库对象分类菜单界面测试] 开始')
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`)
    .then(response => response.json())
  const target = targets.find(item => item.type === 'page' && item.title.includes('SQLTool'))
  assert.ok(target?.webSocketDebuggerUrl, '未找到 SQLTool Electron 调试页面')

  const client = new ElectronCdpTestClient(target.webSocketDebuggerUrl)
  await client.connect()
  try {
    const database = await prepareDatabaseTree(client)
    await waitFor(
      () => client.evaluate(`document.querySelectorAll('.tree-icon--backup').length > 0`),
      '七类对象节点加载',
    )
    for (const [category, expected] of Object.entries(expectedMenus)) {
      const labels = await readCategoryMenu(client, category, expected)
      assert.deepEqual(labels, expected, `${category}右键菜单不符合预期`)
      console.log(`[数据库对象分类菜单界面测试] ${category}菜单通过`)
    }
    assert.deepEqual(client.errors, [], `界面运行异常: ${client.errors.join('\n')}`)
    console.log(`[数据库对象分类菜单界面测试] 全部通过: 数据库=${database}`)
  } finally {
    client.close()
  }
}
main().catch(error => {
  console.error('[数据库对象分类菜单界面测试] 失败', error)
  process.exitCode = 1
})
