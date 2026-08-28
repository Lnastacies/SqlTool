import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { logger } from './logger'

/**
 * 收藏的数据库对象，用于快速定位常用对象。
 * connectionName 为冗余字段，便于在连接被删除后仍能展示历史收藏。
 */
export interface Favorite {
  id: string
  name: string
  connId: string
  connectionName: string
  database: string
  objectName?: string
  objectType?: 'table' | 'view' | 'function' | 'event' | 'procedure'
  createdAt: string
}

/**
 * 收藏夹存储，基于用户数据目录下的 favorites.json 文件。
 * 参考 snippetManager 的实现模式，提供增删查改能力。
 */
export class FavoriteStore {
  private favorites: Favorite[] = []
  private readonly file: string

  constructor() {
    this.file = path.join(app.getPath('userData'), 'favorites.json')
    this.load()
  }

  load(): void {
    try {
      if (fs.existsSync(this.file)) {
        const content = fs.readFileSync(this.file, 'utf-8')
        this.favorites = JSON.parse(content)
        logger.info('FavoriteStore', `加载收藏夹完成: 数量=${this.favorites.length}`)
      }
    } catch (error) {
      logger.error(
        'FavoriteStore',
        `加载收藏夹失败: ${error instanceof Error ? error.message : String(error)}`,
      )
      this.favorites = []
    }
  }

  save(): void {
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.favorites, null, 2), 'utf-8')
    } catch (error) {
      logger.error(
        'FavoriteStore',
        `保存收藏夹失败: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  list(): Favorite[] {
    return [...this.favorites].sort((a, b) => (
      a.name.localeCompare(b.name, 'zh-CN')
    ))
  }

  add(favorite: Omit<Favorite, 'id' | 'createdAt'>): Favorite {
    const item: Favorite = {
      ...favorite,
      id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    }
    this.favorites.push(item)
    this.save()
    logger.info('FavoriteStore', `添加收藏: 名称=${item.name}, 连接=${item.connId}`)
    return item
  }

  update(id: string, updates: Partial<Omit<Favorite, 'id' | 'createdAt'>>): boolean {
    const index = this.favorites.findIndex(item => item.id === id)
    if (index === -1) return false
    this.favorites[index] = { ...this.favorites[index], ...updates }
    this.save()
    return true
  }

  remove(id: string): boolean {
    const initialLength = this.favorites.length
    this.favorites = this.favorites.filter(item => item.id !== id)
    if (this.favorites.length !== initialLength) {
      this.save()
      logger.info('FavoriteStore', `删除收藏: ID=${id}`)
      return true
    }
    return false
  }
}
