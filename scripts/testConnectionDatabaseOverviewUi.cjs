const assert = require('node:assert/strict')
const {
  ElectronCdpTestClient,
  waitFor,
} = require('./electronCdpTestClient.cjs')

const port = Number(process.env.SQLTOOL_DEBUG_PORT || 9222)
const protectedDatabases = new Set([
  'information_schema',
  'master',
  'model',
  'msdb',
  'mysql',
  'performance_schema',
  'postgres',
  'sys',
  'tempdb',
  'template0',
  'template1',
])

async function openConnectionOverview(client) {
  await waitFor(
    () => client.evaluate(
      `document.querySelectorAll('.connection-tree').length > 0`,
    ),
    '连接树加载',
  )
  await client.evaluate(`(() => {
    [...document.querySelectorAll('.ant-tree-treenode')]
      .filter(row => row.querySelector('.tree-icon--group'))
      .forEach(row => {
        const switcher = row.querySelector('.ant-tree-switcher')
        if (switcher && !switcher.classList.contains('ant-tree-switcher_open')) {
          switcher.click()
        }
      })
  })()`)
  const connectionName = await waitFor(
    () => client.evaluate(`(() => {
      const row = [...document.querySelectorAll('.ant-tree-treenode')]
        .find(item => item.querySelector('.tree-icon--connection'))
      const target = row?.querySelector('.tree-node-title')
      if (!target) return ''
      target.click()
      return row.querySelector('.tree-node-label')?.textContent?.trim() || ''
    })()`),
    '连接节点选择',
  )
  const overview = await waitFor(
    () => client.evaluate(`(() => {
      const root = document.querySelector('.database-overview')
      if (!root || root.querySelector('.ant-spin-spinning')) return null
      const summary = root.querySelector('.database-overview__summary')
        ?.textContent?.trim() || ''
      const headers = [...root.querySelectorAll('.ant-table-thead th')]
        .map(item => item.textContent?.trim())
        .filter(Boolean)
      const rows = [...root.querySelectorAll('.ant-table-tbody tr')]
        .map(row => ({
          name: row.querySelector(
            '.database-overview__name > span:last-child'
          )
            ?.textContent?.trim() || '',
          size: row.querySelector('td:nth-child(2)')
            ?.textContent?.trim() || '',
          cellCount: row.querySelectorAll('td').length,
        }))
        .filter(row => row.name)
      if (summary.includes('正在读取') || rows.length === 0) return null
      return { headers, rows, summary }
    })()`),
    '连接数据库概览',
  )
  await client.evaluate(`(() => {
    const row = [...document.querySelectorAll('.ant-tree-treenode')]
      .find(item =>
        item.querySelector('.tree-icon--connection')
        && item.querySelector('.tree-node-label')?.textContent?.trim()
          === ${JSON.stringify(connectionName)}
      )
    const switcher = row?.querySelector('.ant-tree-switcher')
    if (switcher && !switcher.classList.contains('ant-tree-switcher_open')) {
      switcher.click()
    }
  })()`)
  overview.treeSizes = await waitFor(
    () => client.evaluate(`(() => {
      const sizes = [...document.querySelectorAll('.tree-node-size')]
        .map(item => item.textContent?.trim())
        .filter(Boolean)
      return sizes.length > 0 ? sizes : null
    })()`),
    '左侧数据库大小',
  )
  overview.layout = await client.evaluate(`(() => {
    const sizedTitles = [...document.querySelectorAll(
      '.tree-node-title:has(.tree-node-size)'
    )]
    const rowHeights = [...document.querySelectorAll(
      '.connection-tree .ant-tree-node-content-wrapper'
    )].map(item => item.getBoundingClientRect().height)
    const treeNodeHeights = [...document.querySelectorAll(
      '.connection-tree .ant-tree-treenode'
    )].map(item => item.getBoundingClientRect().height)
    const indentWidths = [...document.querySelectorAll(
      '.connection-tree .ant-tree-indent-unit'
    )].map(item => item.getBoundingClientRect().width)
    const root = document.querySelector('.database-overview')
    const footer = root?.querySelector('.database-overview__summary')
    const rootRect = root?.getBoundingClientRect()
    const footerRect = footer?.getBoundingClientRect()
    return {
      maxTreeRowHeight: rowHeights.length ? Math.max(...rowHeights) : 0,
      maxTreeNodeHeight: treeNodeHeights.length
        ? Math.max(...treeNodeHeights)
        : 0,
      maxIndentWidth: indentWidths.length ? Math.max(...indentWidths) : 0,
      treeFontSize: Number.parseFloat(
        getComputedStyle(document.querySelector('.connection-tree')).fontSize
      ),
      sizeOverlapCount: sizedTitles.filter(item => {
        const label = item.querySelector('.tree-node-label')
        const size = item.querySelector('.tree-node-size')
        return label && size
          && label.getBoundingClientRect().right
            > size.getBoundingClientRect().left
      }).length,
      footerVisible: Boolean(
        rootRect && footerRect
        && footerRect.top >= rootRect.top
        && footerRect.bottom <= rootRect.bottom + 1
      ),
      bodyOverflow: document.documentElement.scrollWidth
        > document.documentElement.clientWidth + 1,
    }
  })()`)
  return { connectionName, overview }
}

async function openTableOverview(client, database) {
  const opened = await client.evaluate(`(() => {
    const row = [...document.querySelectorAll(
      '.database-overview .ant-table-tbody tr'
    )].find(item =>
      item.querySelector('.database-overview__name > span:last-child')
        ?.textContent?.trim() === ${JSON.stringify(database)}
    )
    if (!row) return false
    row.dispatchEvent(new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      button: 0,
    }))
    return true
  })()`)
  assert.equal(opened, true, `未找到数据库概览行: ${database}`)
  return waitFor(
    () => client.evaluate(`(() => {
      const root = document.querySelector('.table-overview')
      if (!root || root.querySelector('.ant-spin-spinning')) return null
      const headers = [...root.querySelectorAll('.ant-table-thead th')]
        .map(item => item.textContent?.trim())
        .filter(Boolean)
      const tableNames = [...root.querySelectorAll(
        '.table-overview__name > span'
      )].map(item => item.textContent?.trim()).filter(Boolean)
      const selectedTreeLabel = document.querySelector(
        '.ant-tree-node-selected .tree-node-label'
      )?.textContent?.trim()
      const title = root.querySelector('.table-overview__titlebar')
        ?.textContent?.replace(/\\s+/g, ' ').trim()
      const openDatabases = [...document.querySelectorAll(
        '.tree-node-label--database-open'
      )].map(item => ({
        name: item.textContent?.trim() || '',
        fontWeight: getComputedStyle(item).fontWeight,
      }))
      return {
        headers,
        tableNames,
        selectedTreeLabel,
        title,
        openDatabases,
      }
    })()`),
    '数据库表明细',
  )
}

async function main() {
  console.log('[连接数据库概览界面测试] 开始')
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`)
    .then(response => response.json())
  const target = targets.find(
    item => item.type === 'page' && item.title.includes('SQLTool'),
  )
  assert.ok(target?.webSocketDebuggerUrl, '未找到 SQLTool Electron 调试页面')

  const client = new ElectronCdpTestClient(target.webSocketDebuggerUrl)
  await client.connect()
  try {
    const { connectionName, overview } = await openConnectionOverview(client)
    assert.deepEqual(overview.headers, [
      '数据库',
      '大小',
      '表数量',
      '字符集',
      '排序规则',
      '状态',
    ])
    assert.ok(overview.rows.length > 0, '连接下没有可测试的数据库')
    assert.ok(
      overview.rows.every(row => row.cellCount === 6),
      '连接概览应完整显示六列数据库明细',
    )
    assert.ok(
      overview.rows.some(row => row.size),
      '连接概览未显示数据库大小',
    )
    assert.ok(
      overview.treeSizes.length > 0,
      '左侧连接树未显示数据库大小',
    )
    assert.ok(
      overview.layout.maxTreeRowHeight <= 15,
      `左侧连接行不够紧凑: ${overview.layout.maxTreeRowHeight}px`,
    )
    assert.ok(
      overview.layout.maxTreeNodeHeight <= 15,
      `左侧树节点间距过大: ${overview.layout.maxTreeNodeHeight}px`,
    )
    assert.ok(
      overview.layout.maxIndentWidth <= 11,
      `左侧树层级缩进过大: ${overview.layout.maxIndentWidth}px`,
    )
    assert.ok(
      overview.layout.treeFontSize <= 10,
      `左侧树字号未紧凑: ${overview.layout.treeFontSize}px`,
    )
    assert.equal(overview.layout.sizeOverlapCount, 0, '左侧名称与大小发生重叠')
    assert.equal(overview.layout.footerVisible, true, '右侧概览底部统计不可见')
    assert.equal(overview.layout.bodyOverflow, false, '工作台出现横向页面溢出')

    const targetRow = overview.rows.find(
      row => !protectedDatabases.has(row.name.toLowerCase()),
    ) || overview.rows[0]
    const tableOverview = await openTableOverview(client, targetRow.name)
    assert.deepEqual(tableOverview.headers, [
      '名称',
      '记录行数',
      '大小',
      '已创建',
      '已修改',
      '引擎',
      '注释',
      '类型',
    ])
    assert.equal(tableOverview.selectedTreeLabel, '表')
    assert.equal(
      tableOverview.title.replace(/\s*@\s*/, ' @ '),
      `表 @ ${targetRow.name}`,
    )
    const openDatabase = tableOverview.openDatabases.find(
      item => item.name === targetRow.name,
    )
    assert.ok(openDatabase, `已打开数据库未加粗: ${targetRow.name}`)
    assert.ok(
      Number(openDatabase.fontWeight) >= 700
        || openDatabase.fontWeight === 'bold',
      `已打开数据库字重不足: ${openDatabase.fontWeight}`,
    )
    assert.deepEqual(client.errors, [], `界面运行异常: ${client.errors.join('\n')}`)
    console.log(
      `[连接数据库概览界面测试] 全部通过: 连接=${connectionName}, 数据库=${targetRow.name}, 表=${tableOverview.tableNames.length}`,
    )
  } finally {
    client.close()
  }
}

main().catch(error => {
  console.error('[连接数据库概览界面测试] 失败', error)
  process.exitCode = 1
})
