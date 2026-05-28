#!/usr/bin/env python3
"""
数据库操作模块
"""

import time
from PyQt6.QtCore import QRunnable, pyqtSignal, QObject

class WorkerSignals(QObject):
    """工作线程信号"""
    finished = pyqtSignal(dict)
    error = pyqtSignal(str)

class SQLWorker(QRunnable):
    """SQL执行工作线程"""
    def __init__(self, sql, db_connection, db_type, parent):
        super().__init__()
        self.sql = sql
        self.db_connection = db_connection
        self.db_type = db_type
        self.parent = parent
        self.signals = WorkerSignals()
        self.max_retries = 1

    def _execute_with_cursor(self, connection, db_type):
        """使用游标执行SQL，返回(results, affected_rows)"""
        is_query_type = db_type in ('MySQL', 'MariaDB', 'PostgreSQL')
        uses_cm = is_query_type

        if uses_cm:
            with connection.cursor() as cursor:
                return self._do_execute(cursor, db_type)
        else:
            cursor = connection.cursor()
            try:
                return self._do_execute(cursor, db_type)
            finally:
                cursor.close()

    def _do_execute(self, cursor, db_type):
        """实际执行SQL并获取结果"""
        cursor.execute(self.sql)
        sql_upper = self.sql.strip().upper()
        is_query = sql_upper.startswith('SELECT') or sql_upper.startswith('SHOW')

        if is_query:
            results = cursor.fetchall()
            return results, 0
        else:
            affected_rows = cursor.rowcount
            if db_type in ('MySQL', 'MariaDB'):
                cursor.connection.commit()
            elif db_type in ('SQLite', 'SQL Server'):
                cursor.connection.commit()
            return None, affected_rows

    def _try_reconnect_and_retry(self):
        """尝试重连并重试执行"""
        if (hasattr(self.parent, 'connection_pool')
                and hasattr(self.parent, 'current_connection')):
            conn_name = self.parent.current_connection
            new_conn = self.parent.connection_pool.refresh_connection(conn_name)
            if new_conn:
                self.parent.db_connection = new_conn
                return self._execute_with_cursor(new_conn, self.db_type)
        return None, 0

    def _should_retry(self, error_str):
        """判断是否应该重试"""
        lost_keywords = ['lost connection', 'connection lost', 'connection refused',
                         'connection timeout', 'closed connection', 'connection reset']
        err_lower = error_str.lower()
        return any(kw in err_lower for kw in lost_keywords)

    def run(self):
        """执行SQL语句"""
        start_time = time.time()
        try:
            results = None
            affected_rows = 0

            try:
                results, affected_rows = self._execute_with_cursor(
                    self.db_connection, self.db_type)
            except Exception as e:
                if self._should_retry(str(e)):
                    results, affected_rows = self._try_reconnect_and_retry()
                    if results is None and affected_rows == 0:
                        raise
                else:
                    raise

            execution_time = time.time() - start_time

            self.signals.finished.emit({
                'results': results,
                'affected_rows': affected_rows,
                'execution_time': execution_time
            })

        except Exception as e:
            self.signals.error.emit(str(e))


class DatabaseOperations:
    """数据库操作类"""
    def __init__(self, db_connection, db_type):
        self.db_connection = db_connection
        self.db_type = db_type

    def execute_sql(self, sql):
        """执行SQL语句（返回worker对象）"""
        return SQLWorker(sql, self.db_connection, self.db_type, None)

    def get_tables(self, db_name=None):
        """获取数据库中的表列表"""
        tables = []
        
        if not self.db_connection:
            return tables
        
        try:
            if self.db_type == 'MySQL' or self.db_type == 'MariaDB':
                with self.db_connection.cursor() as cursor:
                    if db_name:
                        cursor.execute(f"USE `{db_name}`")
                    cursor.execute("SHOW TABLES")
                    results = cursor.fetchall()
                    tables = [list(r.values())[0] if isinstance(r, dict) else r[0] for r in results]
            
            elif self.db_type == 'PostgreSQL':
                with self.db_connection.cursor() as cursor:
                    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
                    results = cursor.fetchall()
                    tables = [r[0] for r in results]
            
            elif self.db_type == 'SQL Server':
                with self.db_connection.cursor() as cursor:
                    if db_name:
                        cursor.execute(f"USE [{db_name}]")
                    cursor.execute("SELECT name FROM sys.tables")
                    results = cursor.fetchall()
                    tables = [r[0] for r in results]
            
        except Exception as e:
            print(f"获取表列表失败: {e}")
        
        return tables

    def close(self):
        """关闭连接"""
        if hasattr(self, 'db_connection') and self.db_connection:
            try:
                self.db_connection.close()
            except Exception:
                pass

    def _execute_query(self, sql, params=None):
        """执行查询并返回结果列表"""
        if self.db_type in ('MySQL', 'MariaDB', 'PostgreSQL'):
            with self.db_connection.cursor() as cursor:
                cursor.execute(sql, params or ())
                return cursor.fetchall()
        else:
            cursor = self.db_connection.cursor()
            try:
                cursor.execute(sql, params or ())
                return cursor.fetchall()
            finally:
                cursor.close()

    def get_database_objects(self, current_db=None):
        """获取数据库对象（表名和列名）"""
        tables = []
        columns = []

        if not self.db_connection:
            return tables, columns

        try:
            if self.db_type == 'MySQL':
                with self.db_connection.cursor() as cursor:
                    if current_db:
                        try:
                            cursor.execute(f"USE {current_db}")
                        except Exception:
                            pass

                    cursor.execute("SHOW TABLES")
                    table_results = cursor.fetchall()

                    for table in table_results:
                        table_name = list(table.values())[0] if isinstance(table, dict) else table[0]
                        tables.append(table_name)

                        cursor.execute(f"DESCRIBE {table_name}")
                        column_results = cursor.fetchall()
                        for column in column_results:
                            column_name = column['Field'] if isinstance(column, dict) else column[0]
                            columns.append(f"{table_name}.{column_name}")

            elif self.db_type == 'PostgreSQL':
                results = self._execute_query(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
                for row in results:
                    table_name = row[0]
                    tables.append(table_name)
                    col_results = self._execute_query(
                        f"SELECT column_name FROM information_schema.columns "
                        f"WHERE table_schema = 'public' AND table_name = '{table_name}'")
                    for col in col_results:
                        columns.append(f"{table_name}.{col[0]}")

            elif self.db_type == 'SQLite':
                results = self._execute_query(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                for row in results:
                    table_name = row[0]
                    tables.append(table_name)
                    col_results = self._execute_query(f"PRAGMA table_info({table_name})")
                    for col in col_results:
                        columns.append(f"{table_name}.{col[1]}")

            elif self.db_type == 'SQL Server':
                results = self._execute_query("SELECT name FROM sys.tables")
                for row in results:
                    table_name = row[0]
                    tables.append(table_name)
                    col_results = self._execute_query(
                        f"SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('{table_name}')")
                    for col in col_results:
                        columns.append(f"{table_name}.{col[0]}")

        except Exception as e:
            print(f"获取数据库对象失败: {e}")

        return tables, columns

    def get_objects_by_type(self, object_type, database_name):
        """获取指定类型的数据库对象"""
        objects = []

        if not self.db_connection:
            return objects

        try:
            if self.db_type == 'MySQL':
                with self.db_connection.cursor() as cursor:
                    if object_type == 'tables':
                        cursor.execute("SHOW TABLES")
                        results = cursor.fetchall()
                        objects = [
                            list(r.values())[0] if isinstance(r, dict) else r[0]
                            for r in results
                        ]
                    elif object_type == 'views':
                        cursor.execute("SHOW FULL TABLES WHERE Table_type = 'VIEW'")
                        results = cursor.fetchall()
                        objects = [
                            list(r.values())[0] if isinstance(r, dict) else r[0]
                            for r in results
                        ]
                    elif object_type in ('procedures', 'functions'):
                        type_key = 'FUNCTION' if object_type == 'functions' else 'PROCEDURE'
                        cursor.execute(f"SHOW {type_key} STATUS WHERE Db = %s", (database_name,))
                        results = cursor.fetchall()
                        objects = [
                            r['Name'] if isinstance(r, dict) else r[1]
                            for r in results
                        ]
                    elif object_type == 'events':
                        cursor.execute("SHOW EVENTS WHERE Db = %s", (database_name,))
                        results = cursor.fetchall()
                        objects = [
                            r['Name'] if isinstance(r, dict) else r[1]
                            for r in results
                        ]

            elif self.db_type == 'PostgreSQL':
                with self.db_connection.cursor() as cursor:
                    if object_type == 'tables':
                        cursor.execute(
                            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
                        objects = [r[0] for r in cursor.fetchall()]
                    elif object_type == 'views':
                        cursor.execute(
                            "SELECT table_name FROM information_schema.views WHERE table_schema = 'public'")
                        objects = [r[0] for r in cursor.fetchall()]
                    elif object_type in ('procedures', 'functions'):
                        cursor.execute(
                            "SELECT proname FROM pg_proc WHERE pronamespace = "
                            "(SELECT oid FROM pg_namespace WHERE nspname = 'public')")
                        objects = [r[0] for r in cursor.fetchall()]

            elif self.db_type == 'SQL Server':
                cursor = self.db_connection.cursor()
                try:
                    if object_type == 'tables':
                        cursor.execute("SELECT name FROM sys.tables")
                        objects = [r[0] for r in cursor.fetchall()]
                    elif object_type == 'views':
                        cursor.execute("SELECT name FROM sys.views")
                        objects = [r[0] for r in cursor.fetchall()]
                    elif object_type == 'procedures':
                        cursor.execute("SELECT name FROM sys.procedures")
                        objects = [r[0] for r in cursor.fetchall()]
                    elif object_type == 'functions':
                        cursor.execute("SELECT name FROM sys.objects WHERE type IN ('FN', 'IF', 'TF')")
                        objects = [r[0] for r in cursor.fetchall()]
                finally:
                    cursor.close()

            elif self.db_type == 'SQLite':
                if object_type == 'tables':
                    results = self._execute_query(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                    objects = [r[0] for r in results]

        except Exception as e:
            print(f"获取{object_type}失败: {e}")

        return objects

    def get_tables_structure(self):
        """获取表结构"""
        tables = {}

        try:
            if self.db_type == 'MySQL':
                with self.db_connection.cursor() as cursor:
                    cursor.execute("SHOW TABLES")
                    for tr in cursor.fetchall():
                        table_name = list(tr.values())[0]
                        cursor.execute(f"DESCRIBE {table_name}")
                        tables[table_name] = [
                            (col['Field'], col['Type']) for col in cursor.fetchall()
                        ]

            elif self.db_type == 'PostgreSQL':
                results = self._execute_query(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
                for row in results:
                    table_name = row[0]
                    col_results = self._execute_query(
                        f"SELECT column_name, data_type FROM information_schema.columns "
                        f"WHERE table_name = '{table_name}'")
                    tables[table_name] = [(c[0], c[1]) for c in col_results]

            elif self.db_type == 'SQLite':
                results = self._execute_query(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                for row in results:
                    table_name = row[0]
                    col_results = self._execute_query(f"PRAGMA table_info({table_name})")
                    tables[table_name] = [(c[1], c[2]) for c in col_results]

        except Exception as e:
            print(f"获取表结构失败: {e}")

        return tables

    def get_execution_plan(self, sql):
        """获取SQL执行计划"""
        try:
            if self.db_type == 'MySQL':
                with self.db_connection.cursor() as cursor:
                    cursor.execute(f"EXPLAIN {sql}")
                    results = cursor.fetchall()
                    if results:
                        columns = list(results[0].keys())
                        plan = [columns]
                        for row in results:
                            plan.append(list(row.values()))
                        return plan

            elif self.db_type == 'PostgreSQL':
                with self.db_connection.cursor() as cursor:
                    cursor.execute(f"EXPLAIN {sql}")
                    results = cursor.fetchall()
                    if results:
                        plan = [['执行计划']]
                        for row in results:
                            plan.append([row[0]])
                        return plan

            elif self.db_type == 'SQL Server':
                cursor = self.db_connection.cursor()
                try:
                    cursor.execute(f"SET SHOWPLAN_TEXT ON; {sql}; SET SHOWPLAN_TEXT OFF")
                    results = cursor.fetchall()
                    if results:
                        plan = [['执行计划']]
                        for row in results:
                            plan.append([row[0]])
                        return plan
                finally:
                    cursor.close()

        except Exception as e:
            print(f"获取执行计划失败: {e}")

        return [['执行计划'], ['无法生成执行计划']]

    def get_table_info(self, table_name):
        """获取表的详细信息（字段、索引、外键、DDL等）"""
        info = {
            'created': '',
            'updated': '',
            'fields': [],
            'indexes': [],
            'foreign_keys': [],
            'ddl': ''
        }

        if not self.db_connection:
            return info

        try:
            if self.db_type == 'MySQL':
                with self.db_connection.cursor() as cursor:
                    cursor.execute(f"DESCRIBE `{table_name}`")
                    columns = cursor.fetchall()
                    for col in columns:
                        field_name = col['Field'] if isinstance(col, dict) else col[0]
                        col_type = col['Type'] if isinstance(col, dict) else col[1]
                        col_null = col['Null'] if isinstance(col, dict) else col[2]
                        col_key = col['Key'] if isinstance(col, dict) else col[3]
                        col_default = col['Default'] if isinstance(col, dict) else col[4]
                        col_extra = col['Extra'] if isinstance(col, dict) else col[5]

                        import re
                        type_match = re.match(r'(\w+)(?:\((\d+)\))?', col_type)
                        base_type = type_match.group(1) if type_match else col_type
                        length = type_match.group(2) if type_match and type_match.group(2) else ''

                        info['fields'].append({
                            'name': field_name,
                            'type': base_type,
                            'length': length,
                            'primary': col_key == 'PRI',
                            'not_null': col_null == 'NO',
                            'default': col_default,
                            'comment': ''
                        })

                    cursor.execute(f"SHOW TABLE STATUS LIKE '{table_name}'")
                    status = cursor.fetchone()
                    if status:
                        info['created'] = status['Create_time'] if isinstance(status, dict) else (status[11] if len(status) > 11 else '')
                        info['updated'] = status['Update_time'] if isinstance(status, dict) else (status[12] if len(status) > 12 else '')

                    cursor.execute(f"SHOW INDEX FROM `{table_name}`")
                    indexes_raw = cursor.fetchall()
                    seen_indexes = {}
                    for idx in indexes_raw:
                        idx_name = idx['Key_name'] if isinstance(idx, dict) else idx[2]
                        idx_col = idx['Column_name'] if isinstance(idx, dict) else idx[4]
                        non_unique = idx['Non_unique'] if isinstance(idx, dict) else idx[1]
                        idx_type = idx['Index_type'] if isinstance(idx, dict) else ''

                        if idx_name not in seen_indexes:
                            seen_indexes[idx_name] = {
                                'name': idx_name,
                                'type': idx_type,
                                'fields': '',
                                'unique': non_unique == 0
                            }
                        if seen_indexes[idx_name]['fields']:
                            seen_indexes[idx_name]['fields'] += ', '
                        seen_indexes[idx_name]['fields'] += idx_col

                    info['indexes'] = list(seen_indexes.values())

                    cursor.execute(f"""
                        SELECT k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME
                        FROM information_schema.KEY_COLUMN_USAGE k
                        WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = %s
                        AND k.REFERENCED_TABLE_NAME IS NOT NULL
                    """, (table_name,))
                    fks = cursor.fetchall()
                    seen_fks = {}
                    for fk in fks:
                        fk_name = fk['CONSTRAINT_NAME'] if isinstance(fk, dict) else fk[0]
                        fk_col = fk['COLUMN_NAME'] if isinstance(fk, dict) else fk[1]
                        ref_table = fk['REFERENCED_TABLE_NAME'] if isinstance(fk, dict) else fk[2]
                        ref_col = fk['REFERENCED_COLUMN_NAME'] if isinstance(fk, dict) else fk[3]

                        if fk_name not in seen_fks:
                            seen_fks[fk_name] = {
                                'name': fk_name,
                                'fields': '',
                                'ref_table': ref_table,
                                'ref_fields': ''
                            }
                        if seen_fks[fk_name]['fields']:
                            seen_fks[fk_name]['fields'] += ', '
                        seen_fks[fk_name]['fields'] += fk_col
                        if seen_fks[fk_name]['ref_fields']:
                            seen_fks[fk_name]['ref_fields'] += ', '
                        seen_fks[fk_name]['ref_fields'] += ref_col

                    info['foreign_keys'] = list(seen_fks.values())

                    cursor.execute(f"SHOW CREATE TABLE `{table_name}`")
                    ddl_result = cursor.fetchone()
                    if ddl_result:
                        info['ddl'] = ddl_result['Create Table'] if isinstance(ddl_result, dict) else ddl_result[1]

            elif self.db_type == 'PostgreSQL':
                with self.db_connection.cursor() as cursor:
                    cursor.execute(f"""
                        SELECT column_name, data_type, character_maximum_length,
                               is_nullable, column_default
                        FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = %s
                        ORDER BY ordinal_position
                    """, (table_name,))
                    columns = cursor.fetchall()
                    for col in columns:
                        info['fields'].append({
                            'name': col[0],
                            'type': col[1],
                            'length': str(col[2]) if col[2] else '',
                            'primary': False,
                            'not_null': col[3] == 'NO',
                            'default': col[4] if col[4] else '',
                            'comment': ''
                        })

                    cursor.execute(f"SHOW CREATE TABLE \"{table_name}\"")
                    ddl_result = cursor.fetchone()
                    if ddl_result:
                        info['ddl'] = ddl_result[1] if len(ddl_result) > 1 else ddl_result[0]

        except Exception as e:
            print(f"获取表信息失败: {e}")

        return info
