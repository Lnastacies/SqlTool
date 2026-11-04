import type { ConnectionData } from './adapters'

export interface CreateDatabaseOptions {
  charset?: string
  encoding?: string
  collation?: string
}

export interface CreateDatabaseResult {
  name: string
}

const DATABASE_NAME_LIMITS: Partial<Record<ConnectionData['type'], number>> = {
  MySQL: 64,
  PostgreSQL: 63,
  'SQL Server': 128,
}

const POSTGRES_ENCODINGS = new Set([
  'SQL_ASCII',
  'EUC_JP',
  'EUC_CN',
  'EUC_KR',
  'EUC_TW',
  'EUC_JIS_2004',
  'UTF8',
  'MULE_INTERNAL',
  'LATIN1',
  'LATIN2',
  'LATIN3',
  'LATIN4',
  'LATIN5',
  'LATIN6',
  'LATIN7',
  'LATIN8',
  'LATIN9',
  'LATIN10',
  'WIN1250',
  'WIN1251',
  'WIN1252',
  'WIN1253',
  'WIN1254',
  'WIN1255',
  'WIN1256',
  'WIN1257',
  'WIN1258',
  'KOI8R',
  'KOI8U',
  'SJIS',
  'BIG5',
  'GBK',
  'UHC',
  'GB18030',
  'JOHAB',
  'SHIFT_JIS_2004',
])

export function normalizeDatabaseName(
  type: ConnectionData['type'],
  input: string,
): string {
  if (type === 'SQLite') {
    throw new Error('SQLite 连接通过数据库文件管理，不支持在连接内新建数据库')
  }

  const name = input.trim()
  if (!name) throw new Error('数据库名称不能为空')
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('数据库名称不能包含控制字符')
  }

  const limit = DATABASE_NAME_LIMITS[type]
  const length = type === 'PostgreSQL'
    ? Buffer.byteLength(name, 'utf8')
    : Array.from(name).length
  if (limit && length > limit) {
    const unit = type === 'PostgreSQL' ? '字节' : '个字符'
    throw new Error(`数据库名称不能超过 ${limit} ${unit}`)
  }
  return name
}

function normalizeIdentifierOption(
  value: string | undefined,
  label: string,
): string {
  const normalized = value?.trim() || ''
  if (!normalized) return ''
  if (normalized.length > 128 || !/^[A-Za-z0-9_]+$/.test(normalized)) {
    throw new Error(`${label}只能包含字母、数字和下划线，且不能超过 128 个字符`)
  }
  return normalized
}

function normalizePostgresEncoding(value: string | undefined): string {
  const encoding = value?.trim().toUpperCase() || ''
  if (encoding && !POSTGRES_ENCODINGS.has(encoding)) {
    throw new Error(`PostgreSQL 不支持编码“${encoding}”`)
  }
  return encoding
}

function normalizePostgresLocale(value: string | undefined): string {
  const locale = value?.trim() || ''
  if (!locale) return ''
  if (locale.length > 128 || /[\u0000-\u001f\u007f]/.test(locale)) {
    throw new Error('区域设置不能包含控制字符，且不能超过 128 个字符')
  }
  return locale
}

function quoteSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export function buildCreateDatabaseStatement(
  type: ConnectionData['type'],
  input: string,
  options: CreateDatabaseOptions = {},
): string {
  const name = normalizeDatabaseName(type, input)
  switch (type) {
    case 'MySQL':
    case 'TDSQL': {
      if (options.encoding?.trim()) {
        throw new Error('MySQL 请使用字符集选项，不支持 PostgreSQL 编码选项')
      }
      const charset = normalizeIdentifierOption(options.charset, '字符集')
      const collation = normalizeIdentifierOption(options.collation, '排序规则')
      const clauses = [
        charset ? `DEFAULT CHARACTER SET = ${charset}` : '',
        collation ? `DEFAULT COLLATE = ${collation}` : '',
      ].filter(Boolean)
      return [
        `CREATE DATABASE \`${name.replace(/`/g, '``')}\``,
        ...clauses,
      ].join(' ')
    }
    case 'PostgreSQL': {
      if (options.charset?.trim()) {
        throw new Error('PostgreSQL 请使用编码选项，不支持 MySQL 字符集选项')
      }
      const encoding = normalizePostgresEncoding(options.encoding)
      const locale = normalizePostgresLocale(options.collation)
      const clauses = [
        encoding ? `ENCODING = ${quoteSqlString(encoding)}` : '',
        locale ? `LC_COLLATE = ${quoteSqlString(locale)}` : '',
        locale ? `LC_CTYPE = ${quoteSqlString(locale)}` : '',
        encoding || locale ? 'TEMPLATE = template0' : '',
      ].filter(Boolean)
      return [
        `CREATE DATABASE "${name.replace(/"/g, '""')}"`,
        clauses.length > 0 ? `WITH ${clauses.join(' ')}` : '',
      ].filter(Boolean).join(' ')
    }
    case 'SQL Server': {
      if (options.charset?.trim() || options.encoding?.trim()) {
        throw new Error('SQL Server 的字符编码由排序规则决定')
      }
      const collation = normalizeIdentifierOption(options.collation, '排序规则')
      return [
        `CREATE DATABASE [${name.replace(/]/g, ']]')}]`,
        collation ? `COLLATE ${collation}` : '',
      ].filter(Boolean).join(' ')
    }
    default:
      throw new Error(`不支持新建数据库: ${type}`)
  }
}
