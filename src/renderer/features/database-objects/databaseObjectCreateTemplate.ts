import type { ConnectionData } from '../../types'
import type { DatabaseObjectCategory } from './databaseObjectModel'

export interface DatabaseObjectCreateDocument {
  name: string
  sql: string
}

const VIEW_SQL = `CREATE VIEW view_name AS
SELECT *
FROM target_table;
`

const FUNCTION_SQL: Record<ConnectionData['type'], string> = {
  MySQL: `CREATE FUNCTION function_name()
RETURNS VARCHAR(255)
DETERMINISTIC
RETURN '';
`,
  PostgreSQL: `CREATE OR REPLACE FUNCTION public.function_name()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 在此编写函数逻辑
END;
$$;
`,
  'SQL Server': `CREATE FUNCTION dbo.function_name()
RETURNS NVARCHAR(255)
AS
BEGIN
  RETURN N'';
END;
`,
  SQLite: `-- SQLite 不支持通过 SQL 创建自定义函数。
-- 可在此编写用于替代函数逻辑的查询。
SELECT 1;
`,
}

const EVENT_SQL: Record<ConnectionData['type'], string> = {
  MySQL: `CREATE EVENT event_name
ON SCHEDULE EVERY 1 DAY
DO
  DELETE FROM target_table WHERE 1 = 0;
`,
  PostgreSQL: `-- PostgreSQL 没有原生数据库事件对象。
-- 安装调度扩展后，可在此编写对应的调度 SQL。
SELECT 1;
`,
  'SQL Server': `-- SQL Server 数据库级事件通常由 SQL Server Agent 作业实现。
-- 请在此编写需要调度执行的 SQL。
SELECT 1;
`,
  SQLite: `CREATE TRIGGER event_name
AFTER INSERT ON target_table
BEGIN
  -- 在此编写触发逻辑
  SELECT 1;
END;
`,
}

export function buildDatabaseObjectCreateDocument(
  type: ConnectionData['type'],
  category: DatabaseObjectCategory,
): DatabaseObjectCreateDocument | undefined {
  if (category === 'views') {
    return { name: '新建视图.sql', sql: VIEW_SQL }
  }
  if (category === 'functions') {
    return { name: '新建函数.sql', sql: FUNCTION_SQL[type] }
  }
  if (category === 'events') {
    return { name: '新建事件.sql', sql: EVENT_SQL[type] }
  }
  if (category === 'queries') {
    return { name: '新建查询.sql', sql: '' }
  }
  if (category === 'reports') {
    return {
      name: '新建报表.sql',
      sql: `-- 报表数据集查询
SELECT *
FROM target_table;
`,
    }
  }
  return undefined
}
