import type { DatabaseType } from '../../types'
import {
  findTableDataTypeOption,
  type TableDataTypeOption,
} from './tableDataTypeCatalog'

export interface ParsedTableDataType {
  name: string
  argument: string
  scale: string
  unsigned: boolean
  zerofill: boolean
  option?: TableDataTypeOption
}

const POSTGRES_TEMPORAL_PATTERN =
  /^(timestamp|time)\s*\(([^)]+)\)\s+(with|without)\s+time\s+zone$/i

function splitArguments(value: string): [string, string] {
  const separator = value.indexOf(',')
  if (separator < 0) return [value.trim(), '']
  return [
    value.slice(0, separator).trim(),
    value.slice(separator + 1).trim(),
  ]
}

export function parseTableDataType(
  databaseType: DatabaseType,
  value: string,
): ParsedTableDataType {
  let source = value.trim().replace(/\s+/g, ' ')
  let unsigned = false
  let zerofill = false

  if (databaseType === 'MySQL') {
    zerofill = /\s+zerofill$/i.test(source)
    source = source.replace(/\s+zerofill$/i, '').trim()
    unsigned = /\s+unsigned$/i.test(source) || zerofill
    source = source.replace(/\s+unsigned$/i, '').trim()
  }

  // PostgreSQL 把时间精度写在 timestamp/time 与时区修饰语之间。
  const temporalMatch = databaseType === 'PostgreSQL'
    ? source.match(POSTGRES_TEMPORAL_PATTERN)
    : null
  if (temporalMatch) {
    const name = `${temporalMatch[1]} ${temporalMatch[3]} time zone`
    return {
      name,
      argument: temporalMatch[2].trim(),
      scale: '',
      unsigned,
      zerofill,
      option: findTableDataTypeOption(databaseType, name),
    }
  }

  const parameterMatch = source.match(/^(.+?)\s*\((.*)\)$/)
  const name = (parameterMatch?.[1] || source).trim()
  const option = findTableDataTypeOption(databaseType, name)
  const rawArguments = parameterMatch?.[2]?.trim() || ''
  const [argument, scale] = option?.parameter === 'precisionScale'
    ? splitArguments(rawArguments)
    : [rawArguments, '']

  return {
    name: option?.name || name,
    argument,
    scale,
    unsigned,
    zerofill,
    option,
  }
}

export function formatTableDataType(
  databaseType: DatabaseType,
  parsed: ParsedTableDataType,
): string {
  const name = (parsed.option?.name || parsed.name).trim()
  const parameter = parsed.option?.parameter
  let type = name

  if (
    databaseType === 'PostgreSQL'
    && parsed.argument
    && /^(timestamp|time) (with|without) time zone$/i.test(name)
  ) {
    const match = name.match(/^(timestamp|time) ((?:with|without) time zone)$/i)
    type = `${match?.[1]}(${parsed.argument}) ${match?.[2]}`
  } else if (parameter === 'precisionScale' && parsed.argument) {
    type += parsed.scale
      ? `(${parsed.argument},${parsed.scale})`
      : `(${parsed.argument})`
  } else if (parameter && parameter !== 'none' && parsed.argument) {
    type += `(${parsed.argument})`
  } else if (!parsed.option && parsed.argument) {
    type += parsed.scale
      ? `(${parsed.argument},${parsed.scale})`
      : `(${parsed.argument})`
  }

  if (databaseType === 'MySQL' && parsed.unsigned) type += ' UNSIGNED'
  if (databaseType === 'MySQL' && parsed.zerofill) type += ' ZEROFILL'
  return type
}

export function selectTableDataType(
  databaseType: DatabaseType,
  name: string,
): string {
  const option = findTableDataTypeOption(databaseType, name)
  if (!option) return name
  return formatTableDataType(databaseType, {
    name: option.name,
    argument: option.defaultArgument || '',
    scale: option.defaultScale || '',
    unsigned: false,
    zerofill: false,
    option,
  })
}

export function updateTableDataType(
  databaseType: DatabaseType,
  currentType: string,
  patch: Partial<Pick<
    ParsedTableDataType,
    'argument' | 'scale' | 'unsigned' | 'zerofill'
  >>,
): string {
  const parsed = parseTableDataType(databaseType, currentType)
  return formatTableDataType(databaseType, { ...parsed, ...patch })
}

export function validateTableDataType(
  databaseType: DatabaseType,
  value: string,
): string | undefined {
  const parsed = parseTableDataType(databaseType, value)
  const { option } = parsed
  if (!option) return undefined

  if (option.parameter === 'values') {
    if (!parsed.argument) return '必须填写枚举值'
    if (!/^\s*'(?:[^']|'')*'(?:\s*,\s*'(?:[^']|'')*')*\s*$/.test(
      parsed.argument,
    )) {
      return '枚举值应使用单引号并以逗号分隔'
    }
    return undefined
  }

  if (!parsed.argument) return undefined
  if (
    option.allowMax
    && parsed.argument.toLowerCase() === 'max'
  ) {
    return undefined
  }
  if (!/^\d+$/.test(parsed.argument) || Number(parsed.argument) <= 0) {
    return '长度或精度必须是大于 0 的整数'
  }
  if (
    option.parameter === 'precisionScale'
    && parsed.scale
    && (
      !/^\d+$/.test(parsed.scale)
      || Number(parsed.scale) > Number(parsed.argument)
    )
  ) {
    return '小数位必须是不大于精度的非负整数'
  }
  return undefined
}
