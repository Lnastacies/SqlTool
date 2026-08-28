import type { QueryTransactionState } from './queryTypes'

/**
 * 只读取每条语句开头的事务关键字，字符串、标识符和注释中的文本不会参与判断。
 * 该结果用于同步工具栏状态，实际事务仍由数据库会话负责。
 */
export function inferTransactionState(
  sql: string,
  current: QueryTransactionState,
): QueryTransactionState {
  let state = current
  for (const tokens of readStatementPrefixes(sql)) {
    const [first, second] = tokens
    if (
      first === 'BEGIN'
      || (first === 'START' && second === 'TRANSACTION')
    ) {
      state = 'active'
    } else if (
      first === 'COMMIT'
      || first === 'END'
      || first === 'ROLLBACK'
      || first === 'ABORT'
    ) {
      state = 'idle'
    }
  }
  return state
}

function readStatementPrefixes(sql: string): string[][] {
  const statements: string[][] = []
  let tokens: string[] = []
  let token = ''
  let mode:
    | 'normal'
    | 'single'
    | 'double'
    | 'backtick'
    | 'line-comment'
    | 'block-comment'
    | 'dollar' = 'normal'
  let dollarTag = ''

  const finishToken = () => {
    if (!token) return
    if (tokens.length < 2) tokens.push(token.toUpperCase())
    token = ''
  }
  const finishStatement = () => {
    finishToken()
    if (tokens.length > 0) statements.push(tokens)
    tokens = []
  }

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const next = sql[index + 1]

    if (mode === 'line-comment') {
      if (char === '\n' || char === '\r') mode = 'normal'
      continue
    }
    if (mode === 'block-comment') {
      if (char === '*' && next === '/') {
        mode = 'normal'
        index += 1
      }
      continue
    }
    if (mode === 'single') {
      if (char === "'" && next === "'") {
        index += 1
      } else if (char === "'") {
        mode = 'normal'
      }
      continue
    }
    if (mode === 'double') {
      if (char === '"' && next === '"') {
        index += 1
      } else if (char === '"') {
        mode = 'normal'
      }
      continue
    }
    if (mode === 'backtick') {
      if (char === '`' && next === '`') {
        index += 1
      } else if (char === '`') {
        mode = 'normal'
      }
      continue
    }
    if (mode === 'dollar') {
      if (sql.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1
        mode = 'normal'
      }
      continue
    }

    if (char === '-' && next === '-') {
      finishToken()
      mode = 'line-comment'
      index += 1
    } else if (char === '/' && next === '*') {
      finishToken()
      mode = 'block-comment'
      index += 1
    } else if (char === '#') {
      finishToken()
      mode = 'line-comment'
    } else if (char === "'") {
      finishToken()
      mode = 'single'
    } else if (char === '"') {
      finishToken()
      mode = 'double'
    } else if (char === '`') {
      finishToken()
      mode = 'backtick'
    } else if (char === '$') {
      const match = sql.slice(index).match(/^\$[A-Za-z_0-9]*\$/)
      if (match) {
        finishToken()
        dollarTag = match[0]
        mode = 'dollar'
        index += dollarTag.length - 1
      }
    } else if (char === ';') {
      finishStatement()
    } else if (/[A-Za-z_]/.test(char)) {
      if (tokens.length < 2) token += char
    } else {
      finishToken()
    }
  }

  finishStatement()
  return statements
}
