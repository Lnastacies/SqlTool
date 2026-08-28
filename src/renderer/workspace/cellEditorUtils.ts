import type { TableFieldMetadata } from '../types'

export type CellEditorKind =
  | 'text'
  | 'boolean'
  | 'date'
  | 'time'
  | 'datetime'
  | 'json'
  | 'binary'
  | 'enum'

export interface CellEditorDescriptor {
  kind: CellEditorKind
  enumOptions: string[]
}

export function describeCellEditor(
  field: TableFieldMetadata | undefined,
  value: unknown,
): CellEditorDescriptor {
  const type = field?.type.trim().toLowerCase() || ''
  if (value instanceof Uint8Array || isBinaryType(type)) {
    return { kind: 'binary', enumOptions: [] }
  }
  if (/^(boolean|bool|bit)$/.test(type) || /^tinyint\s*\(\s*1\s*\)/.test(type)) {
    return { kind: 'boolean', enumOptions: [] }
  }
  if (type.includes('json')) {
    return { kind: 'json', enumOptions: [] }
  }
  const enumOptions = parseEnumOptions(type)
  if (enumOptions.length > 0) {
    return { kind: 'enum', enumOptions }
  }
  if (type.includes('timestamp') || type.includes('datetime')) {
    return { kind: 'datetime', enumOptions: [] }
  }
  if (type === 'date') {
    return { kind: 'date', enumOptions: [] }
  }
  if (type.includes('time')) {
    return { kind: 'time', enumOptions: [] }
  }
  if (typeof value === 'boolean') {
    return { kind: 'boolean', enumOptions: [] }
  }
  return { kind: 'text', enumOptions: [] }
}

export function formatEditorValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export function formatDateInputValue(
  value: unknown,
  kind: 'date' | 'time' | 'datetime',
): string {
  if (value === null || value === undefined) return ''
  const raw = value instanceof Date
    ? formatLocalDate(value)
    : String(value).trim().replace(' ', 'T')
  if (kind === 'date') return raw.slice(0, 10)
  if (kind === 'time') {
    const time = raw.includes('T') ? raw.split('T')[1] : raw
    return time.slice(0, 8)
  }
  return raw.replace(/Z$/, '').slice(0, 19)
}

function formatLocalDate(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0')
  return [
    value.getFullYear(),
    '-',
    pad(value.getMonth() + 1),
    '-',
    pad(value.getDate()),
    'T',
    pad(value.getHours()),
    ':',
    pad(value.getMinutes()),
    ':',
    pad(value.getSeconds()),
  ].join('')
}

function isBinaryType(type: string): boolean {
  return /(blob|binary|bytea|varbinary|image|long raw)/.test(type)
}

function parseEnumOptions(type: string): string[] {
  const match = type.match(/^enum\s*\((.*)\)$/i)
  if (!match) return []
  return Array.from(match[1].matchAll(/'((?:''|[^'])*)'/g))
    .map(item => item[1].replace(/''/g, "'"))
}
