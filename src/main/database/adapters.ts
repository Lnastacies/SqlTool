import mysql from 'mysql2/promise'
import pg from 'pg'
import initSqlJs from 'sql.js'
import { Connection, Request } from 'tedious'
import { logger } from '../logger'
import { normalizeValue } from './mutationSqlUtils'
import { tediousType } from './sqlServerMutation'
import {
  buildCreateDatabaseStatement,
  type CreateDatabaseOptions,
} from './databaseCreation'

export interface ConnectionData {
  id: string
  name: string
  type: 'MySQL' | 'PostgreSQL' | 'SQL Server' | 'SQLite'
  groupId?: string
  host: string
  port: number
  username: string
  password: string
  database: string
  timeout?: number
  charset?: string
  color?: string
  /** 仅查询专用连接开启，普通元数据连接保持单语句模式。 */
  multipleStatements?: boolean
  /** 查询结果按列序号返回，避免重复列名覆盖。 */
  rowsAsArray?: boolean
}

export interface TableMetadata {
  primary_key_name?: string
  fields: Array<{
    name: string
    type: string
    not_null: boolean
    default: any
    default_expression?: string
    primary: boolean
    auto_increment?: boolean
    comment: string
  }>
  indexes: Array<{
    name: string
    type: string
    fields: string[]
    unique: boolean
  }>
  foreign_keys: Array<{
    name: string
    fields: string[]
    referenced_table: string
    referenced_fields: string[]
  }>
  ddl: string
}

export interface ExecuteResult {
  success: boolean
  columns?: string[]
  rows?: any[]
  affected_rows?: number
  message: string
  execution_time?: number
}

export interface TableDataPage {
  columns: string[]
  fields: TableMetadata['fields']
  rows: Record<string, unknown>[]
  total: number
  page: number
  pageSize: number
  primaryKeys: string[]
  editable: boolean
}

export interface TableSummary {
  name: string
  rowCount?: number
  sizeBytes?: number
  createdAt?: string
  updatedAt?: string
  engine?: string
  comment?: string
  type: string
}

export interface DatabaseSummary {
  name: string
  sizeBytes?: number
  tableCount?: number
  charset?: string
  collation?: string
  state?: string
}

function connectionTimeoutMs(timeoutSeconds?: number): number {
  return Math.max(1, timeoutSeconds || 30) * 1000
}

/**
 * 生成 MySQL 连接的日志标识。PromiseConnection 与 BaseConnection 的配置位置不同，
 * 这里统一从底层对象取 host:port，避免在关闭路径里丢失上下文信息。
 */
function describeMysqlConnection(connection: unknown): string {
  const raw = (connection as any)?.connection ?? connection
  const config = (raw as any)?.config || {}
  const host = config.host || 'unknown'
  const port = config.port || 'unknown'
  return `${host}:${port}`
}

/** 生成 PostgreSQL 连接的日志标识，取不到时回退为 client 实例标识。 */
function describePgConnection(connection: unknown): string {
  const config = (connection as any)?.connectionParameters || {}
  const host = config.host || 'unknown'
  const port = config.port || 'unknown'
  return `${host}:${port}`
}

function dateTimeText(value: unknown): string | undefined {
  if (value == null || value === '') return undefined
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export abstract class DatabaseAdapter {
  abstract connect(connData: ConnectionData): Promise<any>
  abstract testConnection(connData: ConnectionData): Promise<boolean>
  abstract getDatabases(connection: any): Promise<string[]>
  async getDatabaseSummaries(connection: any): Promise<DatabaseSummary[]> {
    const databases = await this.getDatabases(connection)
    return databases.map(name => ({ name }))
  }
  abstract createDatabase(
    connection: any,
    name: string,
    options?: CreateDatabaseOptions,
  ): Promise<void>
  abstract getTables(connection: any, database: string): Promise<string[]>
  abstract getTableSummaries(
    connection: any,
    database: string,
  ): Promise<TableSummary[]>
  abstract getViews(connection: any, database: string): Promise<string[]>
  abstract getProcedures(connection: any, database: string): Promise<string[]>
  abstract getFunctions(connection: any, database: string): Promise<string[]>
  abstract getEvents(connection: any, database: string): Promise<string[]>
  abstract getTableMetadata(connection: any, database: string, tableName: string): Promise<TableMetadata>
  abstract executeSQL(
    connection: any,
    database: string,
    sql: string,
    parameters?: unknown[],
  ): Promise<ExecuteResult>
  abstract close(connection: any): void | Promise<void>
}

export class MySQLAdapter extends DatabaseAdapter {
  private readObjectNames(
    rows: unknown,
    database: string,
    objectType: string,
  ): string[] {
    const source = Array.isArray(rows) ? rows : []
    const names = source.flatMap(row => {
      const value = Array.isArray(row)
        ? row[0]
        : row && typeof row === 'object'
          ? (
            (row as Record<string, unknown>).object_name
            ?? Object.values(row)[0]
          )
          : undefined
      if (typeof value !== 'string' || !value.trim()) return []
      return [value.trim()]
    })
    const invalidCount = source.length - names.length

    if (invalidCount > 0) {
      logger.warn(
        'MySQLAdapter',
        `数据库对象名称无效: 数据库=${database}, 类型=${objectType}, 无效=${invalidCount}, 总数=${source.length}`,
      )
    }
    logger.debug(
      'MySQLAdapter',
      `数据库对象读取完成: 数据库=${database}, 类型=${objectType}, 数量=${names.length}, 样例=${names.slice(0, 3).join(',') || '无'}`,
    )
    return names
  }

  async connect(connData: ConnectionData): Promise<mysql.Connection> {
    const startTime = Date.now()
    logger.info('MySQLAdapter', `开始连接 MySQL: ${connData.host}:${connData.port}`)
    logger.debug('MySQLAdapter', `连接参数: database=${connData.database || '无'}, user=${connData.username}, timeout=${connData.timeout || 30}s`)
    
    const params: mysql.ConnectionOptions = {
      // mysql2 对 'localhost' 仅取 DNS 解析的第一个结果（可能是 ::1），
      // 服务未监听 IPv6 时会误报 ECONNREFUSED；统一走 IPv4 回环更稳定
      host: connData.host === 'localhost' ? '127.0.0.1' : connData.host,
      port: connData.port,
      user: connData.username,
      password: connData.password,
      database: connData.database || undefined,
      connectTimeout: connectionTimeoutMs(connData.timeout),
      charset: connData.charset || 'utf8mb4',
      multipleStatements: connData.multipleStatements || false,
      rowsAsArray: connData.rowsAsArray || false,
    }
    
    try {
      const connection = await mysql.createConnection(params)
      const duration = Date.now() - startTime
      logger.info('MySQLAdapter', `MySQL连接成功: ${connData.host}:${connData.port}, 耗时: ${duration}ms`)
      return connection
    } catch (error: any) {
      const duration = Date.now() - startTime
      logger.error('MySQLAdapter', `MySQL连接失败: ${connData.host}:${connData.port}, 错误: ${error.message}, 耗时: ${duration}ms`, error)
      throw error
    }
  }

  async testConnection(connData: ConnectionData): Promise<boolean> {
    let conn: mysql.Connection | null = null
    try {
      conn = await this.connect(connData)
      await conn.execute('SELECT 1')
      return true
    } catch {
      return false
    } finally {
      // 复用统一关闭语义：连接已断开时 close() 内部会降级并吞掉异常，
      // 避免 finally 抛错覆盖上面的 return false
      if (conn) await this.close(conn).catch(() => undefined)
    }
  }

  async getDatabases(connection: mysql.Connection): Promise<string[]> {
    const [rows] = await connection.execute('SHOW DATABASES')
    return (rows as any[]).map((row: any) => row.Database || row[0])
  }

  async getDatabaseSummaries(
    connection: mysql.Connection,
  ): Promise<DatabaseSummary[]> {
    try {
      const [rows] = await connection.execute(`
        SELECT s.SCHEMA_NAME AS database_name,
               s.DEFAULT_CHARACTER_SET_NAME AS charset_name,
               s.DEFAULT_COLLATION_NAME AS collation_name,
               COALESCE(SUM(
                 CASE WHEN t.TABLE_TYPE = 'BASE TABLE'
                   THEN COALESCE(t.DATA_LENGTH, 0) + COALESCE(t.INDEX_LENGTH, 0)
                   ELSE 0
                 END
               ), 0) AS size_bytes,
               COALESCE(SUM(
                 CASE WHEN t.TABLE_TYPE = 'BASE TABLE' THEN 1 ELSE 0 END
               ), 0) AS table_count
        FROM information_schema.SCHEMATA s
        LEFT JOIN information_schema.TABLES t
          ON t.TABLE_SCHEMA = s.SCHEMA_NAME
        GROUP BY s.SCHEMA_NAME,
                 s.DEFAULT_CHARACTER_SET_NAME,
                 s.DEFAULT_COLLATION_NAME
        ORDER BY s.SCHEMA_NAME
      `)
      return (rows as Record<string, unknown>[]).map(row => ({
        name: String(row.database_name || ''),
        sizeBytes: Number(row.size_bytes || 0),
        tableCount: Number(row.table_count || 0),
        charset: row.charset_name == null
          ? undefined
          : String(row.charset_name),
        collation: row.collation_name == null
          ? undefined
          : String(row.collation_name),
        state: 'ONLINE',
      })).filter(item => item.name)
    } catch (error) {
      logger.warn(
        'MySQLAdapter',
        `数据库摘要读取失败，退回名称列表: ${error instanceof Error ? error.message : String(error)}`,
      )
      return super.getDatabaseSummaries(connection)
    }
  }

  async createDatabase(
    connection: mysql.Connection,
    name: string,
    options?: CreateDatabaseOptions,
  ): Promise<void> {
    // MySQL 的 CREATE DATABASE 不支持预编译协议，必须使用普通查询。
    await connection.query(buildCreateDatabaseStatement('MySQL', name, options))
  }

  async getTables(connection: mysql.Connection, database: string): Promise<string[]> {
    const [rows] = await connection.execute(
      `SELECT TABLE_NAME AS object_name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [database],
    )
    return this.readObjectNames(rows, database, '表')
  }

  async getTableSummaries(
    connection: mysql.Connection,
    database: string,
  ): Promise<TableSummary[]> {
    const [rows] = await connection.execute(
      `SELECT TABLE_NAME AS table_name,
              TABLE_ROWS AS row_count,
              DATA_LENGTH + INDEX_LENGTH AS size_bytes,
              CREATE_TIME AS created_at,
              UPDATE_TIME AS updated_at,
              ENGINE AS engine,
              TABLE_COMMENT AS table_comment,
              TABLE_TYPE AS table_type
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [database],
    )
    const summaries = (rows as Record<string, unknown>[]).map(row => ({
      name: String(row.table_name || ''),
      rowCount: row.row_count == null ? undefined : Number(row.row_count),
      sizeBytes: row.size_bytes == null ? undefined : Number(row.size_bytes),
      createdAt: dateTimeText(row.created_at),
      updatedAt: dateTimeText(row.updated_at),
      engine: row.engine == null ? undefined : String(row.engine),
      comment: row.table_comment == null
        ? undefined
        : String(row.table_comment),
      type: row.table_type == null ? 'Table' : String(row.table_type),
    })).filter(item => item.name)
    logger.info(
      'MySQLAdapter',
      `表明细读取完成: 数据库=${database}, 数量=${summaries.length}`,
    )
    return summaries
  }

  async getViews(connection: mysql.Connection, database: string): Promise<string[]> {
    const [rows] = await connection.execute(
      `SELECT TABLE_NAME AS object_name
       FROM information_schema.VIEWS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [database],
    )
    return this.readObjectNames(rows, database, '视图')
  }

  async getProcedures(connection: mysql.Connection, database: string): Promise<string[]> {
    const [rows] = await connection.execute(
      `SELECT ROUTINE_NAME AS object_name
       FROM information_schema.ROUTINES
       WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE'
       ORDER BY ROUTINE_NAME`,
      [database],
    )
    return this.readObjectNames(rows, database, '存储过程')
  }

  async getFunctions(connection: mysql.Connection, database: string): Promise<string[]> {
    const [rows] = await connection.execute(
      `SELECT ROUTINE_NAME AS object_name
       FROM information_schema.ROUTINES
       WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'FUNCTION'
       ORDER BY ROUTINE_NAME`,
      [database],
    )
    return this.readObjectNames(rows, database, '函数')
  }

  async getEvents(connection: mysql.Connection, database: string): Promise<string[]> {
    const [rows] = await connection.execute(
      `SELECT EVENT_NAME AS object_name
       FROM information_schema.EVENTS
       WHERE EVENT_SCHEMA = ?
       ORDER BY EVENT_NAME`,
      [database],
    )
    return this.readObjectNames(rows, database, '事件')
  }

  async getTableMetadata(connection: mysql.Connection, database: string, tableName: string): Promise<TableMetadata> {
    const metadata: TableMetadata = {
      fields: [],
      indexes: [],
      foreign_keys: [],
      ddl: ''
    }

    const [fields] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
              COLUMN_KEY, EXTRA, COLUMN_COMMENT, DATA_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [database, tableName],
    )
    for (const field of fields as any[]) {
      const defaultValue = field.COLUMN_DEFAULT
      const rawDefault = defaultValue === null || defaultValue === undefined
        ? ''
        : String(defaultValue)
      const defaultExpression = (
        !rawDefault
        || /^NULL$/i.test(rawDefault)
        || /^CURRENT_(?:TIMESTAMP|DATE|TIME)(?:\(\d+\))?$/i.test(rawDefault)
        || (
          /^(?:tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real|bit)$/i.test(field.DATA_TYPE)
          && /^[-+]?\d+(?:\.\d+)?$/.test(rawDefault)
        )
        || /^'.*'$/.test(rawDefault)
      )
        ? rawDefault
        : `'${rawDefault.replace(/'/g, "''")}'`
      metadata.fields.push({
        name: field.COLUMN_NAME,
        type: field.COLUMN_TYPE,
        not_null: field.IS_NULLABLE === 'NO',
        default: defaultValue,
        default_expression: defaultExpression,
        primary: field.COLUMN_KEY === 'PRI',
        auto_increment: String(field.EXTRA || '').includes('auto_increment'),
        comment: field.COLUMN_COMMENT || ''
      })
    }

    const escapedDatabase = database.replace(/`/g, '``')
    const escapedTable = tableName.replace(/`/g, '``')
    const [indexes] = await connection.execute(
      `SHOW INDEX FROM \`${escapedDatabase}\`.\`${escapedTable}\``,
    )
    const indexDict: { [key: string]: { name: string; type: string; fields: string[]; unique: boolean } } = {}
    for (const index of indexes as any[]) {
      const indexName = index.Key_name ?? index[2]
      if (!indexDict[indexName]) {
        indexDict[indexName] = {
          name: indexName,
          type: String(index.Index_type ?? index[10] ?? 'BTREE'),
          fields: [],
          // Non_unique=0 表示唯一索引，不能使用 ||，否则数值 0 会被当成空值。
          unique: Number(index.Non_unique ?? index[1]) === 0
        }
      }
      indexDict[indexName].fields.push(index.Column_name ?? index[4])
    }
    metadata.indexes = Object.values(indexDict)
    if (indexDict.PRIMARY) metadata.primary_key_name = 'PRIMARY'

    const [createTable] = await connection.execute(
      `SHOW CREATE TABLE \`${escapedDatabase}\`.\`${escapedTable}\``,
    )
    if (createTable && (createTable as any[]).length > 0) {
      const row = (createTable as any[])[0]
      metadata.ddl = String(
        row['Create Table']
        ?? row.Create_Table
        ?? row[1]
        ?? '',
      )
    }

    const [foreignKeys] = await connection.execute(
      `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME,
              REFERENCED_COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION`,
      [database, tableName],
    )
    const foreignKeyDict: Record<string, TableMetadata['foreign_keys'][number]> = {}
    for (const row of foreignKeys as any[]) {
      if (!foreignKeyDict[row.CONSTRAINT_NAME]) {
        foreignKeyDict[row.CONSTRAINT_NAME] = {
          name: row.CONSTRAINT_NAME,
          fields: [],
          referenced_table: row.REFERENCED_TABLE_NAME,
          referenced_fields: [],
        }
      }
      foreignKeyDict[row.CONSTRAINT_NAME].fields.push(row.COLUMN_NAME)
      foreignKeyDict[row.CONSTRAINT_NAME].referenced_fields.push(
        row.REFERENCED_COLUMN_NAME,
      )
    }
    metadata.foreign_keys = Object.values(foreignKeyDict)

    return metadata
  }

  async executeSQL(
    connection: mysql.Connection,
    database: string,
    sql: string,
    parameters: unknown[] = [],
  ): Promise<ExecuteResult> {
    const start = Date.now()
    const sqlPreview = sql.trim().length > 100 ? sql.trim().substring(0, 100) + '...' : sql.trim()
    logger.info('MySQLAdapter', `开始执行SQL, 数据库: ${database || '当前'}, SQL预览: ${sqlPreview}`)
    
    try {
      if (database) {
        logger.debug('MySQLAdapter', `切换数据库: ${database}`)
        await connection.query(`USE \`${database}\``)
      }
      // MySQL/MariaDB 的部分版本不允许通过预处理协议执行 DDL。
      // 无参数 SQL 使用文本协议，有参数 SQL仍使用预处理协议保证参数安全。
      const usePreparedProtocol = parameters.length > 0
      logger.debug(
        'MySQLAdapter',
        `SQL执行协议: ${usePreparedProtocol ? '预处理协议' : '文本协议'}`,
      )
      const [rows, fields] = usePreparedProtocol
        ? await connection.execute(sql, parameters as any[])
        : await connection.query(sql)
      const executionTime = (Date.now() - start) / 1000
      
      if (fields && (fields as mysql.FieldPacket[]).length > 0) {
        const columns = (fields as mysql.FieldPacket[]).map(f => f.name)
        logger.info('MySQLAdapter', `SQL执行成功, 返回 ${(rows as any[]).length} 条记录, 耗时: ${executionTime.toFixed(2)}s`)
        return {
          success: true,
          columns,
          rows: rows as any[],
          affected_rows: (rows as any[]).length,
          message: `查询成功，返回 ${(rows as any[]).length} 条记录`,
          execution_time: executionTime
        }
      } else {
        const affectedRows = (rows as any).affectedRows || 0
        logger.info('MySQLAdapter', `SQL执行成功, 影响 ${affectedRows} 行, 耗时: ${executionTime.toFixed(2)}s`)
        return {
          success: true,
          affected_rows: affectedRows,
          message: `执行成功，影响 ${affectedRows} 行`,
          execution_time: executionTime
        }
      }
    } catch (error: any) {
      const executionTime = (Date.now() - start) / 1000
      logger.error('MySQLAdapter', `SQL执行失败, 错误: ${error.message}, 耗时: ${executionTime.toFixed(2)}s`, error)
      return {
        success: false,
        message: `执行失败: ${error.message}`
      }
    }
  }

  /**
   * 关闭底层连接。目标：无论连接当前处于什么状态（正常、服务端已断开、超时），
   * 都只做本地释放，不发送 QUIT，也不向调用方抛错。
   *
   * 注意：mysql2 的 PromiseConnection 只封装了 query/execute/end 等方法，
   * 并没有 close()/destroy()，必须取到内部的 BaseConnection 才能真正释放 socket；
   * 因此直接判断外层对象的 close 存在性会导致"静默不关闭"，此处按层级依次降级。
   */
  async close(connection: mysql.Connection): Promise<void> {
    const connId = describeMysqlConnection(connection)
    // PromiseConnection 的底层连接对象；若传入的本身就是 BaseConnection 则直接使用
    const raw = (connection as any).connection ?? connection

    // 1) 首选 BaseConnection.close()：同步关闭 socket，不发远程命令，已断开时也安全
    if (raw && typeof raw.close === 'function') {
      try {
        raw.close()
        return
      } catch (error) {
        logger.warn('MySQLAdapter', `close() 释放连接失败，降级尝试 destroy(): ${connId}, 原因=${(error as Error).message}`)
      }
    }

    // 2) 降级 destroy()：强制销毁 socket（close 不存在或抛错时使用）
    if (raw && typeof raw.destroy === 'function') {
      logger.warn('MySQLAdapter', `close() 不可用或失败，已降级使用 destroy() 释放连接: ${connId}`)
      try {
        raw.destroy()
        return
      } catch (error) {
        logger.warn('MySQLAdapter', `destroy() 释放连接失败，降级尝试 end(): ${connId}, 原因=${(error as Error).message}`)
      }
    }

    // 3) 最后兜底 end()（会发 QUIT），连接已断开时可能抛错，统一吞掉避免影响关闭流程
    logger.warn('MySQLAdapter', `close()/destroy() 均不可用，已降级使用 end() 释放连接: ${connId}`)
    try {
      await connection.end()
    } catch (error) {
      logger.warn('MySQLAdapter', `end() 释放连接异常(已忽略): ${connId}, 原因=${(error as Error).message}`)
    }
  }
}

export class PostgreSQLAdapter extends DatabaseAdapter {
  async connect(connData: ConnectionData): Promise<pg.Client> {
    const startTime = Date.now()
    logger.info('PostgreSQLAdapter', `开始连接 PostgreSQL: ${connData.host}:${connData.port}`)
    logger.debug('PostgreSQLAdapter', `连接参数: database=${connData.database || 'postgres'}, user=${connData.username}, timeout=${connData.timeout || 30}s`)
    
    const client = new pg.Client({
      host: connData.host,
      port: connData.port,
      user: connData.username,
      password: connData.password,
      database: connData.database || 'postgres',
      connectionTimeoutMillis: connectionTimeoutMs(connData.timeout)
    })
    
    try {
      await client.connect()
      const duration = Date.now() - startTime
      logger.info('PostgreSQLAdapter', `PostgreSQL连接成功: ${connData.host}:${connData.port}, 耗时: ${duration}ms`)
      return client
    } catch (error: any) {
      const duration = Date.now() - startTime
      logger.error('PostgreSQLAdapter', `PostgreSQL连接失败: ${connData.host}:${connData.port}, 错误: ${error.message}, 耗时: ${duration}ms`, error)
      throw error
    }
  }

  async testConnection(connData: ConnectionData): Promise<boolean> {
    let client: pg.Client | null = null
    try {
      client = await this.connect(connData)
      await client.query('SELECT 1')
      return true
    } catch {
      return false
    } finally {
      // 同样复用统一关闭语义，确保连接超时/已断开时 return false 不被 end() 抛错覆盖
      if (client) await this.close(client).catch(() => undefined)
    }
  }

  async getDatabases(connection: pg.Client): Promise<string[]> {
    const result = await connection.query("SELECT datname FROM pg_database WHERE datistemplate = false")
    return result.rows.map(row => row.datname)
  }

  async getDatabaseSummaries(
    connection: pg.Client,
  ): Promise<DatabaseSummary[]> {
    try {
      const result = await connection.query(`
        SELECT datname AS database_name,
               pg_database_size(datname)::bigint AS size_bytes,
               pg_encoding_to_char(encoding) AS charset_name,
               datcollate AS collation_name,
               CASE WHEN datallowconn THEN 'ONLINE' ELSE 'OFFLINE' END AS state_name
        FROM pg_database
        WHERE datistemplate = false
        ORDER BY datname
      `)
      return result.rows.map(row => ({
        name: String(row.database_name),
        sizeBytes: row.size_bytes == null
          ? undefined
          : Number(row.size_bytes),
        charset: row.charset_name || undefined,
        collation: row.collation_name || undefined,
        state: row.state_name || undefined,
      }))
    } catch (error) {
      logger.warn(
        'PostgreSQLAdapter',
        `数据库摘要读取失败，退回名称列表: ${error instanceof Error ? error.message : String(error)}`,
      )
      return super.getDatabaseSummaries(connection)
    }
  }

  async createDatabase(
    connection: pg.Client,
    name: string,
    options?: CreateDatabaseOptions,
  ): Promise<void> {
    await connection.query(
      buildCreateDatabaseStatement('PostgreSQL', name, options),
    )
  }

  async getTables(connection: pg.Client, database: string): Promise<string[]> {
    const result = await connection.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`)
    return result.rows.map(row => row.table_name)
  }

  async getTableSummaries(
    connection: pg.Client,
    database: string,
  ): Promise<TableSummary[]> {
    const result = await connection.query(`
      SELECT c.relname AS table_name,
             GREATEST(c.reltuples, 0)::bigint AS row_count,
             pg_total_relation_size(c.oid) AS size_bytes,
             obj_description(c.oid, 'pg_class') AS table_comment
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `)
    const summaries = result.rows.map(row => ({
      name: String(row.table_name),
      rowCount: row.row_count == null ? undefined : Number(row.row_count),
      sizeBytes: row.size_bytes == null ? undefined : Number(row.size_bytes),
      engine: 'PostgreSQL',
      comment: row.table_comment || undefined,
      type: 'Table',
    }))
    logger.info(
      'PostgreSQLAdapter',
      `表明细读取完成: 数据库=${database}, 数量=${summaries.length}`,
    )
    return summaries
  }

  async getViews(connection: pg.Client, database: string): Promise<string[]> {
    const result = await connection.query(`SELECT table_name FROM information_schema.views WHERE table_schema = 'public'`)
    return result.rows.map(row => row.table_name)
  }

  async getProcedures(connection: pg.Client, database: string): Promise<string[]> {
    const result = await connection.query(`
      SELECT proname FROM pg_proc 
      WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') 
      AND prokind = 'p'
    `)
    return result.rows.map(row => row.proname)
  }

  async getFunctions(connection: pg.Client, database: string): Promise<string[]> {
    const result = await connection.query(`
      SELECT proname FROM pg_proc 
      WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') 
      AND prokind = 'f'
    `)
    return result.rows.map(row => row.proname)
  }

  async getEvents(): Promise<string[]> {
    // PostgreSQL 没有与 MySQL Event 对等的数据库级调度对象。
    return []
  }

  async getTableMetadata(connection: pg.Client, database: string, tableName: string): Promise<TableMetadata> {
    const metadata: TableMetadata = {
      fields: [],
      indexes: [],
      foreign_keys: [],
      ddl: ''
    }

    const fieldsResult = await connection.query(`
      SELECT
        c.column_name,
        format_type(a.atttypid, a.atttypmod) AS formatted_type,
        c.is_nullable,
        c.column_default,
        c.is_identity,
        d.description AS column_comment
      FROM information_schema.columns c
      LEFT JOIN pg_namespace n
        ON n.nspname = c.table_schema
      LEFT JOIN pg_class t
        ON t.relnamespace = n.oid AND t.relname = c.table_name
      LEFT JOIN pg_attribute a
        ON a.attrelid = t.oid AND a.attname = c.column_name
      LEFT JOIN pg_description d
        ON d.objoid = t.oid AND d.objsubid = a.attnum
      WHERE c.table_name = $1 AND c.table_schema = 'public'
      ORDER BY c.ordinal_position
    `, [tableName])

    const pkResult = await connection.query(`
      SELECT k.column_name, k.constraint_name
      FROM information_schema.key_column_usage k
      JOIN information_schema.table_constraints t
        ON t.constraint_schema = k.constraint_schema
       AND t.constraint_name = k.constraint_name
      WHERE k.table_name = $1 AND k.table_schema = 'public'
        AND t.constraint_type = 'PRIMARY KEY'
      ORDER BY k.ordinal_position
    `, [tableName])
    const primaryKeys = new Set(pkResult.rows.map(row => row.column_name))
    metadata.primary_key_name = pkResult.rows[0]?.constraint_name

    for (const field of fieldsResult.rows) {
      metadata.fields.push({
        name: field.column_name,
        type: field.formatted_type,
        not_null: field.is_nullable === 'NO',
        default: field.column_default,
        default_expression: field.column_default || '',
        primary: primaryKeys.has(field.column_name),
        auto_increment: field.is_identity === 'YES'
          || String(field.column_default || '').includes('nextval('),
        comment: field.column_comment || ''
      })
    }

    const indexResult = await connection.query(`
      SELECT i.relname, a.attname, ix.indisunique
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON ix.indexrelid = i.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname = $1 AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND NOT ix.indisprimary
    `, [tableName])

    const indexDict: { [key: string]: { name: string; type: string; fields: string[]; unique: boolean } } = {}
    for (const index of indexResult.rows) {
      if (!indexDict[index.relname]) {
        indexDict[index.relname] = {
          name: index.relname,
          type: 'BTREE',
          fields: [],
          unique: index.indisunique
        }
      }
      indexDict[index.relname].fields.push(index.attname)
    }
    metadata.indexes = Object.values(indexDict)

    const fkResult = await connection.query(`
      SELECT conname, a.attname, confrelid::regclass, af.attname
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY(c.confkey)
      WHERE c.conrelid = $1::regclass AND c.contype = 'f'
    `, [tableName])

    const fkDict: { [key: string]: { name: string; fields: string[]; referenced_table: string; referenced_fields: string[] } } = {}
    for (const fk of fkResult.rows) {
      if (!fkDict[fk.conname]) {
        fkDict[fk.conname] = {
          name: fk.conname,
          fields: [],
          referenced_table: String(fk.confrelid),
          referenced_fields: []
        }
      }
      fkDict[fk.conname].fields.push(fk.attname)
      fkDict[fk.conname].referenced_fields.push(fk.af.attname)
    }
    metadata.foreign_keys = Object.values(fkDict)

    return metadata
  }

  async executeSQL(
    connection: pg.Client,
    database: string,
    sql: string,
    parameters: unknown[] = [],
  ): Promise<ExecuteResult> {
    const start = Date.now()
    const sqlPreview = sql.trim().length > 100 ? sql.trim().substring(0, 100) + '...' : sql.trim()
    logger.info('PostgreSQLAdapter', `开始执行SQL, 数据库: ${database || '当前'}, SQL预览: ${sqlPreview}`)
    
    try {
      // PostgreSQL 的数据库由连接会话决定，不能把数据库名误作 Schema 设置 search_path。
      const result = await connection.query(sql, parameters)
      const executionTime = (Date.now() - start) / 1000

      if (result.rows && result.rows.length > 0) {
        const columns = result.fields ? result.fields.map(f => f.name) : []
        logger.info('PostgreSQLAdapter', `SQL执行成功, 返回 ${result.rows.length} 条记录, 耗时: ${executionTime.toFixed(2)}s`)
        return {
          success: true,
          columns,
          rows: result.rows,
          affected_rows: result.rows.length,
          message: `查询成功，返回 ${result.rows.length} 条记录`,
          execution_time: executionTime
        }
      } else {
        const affectedRows = result.rowCount || 0
        logger.info('PostgreSQLAdapter', `SQL执行成功, 影响 ${affectedRows} 行, 耗时: ${executionTime.toFixed(2)}s`)
        return {
          success: true,
          affected_rows: affectedRows,
          message: `执行成功，影响 ${affectedRows} 行`,
          execution_time: executionTime
        }
      }
    } catch (error: any) {
      const executionTime = (Date.now() - start) / 1000
      logger.error('PostgreSQLAdapter', `SQL执行失败, 错误: ${error.message}, 耗时: ${executionTime.toFixed(2)}s`, error)
      return {
        success: false,
        message: `执行失败: ${error.message}`
      }
    }
  }

  /**
   * 关闭底层连接。pg.Client 本身没有 destroy()（仅在内部使用 connection.stream.destroy），
   * 且 end() 在已断开/超时连接上可能抛错或长时间等待 'end' 事件。
   * 因此优先直接销毁底层 socket，取不到 stream 时才回退 end() 并吞掉异常。
   */
  async close(connection: pg.Client): Promise<void> {
    // pg 的 Connection 实例挂在 client.connection 上，其 socket 来自 connection.stream
    const stream = (connection as any)?.connection?.stream
    if (stream && typeof stream.destroy === 'function') {
      try {
        stream.destroy()
        return
      } catch (error) {
        logger.warn('PostgreSQLAdapter', `销毁底层 socket 失败，降级尝试 end(): ${describePgConnection(connection)}, 原因=${(error as Error).message}`)
      }
    }
    try {
      await connection.end()
    } catch (error) {
      // 连接已断开时 end() 抛错属预期，不应阻断上层清理
      logger.warn('PostgreSQLAdapter', `end() 释放连接异常(已忽略): ${describePgConnection(connection)}, 原因=${(error as Error).message}`)
    }
  }
}

export class SQLServerAdapter extends DatabaseAdapter {
  async connect(connData: ConnectionData): Promise<Connection> {
    const startTime = Date.now()
    logger.info('SQLServerAdapter', `开始连接 SQL Server: ${connData.host}:${connData.port}`)
    logger.debug('SQLServerAdapter', `连接参数: database=${connData.database || 'master'}, user=${connData.username}, timeout=${connData.timeout || 30}s`)
    
    return new Promise((resolve, reject) => {
      const config = {
        server: connData.host,
        port: connData.port,
        authentication: {
          type: 'default',
          options: {
            userName: connData.username,
            password: connData.password
          }
        },
        options: {
          database: connData.database || 'master',
          connectTimeout: connectionTimeoutMs(connData.timeout)
        }
      }

      const connection = new Connection(config)
      connection.on('connect', (err: any) => {
        const duration = Date.now() - startTime
        if (err) {
          logger.error('SQLServerAdapter', `SQL Server连接失败: ${connData.host}:${connData.port}, 错误: ${err.message}, 耗时: ${duration}ms`, err)
          reject(err)
        } else {
          logger.info('SQLServerAdapter', `SQL Server连接成功: ${connData.host}:${connData.port}, 耗时: ${duration}ms`)
          resolve(connection)
        }
      })
      connection.connect()
    })
  }

  async testConnection(connData: ConnectionData): Promise<boolean> {
    let conn: Connection | null = null
    try {
      conn = await this.connect(connData)
      return new Promise((resolve) => {
        const request = new Request('SELECT 1', (err: any) => {
          if (err) resolve(false)
          else resolve(true)
        })
        conn!.execSql(request)
      })
    } catch {
      return false
    } finally {
      if (conn) conn.close()
    }
  }

  async getDatabases(connection: Connection): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const results: string[] = []
      const request = new Request('SELECT name FROM sys.databases', (err: any) => {
        if (err) reject(err)
        else resolve(results)
      })
      request.on('row', (columns: any[]) => {
        results.push(columns[0].value as string)
      })
      connection.execSql(request)
    })
  }

  async getDatabaseSummaries(
    connection: Connection,
  ): Promise<DatabaseSummary[]> {
    try {
      return await new Promise<DatabaseSummary[]>((resolve, reject) => {
        const summaries: DatabaseSummary[] = []
        const request = new Request(`
          SELECT d.name,
                 CAST(COALESCE(SUM(CAST(mf.size AS bigint)), 0) * 8192 AS bigint)
                   AS size_bytes,
                 d.collation_name,
                 d.state_desc
          FROM sys.databases d
          LEFT JOIN sys.master_files mf
            ON mf.database_id = d.database_id
          GROUP BY d.name, d.collation_name, d.state_desc
          ORDER BY d.name
        `, error => {
          if (error) reject(error)
          else resolve(summaries)
        })
        request.on('row', columns => {
          summaries.push({
            name: String(columns[0]?.value || ''),
            sizeBytes: columns[1]?.value == null
              ? undefined
              : Number(columns[1].value),
            collation: columns[2]?.value == null
              ? undefined
              : String(columns[2].value),
            state: columns[3]?.value == null
              ? undefined
              : String(columns[3].value),
          })
        })
        connection.execSql(request)
      })
    } catch (error) {
      logger.warn(
        'SQLServerAdapter',
        `数据库摘要读取失败，退回名称列表: ${error instanceof Error ? error.message : String(error)}`,
      )
      return super.getDatabaseSummaries(connection)
    }
  }

  async createDatabase(
    connection: Connection,
    name: string,
    options?: CreateDatabaseOptions,
  ): Promise<void> {
    const statement = buildCreateDatabaseStatement('SQL Server', name, options)
    await new Promise<void>((resolve, reject) => {
      const request = new Request(statement, (error?: Error) => {
        if (error) reject(error)
        else resolve()
      })
      connection.execSql(request)
    })
  }

  async getTables(connection: Connection, database: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const results: string[] = []
      const request = new Request(`USE ${database}; SELECT name FROM sys.tables`, (err: any) => {
        if (err) reject(err)
        else resolve(results)
      })
      request.on('row', (columns: any[]) => {
        results.push(columns[0].value as string)
      })
      connection.execSql(request)
    })
  }

  async getTableSummaries(
    connection: Connection,
    database: string,
  ): Promise<TableSummary[]> {
    const escapedDatabase = database.replace(/]/g, ']]')
    return new Promise((resolve, reject) => {
      const summaries: TableSummary[] = []
      const sql = `
        USE [${escapedDatabase}];
        SELECT t.name,
               SUM(p.rows) AS row_count,
               SUM(a.total_pages) * 8192 AS size_bytes,
               t.create_date,
               t.modify_date,
               CAST(ep.value AS nvarchar(4000)) AS table_comment
        FROM sys.tables t
        LEFT JOIN sys.indexes i
          ON t.object_id = i.object_id AND i.index_id IN (0, 1)
        LEFT JOIN sys.partitions p
          ON i.object_id = p.object_id AND i.index_id = p.index_id
        LEFT JOIN sys.allocation_units a
          ON p.partition_id = a.container_id
        LEFT JOIN sys.extended_properties ep
          ON ep.major_id = t.object_id
         AND ep.minor_id = 0
         AND ep.name = N'MS_Description'
        GROUP BY t.name, t.create_date, t.modify_date, ep.value
        ORDER BY t.name`
      const request = new Request(sql, error => {
        if (error) {
          reject(error)
          return
        }
        logger.info(
          'SQLServerAdapter',
          `表明细读取完成: 数据库=${database}, 数量=${summaries.length}`,
        )
        resolve(summaries)
      })
      request.on('row', columns => {
        summaries.push({
          name: String(columns[0]?.value || ''),
          rowCount: columns[1]?.value == null
            ? undefined
            : Number(columns[1].value),
          sizeBytes: columns[2]?.value == null
            ? undefined
            : Number(columns[2].value),
          createdAt: dateTimeText(columns[3]?.value),
          updatedAt: dateTimeText(columns[4]?.value),
          engine: 'SQL Server',
          comment: columns[5]?.value == null
            ? undefined
            : String(columns[5].value),
          type: 'Table',
        })
      })
      connection.execSql(request)
    })
  }

  async getViews(connection: Connection, database: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const results: string[] = []
      const request = new Request(`USE ${database}; SELECT name FROM sys.views`, (err: any) => {
        if (err) reject(err)
        else resolve(results)
      })
      request.on('row', (columns: any[]) => {
        results.push(columns[0].value as string)
      })
      connection.execSql(request)
    })
  }

  async getProcedures(connection: Connection, database: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const results: string[] = []
      const request = new Request(`USE ${database}; SELECT name FROM sys.procedures`, (err: any) => {
        if (err) reject(err)
        else resolve(results)
      })
      request.on('row', (columns: any[]) => {
        results.push(columns[0].value as string)
      })
      connection.execSql(request)
    })
  }

  async getFunctions(connection: Connection, database: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const results: string[] = []
      const request = new Request(`USE ${database}; SELECT name FROM sys.objects WHERE type IN ('FN', 'IF', 'TF')`, (err: any) => {
        if (err) reject(err)
        else resolve(results)
      })
      request.on('row', (columns: any[]) => {
        results.push(columns[0].value as string)
      })
      connection.execSql(request)
    })
  }

  async getEvents(): Promise<string[]> {
    // SQL Server Agent 作业属于实例级对象，不归入当前数据库事件分类。
    return []
  }

  async getTableMetadata(connection: Connection, database: string, tableName: string): Promise<TableMetadata> {
    const metadata: TableMetadata = {
      fields: [],
      indexes: [],
      foreign_keys: [],
      ddl: ''
    }

    const escapedDatabase = database.replace(/]/g, ']]')
    const escapedTableLiteral = tableName
      .replace(/]/g, ']]')
      .replace(/'/g, "''")
    const tableObjectId = await new Promise<any>((resolve, reject) => {
      let result: any = null
      const request = new Request(`USE [${escapedDatabase}]; SELECT OBJECT_ID(N'[dbo].[${escapedTableLiteral}]')`, (err: any) => {
        if (err) reject(err)
        else resolve(result)
      })
      request.on('row', (columns: any[]) => {
        result = columns[0].value
      })
      connection.execSql(request)
    })

    if (!tableObjectId) {
      return metadata
    }

    await new Promise<void>((resolve, reject) => {
      const request = new Request(`USE [${escapedDatabase}];
        SELECT c.name,
          CASE
            WHEN t.name IN ('varchar', 'char', 'varbinary', 'binary')
              THEN t.name + '(' + CASE WHEN c.max_length = -1 THEN 'max' ELSE CAST(c.max_length AS varchar(10)) END + ')'
            WHEN t.name IN ('nvarchar', 'nchar')
              THEN t.name + '(' + CASE WHEN c.max_length = -1 THEN 'max' ELSE CAST(c.max_length / 2 AS varchar(10)) END + ')'
            WHEN t.name IN ('decimal', 'numeric')
              THEN t.name + '(' + CAST(c.precision AS varchar(10)) + ',' + CAST(c.scale AS varchar(10)) + ')'
            WHEN t.name IN ('datetime2', 'datetimeoffset', 'time')
              THEN t.name + '(' + CAST(c.scale AS varchar(10)) + ')'
            ELSE t.name
          END AS formatted_type,
          c.is_nullable, dc.definition, ep.value, pk.is_primary_key,
          c.is_identity, pk.constraint_name
        FROM sys.columns c
        JOIN sys.types t ON c.user_type_id = t.user_type_id
        LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
        LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
        LEFT JOIN (
          SELECT ic.column_id, 1 as is_primary_key, i.name AS constraint_name
          FROM sys.indexes i
          JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
          WHERE i.object_id = ${tableObjectId} AND i.is_primary_key = 1
        ) pk ON c.column_id = pk.column_id
        WHERE c.object_id = ${tableObjectId}
        ORDER BY c.column_id`, (err: any) => {
        if (err) reject(err)
        else resolve()
      })

      request.on('row', (columns: any[]) => {
        if (columns[7]?.value) {
          metadata.primary_key_name = columns[7].value as string
        }
        metadata.fields.push({
          name: columns[0].value as string,
          type: columns[1].value as string,
          not_null: !(columns[2].value as boolean),
          default: columns[3].value,
          default_expression: columns[3].value || '',
          primary: columns[5]?.value === 1,
          auto_increment: Boolean(columns[6]?.value),
          comment: columns[4]?.value || ''
        })
      })

      connection.execSql(request)
    })

    await new Promise<void>((resolve, reject) => {
      const request = new Request(`USE [${escapedDatabase}]; SELECT i.name, ic.column_id, c.name, i.is_unique
        FROM sys.indexes i
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.object_id = ${tableObjectId} AND i.is_primary_key = 0 AND i.name IS NOT NULL
        ORDER BY i.index_id, ic.key_ordinal`, (err: any) => {
        if (err) reject(err)
        else resolve()
      })

      const indexDict: { [key: string]: { name: string; type: string; fields: string[]; unique: boolean } } = {}
      request.on('row', (columns: any[]) => {
        const indexName = columns[0].value as string
        const colName = columns[2].value as string
        const isUnique = columns[3].value as boolean

        if (!indexDict[indexName]) {
          indexDict[indexName] = {
            name: indexName,
            type: 'BTREE',
            fields: [],
            unique: isUnique
          }
        }
        indexDict[indexName].fields.push(colName)
      })

      request.on('done', () => {
        metadata.indexes = Object.values(indexDict)
      })

      connection.execSql(request)
    })

    await new Promise<void>((resolve, reject) => {
      const request = new Request(`USE [${escapedDatabase}]; SELECT fk.name, c.name, r.name, rc.name
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
        JOIN sys.tables r ON fkc.referenced_object_id = r.object_id
        JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
        WHERE fk.parent_object_id = ${tableObjectId}`, (err: any) => {
        if (err) reject(err)
        else resolve()
      })

      const fkDict: { [key: string]: { name: string; fields: string[]; referenced_table: string; referenced_fields: string[] } } = {}
      request.on('row', (columns: any[]) => {
        const fkName = columns[0].value as string
        const colName = columns[1].value as string
        const refTable = columns[2].value as string
        const refCol = columns[3].value as string

        if (!fkDict[fkName]) {
          fkDict[fkName] = {
            name: fkName,
            fields: [],
            referenced_table: refTable,
            referenced_fields: []
          }
        }
        fkDict[fkName].fields.push(colName)
        fkDict[fkName].referenced_fields.push(refCol)
      })

      request.on('done', () => {
        metadata.foreign_keys = Object.values(fkDict)
      })

      connection.execSql(request)
    })

    return metadata
  }

  async executeSQL(
    connection: Connection,
    database: string,
    sql: string,
    parameters: unknown[] = [],
  ): Promise<ExecuteResult> {
    const start = Date.now()
    const sqlPreview = sql.trim().length > 100 ? sql.trim().substring(0, 100) + '...' : sql.trim()
    logger.info('SQLServerAdapter', `开始执行SQL, 数据库: ${database || '当前'}, SQL预览: ${sqlPreview}`)
    logger.debug('SQLServerAdapter', `参数化查询参数数量: ${parameters.length}`)
    
    return new Promise((resolve) => {
      const results: any[] = []
      const columns: string[] = []

      const request = new Request(sql, (err: any, rowCount: any) => {
        const executionTime = (Date.now() - start) / 1000
        if (err) {
          logger.error('SQLServerAdapter', `SQL执行失败, 错误: ${err.message}, 耗时: ${executionTime.toFixed(2)}s`, err)
          resolve({
            success: false,
            message: `执行失败: ${err.message}`
          })
        } else if (columns.length > 0) {
          logger.info('SQLServerAdapter', `SQL执行成功, 返回 ${results.length} 条记录, 耗时: ${executionTime.toFixed(2)}s`)
          resolve({
            success: true,
            columns,
            rows: results,
            affected_rows: results.length,
            message: `查询成功，返回 ${results.length} 条记录`,
            execution_time: executionTime
          })
        } else {
          const affectedRows = rowCount || 0
          logger.info('SQLServerAdapter', `SQL执行成功, 影响 ${affectedRows} 行, 耗时: ${executionTime.toFixed(2)}s`)
          resolve({
            success: true,
            affected_rows: affectedRows,
            message: `执行成功，影响 ${affectedRows} 行`,
            execution_time: executionTime
          })
        }
      })

      request.on('columnMetadata', (metadata: any[]) => {
        columns.push(...metadata.map((m: any) => m.colName))
      })

      request.on('row', (rowColumns: any[]) => {
        const row: { [key: string]: any } = {}
        rowColumns.forEach((col: any) => {
          row[col.metadata.colName] = col.value
        })
        results.push(row)
      })

      parameters.forEach((value, index) => {
        const normalized = normalizeValue(value)
        request.addParameter(`p${index}`, tediousType(normalized), normalized)
      })

      if (database) {
        logger.debug('SQLServerAdapter', `切换数据库: ${database}`)
        connection.execSql(new Request(`USE ${database}`, () => {
          connection.execSql(request)
        }))
      } else {
        connection.execSql(request)
      }
    })
  }

  close(connection: Connection): void {
    connection.close()
  }
}

export class SQLiteAdapter extends DatabaseAdapter {
  private sqlJs: any = null

  private async getSqlJs(): Promise<any> {
    if (!this.sqlJs) {
      logger.info('SQLiteAdapter', '初始化 sql.js 库')
      const path = require('path')
      const sqlJsPath = path.dirname(require.resolve('sql.js'))
      this.sqlJs = await initSqlJs({
        locateFile: (file: string) => {
          // require.resolve('sql.js') 的入口本身位于 dist，不能再次追加 dist。
          const filePath = path.join(sqlJsPath, file)
          logger.debug('SQLiteAdapter', `定位 sql.js 文件: ${file} -> ${filePath}`)
          return filePath
        }
      })
      logger.info('SQLiteAdapter', 'sql.js 库初始化完成')
    }
    return this.sqlJs
  }

  async connect(connData: ConnectionData): Promise<any> {
    const startTime = Date.now()
    const databasePath = connData.database
    
    logger.info('SQLiteAdapter', '开始连接 SQLite')
    logger.debug('SQLiteAdapter', `数据库路径: ${databasePath || ':memory:'}`)
    
    try {
      const SQL = await this.getSqlJs()
      
      if (databasePath === ':memory:' || !databasePath) {
        const db = new SQL.Database()
        const duration = Date.now() - startTime
        logger.info('SQLiteAdapter', `SQLite内存数据库创建成功, 耗时: ${duration}ms`)
        return db
      } else {
        const fs = require('fs')
        if (fs.existsSync(databasePath)) {
          logger.debug('SQLiteAdapter', `读取 SQLite 文件: ${databasePath}`)
          const data = fs.readFileSync(databasePath)
          const db = new SQL.Database(data)
          const duration = Date.now() - startTime
          logger.info('SQLiteAdapter', `SQLite文件数据库加载成功, 文件大小: ${data.length} bytes, 耗时: ${duration}ms`)
          db.saveToDisk = () => {
            const data = db.export()
            fs.writeFileSync(databasePath, data)
          }
          return db
        } else {
          logger.debug('SQLiteAdapter', `创建新的 SQLite 文件: ${databasePath}`)
          const db = new SQL.Database()
          db.saveToDisk = () => {
            const data = db.export()
            fs.writeFileSync(databasePath, data)
          }
          const duration = Date.now() - startTime
          logger.info('SQLiteAdapter', `SQLite新文件数据库创建成功, 耗时: ${duration}ms`)
          return db
        }
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      logger.error('SQLiteAdapter', `SQLite连接失败: ${error.message}, 耗时: ${duration}ms`, error)
      throw error
    }
  }

  async testConnection(connData: ConnectionData): Promise<boolean> {
    let db: any = null
    try {
      db = await this.connect(connData)
      const result = db.exec('SELECT 1')
      return result.length > 0
    } catch {
      return false
    } finally {
      if (db) db.close()
    }
  }

  async getDatabases(connection: any): Promise<string[]> {
    return ['main']
  }

  async getDatabaseSummaries(connection: any): Promise<DatabaseSummary[]> {
    try {
      const pageCount = Number(
        connection.exec('PRAGMA page_count')[0]?.values?.[0]?.[0] || 0,
      )
      const pageSize = Number(
        connection.exec('PRAGMA page_size')[0]?.values?.[0]?.[0] || 0,
      )
      const tableCount = (await this.getTables(connection)).length
      return [{
        name: 'main',
        sizeBytes: pageCount * pageSize,
        tableCount,
        charset: 'UTF-8',
        state: 'ONLINE',
      }]
    } catch (error) {
      logger.warn(
        'SQLiteAdapter',
        `数据库摘要读取失败，退回名称列表: ${error instanceof Error ? error.message : String(error)}`,
      )
      return super.getDatabaseSummaries(connection)
    }
  }

  async createDatabase(
    _connection: any,
    _name: string,
    _options?: CreateDatabaseOptions,
  ): Promise<void> {
    throw new Error('SQLite 连接通过数据库文件管理，不支持在连接内新建数据库')
  }

  async getTables(connection: any): Promise<string[]> {
    const result = connection.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    if (result.length > 0) {
      return result[0].values.map((row: any[]) => row[0])
    }
    return []
  }

  async getTableSummaries(
    connection: any,
    database: string,
  ): Promise<TableSummary[]> {
    const names = await this.getTables(connection)
    const summaries = names.map(name => ({
      name,
      engine: 'SQLite',
      type: 'Table',
    }))
    logger.info(
      'SQLiteAdapter',
      `表明细读取完成: 数据库=${database}, 数量=${summaries.length}`,
    )
    return summaries
  }

  async getViews(connection: any): Promise<string[]> {
    const result = connection.exec("SELECT name FROM sqlite_master WHERE type='view'")
    if (result.length > 0) {
      return result[0].values.map((row: any[]) => row[0])
    }
    return []
  }

  async getProcedures(connection: any): Promise<string[]> {
    return []
  }

  async getFunctions(connection: any): Promise<string[]> {
    return []
  }

  async getEvents(connection: any): Promise<string[]> {
    const result = connection.exec(
      "SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name",
    )
    if (result.length > 0) {
      return result[0].values.map((row: any[]) => row[0])
    }
    return []
  }

  async getTableMetadata(connection: any, database: string, tableName: string): Promise<TableMetadata> {
    const metadata: TableMetadata = {
      fields: [],
      indexes: [],
      foreign_keys: [],
      ddl: ''
    }

    const escapedIdentifier = tableName.replace(/"/g, '""')
    const escapedLiteral = tableName.replace(/'/g, "''")
    const ddlResult = connection.exec(
      `SELECT sql FROM sqlite_master WHERE name = '${escapedLiteral}' AND type = 'table'`,
    )
    if (ddlResult.length > 0 && ddlResult[0].values.length > 0) {
      metadata.ddl = ddlResult[0].values[0][0] || ''
    }

    const fieldsResult = connection.exec(
      `PRAGMA table_info("${escapedIdentifier}")`,
    )
    if (fieldsResult.length > 0) {
      for (const row of fieldsResult[0].values) {
        metadata.fields.push({
          name: row[1],
          type: row[2],
          not_null: row[3] === 1,
          default: row[4],
          default_expression: row[4] === null ? '' : String(row[4]),
          primary: Number(row[5]) > 0,
          auto_increment: (
            row[5] === 1
            && /^integer$/i.test(String(row[2]))
            && /\bAUTOINCREMENT\b/i.test(metadata.ddl)
          ),
          comment: ''
        })
      }
    }

    const indexList = connection.exec(
      `PRAGMA index_list("${escapedIdentifier}")`,
    )
    if (indexList.length > 0) {
      for (const row of indexList[0].values) {
        const indexName = String(row[1])
        // 主键自动索引由 CREATE TABLE 约束恢复，不单独重建。
        if (String(row[3] || '').toLowerCase() === 'pk') continue
        const escapedIndex = indexName.replace(/"/g, '""')
        const indexInfo = connection.exec(
          `PRAGMA index_info("${escapedIndex}")`,
        )
        metadata.indexes.push({
          name: indexName,
          type: 'BTREE',
          fields: indexInfo.length > 0
            ? indexInfo[0].values.map((item: any[]) => String(item[2]))
            : [],
          unique: row[2] === 1,
        })
      }
    }

    const foreignKeyList = connection.exec(
      `PRAGMA foreign_key_list("${escapedIdentifier}")`,
    )
    const foreignKeys: Record<string, TableMetadata['foreign_keys'][number]> = {}
    if (foreignKeyList.length > 0) {
      for (const row of foreignKeyList[0].values) {
        const key = String(row[0])
        if (!foreignKeys[key]) {
          foreignKeys[key] = {
            name: `FK_${tableName}_${key}`,
            fields: [],
            referenced_table: String(row[2]),
            referenced_fields: [],
          }
        }
        foreignKeys[key].fields.push(String(row[3]))
        foreignKeys[key].referenced_fields.push(String(row[4]))
      }
    }
    metadata.foreign_keys = Object.values(foreignKeys)

    return metadata
  }

  async executeSQL(
    connection: any,
    database: string,
    sql: string,
    parameters: unknown[] = [],
  ): Promise<ExecuteResult> {
    const start = Date.now()
    const sqlPreview = sql.trim().length > 100 ? sql.trim().substring(0, 100) + '...' : sql.trim()
    logger.info('SQLiteAdapter', `开始执行SQL, SQL预览: ${sqlPreview}`)
    logger.debug('SQLiteAdapter', `参数化查询参数数量: ${parameters.length}`)
    
    try {
      const normalizedParameters = parameters.map(value => (
        typeof value === 'boolean'
          ? (value ? 1 : 0)
          : normalizeValue(value)
      ))
      const results = connection.exec(sql, normalizedParameters)
      const executionTime = (Date.now() - start) / 1000

      if (typeof connection.saveToDisk === 'function') {
        const sqlUpper = sql.toUpperCase().trim()
        if (sqlUpper.startsWith('INSERT') || sqlUpper.startsWith('UPDATE') || 
            sqlUpper.startsWith('DELETE') || sqlUpper.startsWith('CREATE') ||
            sqlUpper.startsWith('DROP') || sqlUpper.startsWith('ALTER') ||
            sqlUpper.startsWith('TRUNCATE')) {
          logger.debug('SQLiteAdapter', '自动保存数据库文件')
          connection.saveToDisk()
        }
      }

      if (results.length > 0) {
        const columns = results[0].columns || []
        const rows = results[0].values.map((row: any[]) => {
          const obj: { [key: string]: any } = {}
          columns.forEach((col: string, idx: number) => {
            obj[col] = row[idx]
          })
          return obj
        })
        logger.info('SQLiteAdapter', `SQL执行成功, 返回 ${rows.length} 条记录, 耗时: ${executionTime.toFixed(2)}s`)
        return {
          success: true,
          columns,
          rows,
          affected_rows: rows.length,
          message: `查询成功，返回 ${rows.length} 条记录`,
          execution_time: executionTime
        }
      } else {
        logger.info('SQLiteAdapter', `SQL执行成功, 耗时: ${executionTime.toFixed(2)}s`)
        return {
          success: true,
          affected_rows: 0,
          message: '执行成功',
          execution_time: executionTime
        }
      }
    } catch (error: any) {
      const executionTime = (Date.now() - start) / 1000
      logger.error('SQLiteAdapter', `SQL执行失败, 错误: ${error.message}, 耗时: ${executionTime.toFixed(2)}s`, error)
      return {
        success: false,
        message: `执行失败: ${error.message}`
      }
    }
  }

  close(connection: any): void {
    if (typeof connection.saveToDisk === 'function') {
      connection.saveToDisk()
    }
    connection.close()
  }
}

export function getAdapter(type: string): DatabaseAdapter {
  switch (type) {
    case 'MySQL':
    case 'MariaDB':
      return new MySQLAdapter()
    case 'PostgreSQL':
      return new PostgreSQLAdapter()
    case 'SQL Server':
      return new SQLServerAdapter()
    case 'SQLite':
      return new SQLiteAdapter()
    default:
      throw new Error(`Unsupported database type: ${type}`)
  }
}
