const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

require.extensions['.ts'] = (module, fileName) => {
  const source = fs.readFileSync(fileName, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName,
  }).outputText
  module._compile(output, fileName)
}

const {
  initialBackupForm,
} = require('../src/renderer/features/backups/backupDialogModel')
const {
  backupTimestampToken,
  buildBackupFileName,
} = require('../dist/main/database/databaseBackupFileName')

const createdAt = new Date(2026, 7, 18, 9, 27, 59)
const timestamp = backupTimestampToken(createdAt)
const fileName = buildBackupFileName({
  name: 'crm_完整备份',
  id: '12345678-abcd-4321-abcd-1234567890ab',
  createdAt,
  compressed: true,
})

assert.equal(initialBackupForm('crm').name, 'crm_完整备份')
assert.equal(timestamp, '20260818_092759')
assert.equal(
  fileName,
  'crm_完整备份_20260818_092759_12345678.sql.gz',
)
assert.equal(
  fileName.match(/\d{8}_\d{6}/g)?.length,
  1,
  '备份文件名只能包含一个标准时间戳',
)

console.log('[数据库备份命名测试] 全部通过')
