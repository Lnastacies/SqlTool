import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

const PREFIX = 'enc:v1'
const KEY_LENGTH = 32

export class ConnectionCredentialCipher {
  private readonly key: Buffer
  private readonly legacyKey?: Buffer

  constructor(storageDirectory: string, legacyKeyFile: string) {
    this.key = this.loadOrCreateKey(
      path.join(storageDirectory, 'connection.key'),
    )
    this.legacyKey = this.loadLegacyKey(legacyKeyFile)
  }

  encrypt(value: string): string {
    if (!value) return ''
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ])
    return [
      PREFIX,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':')
  }

  decrypt(value: string): string {
    if (!value) return ''
    if (value.startsWith(`${PREFIX}:`)) {
      return this.decryptCurrent(value)
    }
    if (value.startsWith('gAAAA')) {
      if (!this.legacyKey) {
        throw new Error('缺少旧版连接密码密钥')
      }
      return this.decryptFernet(value, this.legacyKey)
    }
    // 旧版本允许明文密码，迁移后会统一使用新格式写回。
    return value
  }

  isCurrentFormat(value: string): boolean {
    return value.startsWith(`${PREFIX}:`)
  }

  private decryptCurrent(value: string): string {
    const [, , ivText, tagText, encryptedText] = value.split(':')
    if (!ivText || !tagText || !encryptedText) {
      throw new Error('连接密码密文格式无效')
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivText, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  }

  private decryptFernet(token: string, key: Buffer): string {
    const payload = Buffer.from(token, 'base64url')
    if (key.length !== KEY_LENGTH || payload.length < 57 || payload[0] !== 0x80) {
      throw new Error('旧版连接密码密文格式无效')
    }
    const signed = payload.subarray(0, payload.length - 32)
    const signature = payload.subarray(payload.length - 32)
    const expected = createHmac('sha256', key.subarray(0, 16))
      .update(signed)
      .digest()
    if (!timingSafeEqual(signature, expected)) {
      throw new Error('旧版连接密码签名校验失败')
    }
    const decipher = createDecipheriv(
      'aes-128-cbc',
      key.subarray(16),
      payload.subarray(9, 25),
    )
    return Buffer.concat([
      decipher.update(payload.subarray(25, payload.length - 32)),
      decipher.final(),
    ]).toString('utf8')
  }

  private loadOrCreateKey(keyFile: string): Buffer {
    if (fs.existsSync(keyFile)) {
      const key = Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'base64url')
      if (key.length !== KEY_LENGTH) {
        throw new Error('连接凭据密钥长度无效')
      }
      return key
    }
    const key = randomBytes(KEY_LENGTH)
    fs.writeFileSync(keyFile, key.toString('base64url'), {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    })
    return key
  }

  private loadLegacyKey(keyFile: string): Buffer | undefined {
    if (!fs.existsSync(keyFile)) return undefined
    try {
      const key = Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'base64url')
      return key.length === KEY_LENGTH ? key : undefined
    } catch {
      return undefined
    }
  }
}
