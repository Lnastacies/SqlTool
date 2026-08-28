const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const esbuild = require('esbuild')

function loadSubmitLogModel() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sqltool-submit-log-'))
  const output = path.join(root, 'tableDesignerSubmitLog.cjs')
  esbuild.buildSync({
    entryPoints: [path.resolve(
      __dirname,
      '../src/renderer/features/tables/tableDesignerSubmitLog.ts',
    )],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  })
  return {
    model: require(output),
    dispose: () => fs.rmSync(root, { recursive: true, force: true }),
  }
}

function createField(index, type = 'VARCHAR(255)') {
  return {
    originalName: `old_field_${index}`,
    name: `field_${index}`,
    type,
    notNull: index % 2 === 0,
    primary: index === 1,
    autoIncrement: index === 1,
    defaultValue: index === 2 ? 'CURRENT_TIMESTAMP' : '',
    comment: `字段 ${index}`,
  }
}

function main() {
  const { model, dispose } = loadSubmitLogModel()
  try {
    const request = {
      originalName: 'old_orders',
      definition: {
        name: 'orders',
        primaryKeyName: 'PRIMARY',
        fields: [
          createField(1, 'BIGINT UNSIGNED'),
          createField(2, 'VARCHAR(255)'),
          createField(3, "ENUM('草稿','启用')"),
        ],
        indexes: [{
          originalName: 'idx_old_status',
          name: 'idx_status',
          fields: ['field_3'],
          unique: false,
        }],
        foreignKeys: [{
          originalName: 'fk_old_user',
          name: 'fk_user',
          fields: ['field_1'],
          referencedTable: 'users',
          referencedFields: ['id'],
        }],
      },
    }
    const logs = model.buildTableDesignerSubmitLogs({
      database: 'business',
      databaseType: 'MySQL',
      validationIssues: [],
    }, request)
    const content = logs.join('\n')

    assert.match(content, /"mode":"alter"/)
    assert.match(content, /"databaseType":"MySQL"/)
    assert.match(content, /"type":"VARCHAR\(255\)"/)
    assert.match(content, /ENUM\('草稿','启用'\)/)
    assert.match(content, /"defaultValue":"CURRENT_TIMESTAMP"/)
    assert.match(content, /"name":"idx_status"/)
    assert.match(content, /"referencedTable":"users"/)
    assert.ok(logs.every(message => !message.includes('\n')))

    const largeRequest = {
      definition: {
        name: 'large_table',
        fields: Array.from(
          { length: 80 },
          (_, index) => createField(index + 1),
        ),
        indexes: [],
        foreignKeys: [],
      },
    }
    const largeLogs = model.buildTableDesignerSubmitLogs({
      database: 'business',
      databaseType: 'MySQL',
      validationIssues: [],
    }, largeRequest)
    assert.ok(largeLogs.length > 2, '大量字段应拆分为多条日志')
    assert.ok(
      largeLogs.every(message => message.length < 4000),
      '单条日志不能超过主进程截断上限',
    )
    const largeContent = largeLogs.join('\n')
    assert.match(largeContent, /"name":"field_1"/)
    assert.match(largeContent, /"name":"field_80"/)
    console.log('[表结构提交日志测试] 全部通过')
  } finally {
    dispose()
  }
}

main()
