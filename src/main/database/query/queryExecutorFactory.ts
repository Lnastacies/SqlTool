import type { ConnectionData } from '../adapters'
import { MySQLQueryExecutor } from './mysqlQueryExecutor'
import { PostgreSQLQueryExecutor } from './postgresQueryExecutor'
import type { QueryExecutor } from './queryTypes'
import { SQLiteQueryExecutor } from './sqliteQueryExecutor'
import { SQLServerQueryExecutor } from './sqlServerQueryExecutor'

export function createQueryExecutor(
  type: ConnectionData['type'],
): QueryExecutor {
  switch (type) {
    case 'MySQL':
    case 'TDSQL':
      return new MySQLQueryExecutor()
    case 'PostgreSQL':
      return new PostgreSQLQueryExecutor()
    case 'SQL Server':
      return new SQLServerQueryExecutor()
    case 'SQLite':
      return new SQLiteQueryExecutor()
    default:
      throw new Error(`暂不支持该数据库类型的查询会话: ${type}`)
  }
}
