import { logger } from '../logger'
import type { ActiveConnection } from './databaseConnectionRegistry'
import type {
  DatabaseModel,
  DatabaseModelTable,
} from './databaseManagementTypes'
import { buildCreateTableStatements } from './tableStructureSqlCommon'
import { metadataToTableDefinition } from './tableStructureTypes'

function sortTablesByDependencies(
  tables: DatabaseModelTable[],
): DatabaseModelTable[] {
  const byName = new Map(tables.map(table => [table.name, table]))
  const pending = new Set(tables.map(table => table.name))
  const sorted: DatabaseModelTable[] = []

  while (pending.size > 0) {
    const ready = Array.from(pending).filter(name => {
      const table = byName.get(name)!
      return table.foreignKeys.every(foreignKey => (
        foreignKey.referenced_table === name
        || !pending.has(foreignKey.referenced_table)
        || !byName.has(foreignKey.referenced_table)
      ))
    })
    if (ready.length === 0) {
      // 循环外键无法拓扑排序，保留数据库返回顺序，避免遗漏任何表。
      ready.push(...tables
        .map(table => table.name)
        .filter(name => pending.has(name)))
    }
    for (const name of ready) {
      pending.delete(name)
      sorted.push(byName.get(name)!)
    }
  }
  return sorted
}

export async function loadDatabaseModel(
  activeConnection: ActiveConnection,
  database: string,
): Promise<DatabaseModel> {
  const { adapter, connection, connData } = activeConnection
  const startedAt = Date.now()
  logger.info(
    'DatabaseModel',
    `开始读取数据库模型: 连接=${connData.id}, 数据库=${database}, 类型=${connData.type}`,
  )

  const tables = await adapter.getTables(connection, database)
  const views = await adapter.getViews(connection, database)
  const functions = await adapter.getFunctions(connection, database)
  const procedures = await adapter.getProcedures(connection, database)
  const events = await adapter.getEvents(connection, database)
  const modelTables: DatabaseModelTable[] = []

  for (let index = 0; index < tables.length; index += 1) {
    const name = tables[index]
    const metadata = await adapter.getTableMetadata(
      connection,
      database,
      name,
    )
    const ddl = metadata.ddl.trim() || buildCreateTableStatements(
      connData.type,
      database,
      metadataToTableDefinition(name, metadata),
    ).join(';\n\n')
    if (!metadata.ddl.trim()) {
      logger.info(
        'DatabaseModel',
        `数据库未直接返回建表语句，已根据元数据重建: 数据库=${database}, 表=${name}, 类型=${connData.type}`,
      )
    }
    modelTables.push({
      name,
      primaryKeyName: metadata.primary_key_name,
      fields: metadata.fields,
      indexes: metadata.indexes,
      foreignKeys: metadata.foreign_keys,
      ddl,
    })
    if ((index + 1) % 20 === 0) {
      logger.info(
        'DatabaseModel',
        `数据库模型读取进度: 数据库=${database}, 已完成=${index + 1}/${tables.length}`,
      )
    }
  }

  const model: DatabaseModel = {
    name: database,
    type: connData.type,
    tables: sortTablesByDependencies(modelTables),
    views,
    functions,
    procedures,
    events,
  }
  logger.info(
    'DatabaseModel',
    `数据库模型读取完成: 数据库=${database}, 表=${model.tables.length}, 视图=${views.length}, 外键=${model.tables.reduce((total, table) => total + table.foreignKeys.length, 0)}, 耗时=${Date.now() - startedAt}ms`,
  )
  return model
}
