import type {
  QueryExecutionMessage,
  QueryResultColumn,
  QueryResultSet,
} from './queryTypes'

export function buildColumns(
  names: string[],
  dataTypes: Array<string | undefined> = [],
): QueryResultColumn[] {
  return names.map((name, index) => ({
    key: `column-${index}`,
    name: name || `列 ${index + 1}`,
    dataType: dataTypes[index],
  }))
}

export function buildResultSet(
  requestId: string,
  index: number,
  columns: QueryResultColumn[],
  rows: unknown[][],
  command?: string,
): QueryResultSet {
  return {
    id: `${requestId}-result-${index}`,
    index,
    columns,
    rows,
    rowCount: rows.length,
    command,
  }
}

export function resultMessage(
  index: number,
  rowCount: number,
  command?: string,
): QueryExecutionMessage {
  const prefix = command ? `${command}: ` : ''
  return {
    index,
    level: 'info',
    command,
    text: `${prefix}返回 ${rowCount} 行`,
  }
}

export function affectedMessage(
  index: number,
  affectedRows: number,
  command?: string,
): QueryExecutionMessage {
  const prefix = command ? `${command}: ` : ''
  return {
    index,
    level: 'info',
    command,
    affectedRows,
    text: `${prefix}影响 ${affectedRows} 行`,
  }
}

export function errorMessage(
  text: string,
  index: number = 0,
): QueryExecutionMessage {
  return {
    index,
    level: 'error',
    text,
  }
}
