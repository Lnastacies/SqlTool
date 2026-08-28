export function normalizeInput(
  value: unknown,
  original: unknown,
): unknown {
  if (typeof value !== 'string') return value
  if (typeof original === 'number') {
    const numberValue = Number(value)
    return Number.isNaN(numberValue) ? value : numberValue
  }
  if (typeof original === 'boolean') {
    return value.toLowerCase() === 'true' || value === '1'
  }
  if (original instanceof Date) {
    const dateValue = new Date(value)
    return Number.isNaN(dateValue.getTime()) ? value : dateValue
  }
  if (
    original !== null
    && typeof original === 'object'
    && !(original instanceof Uint8Array)
  ) {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

export function serializeIdentityValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (value instanceof Date) return `date:${value.toISOString()}`
  if (value instanceof Uint8Array) {
    return `binary:${Array.from(value).join(',')}`
  }
  if (typeof value === 'object') {
    try {
      return `object:${JSON.stringify(value)}`
    } catch {
      return `object:${String(value)}`
    }
  }
  return `${typeof value}:${String(value)}`
}
