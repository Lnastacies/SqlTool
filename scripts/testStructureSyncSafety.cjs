const assert = require('node:assert/strict')
const {
  StructureSyncService,
} = require('../dist/main/database/structureSyncService')

function metadata(type) {
  return {
    primary_key_name: 'PRIMARY',
    fields: [{
      name: 'telephone',
      type,
      not_null: false,
      default: null,
      default_expression: '',
      primary: false,
      auto_increment: false,
      comment: '',
    }],
    indexes: [],
    foreign_keys: [],
    ddl: '',
  }
}

function gatewayFor(sourceType, targetType, maximumLength) {
  let saveCount = 0
  return {
    gateway: {
      getConnectionCatalog() {
        return {
          connections: [
            { id: 'source', type: 'MySQL' },
            { id: 'target', type: 'MySQL' },
          ],
          groups: [],
        }
      },
      async getTables() {
        return ['customer']
      },
      async getTableMetadata(connId) {
        return connId === 'source'
          ? metadata(sourceType)
          : metadata(targetType)
      },
      async previewTableStructure() {
        return {
          mode: 'alter',
          statements: ['ALTER TABLE `customer` MODIFY `telephone` VARCHAR(10)'],
          warnings: [],
        }
      },
      async executeSQL() {
        return {
          success: true,
          rows: [{ __sqltool_length_0: maximumLength }],
          message: '',
        }
      },
      async saveTableStructure() {
        saveCount += 1
        return {
          tableName: 'customer',
          mode: 'alter',
          statementCount: 1,
          warnings: [],
        }
      },
    },
    getSaveCount: () => saveCount,
  }
}

async function testUnsafeNarrowingIsBlocked() {
  const fixture = gatewayFor('varchar(10)', 'varchar(30)', 18)
  const service = new StructureSyncService(fixture.gateway)
  const request = {
    source: { connId: 'source', database: 'source_db' },
    target: { connId: 'target', database: 'target_db' },
    tables: ['customer'],
  }
  const preview = await service.preview(request)
  assert.equal(preview.items[0].status, 'blocked')
  assert.match(preview.items[0].warnings.join('；'), /最大长度 18/)
  assert.match(preview.items[0].warnings.join('；'), /目标长度 10/)
  await assert.rejects(() => service.execute(request), /未通过结构预检查/)
  assert.equal(fixture.getSaveCount(), 0)
}

async function testSameStructureIsSkipped() {
  const fixture = gatewayFor('varchar(30)', 'varchar(30)', 18)
  const service = new StructureSyncService(fixture.gateway)
  const preview = await service.preview({
    source: { connId: 'source', database: 'source_db' },
    target: { connId: 'target', database: 'target_db' },
    tables: ['customer'],
  })
  assert.equal(preview.items[0].status, 'same')
  assert.equal(preview.items[0].plan.statements.length, 0)
}

async function main() {
  await testUnsafeNarrowingIsBlocked()
  await testSameStructureIsSkipped()
  console.log('[结构同步安全测试] 数据截断预检查与相同结构跳过通过')
}

main().catch(error => {
  console.error('[结构同步安全测试] 失败', error)
  process.exitCode = 1
})
