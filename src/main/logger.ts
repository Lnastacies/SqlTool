import * as fs from 'fs'
import * as path from 'path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogConfig {
  logLevel: LogLevel
  maxFileSize: number
  maxFiles: number
  logDir: string
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  error?: Error
}

export class Logger {
  private config: LogConfig
  private currentFile: string
  private currentSize: number = 0

  constructor(config?: Partial<LogConfig>) {
    this.config = {
      logLevel: config?.logLevel || 'info',
      maxFileSize: config?.maxFileSize || 10 * 1024 * 1024,
      maxFiles: config?.maxFiles || 10,
      logDir: config?.logDir || path.join(__dirname, '../../logs')
    }

    this.ensureLogDir()
    this.currentFile = this.getLogFileName()
    this.currentSize = this.getCurrentFileSize()
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true })
    }
  }

  private getLogFileName(): string {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    return path.join(this.config.logDir, `sqltool_${dateStr}.log`)
  }

  private getCurrentFileSize(): number {
    if (fs.existsSync(this.currentFile)) {
      return fs.statSync(this.currentFile).size
    }
    return 0
  }

  private shouldRotate(): boolean {
    return this.currentSize >= this.config.maxFileSize
  }

  private rotate(): void {
    if (!fs.existsSync(this.currentFile)) return

    let index = 1
    let rotatedFile: string
    do {
      rotatedFile = `${this.currentFile}.${index}`
      index++
    } while (fs.existsSync(rotatedFile))

    fs.renameSync(this.currentFile, rotatedFile)
    this.currentSize = 0

    this.cleanupOldLogs()
  }

  private cleanupOldLogs(): void {
    const files = fs.readdirSync(this.config.logDir)
      .filter(f => f.startsWith('sqltool_') && f.endsWith('.log'))
      .sort((a, b) => b.localeCompare(a))

    if (files.length > this.config.maxFiles) {
      const filesToDelete = files.slice(this.config.maxFiles)
      for (const file of filesToDelete) {
        fs.unlinkSync(path.join(this.config.logDir, file))
      }
    }
  }

  private formatTimestamp(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const ms = String(now.getMilliseconds()).padStart(3, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`
  }

  private formatLog(entry: LogEntry): string {
    const timestamp = this.formatTimestamp()
    const level = `[${entry.level.toUpperCase()}]`
    const module = `[${entry.module}]`
    let message = `${timestamp} ${level} ${module} ${entry.message}`
    
    if (entry.error) {
      message += `\n${entry.error.stack || entry.error.message}`
    }
    
    return message + '\n'
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(this.config.logLevel)
  }

  debug(module: string, message: string, error?: Error): void {
    if (!this.shouldLog('debug')) return
    this.log('debug', module, message, error)
  }

  info(module: string, message: string, error?: Error): void {
    if (!this.shouldLog('info')) return
    this.log('info', module, message, error)
  }

  warn(module: string, message: string, error?: Error): void {
    if (!this.shouldLog('warn')) return
    this.log('warn', module, message, error)
  }

  error(module: string, message: string, error?: Error): void {
    if (!this.shouldLog('error')) return
    this.log('error', module, message, error)
  }

  private log(level: LogLevel, module: string, message: string, error?: Error): void {
    const entry: LogEntry = { timestamp: this.formatTimestamp(), level, module, message, error }
    const logStr = this.formatLog(entry)

    if (level === 'error') {
      console.error(logStr.trim())
    } else if (level === 'warn') {
      console.warn(logStr.trim())
    } else {
      console.log(logStr.trim())
    }

    try {
      if (this.shouldRotate()) {
        this.rotate()
      }

      fs.appendFileSync(this.currentFile, logStr)
      this.currentSize += Buffer.byteLength(logStr, 'utf-8')
    } catch (err) {
      console.error(`[Logger] 写入日志文件失败: ${(err as Error).message}`)
    }
  }

  getLogFiles(): string[] {
    return fs.readdirSync(this.config.logDir)
      .filter(f => f.startsWith('sqltool_') && f.endsWith('.log'))
      .sort((a, b) => b.localeCompare(a))
  }

  getLogContent(fileName: string): string {
    const filePath = path.join(this.config.logDir, fileName)
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8')
    }
    return ''
  }

  clearLogs(): void {
    const files = this.getLogFiles()
    for (const file of files) {
      fs.unlinkSync(path.join(this.config.logDir, file))
    }
    this.currentSize = 0
  }
}

export const logger = new Logger()
