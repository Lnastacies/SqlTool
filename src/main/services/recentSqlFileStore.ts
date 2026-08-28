import fs from 'fs'
import path from 'path'
import { logger } from '../logger'

const MAX_RECENT_FILE_COUNT = 10

export interface RecentSqlFile {
  filePath: string
  name: string
  lastOpenedAt: string
}

export class RecentSqlFileStore {
  private readonly storageFile: string

  constructor(storageDirectory: string) {
    if (!path.isAbsolute(storageDirectory)) {
      throw new Error('最近文件存储目录必须是绝对路径')
    }
    fs.mkdirSync(storageDirectory, { recursive: true })
    this.storageFile = path.join(storageDirectory, 'recent-sql-files.json')
  }

  list(): RecentSqlFile[] {
    if (!fs.existsSync(this.storageFile)) return []
    try {
      const content = JSON.parse(
        fs.readFileSync(this.storageFile, 'utf8'),
      ) as unknown
      if (!Array.isArray(content)) throw new Error('最近文件格式无效')
      return content
        .filter(this.isRecentSqlFile)
        .slice(0, MAX_RECENT_FILE_COUNT)
    } catch (error) {
      logger.warn(
        'RecentSqlFile',
        `读取最近文件失败: 原因=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return []
    }
  }

  record(filePath: string): void {
    const entry: RecentSqlFile = {
      filePath,
      name: path.basename(filePath),
      lastOpenedAt: new Date().toISOString(),
    }
    const entries = [
      entry,
      ...this.list().filter(item => item.filePath !== filePath),
    ].slice(0, MAX_RECENT_FILE_COUNT)
    this.write(entries)
    logger.info(
      'RecentSqlFile',
      `更新最近文件: 文件=${entry.name}, 总数=${entries.length}`,
    )
  }

  remove(filePath: string): void {
    const entries = this.list().filter(item => item.filePath !== filePath)
    this.write(entries)
    logger.info(
      'RecentSqlFile',
      `移除失效最近文件: 文件=${path.basename(filePath)}`,
    )
  }

  clear(): void {
    this.write([])
    logger.info('RecentSqlFile', '最近文件已清空')
  }

  private write(entries: RecentSqlFile[]): void {
    fs.writeFileSync(
      this.storageFile,
      JSON.stringify(entries, null, 2),
      'utf8',
    )
  }

  private isRecentSqlFile(value: unknown): value is RecentSqlFile {
    if (!value || typeof value !== 'object') return false
    const entry = value as Partial<RecentSqlFile>
    return typeof entry.filePath === 'string'
      && path.isAbsolute(entry.filePath)
      && typeof entry.name === 'string'
      && typeof entry.lastOpenedAt === 'string'
  }
}
