function hasExecutableSql(value: string): boolean {
  const withoutComments = value
    .replace(/--[^\r\n]*(?:\r?\n|$)/g, '')
    .replace(/#[^\r\n]*(?:\r?\n|$)/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  return Boolean(withoutComments.trim())
}

export function splitSqlScript(script: string): string[] {
  const statements: string[] = []
  let start = 0
  let lineStart = 0
  let delimiter = ';'
  let quote: "'" | '"' | '`' | ']' | null = null
  let dollarTag = ''
  let lineComment = false
  let blockCommentDepth = 0
  let protectedStatement = false

  const pushStatement = (end: number) => {
    const statement = script.slice(start, end).trim()
    if (statement && hasExecutableSql(statement)) statements.push(statement)
  }

  for (let index = 0; index < script.length; index += 1) {
    const current = script[index]
    const next = script[index + 1]

    if (index === lineStart && protectedStatement) {
      const newlineIndex = script.indexOf('\n', index)
      const lineEnd = newlineIndex < 0 ? script.length : newlineIndex + 1
      const line = script.slice(index, lineEnd).trim()
      if (/^--\s*SQLTOOL STATEMENT END$/i.test(line)) {
        pushStatement(index)
        protectedStatement = false
        start = lineEnd
        lineStart = lineEnd
        index = lineEnd - 1
        continue
      }
    }
    if (protectedStatement) {
      if (current === '\n') lineStart = index + 1
      continue
    }

    if (
      index === lineStart
      && !quote
      && !dollarTag
      && !lineComment
      && blockCommentDepth === 0
    ) {
      const newlineIndex = script.indexOf('\n', index)
      const lineEnd = newlineIndex < 0 ? script.length : newlineIndex + 1
      const line = script.slice(index, lineEnd).trim()
      if (/^--\s*SQLTOOL STATEMENT BEGIN$/i.test(line)) {
        pushStatement(index)
        protectedStatement = true
        start = lineEnd
        lineStart = lineEnd
        index = lineEnd - 1
        continue
      }
      const delimiterMatch = line.match(/^DELIMITER\s+(\S+)$/i)
      if (delimiterMatch) {
        pushStatement(index)
        delimiter = delimiterMatch[1]
        start = lineEnd
        lineStart = lineEnd
        index = lineEnd - 1
        continue
      }
      if (/^GO(?:\s+\d+)?$/i.test(line)) {
        pushStatement(index)
        start = lineEnd
        lineStart = lineEnd
        index = lineEnd - 1
        continue
      }
    }

    if (lineComment) {
      if (current === '\n') {
        lineComment = false
        lineStart = index + 1
      }
      continue
    }
    if (blockCommentDepth > 0) {
      if (current === '/' && next === '*') {
        blockCommentDepth += 1
        index += 1
      } else if (current === '*' && next === '/') {
        blockCommentDepth -= 1
        index += 1
      } else if (current === '\n') {
        lineStart = index + 1
      }
      continue
    }
    if (dollarTag) {
      if (script.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1
        dollarTag = ''
      } else if (current === '\n') {
        lineStart = index + 1
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
      } else if (current === '\n') {
        lineStart = index + 1
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
    } else if (
      delimiter !== ';'
      && script.startsWith(delimiter, index)
    ) {
      // MySQL 常用 $$ 作为例程分隔符，必须先于 PostgreSQL dollar quote 识别。
      pushStatement(index)
      index += delimiter.length - 1
      start = index + 1
    } else if (current === '$') {
      const tag = script.slice(index)
        .match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0]
      if (tag) {
        dollarTag = tag
        index += tag.length - 1
      }
    } else if (script.startsWith(delimiter, index)) {
      pushStatement(index)
      index += delimiter.length - 1
      start = index + 1
    } else if (current === '\n') {
      lineStart = index + 1
    }
  }

  pushStatement(script.length)
  return statements
}
