import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../logger'
import type { ConnectionData } from './adapters'
import { normalizeCatalog } from './connectionConfigMigration'
import type {
  ConnectionCatalog,
  ConnectionDraft,
  ConnectionGroup,
  PersistedConnectionCatalog,
} from './connectionConfigTypes'
import { ConnectionCredentialCipher } from './connectionCredentialCipher'

export class ConnectionConfigStore {
  private catalog: ConnectionCatalog = { connections: [], groups: [] }
  private readonly filePath: string
  private readonly cipher: ConnectionCredentialCipher

  constructor(
    storageDirectory: string,
    private readonly legacyFilePath: string,
    legacyKeyPath: string,
  ) {
    this.filePath = path.join(storageDirectory, 'connections.json')
    this.cipher = new ConnectionCredentialCipher(storageDirectory, legacyKeyPath)
    this.load()
  }

  getCatalog(): ConnectionCatalog {
    return structuredClone(this.catalog)
  }

  getConnection(id: string): ConnectionData | undefined {
    const connection = this.catalog.connections.find(item => item.id === id)
    return connection ? { ...connection } : undefined
  }

  createConnection(draft: ConnectionDraft): ConnectionCatalog {
    const connection = this.validateConnection(
      { ...draft, id: randomUUID() },
    )
    const next = this.getCatalog()
    next.connections.push(connection)
    this.persist(next, '新建连接', connection.id)
    return this.getCatalog()
  }

  updateConnection(id: string, draft: ConnectionDraft): ConnectionCatalog {
    const index = this.catalog.connections.findIndex(item => item.id === id)
    if (index < 0) throw new Error('要编辑的连接不存在')
    const next = this.getCatalog()
    next.connections[index] = this.validateConnection(
      { ...draft, id },
      id,
    )
    this.persist(next, '编辑连接', id)
    return this.getCatalog()
  }

  deleteConnection(id: string): ConnectionCatalog {
    const index = this.catalog.connections.findIndex(item => item.id === id)
    if (index < 0) throw new Error('要删除的连接不存在')
    const next = this.getCatalog()
    next.connections.splice(index, 1)
    this.persist(next, '删除连接', id)
    return this.getCatalog()
  }

  createGroup(name: string): ConnectionCatalog {
    const group = { id: randomUUID(), name: this.validateGroupName(name) }
    const next = this.getCatalog()
    next.groups.push(group)
    this.persist(next, '新建分组', group.id)
    return this.getCatalog()
  }

  renameGroup(id: string, name: string): ConnectionCatalog {
    const next = this.getCatalog()
    const group = next.groups.find(item => item.id === id)
    if (!group) throw new Error('要编辑的分组不存在')
    group.name = this.validateGroupName(name, id)
    this.persist(next, '重命名分组', id)
    return this.getCatalog()
  }

  deleteGroup(id: string): ConnectionCatalog {
    const index = this.catalog.groups.findIndex(group => group.id === id)
    if (index < 0) throw new Error('要删除的分组不存在')
    const next = this.getCatalog()
    next.groups.splice(index, 1)
    next.connections.forEach(connection => {
      if (connection.groupId === id) connection.groupId = undefined
    })
    this.persist(next, '删除分组并移动连接到未分组', id)
    return this.getCatalog()
  }

  private load(): void {
    const source = fs.existsSync(this.filePath)
      ? this.filePath
      : this.legacyFilePath
    logger.info('ConnectionConfig', `加载连接配置: 文件=${source}`)
    if (!fs.existsSync(source)) {
      logger.info('ConnectionConfig', '连接配置不存在，初始化为空列表')
      return
    }

    try {
      const raw = JSON.parse(fs.readFileSync(source, 'utf8'))
      this.catalog = normalizeCatalog(raw)
      this.catalog.connections = this.catalog.connections.map(connection => ({
        ...connection,
        password: this.decryptPassword(connection),
      }))
      logger.info(
        'ConnectionConfig',
        `连接配置加载完成: 连接=${this.catalog.connections.length}, 分组=${this.catalog.groups.length}`,
      )
      if (source !== this.filePath || raw.version !== 2) {
        this.persist(this.catalog, '迁移旧版连接配置')
      }
    } catch (error) {
      this.catalog = { connections: [], groups: [] }
      logger.error(
        'ConnectionConfig',
        '连接配置加载失败，已保留原文件',
        error instanceof Error ? error : undefined,
      )
    }
  }

  private persist(
    catalog: ConnectionCatalog,
    action: string,
    targetId = '',
  ): void {
    const output: PersistedConnectionCatalog = {
      version: 2,
      groups: catalog.groups.map(group => ({ ...group })),
      connections: catalog.connections.map(connection => ({
        ...connection,
        password: this.cipher.encrypt(connection.password),
      })),
    }
    const tempFile = `${this.filePath}.${process.pid}.tmp`
    try {
      fs.writeFileSync(tempFile, JSON.stringify(output, null, 2), 'utf8')
      fs.renameSync(tempFile, this.filePath)
      this.catalog = structuredClone(catalog)
      logger.info(
        'ConnectionConfig',
        `${action}完成: 目标=${targetId || '全部'}, 连接=${output.connections.length}, 分组=${output.groups.length}`,
      )
    } catch (error) {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      logger.error(
        'ConnectionConfig',
        `${action}失败: 目标=${targetId || '全部'}`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }

  private decryptPassword(connection: ConnectionData): string {
    try {
      return this.cipher.decrypt(connection.password)
    } catch (error) {
      logger.warn(
        'ConnectionConfig',
        `连接密码解密失败，需重新输入: 连接=${connection.id}, 原因=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return ''
    }
  }

  private validateConnection(
    input: ConnectionData,
    currentId = '',
  ): ConnectionData {
    const name = input.name.trim()
    if (!name) throw new Error('连接名称不能为空')
    const duplicate = this.catalog.connections.some(connection => (
      connection.id !== currentId
      && connection.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    ))
    if (duplicate) throw new Error(`连接名称已存在: ${name}`)
    if (input.groupId) this.requireGroup(input.groupId)
    if (input.type === 'SQLite' && !input.database.trim()) {
      throw new Error('SQLite 文件路径不能为空')
    }
    if (input.type !== 'SQLite') {
      if (!input.host.trim()) throw new Error('主机地址不能为空')
      if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
        throw new Error('端口必须是 1 到 65535 之间的整数')
      }
    }
    return {
      ...input,
      id: currentId || input.id,
      name,
      host: input.type === 'SQLite' ? '' : input.host.trim(),
      port: input.type === 'SQLite' ? 0 : input.port,
      username: input.type === 'SQLite' ? '' : input.username.trim(),
      database: input.database.trim(),
      timeout: Math.max(1, Number(input.timeout || 30)),
      charset: input.charset?.trim() || 'utf8mb4',
      color: normalizeConnectionColor(input.color),
    }
  }

  private validateGroupName(name: string, currentId = ''): string {
    const value = name.trim()
    if (!value) throw new Error('分组名称不能为空')
    const duplicate = this.catalog.groups.some(group => (
      group.id !== currentId
      && group.name.toLocaleLowerCase() === value.toLocaleLowerCase()
    ))
    if (duplicate) throw new Error(`分组名称已存在: ${value}`)
    return value
  }

  private requireGroup(id: string): ConnectionGroup {
    const group = this.catalog.groups.find(item => item.id === id)
    if (!group) throw new Error('连接分组不存在')
    return group
  }
}

function normalizeConnectionColor(input?: string): string | undefined {
  const value = String(input || '').trim()
  if (!value) return undefined
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error('连接颜色格式无效')
  }
  return value.toUpperCase()
}
