const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {
  parseTableImportFile,
  writeTableExportToPath,
} = require('../dist/main/database/tableTransferService')

function exportOptions(format, overrides = {}) {
  return {
    format,
    columns: ['id', 'name', 'note'],
    binaryEncoding: 'base64',
    text: format === 'csv' || format === 'txt'
      ? {
        includeHeader: true,
        delimiter: format === 'txt' ? '\t' : ',',
        recordDelimiter: '\r\n',
        quote: '"',
        encoding: 'utf8bom',
      }
      : undefined,
    xml: { prettyPrint: true },
    excel: { freezeHeader: true, autoFilter: true },
    sql: { includeTransaction: false },
    ...overrides,
  }
}

async function exportFile(
  root,
  format,
  rows,
  overrides = {},
  columns = ['id', 'name', 'note'],
) {
  const pages = []
  const outputPath = path.join(root, `items.${format}`)
  const rowCount = await writeTableExportToPath(
    'SQLite',
    'items',
    columns,
    {
      ...exportOptions(format, overrides),
      columns,
    },
    {
      totalRows: rows.length,
      loadPage: async (page, pageSize) => {
        pages.push({ page, pageSize })
        const start = (page - 1) * pageSize
        return rows.slice(start, start + pageSize)
      },
    },
    outputPath,
  )
  assert.equal(rowCount, rows.length)
  return { outputPath, pages }
}

async function testDelimitedRoundTrips(root) {
  const rows = [
    { id: 1, name: '张三', note: '包含,逗号' },
    { id: 2, name: '李"四', note: '跨行\r\n文本' },
  ]
  const csv = await exportFile(root, 'csv', rows)
  const csvBuffer = fs.readFileSync(csv.outputPath)
  assert.deepEqual([...csvBuffer.subarray(0, 3)], [0xef, 0xbb, 0xbf])
  const csvPreview = await parseTableImportFile(csv.outputPath)
  assert.deepEqual(csvPreview.columns, ['id', 'name', 'note'])
  assert.equal(csvPreview.rows[0].note, '包含,逗号')
  assert.equal(csvPreview.rows[1].name, '李"四')
  assert.equal(csvPreview.rows[1].note, '跨行\r\n文本')

  const text = await exportFile(root, 'txt', rows, {
    text: {
      includeHeader: true,
      delimiter: '|',
      recordDelimiter: '\n',
      quote: "'",
      encoding: 'utf16le',
    },
  })
  const textBuffer = fs.readFileSync(text.outputPath)
  assert.deepEqual([...textBuffer.subarray(0, 2)], [0xff, 0xfe])
  const textPreview = await parseTableImportFile(text.outputPath, {
    format: 'txt',
    text: {
      includeHeader: true,
      delimiter: '|',
      recordDelimiter: '\n',
      quote: "'",
      encoding: 'utf16le',
    },
  })
  assert.equal(textPreview.rows[0].note, '包含,逗号')
  assert.equal(textPreview.rows[1].note, '跨行\r\n文本')
}

async function testStructuredRoundTrips(root) {
  const rows = [
    { id: 1, name: '甲', note: null },
    { id: 2, name: '乙', note: '<标签>&内容' },
  ]
  for (const format of ['json', 'xml']) {
    const exported = await exportFile(root, format, rows)
    const preview = await parseTableImportFile(exported.outputPath)
    assert.deepEqual(preview.columns, ['id', 'name', 'note'])
    assert.equal(preview.totalRows, 2)
    assert.equal(preview.rows[0].note, null)
    assert.equal(preview.rows[1].note, '<标签>&内容')
  }

  const workbook = await exportFile(root, 'xlsx', rows)
  const preview = await parseTableImportFile(workbook.outputPath)
  assert.equal(preview.sheetName, 'items')
  assert.deepEqual(preview.columns, ['id', 'name', 'note'])
  assert.equal(preview.totalRows, 2)
  assert.equal(preview.rows[1].note, '<标签>&内容')
}

async function testOutputOnlyFormats(root) {
  const rows = [{
    id: 1,
    name: "O'Reilly",
    note: '<script>alert("x")</script>',
  }]
  const html = await exportFile(root, 'html', rows)
  const htmlContent = fs.readFileSync(html.outputPath, 'utf8')
  assert.match(htmlContent, /<table border="1">/)
  assert.doesNotMatch(htmlContent, /<script>/)
  assert.match(htmlContent, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/)

  const sql = await exportFile(root, 'sql', rows, {
    sql: { includeTransaction: true },
  })
  const sqlContent = fs.readFileSync(sql.outputPath, 'utf8')
  assert.match(sqlContent, /^BEGIN TRANSACTION;/)
  assert.match(sqlContent, /INSERT INTO "items"/)
  assert.match(sqlContent, /'O''Reilly'/)
  assert.match(sqlContent, /COMMIT;\s*$/)
}

async function testPagedJsonExport(root) {
  const rows = Array.from({ length: 501 }, (_, index) => ({
    id: index + 1,
    name: `记录${index + 1}`,
    note: '',
  }))
  const exported = await exportFile(root, 'json', rows)
  assert.deepEqual(exported.pages, [
    { page: 1, pageSize: 500 },
    { page: 2, pageSize: 500 },
  ])
  const preview = await parseTableImportFile(exported.outputPath)
  assert.equal(preview.totalRows, 501)
  assert.equal(preview.rows[500].name, '记录501')
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sqltool-transfer-'))
  console.log('[表数据多格式传输测试] 开始')
  try {
    await testDelimitedRoundTrips(root)
    await testStructuredRoundTrips(root)
    await testOutputOnlyFormats(root)
    await testPagedJsonExport(root)
    console.log('[表数据多格式传输测试] 全部通过')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error('[表数据多格式传输测试] 失败', error)
  process.exitCode = 1
})
