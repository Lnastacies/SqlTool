const assert = require('node:assert/strict')
const { waitFor } = require('./electronCdpTestClient.cjs')

async function prepareDatabaseTree(client) {
  await waitFor(() => client.evaluate(
    `document.querySelectorAll('.connection-tree').length > 0`,
  ), '连接树加载')
  await client.evaluate(`(() => {
    [...document.querySelectorAll('.ant-tree-treenode')]
      .filter(row => row.querySelector('.tree-icon--group'))
      .forEach(row => {
        const switcher = row.querySelector('.ant-tree-switcher')
        if (switcher && !switcher.classList.contains('ant-tree-switcher_open')) switcher.click()
      })
  })()`)
  await waitFor(() => client.evaluate(
    `document.querySelectorAll('.tree-icon--connection').length > 0`,
  ), '连接节点加载')
  await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')]
      .find(item => item.querySelector('.tree-icon--connection'))
    if (!row?.querySelector('.tree-node-status')) {
      row?.querySelector('.tree-node-title')?.click()
    }
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
  await waitFor(() => client.evaluate(
    `document.querySelectorAll('.tree-icon--database').length > 0`,
  ), '数据库节点加载')
  const database = await waitFor(
    () => client.evaluate(`(() => {
      const protectedNames = new Set(['information_schema', 'mysql',
        'performance_schema', 'sys', 'postgres', 'template0', 'template1',
        'master', 'model', 'msdb', 'tempdb'])
      const row = [...document.querySelectorAll('.ant-tree-treenode')].find(item => {
        const name = item.querySelector('.tree-node-label')?.textContent?.trim() || ''
        return item.querySelector('.tree-icon--database')
          && name && !protectedNames.has(name.toLowerCase())
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
        && item.querySelector('.tree-node-label')?.textContent?.trim()
          === ${JSON.stringify(database)}
      )
      return Boolean(row?.querySelector('.ant-tree-switcher'))
    })()`),
    '数据库对象加载',
  )
  await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')].find(item =>
      item.querySelector('.tree-icon--database')
      && item.querySelector('.tree-node-label')?.textContent?.trim()
        === ${JSON.stringify(database)}
    )
    const switcher = row?.querySelector('.ant-tree-switcher')
    if (switcher && !switcher.classList.contains('ant-tree-switcher_open')) switcher.click()
  })()`)
  await waitFor(
    () => client.evaluate(`[...document.querySelectorAll('.ant-tree-treenode')]
      .some(row => row.querySelector('.tree-node-label')?.textContent?.trim() === '备份')`),
    '备份分类节点加载',
  )
  return database
}

async function openBackupCategoryAction(client, actionLabel) {
  const opened = await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')]
      .find(item => item.querySelector('.tree-node-label')?.textContent?.trim() === '备份')
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
  assert.equal(opened, true, '未找到备份分类节点')
  await waitFor(
    () => client.evaluate(`[...document.querySelectorAll('.ant-dropdown-menu-item')]
      .some(item => item.getBoundingClientRect().height > 0
        && item.textContent?.trim() === ${JSON.stringify(actionLabel)})`),
    `备份菜单项“${actionLabel}”`,
  )
  await client.evaluate(`(() => {
    const item = [...document.querySelectorAll('.ant-dropdown-menu-item')]
      .find(node => node.getBoundingClientRect().height > 0
        && node.textContent?.trim() === ${JSON.stringify(actionLabel)})
    item?.click()
  })()`)
}

async function closeModal(client, titlePrefix) {
  const result = await client.evaluate(`(() => {
    const modal = [...document.querySelectorAll('.ant-modal')].find(item =>
      item.querySelector('.ant-modal-title')?.textContent?.trim()
        .startsWith(${JSON.stringify(titlePrefix)})
    )
    const buttons = [...(modal?.querySelectorAll('.ant-modal-footer button') || [])]
    const button = buttons.find(item => ['取消', '关闭'].includes(
      (item.textContent || '').replace(/\\s+/g, ''),
    ))
    button?.click()
    return {
      clicked: Boolean(button),
      buttons: buttons.map(item => item.textContent?.trim()),
    }
  })()`)
  assert.equal(
    result.clicked,
    true,
    `未找到关闭按钮: ${JSON.stringify(result.buttons)}`,
  )
  await waitFor(() => client.evaluate(
    `![...document.querySelectorAll('.ant-modal')].some(item =>
      item.querySelector('.ant-modal-title')?.textContent?.trim()
        .startsWith(${JSON.stringify(titlePrefix)})
    )`,
  ), '备份窗口关闭')
}

module.exports = {
  closeModal,
  openBackupCategoryAction,
  prepareDatabaseTree,
}
