import type { DatabaseType } from '../../types'

export type TableDataTypeParameter =
  'none' | 'length' | 'precision' | 'precisionScale' | 'values'

export interface TableDataTypeOption {
  name: string
  category: string
  parameter: TableDataTypeParameter
  defaultArgument?: string
  defaultScale?: string
  allowMax?: boolean
  supportsUnsigned?: boolean
}

type TypeConfig = Omit<TableDataTypeOption, 'name' | 'category'>

function group(
  category: string, names: string[], config: Partial<TypeConfig> = {},
): TableDataTypeOption[] {
  return names.map(name => ({
    name,
    category,
    parameter: 'none',
    ...config,
  }))
}

const MYSQL_TYPES: TableDataTypeOption[] = [
  ...group('整数', [
    'TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'INTEGER', 'BIGINT',
  ], { parameter: 'length', supportsUnsigned: true }),
  ...group('精确数值', ['DECIMAL', 'NUMERIC'], {
    parameter: 'precisionScale',
    defaultArgument: '18',
    defaultScale: '2',
    supportsUnsigned: true,
  }),
  ...group('浮点数', ['FLOAT', 'DOUBLE', 'DOUBLE PRECISION', 'REAL'], {
    parameter: 'precisionScale',
    supportsUnsigned: true,
  }),
  ...group('位与布尔', ['BIT'], {
    parameter: 'length',
    defaultArgument: '1',
  }),
  ...group('位与布尔', ['BOOLEAN', 'BOOL']),
  ...group('日期时间', ['DATE', 'YEAR']),
  ...group('日期时间', ['TIME', 'DATETIME', 'TIMESTAMP'], {
    parameter: 'precision',
  }),
  ...group('字符', ['CHAR'], {
    parameter: 'length',
    defaultArgument: '1',
  }),
  ...group('字符', ['VARCHAR'], {
    parameter: 'length',
    defaultArgument: '255',
  }),
  ...group('字符', ['BINARY'], {
    parameter: 'length',
    defaultArgument: '16',
  }),
  ...group('字符', ['VARBINARY'], {
    parameter: 'length',
    defaultArgument: '255',
  }),
  ...group('文本', ['TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT']),
  ...group('二进制', ['TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB']),
  ...group('枚举', ['ENUM', 'SET'], { parameter: 'values' }),
  ...group('文档', ['JSON']),
  ...group('空间', [
    'GEOMETRY', 'POINT', 'LINESTRING', 'POLYGON', 'MULTIPOINT',
    'MULTILINESTRING', 'MULTIPOLYGON', 'GEOMETRYCOLLECTION',
  ]),
]

const POSTGRES_TYPES: TableDataTypeOption[] = [
  ...group('整数', [
    'smallint', 'integer', 'bigint', 'smallserial', 'serial', 'bigserial',
  ]),
  ...group('精确数值', ['numeric', 'decimal'], {
    parameter: 'precisionScale',
    defaultArgument: '18',
    defaultScale: '2',
  }),
  ...group('数值', ['real', 'double precision', 'money']),
  ...group('字符', ['character', 'char'], {
    parameter: 'length',
    defaultArgument: '1',
  }),
  ...group('字符', ['character varying', 'varchar'], {
    parameter: 'length',
    defaultArgument: '255',
  }),
  ...group('字符', ['text', 'bytea']),
  ...group('日期时间', ['date', 'interval']),
  ...group('日期时间', [
    'timestamp', 'timestamp without time zone', 'timestamp with time zone',
    'timestamptz', 'time', 'time without time zone', 'time with time zone',
    'timetz',
  ], { parameter: 'precision' }),
  ...group('逻辑与标识', ['boolean', 'uuid', 'xml']),
  ...group('文档', ['json', 'jsonb']),
  ...group('网络', ['inet', 'cidr', 'macaddr', 'macaddr8']),
  ...group('几何', [
    'point', 'line', 'lseg', 'box', 'path', 'polygon', 'circle',
  ]),
  ...group('位串', ['bit', 'bit varying'], { parameter: 'length' }),
  ...group('全文检索', ['tsvector', 'tsquery']),
  ...group('范围', [
    'int4range', 'int8range', 'numrange', 'tsrange', 'tstzrange', 'daterange',
  ]),
  ...group('数组', [
    'smallint[]', 'integer[]', 'bigint[]', 'numeric[]', 'text[]',
    'varchar[]', 'boolean[]', 'uuid[]', 'jsonb[]',
  ]),
  ...group('系统', ['oid', 'pg_lsn']),
]

const SQL_SERVER_TYPES: TableDataTypeOption[] = [
  ...group('整数', ['tinyint', 'smallint', 'int', 'bigint']),
  ...group('精确数值', ['decimal', 'numeric'], {
    parameter: 'precisionScale',
    defaultArgument: '18',
    defaultScale: '2',
  }),
  ...group('数值', ['money', 'smallmoney', 'real', 'bit']),
  ...group('数值', ['float'], { parameter: 'precision' }),
  ...group('日期时间', ['date', 'datetime', 'smalldatetime']),
  ...group('日期时间', ['time', 'datetime2', 'datetimeoffset'], {
    parameter: 'precision',
    defaultArgument: '3',
  }),
  ...group('字符', ['char', 'nchar'], {
    parameter: 'length',
    defaultArgument: '1',
  }),
  ...group('字符', ['varchar', 'nvarchar'], {
    parameter: 'length',
    defaultArgument: '255',
    allowMax: true,
  }),
  ...group('字符', ['text', 'ntext']),
  ...group('二进制', ['binary'], {
    parameter: 'length',
    defaultArgument: '16',
  }),
  ...group('二进制', ['varbinary'], {
    parameter: 'length',
    defaultArgument: '255',
    allowMax: true,
  }),
  ...group('二进制', ['image', 'rowversion', 'timestamp']),
  ...group('其他', [
    'uniqueidentifier', 'xml', 'sql_variant', 'hierarchyid',
    'geometry', 'geography',
  ]),
]

const SQLITE_TYPES: TableDataTypeOption[] = [
  ...group('整数', [
    'INTEGER', 'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT',
    'UNSIGNED BIG INT', 'INT2', 'INT8',
  ]),
  ...group('字符', ['CHARACTER', 'NCHAR', 'NATIVE CHARACTER'], {
    parameter: 'length',
    defaultArgument: '1',
  }),
  ...group('字符', ['VARCHAR', 'VARYING CHARACTER', 'NVARCHAR'], {
    parameter: 'length',
    defaultArgument: '255',
  }),
  ...group('文本', ['TEXT', 'CLOB']),
  ...group('二进制', ['BLOB']),
  ...group('浮点数', ['REAL', 'DOUBLE', 'DOUBLE PRECISION', 'FLOAT']),
  ...group('精确数值', ['NUMERIC', 'DECIMAL'], {
    parameter: 'precisionScale',
    defaultArgument: '18',
    defaultScale: '2',
  }),
  ...group('常用扩展', ['BOOLEAN', 'DATE', 'DATETIME', 'JSON']),
]

export const TABLE_DATA_TYPE_OPTIONS:
Record<DatabaseType, TableDataTypeOption[]> = {
  MySQL: MYSQL_TYPES,
  TDSQL: MYSQL_TYPES,
  PostgreSQL: POSTGRES_TYPES,
  'SQL Server': SQL_SERVER_TYPES,
  SQLite: SQLITE_TYPES,
}

export function findTableDataTypeOption(
  databaseType: DatabaseType, name: string,
): TableDataTypeOption | undefined {
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase()
  return TABLE_DATA_TYPE_OPTIONS[databaseType].find(
    option => option.name.toLowerCase() === normalized,
  )
}
