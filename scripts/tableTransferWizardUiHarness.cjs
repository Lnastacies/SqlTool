const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  delay,
  waitFor,
} = require('./electronCdpTestClient.cjs')

const actualVisibilityExpression = `(element => {
  if (!element) return false
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  let current = element
  while (current && current !== document.documentElement) {
    const style = getComputedStyle(current)
    if (style.display === 'none'
      || style.visibility === 'hidden'
      || Number(style.opacity) === 0
      || current.getAttribute('aria-hidden') === 'true'
      || (current.classList.contains('ant-dropdown')
        && style.pointerEvents === 'none')
      || current.classList.contains('ant-dropdown-hidden')) {
      return false
    }
    current = current.parentElement
  }
  return true
})`

async function prepareObjectTree(client) {
  await waitFor(
    () => client.evaluate(`Boolean(document.querySelector('.connection-tree'))`),
    '连接树加载',
  )
  await client.evaluate(`(() => {
    const rows = [...document.querySelectorAll('.ant-tree-treenode')]
    rows.filter(row => row.querySelector('.tree-icon--group')).forEach(row => {
      const switcher = row.querySelector('.ant-tree-switcher')
      if (switcher && !switcher.classList.contains('ant-tree-switcher_open')) {
        switcher.click()
      }
    })
  })()`)
  await waitFor(
    () => client.evaluate(`Boolean(document.querySelector('.tree-icon--connection'))`),
    '连接节点显示',
  )
  const connectionExpanded = await client.evaluate(`(() => {
    const row = document.querySelector('.tree-icon--connection')
      ?.closest('.ant-tree-treenode')
    const switcher = row?.querySelector('.ant-tree-switcher')
    if (!row || !switcher) return false
    row.querySelector('.tree-node-title')?.click()
    if (!switcher.classList.contains('ant-tree-switcher_open')) {
      switcher.click()
    }
    return true
  })()`)
  assert.equal(connectionExpanded, true, '未找到可展开的数据库连接节点')
  await waitFor(
    () => client.evaluate(`Boolean(document.querySelector('.tree-icon--connection')
      ?.closest('.ant-tree-treenode')?.querySelector('.tree-node-status'))`),
    '数据库连接建立',
  )
  const databaseListExpanded = await client.evaluate(`(() => {
    const row = document.querySelector('.tree-icon--connection')
      ?.closest('.ant-tree-treenode')
    const switcher = row?.querySelector('.ant-tree-switcher')
    if (!switcher) return false
    if (!switcher.classList.contains('ant-tree-switcher_open')) {
      switcher.click()
    }
    return true
  })()`)
  assert.equal(databaseListExpanded, true, '连接成功后未找到数据库列表展开开关')
  await waitFor(
    () => client.evaluate(`document.querySelectorAll('.tree-icon--database').length > 0`),
    '数据库节点加载',
  )
  await client.evaluate(`(() => {
    const protectedNames = new Set([
      'information_schema', 'mysql', 'performance_schema', 'sys',
      'postgres', 'template0', 'template1', 'master', 'model', 'msdb', 'tempdb',
    ])
    const row = [...document.querySelectorAll('.ant-tree-treenode')].find(item => {
      const name = item.querySelector('.tree-node-label')?.textContent?.trim() || ''
      return item.querySelector('.tree-icon--database')
        && name && !protectedNames.has(name.toLowerCase())
    })
    row?.querySelector('.tree-node-title')?.click()
    const switcher = row?.querySelector('.ant-tree-switcher')
    if (switcher && !switcher.classList.contains('ant-tree-switcher_open')) {
      switcher.click()
    }
  })()`)
  await waitFor(
    () => client.evaluate(`[...document.querySelectorAll('.tree-node-label')]
      .some(item => item.textContent?.trim() === '表')`),
    '表分类加载',
  )
}

async function openExportWizard(client) {
  await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')].find(item =>
      item.querySelector('.tree-node-label')?.textContent?.trim() === '表'
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
  await waitFor(
    () => client.evaluate(`[...document.querySelectorAll('.ant-dropdown-menu-item')]
      .some(item => item.textContent?.trim() === '导出向导...'
        && item.getBoundingClientRect().height > 0)`),
    '表导出菜单显示',
  )
  // 使用元素级 click 触发菜单项；CDP 坐标点击可能因浮层动画偏移落空，
  // 导致菜单被当作外部点击关闭而动作未执行
  const clicked = await client.evaluate(`(() => {
    const item = [...document.querySelectorAll('.ant-dropdown-menu-item')]
      .find(node => node.textContent?.trim() === '导出向导...'
        && node.getBoundingClientRect().height > 0)
    item?.click()
    return Boolean(item)
  })()`)
  assert.ok(clicked, '未找到可点击的表导出菜单项')
  try {
    await waitFor(
      () => client.evaluate(`(() => {
        const modal = document.querySelector('.table-export-modal')
        if (!modal) return false
        if (!modal.textContent?.includes('导出向导：表')) return false
        const isActuallyVisible = ${actualVisibilityExpression}
        if (isActuallyVisible(modal)) return true
        // 锁屏/后台窗口会冻结 CSS 入场动画（opacity 停在 0），
        // 此时以 DOM 挂载与内容作为“已打开”依据
        const style = getComputedStyle(modal)
        return modal.classList.contains('ant-zoom-appear')
          && Number(style.opacity) === 0
      })()`),
      '导出向导打开',
    )
  } catch (error) {
    const diagnostics = await client.evaluate(`(() => {
      const isActuallyVisible = ${actualVisibilityExpression}
      return {
        modalVisible: isActuallyVisible(
          document.querySelector('.table-export-modal')
        ),
        modalText: document.querySelector('.table-export-modal')
          ?.textContent?.slice(0, 120) || '',
        menus: [...document.querySelectorAll('.ant-dropdown-menu')].map(item => ({
          visible: isActuallyVisible(item),
          className: item.className,
          text: item.textContent?.trim() || '',
        })),
      }
    })()`)
    throw new Error(`${error.message}; 页面诊断=${JSON.stringify(diagnostics)}`)
  }
}

async function clickWizardButton(client, label) {
  const clicked = await client.evaluate(`(() => {
    const modal = [...document.querySelectorAll('.table-export-modal')]
      .find(item => item.getBoundingClientRect().height > 0)
    const button = [...(modal?.querySelectorAll('button') || [])]
      .find(item => item.textContent?.trim() === ${JSON.stringify(label)})
    button?.click()
    return Boolean(button)
  })()`)
  assert.equal(clicked, true, `未找到向导按钮: ${label}`)
}

async function selectFormat(client, label) {
  const selected = await client.evaluate(`(() => {
    const card = [...document.querySelectorAll(
      '.table-export__formats .ant-radio-button-wrapper'
    )].find(item => item.querySelector('strong')?.textContent === ${JSON.stringify(label)}
      && item.getBoundingClientRect().height > 0)
    card?.click()
    return Boolean(card)
  })()`)
  assert.equal(selected, true, `未找到导出格式: ${label}`)
  await waitFor(
    () => client.evaluate(`document.querySelector(
      '.table-export__formats .ant-radio-button-wrapper-checked strong'
    )?.textContent === ${JSON.stringify(label)}`),
    `${label} 格式切换`,
  )
}

async function optionText(client) {
  return client.evaluate(`([...document.querySelectorAll('.table-export-options')]
    .find(item => item.getBoundingClientRect().height > 0)?.innerText) || ''`)
}

async function doSaveScreenshot(client) {
  await client.send('Page.enable')
  await client.send('Page.bringToFront')
  await client.evaluate(`new Promise(resolve => requestAnimationFrame(
    () => requestAnimationFrame(resolve)
  ))`)
  await delay(500)
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  })
  const directory = path.join(__dirname, '..', 'out', 'test-artifacts')
  fs.mkdirSync(directory, { recursive: true })
  const filePath = path.join(directory, 'table-export-wizard.png')
  fs.writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'))
  return filePath
}

/**
 * 截图并落盘；锁屏/后台窗口会冻结渲染帧（rAF 与 captureScreenshot 均不返回），
 * 因此整体限时 8 秒，超时或失败时跳过截图，不阻塞功能断言。
 */
async function saveScreenshot(client) {
  try {
    return await Promise.race([
      doSaveScreenshot(client),
      delay(8000).then(() => null),
    ])
  } catch {
    return null
  }
}

module.exports = {
  clickWizardButton,
  openExportWizard,
  optionText,
  prepareObjectTree,
  saveScreenshot,
  selectFormat,
}
