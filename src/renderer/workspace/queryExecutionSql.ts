export type QueryExecutionMode = 'current' | 'all'

interface StatementRange {
  start: number
  end: number
  sql: string
}

export function resolveQueryExecutionSql(
  sql: string,
  selectedSql: string,
  cursorOffset: number,
  mode: QueryExecutionMode,
): string {
  if (mode === 'all') return sql.trim()
  if (selectedSql.trim()) return selectedSql.trim()

  const statements = splitSqlStatements(sql)
  if (statements.length === 0) return ''
  const normalizedOffset = Math.max(0, Math.min(cursorOffset, sql.length))
  const current = statements.find(
    statement =>
      normalizedOffset >= statement.start
      && normalizedOffset <= statement.end,
  )
  if (current) return current.sql

  // 光标位于末尾空白区域时，沿用最近一条有效语句。
  const previous = [...statements]
    .reverse()
    .find(statement => statement.end < normalizedOffset)
  return previous?.sql || statements[0].sql
}

function splitSqlStatements(sql: string): StatementRange[] {
  const statements: StatementRange[] = []
  let start = 0
  let quote: "'" | '"' | '`' | ']' | null = null
  let dollarTag = ''
  let lineComment = false
  let blockCommentDepth = 0

  const pushStatement = (end: number) => {
    const statement = sql.slice(start, end).trim()
    if (statement) statements.push({ start, end, sql: statement })
    start = end
  }

  for (let index = 0; index < sql.length; index += 1) {
    const current = sql[index]
    const next = sql[index + 1]

    if (lineComment) {
      if (current === '\n') lineComment = false
      continue
    }
    if (blockCommentDepth > 0) {
      if (current === '/' && next === '*') {
        blockCommentDepth += 1
        index += 1
      } else if (current === '*' && next === '/') {
        blockCommentDepth -= 1
        index += 1
      }
      continue
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1
        dollarTag = ''
      }
      continue
    }
    if (quote) {
      if (quote === ']' && current === ']' && next === ']') {
        index += 1
      } else if (quote !== ']' && current === quote && next === quote) {
        index += 1
      } else if (current === quote) {
        quote = null
      } else if (current === '\\' && quote !== ']' && next) {
        index += 1
      }
      continue
    }

    if (current === '-' && next === '-') {
      lineComment = true
      index += 1
    } else if (current === '#') {
      lineComment = true
    } else if (current === '/' && next === '*') {
      blockCommentDepth = 1
      index += 1
    } else if (current === "'" || current === '"' || current === '`') {
      quote = current
    } else if (current === '[') {
      quote = ']'
    } else if (current === '$') {
      const tag = sql.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0]
      if (tag) {
        dollarTag = tag
        index += tag.length - 1
      }
    } else if (current === ';') {
      pushStatement(index + 1)
    }
  }

  pushStatement(sql.length)
  return statements
}
