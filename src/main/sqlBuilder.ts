export type DatabaseType = 'MySQL' | 'PostgreSQL' | 'SQLServer' | 'SQLite'

export interface SQLBuilderOptions {
  databaseType: DatabaseType
}

export class SQLBuilder {
  private databaseType: DatabaseType

  constructor(options: SQLBuilderOptions) {
    this.databaseType = options.databaseType
  }

  quoteIdentifier(name: string): string {
    switch (this.databaseType) {
      case 'MySQL':
        return `\`${name}\``
      case 'PostgreSQL':
        return `"${name}"`
      case 'SQLServer':
        return `[${name}]`
      case 'SQLite':
        return `"${name}"`
      default:
        return name
    }
  }

  quoteValue(value: any): string {
    if (value === null) return 'NULL'
    if (value === undefined) return 'NULL'
    if (value instanceof Date) return `'${value.toISOString()}'`
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`
    }
    return String(value)
  }

  buildSelect(options: {
    table: string
    columns?: string[]
    where?: any
    orderBy?: string | string[]
    limit?: number
    offset?: number
    groupBy?: string | string[]
    having?: any
    joins?: Array<{
      type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
      table: string
      on: string
    }>
  }): string {
    const { table, columns = ['*'], where, orderBy, limit, offset, groupBy, having, joins } = options

    let sql = `SELECT `
    
    if (columns.length === 1 && columns[0] === '*') {
      sql += '*'
    } else {
      sql += columns.map(c => this.quoteIdentifier(c)).join(', ')
    }

    sql += ` FROM ${this.quoteIdentifier(table)}`

    if (joins) {
      joins.forEach(join => {
        sql += ` ${join.type} JOIN ${this.quoteIdentifier(join.table)} ON ${join.on}`
      })
    }

    if (where) {
      sql += ` WHERE ${this.buildWhere(where)}`
    }

    if (groupBy) {
      const groupByStr = Array.isArray(groupBy) ? groupBy.join(', ') : groupBy
      sql += ` GROUP BY ${groupByStr}`
    }

    if (having) {
      sql += ` HAVING ${this.buildWhere(having)}`
    }

    if (orderBy) {
      const orderByStr = Array.isArray(orderBy) ? orderBy.join(', ') : orderBy
      sql += ` ORDER BY ${orderByStr}`
    }

    if (limit !== undefined) {
      if (this.databaseType === 'SQLServer') {
        sql = `SELECT TOP ${limit} * FROM (${sql}) AS subquery`
      } else {
        sql += ` LIMIT ${limit}`
        if (offset !== undefined) {
          sql += ` OFFSET ${offset}`
        }
      }
    }

    return sql
  }

  buildInsert(table: string, data: { [key: string]: any }): string {
    const columns = Object.keys(data)
    const values = Object.values(data)

    const columnsStr = columns.map(c => this.quoteIdentifier(c)).join(', ')
    const valuesStr = values.map(v => this.quoteValue(v)).join(', ')

    return `INSERT INTO ${this.quoteIdentifier(table)} (${columnsStr}) VALUES (${valuesStr})`
  }

  buildUpdate(table: string, data: { [key: string]: any }, where?: any): string {
    const setClause = Object.entries(data)
      .map(([key, value]) => `${this.quoteIdentifier(key)} = ${this.quoteValue(value)}`)
      .join(', ')

    let sql = `UPDATE ${this.quoteIdentifier(table)} SET ${setClause}`

    if (where) {
      sql += ` WHERE ${this.buildWhere(where)}`
    }

    return sql
  }

  buildDelete(table: string, where?: any): string {
    let sql = `DELETE FROM ${this.quoteIdentifier(table)}`

    if (where) {
      sql += ` WHERE ${this.buildWhere(where)}`
    }

    return sql
  }

  buildCount(table: string, where?: any): string {
    let sql = `SELECT COUNT(*) FROM ${this.quoteIdentifier(table)}`

    if (where) {
      sql += ` WHERE ${this.buildWhere(where)}`
    }

    return sql
  }

  buildTruncate(table: string): string {
    if (this.databaseType === 'SQLite') {
      return `DELETE FROM ${this.quoteIdentifier(table)}`
    }
    return `TRUNCATE TABLE ${this.quoteIdentifier(table)}`
  }

  buildCreateTable(table: string, columns: Array<{
    name: string
    type: string
    notNull?: boolean
    primary?: boolean
    autoIncrement?: boolean
    defaultValue?: any
    comment?: string
  }>): string {
    const columnDefs = columns.map(col => {
      let def = `${this.quoteIdentifier(col.name)} ${col.type}`
      
      if (col.primary) def += ' PRIMARY KEY'
      if (col.autoIncrement) {
        switch (this.databaseType) {
          case 'MySQL':
            def += ' AUTO_INCREMENT'
            break
          case 'PostgreSQL':
            def += ' SERIAL'
            break
          case 'SQLServer':
            def += ' IDENTITY(1,1)'
            break
          case 'SQLite':
            def += ' INTEGER PRIMARY KEY AUTOINCREMENT'
            break
        }
      }
      if (col.notNull) def += ' NOT NULL'
      if (col.defaultValue !== undefined) def += ` DEFAULT ${this.quoteValue(col.defaultValue)}`
      if (col.comment && this.databaseType === 'MySQL') def += ` COMMENT '${col.comment}'`
      
      return def
    }).join(',\n  ')

    return `CREATE TABLE ${this.quoteIdentifier(table)} (\n  ${columnDefs}\n)`
  }

  buildAddColumn(table: string, column: {
    name: string
    type: string
    notNull?: boolean
    defaultValue?: any
    after?: string
  }): string {
    let sql = `ALTER TABLE ${this.quoteIdentifier(table)} ADD COLUMN ${this.quoteIdentifier(column.name)} ${column.type}`
    
    if (column.notNull) sql += ' NOT NULL'
    if (column.defaultValue !== undefined) sql += ` DEFAULT ${this.quoteValue(column.defaultValue)}`
    if (column.after && this.databaseType === 'MySQL') sql += ` AFTER ${this.quoteIdentifier(column.after)}`
    
    return sql
  }

  buildDropColumn(table: string, columnName: string): string {
    return `ALTER TABLE ${this.quoteIdentifier(table)} DROP COLUMN ${this.quoteIdentifier(columnName)}`
  }

  buildCreateIndex(table: string, indexName: string, columns: string[], unique?: boolean): string {
    const uniqueStr = unique ? 'UNIQUE ' : ''
    const columnsStr = columns.map(c => this.quoteIdentifier(c)).join(', ')
    
    return `CREATE ${uniqueStr}INDEX ${this.quoteIdentifier(indexName)} ON ${this.quoteIdentifier(table)} (${columnsStr})`
  }

  buildDropIndex(indexName: string, table?: string): string {
    if (this.databaseType === 'MySQL' && table) {
      return `ALTER TABLE ${this.quoteIdentifier(table)} DROP INDEX ${this.quoteIdentifier(indexName)}`
    }
    return `DROP INDEX ${this.quoteIdentifier(indexName)}`
  }

  buildCreateView(viewName: string, selectSql: string): string {
    return `CREATE VIEW ${this.quoteIdentifier(viewName)} AS ${selectSql}`
  }

  buildDropView(viewName: string): string {
    return `DROP VIEW ${this.quoteIdentifier(viewName)}`
  }

  buildWhere(where: any): string {
    if (typeof where === 'string') {
      return where
    }

    if (Array.isArray(where)) {
      return where.map(w => `(${this.buildWhere(w)})`).join(' AND ')
    }

    const conditions: string[] = []
    
    for (const [key, value] of Object.entries(where)) {
      if (value === null) {
        conditions.push(`${this.quoteIdentifier(key)} IS NULL`)
      } else if (value === undefined) {
        continue
      } else if (Array.isArray(value)) {
        const valuesStr = value.map(v => this.quoteValue(v)).join(', ')
        conditions.push(`${this.quoteIdentifier(key)} IN (${valuesStr})`)
      } else if (typeof value === 'object' && value !== null) {
        for (const [operator, operand] of Object.entries(value)) {
          const op = operator.toUpperCase()
          if (op === 'LIKE') {
            conditions.push(`${this.quoteIdentifier(key)} LIKE ${this.quoteValue(operand)}`)
          } else if (op === 'BETWEEN') {
            const [start, end] = operand as any[]
            conditions.push(`${this.quoteIdentifier(key)} BETWEEN ${this.quoteValue(start)} AND ${this.quoteValue(end)}`)
          } else {
            conditions.push(`${this.quoteIdentifier(key)} ${op} ${this.quoteValue(operand)}`)
          }
        }
      } else {
        conditions.push(`${this.quoteIdentifier(key)} = ${this.quoteValue(value)}`)
      }
    }

    return conditions.join(' AND ')
  }

  validateSQL(sql: string): { valid: boolean; error?: string } {
    const trimmed = sql.trim().toUpperCase()
    
    if (!trimmed) {
      return { valid: false, error: 'SQL语句不能为空' }
    }

    const allowedKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE', 'REPLACE', 'MERGE', 'CALL']
    const firstKeyword = trimmed.split(/\s+/)[0]
    
    if (!allowedKeywords.includes(firstKeyword)) {
      return { valid: false, error: `不支持的SQL语句类型: ${firstKeyword}` }
    }

    return { valid: true }
  }

  sanitizeSQL(sql: string): string {
    return sql.trim().replace(/;+$/, '')
  }
}