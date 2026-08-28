import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface QueryHistoryEntry {
  id: number
  sql: string
  connection: string
  database: string
  timestamp: string
  execution_time: number
  row_count: number
  success: boolean
  error: string
}

export class QueryHistoryManager {
  private history: QueryHistoryEntry[] = []
  private maxHistory = 500
  private historyFile: string

  constructor() {
    this.historyFile = path.join(app.getPath('userData'), 'query_history.json')
    this.loadHistory()
  }

  loadHistory(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const content = fs.readFileSync(this.historyFile, 'utf-8')
        this.history = JSON.parse(content)
      }
    } catch (error) {
      console.error('加载查询历史失败:', error)
      this.history = []
    }
  }

  saveHistory(): void {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2), 'utf-8')
    } catch (error) {
      console.error('保存查询历史失败:', error)
    }
  }

  addQuery(sql: string, connectionName: string = '', database: string = '', 
           executionTime: number = 0, rowCount: number = 0, success: boolean = true, 
           errorMessage: string = ''): void {
    const entry: QueryHistoryEntry = {
      id: Date.now(),
      sql: sql.trim(),
      connection: connectionName,
      database: database,
      timestamp: new Date().toLocaleString('zh-CN'),
      execution_time: executionTime,
      row_count: rowCount,
      success: success,
      error: errorMessage
    }

    if (this.history.length > 0 && this.history[0].sql === entry.sql) {
      return
    }

    this.history.unshift(entry)

    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory)
    }

    this.saveHistory()
  }

  getHistory(filterText: string = ''): QueryHistoryEntry[] {
    if (!filterText) {
      return this.history
    }

    const filterLower = filterText.toLowerCase()
    return this.history.filter(h => h.sql.toLowerCase().includes(filterLower))
  }

  clearHistory(): void {
    this.history = []
    this.saveHistory()
  }

  deleteEntry(entryId: number): void {
    this.history = this.history.filter(h => h.id !== entryId)
    this.saveHistory()
  }
}