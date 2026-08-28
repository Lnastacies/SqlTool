const assert = require('node:assert/strict')
const {
  ElectronCdpTestClient,
  waitFor,
} = require('./electronCdpTestClient.cjs')
const {
  clickWizardButton,
  openExportWizard,
  optionText,
  prepareObjectTree,
  saveScreenshot,
  selectFormat,
} = require('./tableTransferWizardUiHarness.cjs')

const port = Number(process.env.SQLTOOL_DEBUG_PORT || 9222)

async function verifyFormatOptions(client) {
  const labels = await client.evaluate(`[...document.querySelectorAll(
    '.table-export__formats strong'
  )].map(item => item.textContent)`)
  assert.deepEqual(labels, ['CSV', 'TXT', 'Excel', 'JSON', 'XML', 'SQL', 'HTML'])

  const csvText = await optionText(client)
  assert.match(csvText, /文件编码/)
  assert.match(csvText, /字段分隔符/)
  assert.match(csvText, /输出字段标题/)

  await selectFormat(client, 'Excel')
  const excelText = await optionText(client)
  assert.match(excelText, /冻结标题行/)
  assert.match(excelText, /为标题行启用筛选/)
  assert.doesNotMatch(excelText, /字段分隔符/)

  await selectFormat(client, 'XML')
  const xmlText = await optionText(client)
  assert.match(xmlText, /格式化 XML 节点/)
  assert.match(xmlText, /二进制字段/)

  await selectFormat(client, 'SQL')
  const sqlText = await optionText(client)
  assert.match(sqlText, /使用事务包裹 INSERT 语句/)
  assert.doesNotMatch(sqlText, /二进制字段/)
}

async function main() {
  console.log('[表数据导出向导界面测试] 开始')
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`)
    .then(response => response.json())
  const target = targets.find(item => (
    item.type === 'page' && item.title.includes('SQLTool')
  ))
  assert.ok(target?.webSocketDebuggerUrl, '未找到 SQLTool Electron 调试页面')

  const client = new ElectronCdpTestClient(target.webSocketDebuggerUrl)
  await client.connect()
  try {
    await prepareObjectTree(client)
    await openExportWizard(client)
    await clickWizardButton(client, '下一步')
    await waitFor(
      () => client.evaluate(`Boolean(document.querySelector('.table-export__formats'))`),
      '导出格式步骤',
    )
    await verifyFormatOptions(client)
    await clickWizardButton(client, '下一步')
    await waitFor(
      () => client.evaluate(`Boolean(document.querySelector('.table-export-review'))`),
      '导出确认步骤',
    )
    const review = await client.evaluate(
      `document.querySelector('.table-export-review')?.innerText || ''`,
    )
    // 确认页为统计卡片布局，对象/字段数量分行展示
    assert.match(review, /对象\s*\n\s*1(\n|$)/)
    assert.match(review, /字段\s*\n\s*13(\n|$)/)
    const screenshotPath = await saveScreenshot(client)
    assert.deepEqual(client.errors, [], `界面运行异常: ${client.errors.join('\n')}`)
    console.log(`[表数据导出向导界面测试] 全部通过: 截图=${screenshotPath}`)
  } finally {
    client.close()
  }
}

main().catch(error => {
  console.error('[表数据导出向导界面测试] 失败', error)
  process.exitCode = 1
})
