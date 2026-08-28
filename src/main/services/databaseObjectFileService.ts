import { shell } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import { logger } from '../logger'

export type DatabaseObjectFileCategory = 'queries' | 'reports' | 'backups'

const FOLDER_NAMES: Record<DatabaseObjectFileCategory, string> = {
  queries: 'Queries',
  reports: 'Reports',
  backups: 'Backups',
}

export class DatabaseObjectFileService {
  constructor(private readonly rootDirectory: string) {
    if (!path.isAbsolute(rootDirectory)) {
      throw new Error('数据库对象文件目录必须是绝对路径')
    }
  }

  async showCategoryFolder(
    category: DatabaseObjectFileCategory,
  ): Promise<{ path: string }> {
    const startedAt = Date.now()
    const folderName = FOLDER_NAMES[category]
    if (!folderName) throw new Error(`不支持的对象文件分类: ${category}`)

    const targetPath = path.join(this.rootDirectory, folderName)
    logger.info(
      'ObjectFile',
      `准备打开数据库对象文件夹: 分类=${category}, 根目录=${this.rootDirectory}, 目标=${targetPath}`,
    )
    await fs.mkdir(targetPath, { recursive: true })
    logger.info(
      'ObjectFile',
      `数据库对象文件夹准备完成: 分类=${category}, 路径=${targetPath}, 耗时=${Date.now() - startedAt}ms`,
    )
    const error = await shell.openPath(targetPath)
    if (error) {
      logger.error(
        'ObjectFile',
        `打开数据库对象文件夹失败: 分类=${category}, 路径=${targetPath}, 耗时=${Date.now() - startedAt}ms, 原因=${error}`,
      )
      throw new Error(error)
    }
    logger.info(
      'ObjectFile',
      `数据库对象文件夹打开成功: 分类=${category}, 路径=${targetPath}, 耗时=${Date.now() - startedAt}ms`,
    )
    return { path: targetPath }
  }
}
