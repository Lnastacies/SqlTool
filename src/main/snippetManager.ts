import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface Snippet {
  id: string
  name: string
  category: string
  description: string
  sql: string
  variables?: { name: string; defaultValue: string }[]
  createdAt: string
  updatedAt: string
}

export class SnippetManager {
  private snippets: Snippet[] = []
  private snippetFile: string

  constructor() {
    this.snippetFile = path.join(app.getPath('userData'), 'snippets.json')
    this.loadSnippets()
    if (this.snippets.length === 0) {
      this.initDefaultSnippets()
    }
  }

  loadSnippets(): void {
    try {
      if (fs.existsSync(this.snippetFile)) {
        const content = fs.readFileSync(this.snippetFile, 'utf-8')
        this.snippets = JSON.parse(content)
      }
    } catch (error) {
      console.error('加载代码片段失败:', error)
      this.snippets = []
    }
  }

  saveSnippets(): void {
    try {
      fs.writeFileSync(this.snippetFile, JSON.stringify(this.snippets, null, 2), 'utf-8')
    } catch (error) {
      console.error('保存代码片段失败:', error)
    }
  }

  initDefaultSnippets(): void {
    const defaultSnippets: Snippet[] = [
      {
        id: 'snippet-1',
        name: '查询所有记录',
        category: '查询',
        description: '查询表中所有记录',
        sql: 'SELECT * FROM `${tableName}`',
        variables: [{ name: 'tableName', defaultValue: 'users' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'snippet-2',
        name: '分页查询',
        category: '查询',
        description: '分页查询记录',
        sql: 'SELECT * FROM `${tableName}` LIMIT ${offset}, ${limit}',
        variables: [{ name: 'tableName', defaultValue: 'users' }, { name: 'offset', defaultValue: '0' }, { name: 'limit', defaultValue: '20' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'snippet-3',
        name: '查询行数',
        category: '查询',
        description: '查询表中记录行数',
        sql: 'SELECT COUNT(*) FROM `${tableName}`',
        variables: [{ name: 'tableName', defaultValue: 'users' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'snippet-4',
        name: '创建表',
        category: 'DDL',
        description: '创建新表',
        sql: 'CREATE TABLE `${tableName}` (\n  id INT PRIMARY KEY AUTO_INCREMENT,\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP\n)',
        variables: [{ name: 'tableName', defaultValue: 'new_table' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'snippet-5',
        name: '插入记录',
        category: 'DML',
        description: '插入单条记录',
        sql: 'INSERT INTO `${tableName}` (${columns}) VALUES (${values})',
        variables: [{ name: 'tableName', defaultValue: 'users' }, { name: 'columns', defaultValue: 'name, email' }, { name: 'values', defaultValue: "'test', 'test@example.com'" }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'snippet-6',
        name: '更新记录',
        category: 'DML',
        description: '更新记录',
        sql: 'UPDATE `${tableName}` SET ${setClause} WHERE ${condition}',
        variables: [{ name: 'tableName', defaultValue: 'users' }, { name: 'setClause', defaultValue: 'name = "updated"' }, { name: 'condition', defaultValue: 'id = 1' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'snippet-7',
        name: '删除记录',
        category: 'DML',
        description: '删除记录',
        sql: 'DELETE FROM `${tableName}` WHERE ${condition}',
        variables: [{ name: 'tableName', defaultValue: 'users' }, { name: 'condition', defaultValue: 'id = 1' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'snippet-8',
        name: '创建索引',
        category: 'DDL',
        description: '创建索引',
        sql: 'CREATE ${unique}INDEX `${indexName}` ON `${tableName}` (${columns})',
        variables: [{ name: 'unique', defaultValue: '' }, { name: 'indexName', defaultValue: 'idx_column' }, { name: 'tableName', defaultValue: 'users' }, { name: 'columns', defaultValue: 'column_name' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'snippet-9',
        name: '备份表',
        category: '工具',
        description: '备份表结构和数据',
        sql: 'CREATE TABLE `${backupTableName}` AS SELECT * FROM `${sourceTableName}`',
        variables: [{ name: 'backupTableName', defaultValue: 'users_backup' }, { name: 'sourceTableName', defaultValue: 'users' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'snippet-10',
        name: '查询慢查询',
        category: '性能',
        description: '查询慢查询日志（MySQL）',
        sql: 'SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 100',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'snippet-11',
        name: '查看表结构',
        category: '工具',
        description: '查看表结构（MySQL）',
        sql: 'DESCRIBE `${tableName}`',
        variables: [{ name: 'tableName', defaultValue: 'users' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'snippet-12',
        name: '查询重复记录',
        category: '查询',
        description: '查找重复记录',
        sql: 'SELECT ${column}, COUNT(*) FROM `${tableName}` GROUP BY ${column} HAVING COUNT(*) > 1',
        variables: [{ name: 'column', defaultValue: 'email' }, { name: 'tableName', defaultValue: 'users' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]

    this.snippets = defaultSnippets
    this.saveSnippets()
  }

  getSnippets(filterText: string = '', category: string = ''): Snippet[] {
    let result = this.snippets

    if (category) {
      result = result.filter(s => s.category === category)
    }

    if (filterText) {
      const filterLower = filterText.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(filterLower) ||
        s.description.toLowerCase().includes(filterLower) ||
        s.sql.toLowerCase().includes(filterLower)
      )
    }

    return result.sort((a, b) => a.category.localeCompare(b.category))
  }

  getCategories(): string[] {
    const categories = new Set(this.snippets.map(s => s.category))
    return Array.from(categories).sort()
  }

  getSnippet(id: string): Snippet | undefined {
    return this.snippets.find(s => s.id === id)
  }

  addSnippet(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Snippet {
    const newSnippet: Snippet = {
      ...snippet,
      id: `snippet-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.snippets.push(newSnippet)
    this.saveSnippets()
    return newSnippet
  }

  updateSnippet(id: string, updates: Partial<Omit<Snippet, 'id' | 'createdAt'>>): boolean {
    const index = this.snippets.findIndex(s => s.id === id)
    if (index === -1) return false

    this.snippets[index] = {
      ...this.snippets[index],
      ...updates,
      updatedAt: new Date().toISOString()
    }

    this.saveSnippets()
    return true
  }

  deleteSnippet(id: string): boolean {
    const initialLength = this.snippets.length
    this.snippets = this.snippets.filter(s => s.id !== id)
    if (this.snippets.length !== initialLength) {
      this.saveSnippets()
      return true
    }
    return false
  }

  replaceVariables(sql: string, variables: { [key: string]: string }): string {
    let result = sql
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\${key}`, 'g')
      result = result.replace(regex, value)
    }
    return result
  }
}