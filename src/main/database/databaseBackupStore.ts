import { createHash, randomUUID } from 'crypto'
import { createReadStream, createWriteStream, promises as fs } from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { createGunzip, createGzip } from 'zlib'
import { logger } from '../logger'
import {
  buildBackupFileName,
  normalizeBackupName,
} from './databaseBackupFileName'
import type { DatabaseBackupRecord } from './databaseBackupTypes'

interface BackupDestination {
  id: string
  createdAt: string
  fileName: string
  filePath: string
  metadataPath: string
}

const MAX_BACKUP_BYTES = 1024 * 1024 * 1024

async function fileSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

function isBackupRecord(value: unknown): value is DatabaseBackupRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<DatabaseBackupRecord>
  return [
    record.id,
    record.connectionId,
    record.database,
    record.name,
    record.fileName,
    record.createdAt,
  ].every(item => typeof item === 'string' && item.length > 0)
}

function safeSegment(value: string): string {
  const readable = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 48) || 'database'
  const hash = createHash('sha256').update(value).digest('hex').slice(0, 10)
  return `${readable}-${hash}`
}

export class DatabaseBackupStore {
  constructor(private readonly rootDirectory: string) {
    if (!path.isAbsolute(rootDirectory)) {
      throw new Error('备份存储目录必须是绝对路径')
    }
  }

  async list(
    connectionId: string,
    database: string,
  ): Promise<DatabaseBackupRecord[]> {
    const directory = this.scopeDirectory(connectionId, database)
    await fs.mkdir(directory, { recursive: true })
    const entries = await fs.readdir(directory, { withFileTypes: true })
    const metadataFiles = entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.backup.json'))
      .map(entry => path.join(directory, entry.name))
    const records: DatabaseBackupRecord[] = []

    for (const metadataPath of metadataFiles) {
      try {
        const parsed = JSON.parse(
          await fs.readFile(metadataPath, 'utf8'),
        ) as unknown
        if (!isBackupRecord(parsed)) {
          logger.warn(
            'DatabaseBackup',
            `忽略格式不完整的备份元数据: 文件=${metadataPath}`,
          )
          continue
        }
        const filePath = path.join(directory, path.basename(parsed.fileName))
        const stat = await fs.stat(filePath)
        if (
          parsed.connectionId !== connectionId
          || parsed.database !== database
          || !stat.isFile()
        ) {
          continue
        }
        records.push({
          ...parsed,
          schemaVersion: 1,
          checksumSha256: parsed.checksumSha256 || '',
          filePath,
          size: stat.size,
        })
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        logger.warn(
          'DatabaseBackup',
          `忽略损坏或失效的备份元数据: 文件=${metadataPath}, 原因=${detail}`,
        )
      }
    }
    return records.sort((left, right) => (
      right.createdAt.localeCompare(left.createdAt)
    ))
  }

  async createDestination(
    connectionId: string,
    database: string,
    name: string,
    compressed: boolean,
  ): Promise<BackupDestination> {
    const directory = this.scopeDirectory(connectionId, database)
    await fs.mkdir(directory, { recursive: true })
    const id = randomUUID()
    const createdAt = new Date()
    const fileName = buildBackupFileName({
      name,
      id,
      createdAt,
      compressed,
    })
    logger.info(
      'DatabaseBackup',
      `备份文件命名完成: 数据库=${database}, 逻辑名称=${normalizeBackupName(name)}, 文件=${fileName}`,
    )
    return {
      id,
      createdAt: createdAt.toISOString(),
      fileName,
      filePath: path.join(directory, fileName),
      metadataPath: path.join(directory, `${fileName}.backup.json`),
    }
  }

  async saveRecord(
    destination: BackupDestination,
    record: Omit<
      DatabaseBackupRecord,
      'schemaVersion' | 'size' | 'filePath' | 'checksumSha256'
    >,
  ): Promise<DatabaseBackupRecord> {
    const stat = await fs.stat(destination.filePath)
    const completed: DatabaseBackupRecord = {
      ...record,
      schemaVersion: 1,
      filePath: destination.filePath,
      size: stat.size,
      checksumSha256: await fileSha256(destination.filePath),
    }
    const pendingMetadata = `${destination.metadataPath}.tmp`
    try {
      await fs.writeFile(
        pendingMetadata,
        JSON.stringify(completed, null, 2),
        'utf8',
      )
      await fs.rename(pendingMetadata, destination.metadataPath)
    } catch (error) {
      await fs.rm(pendingMetadata, { force: true }).catch(() => undefined)
      throw error
    }
    return completed
  }

  async resolve(
    connectionId: string,
    database: string,
    backupId: string,
  ): Promise<DatabaseBackupRecord> {
    const record = (await this.list(connectionId, database))
      .find(item => item.id === backupId)
    if (!record) throw new Error('备份记录不存在或文件已被移动')
    return record
  }

  async delete(record: DatabaseBackupRecord): Promise<void> {
    const metadataPath = `${record.filePath}.backup.json`
    await fs.rm(record.filePath, { force: true })
    await fs.rm(metadataPath, { force: true })
  }

  async rename(
    record: DatabaseBackupRecord,
    name: string,
  ): Promise<DatabaseBackupRecord> {
    const normalizedName = normalizeBackupName(name)
    if (normalizedName === record.name) return record

    const createdAt = new Date(record.createdAt)
    const fileName = buildBackupFileName({
      name: normalizedName,
      id: record.id,
      createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
      compressed: record.compressed,
    })
    const filePath = path.join(path.dirname(record.filePath), fileName)
    const metadataPath = `${filePath}.backup.json`
    const previousMetadataPath = `${record.filePath}.backup.json`
    const pendingMetadataPath = `${metadataPath}.tmp`

    try {
      await fs.access(filePath)
      throw new Error('同名备份文件已存在')
    } catch (error) {
      if (
        error instanceof Error
        && !('code' in error && error.code === 'ENOENT')
      ) {
        throw error
      }
    }

    await fs.rename(record.filePath, filePath)
    const updated: DatabaseBackupRecord = {
      ...record,
      name: normalizedName,
      fileName,
      filePath,
    }
    try {
      await fs.writeFile(
        pendingMetadataPath,
        JSON.stringify(updated, null, 2),
        'utf8',
      )
      await fs.rename(pendingMetadataPath, metadataPath)
      await fs.rm(previousMetadataPath, { force: true })
      return updated
    } catch (error) {
      await fs.rm(pendingMetadataPath, { force: true }).catch(() => undefined)
      await fs.rm(metadataPath, { force: true }).catch(() => undefined)
      await fs.rename(filePath, record.filePath).catch(() => undefined)
      throw error
    }
  }

  async verify(record: DatabaseBackupRecord): Promise<void> {
    if (!record.checksumSha256) return
    const actual = await fileSha256(record.filePath)
    if (actual !== record.checksumSha256) {
      throw new Error('备份文件完整性校验失败，文件可能已损坏或被修改')
    }
  }

  async readSql(filePath: string): Promise<string> {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) throw new Error('选择的备份路径不是文件')
    if (stat.size > MAX_BACKUP_BYTES) {
      throw new Error('备份文件不能超过 1 GB')
    }
    const content = await fs.readFile(filePath)
    const sql = filePath.toLowerCase().endsWith('.gz')
      ? await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        const stream = createGunzip()
        let total = 0
        stream.on('data', chunk => {
          total += chunk.length
          if (total > MAX_BACKUP_BYTES) {
            stream.destroy(new Error('解压后的备份文件不能超过 1 GB'))
            return
          }
          chunks.push(Buffer.from(chunk))
        })
        stream.on('error', reject)
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.end(content)
      })
      : content
    return sql.toString('utf8').replace(/^\uFEFF/, '')
  }

  async compress(sourcePath: string, outputPath: string): Promise<void> {
    await pipeline(
      createReadStream(sourcePath),
      createGzip({ level: 6 }),
      createWriteStream(outputPath, { flags: 'wx' }),
    )
  }

  directory(connectionId: string, database: string): string {
    return this.scopeDirectory(connectionId, database)
  }

  private scopeDirectory(connectionId: string, database: string): string {
    return path.join(
      this.rootDirectory,
      safeSegment(connectionId),
      safeSegment(database),
    )
  }
}

export type { BackupDestination }
