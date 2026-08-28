const assert = require('node:assert/strict')
const {
  StructureSyncService,
} = require('../dist/main/database/structureSyncService')

function sourceMetadata(table, referencedTable) {
  return {
    primary_key_name: `pk_${table}`,
    fields: [
      {
        name: 'id',
        type: 'int',
        not_null: true,
        default: null,
        default_expression: '',
        primary: true,
        auto_increment: false,
        comment: '',
      },
      {
        name: `${referencedTable}_id`,
        type: 'int',
        not_null: false,
        default: null,
        default_expression: '',
        primary: false,
        auto_increment: false,
        comment: '',
      },
    ],
    indexes: [],
    foreign_keys: [{
      name: `fk_${table}_${referencedTable}`,
      fields: [`${referencedTable}_id`],
      referenced_table: referencedTable,
      referenced_fields: ['id'],
    }],
    ddl: '',
  }
}

function definitionToMetadata(definition) {
  return {
    primary_key_name: definition.primaryKeyName,
    fields: definition.fields.map(field => ({
      name: field.name,
      type: field.type,
      not_null: field.notNull,
      default: null,
      default_expression: field.defaultValue,
      primary: field.primary,
      auto_increment: field.autoIncrement,
      comment: field.comment,
    })),
    indexes: definition.indexes.map(index => ({
      name: index.name,
      type: index.unique ? 'UNIQUE' : 'INDEX',
      fields: index.fields,
      unique: index.unique,
    })),
    foreign_keys: definition.foreignKeys.map(foreignKey => ({
      name: foreignKey.name,
      fields: foreignKey.fields,
      referenced_table: foreignKey.referencedTable,
      referenced_fields: foreignKey.referencedFields,
    })),
    ddl: '',
  }
}

async function testCycleSafeStructureSync() {
  const source = new Map([
    ['a', sourceMetadata('a', 'b')],
    ['b', sourceMetadata('b', 'a')],
  ])
  const target = new Map()
  const saves = []
  const gateway = {
    getConnectionCatalog() {
      return {
        connections: [
          { id: 'source', type: 'MySQL' },
          { id: 'target', type: 'MySQL' },
        ],
        groups: [],
      }
    },
    async getTables(connId) {
      return connId === 'source'
        ? [...source.keys()]
        : [...target.keys()]
    },
    async getTableMetadata(connId, _database, table) {
      return connId === 'source'
        ? source.get(table)
        : definitionToMetadata(target.get(table))
    },
    async previewTableStructure(_connId, _database, request) {
      return {
        mode: request.originalName ? 'alter' : 'create',
        statements: ['TEST SQL'],
        warnings: [],
      }
    },
    async saveTableStructure(_connId, _database, request) {
      const definition = request.definition
      saves.push({
        table: definition.name,
        foreignKeys: definition.foreignKeys.length,
      })
      target.set(definition.name, definition)
      return {
        tableName: definition.name,
        mode: request.originalName ? 'alter' : 'create',
        statementCount: 1,
        warnings: [],
      }
    },
  }

  const service = new StructureSyncService(gateway)
  const result = await service.execute({
    source: { connId: 'source', database: 'source_db' },
    target: { connId: 'target', database: 'target_db' },
    tables: ['a', 'b'],
  })
  assert.deepEqual(saves, [
    { table: 'a', foreignKeys: 0 },
    { table: 'b', foreignKeys: 0 },
    { table: 'a', foreignKeys: 1 },
    { table: 'b', foreignKeys: 1 },
  ])
  assert.equal(result.tableCount, 2)
  assert.equal(result.statementCount, 4)
  assert.deepEqual(result.createdTables, ['a', 'b'])
}

testCycleSafeStructureSync()
  .then(() => {
    console.log('[结构同步执行测试] 循环外键分阶段建表通过')
  })
  .catch(error => {
    console.error('[结构同步执行测试] 失败', error)
    process.exitCode = 1
  })
