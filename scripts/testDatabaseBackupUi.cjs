const assert = require('node:assert/strict')
const { ElectronCdpTestClient, waitFor } = require('./electronCdpTestClient.cjs')
const {
  closeModal,
  openBackupCategoryAction,
  prepareDatabaseTree,
} = require('./databaseBackupUiTestDriver.cjs')
const port = Number(process.env.SQLTOOL_DEBUG_PORT || 9222)

async function verifyCreateDialog(client, database) {
  await openBackupCategoryAction(client, '新建备份')
  let summary
  try {
    summary = await waitFor(() => client.evaluate(`(() => {
      const modal = [...document.querySelectorAll('.ant-modal')].find(item =>
        item.querySelector('.ant-modal-title')?.textContent?.trim()
          .startsWith('新建备份 -')
      )
      if (!modal || modal.querySelector('.backup-dialog__loading')) return null
      return {
        title: modal.querySelector('.ant-modal-title')?.textContent?.trim(),
        tabs: [...modal.querySelectorAll('.ant-tabs-tab-btn')]
          .map(item => item.textContent?.trim()),
        body: modal.querySelector('.ant-modal-body')?.textContent || '',
        startDisabled: [...modal.querySelectorAll('.ant-modal-footer button')]
          .find(item => item.textContent?.trim() === '开始备份')?.disabled,
        fitsViewport: (() => {
          const rect = modal.getBoundingClientRect()
          return rect.left >= 0 && rect.right <= innerWidth
            && rect.top >= 0 && rect.bottom <= innerHeight
        })(),
      }
    })()`), '新建备份窗口加载')
  } catch (error) {
    const diagnostics = await client.evaluate(`({
      modals: [...document.querySelectorAll('.ant-modal')].map(item => ({
        className: item.className,
        title: item.querySelector('.ant-modal-title')?.textContent?.trim(),
        text: item.textContent?.trim().slice(0, 500),
      })),
      dialogs: document.querySelectorAll('[role="dialog"]').length,
    })`)
    throw new Error(`${error.message}; 页面诊断=${JSON.stringify(diagnostics)}`)
  }
  assert.equal(summary.title, `新建备份 - ${database}`)
  assert.equal(summary.tabs.length, 4)
  assert.equal(summary.tabs[0], '常规')
  assert.match(summary.tabs[1], /^对象 \(\d+\)$/)
  assert.equal(summary.tabs[2], '高级')
  assert.equal(summary.tabs[3], '信息日志')
  assert.match(summary.body, /备份名称/)
  assert.match(summary.body, /备份内容/)
  assert.equal(summary.startDisabled, false)
  assert.equal(summary.fitsViewport, true)

  await client.evaluate(`(() => {
    const tab = [...document.querySelectorAll('.ant-modal .ant-tabs-tab-btn')]
      .find(item => item.textContent?.trim().startsWith('对象'))
    tab?.click()
  })()`)
  await waitFor(
    () => client.evaluate(`document.querySelectorAll(
      '.ant-modal .backup-object-group'
    ).length === 5`),
    '备份对象选择页',
  )
  await closeModal(client, '新建备份 -')
}

async function verifyRestoreDialog(client, database) {
  await openBackupCategoryAction(client, '还原备份从...')
  const summary = await waitFor(
    () => client.evaluate(`(() => {
      const modal = [...document.querySelectorAll('.ant-modal')].find(item =>
        item.querySelector('.ant-modal-title')?.textContent?.trim()
          .startsWith('还原备份 -')
      )
      if (!modal) return null
      return {
        title: modal.querySelector('.ant-modal-title')?.textContent?.trim(),
        body: modal.querySelector('.ant-modal-body')?.textContent || '',
        action: [...modal.querySelectorAll('.ant-modal-footer button')]
          .find(item => item.textContent?.includes('选择文件并还原'))
          ?.textContent?.trim(),
      }
    })()`),
    '还原备份窗口加载',
  )
  assert.equal(summary.title, `还原备份 - ${database}`)
  assert.match(summary.body, /事务保护/)
  assert.match(summary.body, /遇到错误继续/)
  assert.equal(summary.action, '选择文件并还原')
  await closeModal(client, '还原备份 -')
}

async function main() {
  console.log('[数据库备份界面测试] 开始')
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`)
    .then(response => response.json())
  const target = targets.find(
    item => item.type === 'page' && item.title.includes('SQLTool'),
  )
  assert.ok(target?.webSocketDebuggerUrl, '未找到 SQLTool Electron 调试页面')

  const client = new ElectronCdpTestClient(target.webSocketDebuggerUrl)
  await client.connect()
  try {
    const database = await prepareDatabaseTree(client)
    await verifyCreateDialog(client, database)
    await verifyRestoreDialog(client, database)
    assert.deepEqual(client.errors, [], `界面运行异常: ${client.errors.join('\n')}`)
    console.log(`[数据库备份界面测试] 全部通过: 数据库=${database}`)
  } finally {
    client.close()
  }
}

main().catch(error => {
  console.error('[数据库备份界面测试] 失败', error)
  process.exitCode = 1
})
