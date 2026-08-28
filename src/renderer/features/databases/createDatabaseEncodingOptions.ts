import type { DatabaseEncodingCatalog } from '../../types'

export interface DatabaseEncodingOption {
  value: string
  label: string
}

const MYSQL_CHARSETS = [
  'armscii8', 'ascii', 'big5', 'binary', 'cp1250', 'cp1251', 'cp1256',
  'cp1257', 'cp850', 'cp852', 'cp866', 'cp932', 'dec8', 'eucjpms',
  'euckr', 'gb18030', 'gb2312', 'gbk', 'geostd8', 'greek', 'hebrew',
  'hp8', 'keybcs2', 'koi8r', 'koi8u', 'latin1', 'latin2', 'latin5',
  'latin7', 'macce', 'macroman', 'sjis', 'swe7', 'tis620', 'ucs2',
  'ujis', 'utf16', 'utf16le', 'utf32', 'utf8', 'utf8mb3', 'utf8mb4',
]

export const MYSQL_CHARSET_OPTIONS: DatabaseEncodingOption[] = [
  ...MYSQL_CHARSETS.map(value => ({ value, label: value })),
]

const MYSQL_COLLATIONS: Record<string, string[]> = {
  utf8mb4: [
    'utf8mb4_unicode_ci',
    'utf8mb4_general_ci',
    'utf8mb4_bin',
    'utf8mb4_0900_ai_ci',
  ],
  utf8mb3: [
    'utf8mb3_unicode_ci',
    'utf8mb3_general_ci',
    'utf8mb3_bin',
  ],
  latin1: [
    'latin1_swedish_ci',
    'latin1_general_ci',
    'latin1_bin',
  ],
  ascii: ['ascii_general_ci', 'ascii_bin'],
  gbk: ['gbk_chinese_ci', 'gbk_bin'],
  gb18030: ['gb18030_chinese_ci', 'gb18030_bin'],
  binary: ['binary'],
}

function mergeOptions(
  primary: DatabaseEncodingOption[],
  fallback: DatabaseEncodingOption[],
  selected?: string,
): DatabaseEncodingOption[] {
  const options = new Map<string, DatabaseEncodingOption>()
  fallback.forEach(option => options.set(option.value, option))
  primary.forEach(option => options.set(option.value, option))
  if (selected && !options.has(selected)) {
    options.set(selected, { value: selected, label: selected })
  }
  return [...options.values()].sort((left, right) => (
    left.value.localeCompare(right.value)
  ))
}

export function mysqlCharsetOptions(
  catalog?: DatabaseEncodingCatalog,
  selected?: string,
): DatabaseEncodingOption[] {
  const dynamic = (catalog?.charsets || []).map(option => ({
    value: option.value,
    label: option.label,
  }))
  return mergeOptions(dynamic, MYSQL_CHARSET_OPTIONS, selected)
}

export function mysqlCollationOptions(
  charset: string | undefined,
  catalog?: DatabaseEncodingCatalog,
  selected?: string,
): DatabaseEncodingOption[] {
  const dynamic = (catalog?.collations || [])
    .filter(option => option.charset === charset)
    .map(option => ({ value: option.value, label: option.value }))
  const fallback = (MYSQL_COLLATIONS[charset || ''] || []).map(value => ({
    value,
    label: value,
  }))
  return mergeOptions(dynamic, fallback, selected)
}

export function mysqlDefaultCollation(
  charset: string,
  catalog?: DatabaseEncodingCatalog,
): string | undefined {
  return catalog?.charsets.find(option => option.value === charset)
    ?.defaultCollation
    || MYSQL_COLLATIONS[charset]?.[0]
}

export const POSTGRES_ENCODING_OPTIONS: DatabaseEncodingOption[] = [
  'SQL_ASCII', 'EUC_JP', 'EUC_CN', 'EUC_KR', 'EUC_TW', 'EUC_JIS_2004',
  'UTF8', 'MULE_INTERNAL', 'LATIN1', 'LATIN2', 'LATIN3', 'LATIN4',
  'LATIN5', 'LATIN6', 'LATIN7', 'LATIN8', 'LATIN9', 'LATIN10',
  'WIN1250', 'WIN1251', 'WIN1252', 'WIN1253', 'WIN1254', 'WIN1255',
  'WIN1256', 'WIN1257', 'WIN1258', 'KOI8R', 'KOI8U', 'SJIS', 'BIG5',
  'GBK', 'UHC', 'GB18030', 'JOHAB', 'SHIFT_JIS_2004',
].map(value => ({
  value,
  label: value,
}))

export const SQL_SERVER_COLLATION_OPTIONS: DatabaseEncodingOption[] = [
  {
    value: 'Chinese_PRC_100_CI_AS_SC_UTF8',
    label: 'Chinese_PRC_100_CI_AS_SC_UTF8',
  },
  { value: 'Chinese_PRC_CI_AS', label: 'Chinese_PRC_CI_AS' },
  {
    value: 'Latin1_General_100_CI_AS_SC_UTF8',
    label: 'Latin1_General_100_CI_AS_SC_UTF8',
  },
  {
    value: 'SQL_Latin1_General_CP1_CI_AS',
    label: 'SQL_Latin1_General_CP1_CI_AS',
  },
]
