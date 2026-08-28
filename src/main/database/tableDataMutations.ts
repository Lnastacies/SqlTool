import type { ConnectionData } from './adapters'
import {
  deleteMySQL,
  insertMySQL,
  updateMySQL,
} from './mysqlMutations'
import {
  deletePostgreSQL,
  insertPostgreSQL,
  updatePostgreSQL,
} from './postgresMutations'
import {
  deleteSQLite,
  insertSQLite,
  updateSQLite,
} from './sqliteMutations'
import {
  deleteSQLServer,
  insertSQLServer,
  runTedious,
  updateSQLServer,
} from './sqlServerMutation'
import type {
  MutationDialect,
  TableMutationBatch,
  TableMutationResult,
  TableRowUpdate,
} from './tableMutationTypes'

export type {
  TableMutationBatch,
  TableMutationResult,
  TableRowDelete,
  TableRowInsert,
  TableRowUpdate,
} from './tableMutationTypes'

async function transaction(
  type: ConnectionData['type'],
  connection: any,
  action: 'begin' | 'commit' | 'rollback',
): Promise<void> {
  const sql = action === 'begin'
    ? (type === 'MySQL' ? 'START TRANSACTION' : 'BEGIN TRANSACTION')
    : action === 'commit'
      ? 'COMMIT'
      : 'ROLLBACK'

  if (type === 'MySQL') {
    await connection.query(sql)
  } else if (type === 'PostgreSQL') {
    await connection.query(sql)
  } else if (type === 'SQL Server') {
    await runTedious(connection, sql)
  } else {
    connection.run(sql)
  }
}

function getDialect(type: ConnectionData['type']): MutationDialect {
  if (type === 'MySQL') {
    return {
      insertRow: insertMySQL,
      updateRow: updateMySQL,
      deleteRow: deleteMySQL,
    }
  }
  if (type === 'PostgreSQL') {
    return {
      insertRow: insertPostgreSQL,
      updateRow: updatePostgreSQL,
      deleteRow: deletePostgreSQL,
    }
  }
  if (type === 'SQL Server') {
    return {
      insertRow: insertSQLServer,
      updateRow: updateSQLServer,
      deleteRow: deleteSQLServer,
    }
  }
  return {
    insertRow: insertSQLite,
    updateRow: updateSQLite,
    deleteRow: deleteSQLite,
  }
}

function assertSingleRow(
  action: '新增' | '更新' | '删除',
  index: number,
  affectedRows: number,
): void {
  if (affectedRows !== 1) {
    throw new Error(
      `第 ${index + 1} 个${action}操作影响 ${affectedRows} 条记录，已停止提交`,
    )
  }
}

export async function applyTableMutations(
  type: ConnectionData['type'],
  connection: any,
  database: string,
  tableName: string,
  batch: TableMutationBatch,
): Promise<TableMutationResult> {
  const dialect = getDialect(type)
  const result: TableMutationResult = {
    insertedRows: 0,
    updatedRows: 0,
    deletedRows: 0,
    affectedRows: 0,
  }
  await transaction(type, connection, 'begin')
  try {
    for (const [index, deletion] of batch.deletes.entries()) {
      const affected = await dialect.deleteRow(
        connection, database, tableName, deletion,
      )
      assertSingleRow('删除', index, affected)
      result.deletedRows += affected
    }
    for (const [index, update] of batch.updates.entries()) {
      const affected = await dialect.updateRow(
        connection, database, tableName, update,
      )
      assertSingleRow('更新', index, affected)
      result.updatedRows += affected
    }
    for (const [index, insert] of batch.inserts.entries()) {
      const affected = await dialect.insertRow(
        connection, database, tableName, insert,
      )
      assertSingleRow('新增', index, affected)
      result.insertedRows += affected
    }
    await transaction(type, connection, 'commit')
    if (type === 'SQLite' && typeof connection.saveToDisk === 'function') {
      connection.saveToDisk()
    }
    result.affectedRows = (
      result.insertedRows
      + result.updatedRows
      + result.deletedRows
    )
    return result
  } catch (error) {
    try {
      await transaction(type, connection, 'rollback')
    } catch {
      // 回滚异常不能覆盖最初的数据修改异常，外层会记录失败上下文。
    }
    throw error
  }
}

export async function applyTableRowUpdates(
  type: ConnectionData['type'],
  connection: any,
  database: string,
  tableName: string,
  updates: TableRowUpdate[],
): Promise<number> {
  const result = await applyTableMutations(
    type,
    connection,
    database,
    tableName,
    { inserts: [], updates, deletes: [] },
  )
  return result.updatedRows
}
