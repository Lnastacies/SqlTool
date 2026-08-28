import type { ConnectionData, TableMetadata } from './adapters'
import { normalizeValue, quoteIdentifier } from './mutationSqlUtils'

export type TableFilterLogic = 'and' | 'or'
export type TableSortDirection = 'asc' | 'desc'
export type TableFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'isNull'
  | 'isNotNull'

export interface TableDataSort {
  field: string
  direction: TableSortDirection
}

export interface TableDataFilter {
  field: string
  operator: TableFilterOperator
  value?: unknown
}

export interface TableDataQuery {
  sorts?: TableDataSort[]
  filters?: TableDataFilter[]
  filterLogic?: TableFilterLogic
}

interface BuildTableDataQueryOptions {
  databaseType: ConnectionData['type']
  tableReference: string
  fields: TableMetadata['fields']
  page: number
  pageSize: number
  query?: TableDataQuery
}

export interface BuiltTableDataQuery {
  countSql: string
  dataSql: string
  parameters: unknown[]
  query: Required<TableDataQuery>
}

const FILTER_OPERATORS = new Set<TableFilterOperator>([
  'equals',
  'notEquals',
  'contains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'isNull',
  'isNotNull',
])

export function buildTableDataQuery({
  databaseType,
  tableReference,
  fields,
  page,
  pageSize,
  query,
}: BuildTableDataQueryOptions): BuiltTableDataQuery {
  const normalizedQuery = normalizeQuery(fields, query)
  const parameters: unknown[] = []
  const filterClauses = normalizedQuery.filters.map(filter => (
    buildFilterClause(
      databaseType,
      quoteField(databaseType, filter.field),
      filter,
      parameters,
    )
  ))
  const whereSql = filterClauses.length > 0
    ? ` WHERE ${filterClauses.join(
      normalizedQuery.filterLogic === 'or' ? ' OR ' : ' AND ',
    )}`
    : ''
  const orderSql = buildOrderClause(
    databaseType,
    fields,
    normalizedQuery.sorts,
  )
  const offset = (page - 1) * pageSize
  const paginationSql = databaseType === 'SQL Server'
    ? ` OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`
    : ` LIMIT ${pageSize} OFFSET ${offset}`

  return {
    countSql: `SELECT COUNT(*) AS __sqltool_total FROM ${tableReference}${whereSql}`,
    dataSql: `SELECT * FROM ${tableReference}${whereSql}${orderSql}${paginationSql}`,
    parameters,
    query: normalizedQuery,
  }
}

function normalizeQuery(
  fields: TableMetadata['fields'],
  query?: TableDataQuery,
): Required<TableDataQuery> {
  const fieldNames = new Map(fields.map(field => [field.name, field.name]))
  const resolveField = (value: string): string => {
    const fieldName = fieldNames.get(value)
    if (!fieldName) {
      throw new Error(`筛选或排序字段不在表元数据白名单中: ${value}`)
    }
    return fieldName
  }
  if (query?.sorts !== undefined && !Array.isArray(query.sorts)) {
    throw new Error('排序条件格式无效')
  }
  if (query?.filters !== undefined && !Array.isArray(query.filters)) {
    throw new Error('筛选条件格式无效')
  }
  const sourceSorts = query?.sorts || []
  const sourceFilters = query?.filters || []
  if (sourceSorts.length > 3) {
    throw new Error('排序字段不能超过 3 个')
  }
  if (sourceFilters.length > 20) {
    throw new Error('筛选条件不能超过 20 个')
  }
  const sorts = sourceSorts.map(sort => {
    if (!sort || typeof sort.field !== 'string') {
      throw new Error('排序字段格式无效')
    }
    if (sort.direction !== 'asc' && sort.direction !== 'desc') {
      throw new Error(`不支持的排序方向: ${String(sort.direction)}`)
    }
    return {
      field: resolveField(sort.field),
      direction: sort.direction,
    }
  })
  const filters = sourceFilters.map(filter => {
    if (
      !filter
      || typeof filter.field !== 'string'
      || typeof filter.operator !== 'string'
    ) {
      throw new Error('筛选条件格式无效')
    }
    if (!FILTER_OPERATORS.has(filter.operator)) {
      throw new Error(`不支持的筛选操作符: ${String(filter.operator)}`)
    }
    if (
      filter.operator !== 'isNull'
      && filter.operator !== 'isNotNull'
      && filter.value === undefined
    ) {
      throw new Error(`筛选条件缺少值: ${filter.field}`)
    }
    return {
      field: resolveField(filter.field),
      operator: filter.operator,
      value: filter.value,
    }
  })
  return {
    sorts,
    filters,
    filterLogic: query?.filterLogic === 'or' ? 'or' : 'and',
  }
}

function buildFilterClause(
  databaseType: ConnectionData['type'],
  field: string,
  filter: TableDataFilter,
  parameters: unknown[],
): string {
  if (filter.operator === 'isNull') return `${field} IS NULL`
  if (filter.operator === 'isNotNull') return `${field} IS NOT NULL`

  const parameterValue = isLikeOperator(filter.operator)
    ? buildLikeValue(filter.operator, filter.value)
    : filter.value
  const placeholder = addParameter(
    databaseType,
    parameters,
    parameterValue,
  )
  const operators: Record<
    Exclude<TableFilterOperator, 'isNull' | 'isNotNull'>,
    string
  > = {
    equals: '=',
    notEquals: '<>',
    contains: 'LIKE',
    startsWith: 'LIKE',
    endsWith: 'LIKE',
    greaterThan: '>',
    greaterThanOrEqual: '>=',
    lessThan: '<',
    lessThanOrEqual: '<=',
  }
  const escapeSql = isLikeOperator(filter.operator)
    ? ` ESCAPE '='`
    : ''
  return `${field} ${operators[filter.operator]} ${placeholder}${escapeSql}`
}

function addParameter(
  databaseType: ConnectionData['type'],
  parameters: unknown[],
  value: unknown,
): string {
  const index = parameters.length
  parameters.push(normalizeValue(value))
  if (databaseType === 'PostgreSQL') return `$${index + 1}`
  if (databaseType === 'SQL Server') return `@p${index}`
  return '?'
}

function isLikeOperator(
  operator: TableFilterOperator,
): operator is 'contains' | 'startsWith' | 'endsWith' {
  return (
    operator === 'contains'
    || operator === 'startsWith'
    || operator === 'endsWith'
  )
}

function buildLikeValue(
  operator: 'contains' | 'startsWith' | 'endsWith',
  value: unknown,
): string {
  // 使用显式 ESCAPE 字符，确保用户输入的 % 和 _ 按普通字符匹配。
  const escaped = String(value ?? '')
    .replace(/=/g, '==')
    .replace(/%/g, '=%')
    .replace(/_/g, '=_')
  if (operator === 'startsWith') return `${escaped}%`
  if (operator === 'endsWith') return `%${escaped}`
  return `%${escaped}%`
}

function buildOrderClause(
  databaseType: ConnectionData['type'],
  fields: TableMetadata['fields'],
  sorts: TableDataSort[],
): string {
  const effectiveSorts = sorts.length > 0
    ? sorts
    : fields
      .filter(field => field.primary)
      .map(field => ({ field: field.name, direction: 'asc' as const }))
  if (effectiveSorts.length === 0) {
    return databaseType === 'SQL Server' ? ' ORDER BY (SELECT NULL)' : ''
  }
  return ` ORDER BY ${effectiveSorts.map(sort => (
    `${quoteField(databaseType, sort.field)} ${sort.direction.toUpperCase()}`
  )).join(', ')}`
}

function quoteField(
  databaseType: ConnectionData['type'],
  field: string,
): string {
  if (databaseType === 'MySQL') return quoteIdentifier(field, '`')
  if (databaseType === 'SQL Server') return quoteIdentifier(field, '[')
  return quoteIdentifier(field, '"')
}
