export type IdentifierQuote = '`' | '"' | '['

export function quoteIdentifier(
  value: string,
  quote: IdentifierQuote,
): string {
  if (quote === '[') return `[${value.replace(/]/g, ']]')}]`
  return `${quote}${value.replace(
    new RegExp(quote, 'g'),
    `${quote}${quote}`,
  )}${quote}`
}

export function normalizeValue(value: unknown): unknown {
  if (value === undefined) return null
  if (
    value !== null
    && typeof value === 'object'
    && !(value instanceof Uint8Array)
    && !(value instanceof Date)
  ) {
    return JSON.stringify(value)
  }
  return value
}
