import { dialog } from 'electron'
import { existsSync, promises as fs } from 'fs'
import path from 'path'
import { logger } from '../logger'
import {
  RecentSqlFileStore,
  type RecentSqlFile,
} from './recentSqlFileStore'

const MAX_SQL_FILE_SIZE = 5 * 1024 * 1024
const MAX_OPEN_FILE_COUNT = 20
const SQL_FILE_EXTENSIONS = new Set(['.sql', '.ddl', '.dml', '.txt'])

export interface OpenedSqlFile {
  filePath: string
  name: string
  content: string
}

export interface OpenSqlFilesResult {
  cancelled: boolean
  files: OpenedSqlFile[]
}

export interface SaveSqlFileRequest {
  filePath?: string
  suggestedName?: string
  content: string
  forceDialog?: boolean
}

export interface SaveSqlFileResult {
  cancelled: boolean
  filePath?: string
  name?: string
}

export class SqlFileService {
  private readonly recentFiles: RecentSqlFileStore

  constructor(storageDirectory: string) {
    this.recentFiles = new RecentSqlFileStore(storageDirectory)
  }

  async openFiles(): Promise<OpenSqlFilesResult> {
    logger.info('SqlFile', '打开 SQL 文件选择窗口')
    const selection = await dialog.showOpenDialog({
      title: '打开 SQL 文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'SQL 文件', extensions: ['sql', 'ddl', 'dml'] },
        { name: '文本文件', extensions: ['txt'] },
      ],
    })
    if (selection.canceled || selection.filePaths.length === 0) {
      logger.info('SqlFile', '用户取消打开 SQL 文件')
      return { cancelled: true, files: [] }
    }
    if (selection.filePaths.length > MAX_OPEN_FILE_COUNT) {
      throw new Error(`单次最多打开 ${MAX_OPEN_FILE_COUNT} 个 SQL 文件`)
    }

    try {
      const files = await Promise.all(
        selection.filePaths.map(filePath => this.readFile(filePath)),
      )
      files.forEach(file => this.recentFiles.record(file.filePath))
      logger.info('SqlFile', `SQL 文件打开完成: 文件数=${files.length}`)
      return { cancelled: false, files }
    } catch (error) {
      logger.error(
        'SqlFile',
        '打开 SQL 文件失败',
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  async saveFile(request: SaveSqlFileRequest): Promise<SaveSqlFileResult> {
    this.validateContent(request.content)
    let targetPath = request.filePath

    if (request.forceDialog || !targetPath) {
      logger.info(
        'SqlFile',
        `打开 SQL 文件保存窗口: 另存为=${Boolean(request.forceDialog)}`,
      )
      const selection = await dialog.showSaveDialog({
        title: request.forceDialog ? 'SQL 文件另存为' : '保存 SQL 文件',
        defaultPath: this.getDefaultPath(request),
        filters: [
          { name: 'SQL 文件', extensions: ['sql'] },
          { name: '文本文件', extensions: ['txt'] },
        ],
      })
      if (selection.canceled || !selection.filePath) {
        logger.info('SqlFile', '用户取消保存 SQL 文件')
        return { cancelled: true }
      }
      targetPath = selection.filePath
    }

    targetPath = this.normalizeSavePath(targetPath)
    try {
      await fs.writeFile(targetPath, request.content, 'utf8')
      logger.info(
        'SqlFile',
        `SQL 文件保存完成: 文件=${path.basename(targetPath)}, 字节=${Buffer.byteLength(request.content, 'utf8')}`,
      )
      this.recentFiles.record(targetPath)
      return {
        cancelled: false,
        filePath: targetPath,
        name: path.basename(targetPath),
      }
    } catch (error) {
      logger.error(
        'SqlFile',
        `保存 SQL 文件失败: 文件=${path.basename(targetPath)}`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  getRecentFiles(): RecentSqlFile[] {
    const entries = this.recentFiles.list()
    const available = entries.filter(entry => existsSync(entry.filePath))
    if (available.length !== entries.length) {
      entries
        .filter(entry => !existsSync(entry.filePath))
        .forEach(entry => this.recentFiles.remove(entry.filePath))
    }
    logger.info('SqlFile', `读取最近文件完成: 可用文件数=${available.length}`)
    return available
  }

  async openRecentFile(filePath: string): Promise<OpenedSqlFile> {
    try {
      const file = await this.readFile(filePath)
      this.recentFiles.record(file.filePath)
      logger.info('SqlFile', `最近文件打开完成: 文件=${file.name}`)
      return file
    } catch (error) {
      if (!existsSync(filePath)) this.recentFiles.remove(filePath)
      logger.error(
        'SqlFile',
        `最近文件打开失败: 文件=${path.basename(filePath)}`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  clearRecentFiles(): void {
    this.recentFiles.clear()
  }

  private async readFile(filePath: string): Promise<OpenedSqlFile> {
    this.validatePath(filePath)
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) throw new Error('选择的路径不是文件')
    if (stat.size > MAX_SQL_FILE_SIZE) {
      throw new Error(
        `SQL 文件不能超过 5 MB: ${path.basename(filePath)}`,
      )
    }

    const content = (await fs.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '')
    logger.info(
      'SqlFile',
      `已读取 SQL 文件: 文件=${path.basename(filePath)}, 字节=${stat.size}`,
    )
    return {
      filePath,
      name: path.basename(filePath),
      content,
    }
  }

  private validateContent(content: string): void {
    if (typeof content !== 'string') throw new Error('SQL 文件内容格式无效')
    if (Buffer.byteLength(content, 'utf8') > MAX_SQL_FILE_SIZE) {
      throw new Error('SQL 文件内容不能超过 5 MB')
    }
  }

  private validatePath(filePath: string): void {
    if (!path.isAbsolute(filePath)) throw new Error('SQL 文件路径必须为绝对路径')
    const extension = path.extname(filePath).toLowerCase()
    if (!SQL_FILE_EXTENSIONS.has(extension)) {
      throw new Error(`不支持的 SQL 文件类型: ${extension || '无扩展名'}`)
    }
  }

  private normalizeSavePath(filePath: string): string {
    const targetPath = path.extname(filePath) ? filePath : `${filePath}.sql`
    this.validatePath(targetPath)
    return targetPath
  }

  private getDefaultPath(request: SaveSqlFileRequest): string {
    if (request.filePath) return request.filePath
    const suggestedName = request.suggestedName?.trim() || '未命名查询.sql'
    return path.extname(suggestedName)
      ? suggestedName
      : `${suggestedName}.sql`
  }
}
