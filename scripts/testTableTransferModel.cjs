const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, fileName) => {
    const source = fs.readFileSync(fileName, 'utf8')
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName,
    }).outputText
    module._compile(output, fileName)
  }
}

const {
  buildTableImportRequest,
  createImportMappings,
  validateImportMappings,
} = require('../src/renderer/features/tables/tableTransferModel.ts')
const {
  createTableExportOptions,
  createTableImportOptions,
} = require('../src/renderer/features/tables/tableTransferDefaults.ts')

const fields = [
  {
    name: 'id',
    type: 'INTEGER',
    not_null: true,
    default: null,
    primary: true,
    auto_increment: true,
    comment: '',
  },
  {
    name: 'name',
    type: 'VARCHAR(100)',
    not_null: true,
    default: null,
    primary: false,
    comment: '',
  },
  {
    name: 'created_at',
    type: 'DATETIME',
    not_null: true,
    default: null,
    default_expression: 'CURRENT_TIMESTAMP',
    primary: false,
    comment: '',
  },
]

function testAutomaticMappings() {
  const mappings = createImportMappings(
    ['ID', 'name', 'unknown', 'NAME'],
    fields,
  )
  assert.deepEqual(mappings, [
    { source: 'ID', target: 'id' },
    { source: 'name', target: 'name' },
    { source: 'unknown', target: undefined },
    { source: 'NAME', target: undefined },
  ])
  assert.equal(validateImportMappings(mappings, fields), null)
}

function testMappingValidation() {
  assert.match(
    validateImportMappings([
      { source: 'id', target: 'id' },
    ], fields),
    /name/,
  )
  assert.match(
    validateImportMappings([
      { source: 'a', target: 'name' },
      { source: 'b', target: 'name' },
    ], fields),
    /重复映射/,
  )
  assert.match(validateImportMappings([], fields), /至少映射/)
}

function testRequestBuild() {
  const request = buildTableImportRequest(
    {
      cancelled: false,
      fileName: 'items.csv',
      format: 'csv',
      columns: ['source_name', 'ignored'],
      rows: [{ source_name: '测试', ignored: '不导入' }],
      totalRows: 1,
    },
    [
      { source: 'source_name', target: 'name' },
      { source: 'ignored' },
    ],
    true,
  )
  assert.deepEqual(request, {
    fileName: 'items.csv',
    format: 'csv',
    rows: [{ source_name: '测试', ignored: '不导入' }],
    mappings: [{ source: 'source_name', target: 'name' }],
    emptyStringAsNull: true,
  })
}

function testFormatDefaults() {
  const csvImport = createTableImportOptions({
    cancelled: false,
    format: 'csv',
    columns: [],
    rows: [],
    totalRows: 0,
  })
  assert.equal(csvImport.text.delimiter, ',')
  assert.equal(csvImport.text.encoding, 'utf8bom')

  const jsonImport = createTableImportOptions({
    cancelled: false,
    format: 'json',
    columns: [],
    rows: [],
    totalRows: 0,
  })
  assert.equal(jsonImport.text, undefined)

  const formats = ['txt', 'csv', 'html', 'xlsx', 'sql', 'xml', 'json']
  for (const format of formats) {
    const options = createTableExportOptions(format)
    assert.equal(options.format, format)
    assert.equal(options.binaryEncoding, 'base64')
    assert.equal(
      Boolean(options.text),
      format === 'txt' || format === 'csv',
      `${format} 的文本专属选项状态错误`,
    )
  }
  assert.equal(createTableExportOptions('txt').text.delimiter, '\t')
  assert.equal(createTableExportOptions('xlsx').excel.freezeHeader, true)
  assert.equal(createTableExportOptions('xml').xml.prettyPrint, true)
  assert.equal(createTableExportOptions('sql').sql.includeTransaction, false)
}

console.log('[表数据传输向导模型测试] 开始')
testAutomaticMappings()
testMappingValidation()
testRequestBuild()
testFormatDefaults()
console.log('[表数据传输向导模型测试] 全部通过')
