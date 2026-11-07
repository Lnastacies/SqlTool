import * as fs from 'fs'
import * as path from 'path'

const { app } = require('electron')

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

/**
 * 获取默认日志目录。
 * 打包后 __dirname 位于 app.asar（只读虚拟文件）内，mkdir 会抛 ENOTDIR，
 * 因此打包环境写入 userData/logs；开发与纯 Node 测试脚本保持项目 logs 目录。
 */
function getDefaultLogDir(): string {
  try {
    // 纯 Node 环境下 require('electron') 返回字符串，app 为 undefined，直接走回退
    if (app && (app as { isPackaged?: boolean }).isPackaged) {
      return path.join(app.getPath('userData'), 'logs')
    }
  } catch {
    // app 未就绪等异常场景统一回退，绝不让日志模块影响启动
  }
  return path.join(__dirname, '../../logs')
}

export class Logger {
  private config: LogConfig
  private currentFile: string
  private currentSize: number = 0
  private logDirReady = false

  constructor(config?: Partial<LogConfig>) {
    this.config = {
      logLevel: config?.logLevel || 'info',
      maxFileSize: config?.maxFileSize || 10 * 1024 * 1024,
      maxFiles: config?.maxFiles || 10,
      logDir: config?.logDir || getDefaultLogDir()
    }

    this.currentFile = this.getLogFileName()
    this.currentSize = this.getCurrentFileSize()
  }

  private ensureLogDir(): void {
    if (this.logDirReady) return
    try {
      if (!fs.existsSync(this.config.logDir)) {
        fs.mkdirSync(this.config.logDir, { recursive: true })
      }
      this.logDirReady = true
    } catch (err) {
      // 目录创建失败时静默降级为仅控制台输出，避免日志模块导致应用启动崩溃
      console.error(`[Logger] 日志目录不可用，已降级为控制台输出: ${this.config.logDir}`, err)
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

    // 延迟创建目录：首次写日志时才确保目录存在，避免构造函数阻塞启动流程
    this.ensureLogDir()
    if (!this.logDirReady) return

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
    // 目录可能尚未创建（延迟初始化），读取前判空
    if (!fs.existsSync(this.config.logDir)) return []
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
