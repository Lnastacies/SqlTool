#!/usr/bin/env python3
"""
数据库适配器接口模块
"""

from abc import ABC, abstractmethod


class DatabaseAdapter(ABC):
    """数据库适配器接口"""

    @abstractmethod
    def get_connection_params(self, conn_data):
        """获取连接参数"""
        pass

    @abstractmethod
    def test_connection(self, conn):
        """测试连接是否有效"""
        pass

    @abstractmethod
    def get_databases(self, cursor):
        """获取数据库列表"""
        pass

    @abstractmethod
    def get_tables(self, cursor, database):
        """获取表列表"""
        pass

    @abstractmethod
    def get_views(self, cursor, database):
        """获取视图列表"""
        pass

    @abstractmethod
    def get_procedures(self, cursor, database):
        """获取存储过程列表"""
        pass

    @abstractmethod
    def get_functions(self, cursor, database):
        """获取函数列表"""
        pass

    @abstractmethod
    def get_triggers(self, cursor, database):
        """获取触发器列表"""
        pass

    @abstractmethod
    def get_events(self, cursor, database):
        """获取事件列表"""
        pass

    @abstractmethod
    def get_table_metadata(self, cursor, table_name):
        """获取表元数据"""
        pass

    @abstractmethod
    def get_explain_sql(self, sql):
        """获取EXPLAIN SQL语句"""
        pass


class MySQLAdapter(DatabaseAdapter):
    """MySQL数据库适配器"""

    def get_connection_params(self, conn_data):
        params = {
            'host': conn_data['host'],
            'port': conn_data['port'],
            'user': conn_data['username'],
            'password': conn_data['password'],
            'database': conn_data['database'] if conn_data['database'] else None,
            'cursorclass': None,
            'autocommit': False,
            'connect_timeout': conn_data.get('timeout', 30),
            'read_timeout': 60,
            'write_timeout': 60,
            'charset': conn_data.get('charset', 'utf8mb4'),
        }
        return params

    def test_connection(self, conn):
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            return True
        except Exception:
            return False

    def get_databases(self, cursor):
        cursor.execute("SHOW DATABASES")
        databases = cursor.fetchall()
        return [db['Database'] if isinstance(db, dict) else db[0] for db in databases]

    def get_tables(self, cursor, database):
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        return [table[f'Tables_in_{database}'] if isinstance(table, dict) else table[0] for table in tables]

    def get_views(self, cursor, database):
        cursor.execute("SHOW FULL TABLES WHERE Table_type = 'VIEW'")
        views = cursor.fetchall()
        return [view[f'Tables_in_{database}'] if isinstance(view, dict) else view[0] for view in views]

    def get_procedures(self, cursor, database):
        cursor.execute("SHOW PROCEDURE STATUS WHERE Db = %s", (database,))
        procedures = cursor.fetchall()
        return [proc['Name'] if isinstance(proc, dict) else proc[1] for proc in procedures]

    def get_functions(self, cursor, database):
        cursor.execute("SHOW FUNCTION STATUS WHERE Db = %s", (database,))
        functions = cursor.fetchall()
        return [func['Name'] if isinstance(func, dict) else func[1] for func in functions]

    def get_triggers(self, cursor, database):
        cursor.execute("SHOW TRIGGERS")
        triggers = cursor.fetchall()
        return [trigger['Trigger'] if isinstance(trigger, dict) else trigger[0] for trigger in triggers]

    def get_events(self, cursor, database):
        cursor.execute("SHOW EVENTS WHERE Db = %s", (database,))
        events = cursor.fetchall()
        return [event['Name'] if isinstance(event, dict) else event[1] for event in events]

    def get_table_metadata(self, cursor, table_name):
        metadata = {
            'fields': [],
            'indexes': [],
            'foreign_keys': [],
            'ddl': ''
        }

        cursor.execute(f"DESCRIBE `{table_name}`")
        fields = cursor.fetchall()
        for field in fields:
            field_info = {
                'name': field['Field'] if isinstance(field, dict) else field[0],
                'type': field['Type'] if isinstance(field, dict) else field[1],
                'not_null': (field['Null'] if isinstance(field, dict) else field[2]) == 'NO',
                'default': field['Default'] if isinstance(field, dict) else field[4],
                'primary': (field['Key'] if isinstance(field, dict) else field[3]) == 'PRI',
                'comment': field.get('Comment', '') if isinstance(field, dict) else ''
            }
            metadata['fields'].append(field_info)

        cursor.execute(f"SHOW INDEX FROM `{table_name}`")
        indexes = cursor.fetchall()
        index_dict = {}
        for index in indexes:
            index_name = index['Key_name'] if isinstance(index, dict) else index[2]
            if index_name not in index_dict:
                index_dict[index_name] = {
                    'name': index_name,
                    'type': 'BTREE',
                    'fields': [],
                    'unique': (index['Non_unique'] if isinstance(index, dict) else index[1]) == 0
                }
            column_name = index['Column_name'] if isinstance(index, dict) else index[4]
            index_dict[index_name]['fields'].append(column_name)
        metadata['indexes'] = list(index_dict.values())

        cursor.execute(f"SHOW CREATE TABLE `{table_name}`")
        create_table = cursor.fetchone()
        if create_table:
            metadata['ddl'] = create_table[1] if len(create_table) > 1 else ''

        import re
        foreign_keys = re.findall(
            r'CONSTRAINT `(.*?)` FOREIGN KEY `(.*?)` REFERENCES `(.*?)` \(`(.*?)`\)',
            metadata['ddl']
        )
        for fk in foreign_keys:
            foreign_key_info = {
                'name': fk[0],
                'fields': [fk[1]],
                'referenced_table': fk[2],
                'referenced_fields': [fk[3]]
            }
            metadata['foreign_keys'].append(foreign_key_info)

        return metadata

    def get_explain_sql(self, sql):
        return f"EXPLAIN {sql}"


class PostgreSQLAdapter(DatabaseAdapter):
    """PostgreSQL数据库适配器"""

    def get_connection_params(self, conn_data):
        params = {
            'host': conn_data['host'],
            'port': conn_data['port'],
            'user': conn_data['username'],
            'password': conn_data['password'],
            'dbname': conn_data['database'] if conn_data['database'] else 'postgres',
            'connect_timeout': conn_data.get('timeout', 30)
        }
        return params

    def test_connection(self, conn):
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            return True
        except Exception:
            return False

    def get_databases(self, cursor):
        cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
        databases = cursor.fetchall()
        return [db[0] for db in databases]

    def get_tables(self, cursor, database):
        cursor.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        """)
        tables = cursor.fetchall()
        return [table[0] for table in tables]

    def get_views(self, cursor, database):
        cursor.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'VIEW'
        """)
        views = cursor.fetchall()
        return [view[0] for view in views]

    def get_procedures(self, cursor, database):
        cursor.execute("""
            SELECT proname FROM pg_proc 
            WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') 
            AND prokind = 'p'
        """)
        procedures = cursor.fetchall()
        return [proc[0] for proc in procedures]

    def get_functions(self, cursor, database):
        cursor.execute("""
            SELECT proname FROM pg_proc 
            WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') 
            AND prokind = 'f'
        """)
        functions = cursor.fetchall()
        return [func[0] for func in functions]

    def get_triggers(self, cursor, database):
        cursor.execute("SELECT tgname FROM pg_trigger WHERE tgisinternal = false")
        triggers = cursor.fetchall()
        return [trigger[0] for trigger in triggers]

    def get_events(self, cursor, database):
        return []

    def get_table_metadata(self, cursor, table_name):
        metadata = {
            'fields': [],
            'indexes': [],
            'foreign_keys': [],
            'ddl': ''
        }

        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default, column_comment
            FROM information_schema.columns
            WHERE table_name = %s AND table_schema = 'public'
            ORDER BY ordinal_position
        """, (table_name,))
        fields = cursor.fetchall()

        cursor.execute("""
            SELECT column_name
            FROM information_schema.key_column_usage
            WHERE table_name = %s AND table_schema = 'public' AND constraint_name LIKE '%_pkey'
        """, (table_name,))
        primary_keys = [pk[0] for pk in cursor.fetchall()]

        for field in fields:
            field_info = {
                'name': field[0],
                'type': field[1],
                'not_null': field[2] == 'NO',
                'default': field[3],
                'primary': field[0] in primary_keys,
                'comment': field[4]
            }
            metadata['fields'].append(field_info)

        cursor.execute("""
            SELECT i.relname, a.attname, ix.indisunique
            FROM pg_class t
            JOIN pg_index ix ON t.oid = ix.indrelid
            JOIN pg_class i ON ix.indexrelid = i.oid
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
            WHERE t.relname = %s AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        """, (table_name,))
        indexes = cursor.fetchall()
        index_dict = {}
        for index in indexes:
            index_name = index[0]
            if index_name not in index_dict:
                index_dict[index_name] = {
                    'name': index_name,
                    'type': 'BTREE',
                    'fields': [],
                    'unique': index[2]
                }
            index_dict[index_name]['fields'].append(index[1])
        metadata['indexes'] = list(index_dict.values())

        cursor.execute("""
            SELECT conname, a.attname, confrelid::regclass, af.attname
            FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY(c.confkey)
            WHERE c.conrelid = %s::regclass AND c.contype = 'f'
        """, (table_name,))
        foreign_keys = cursor.fetchall()
        fk_dict = {}
        for fk in foreign_keys:
            fk_name = fk[0]
            if fk_name not in fk_dict:
                fk_dict[fk_name] = {
                    'name': fk_name,
                    'fields': [],
                    'referenced_table': str(fk[2]),
                    'referenced_fields': []
                }
            fk_dict[fk_name]['fields'].append(fk[1])
            fk_dict[fk_name]['referenced_fields'].append(fk[3])
        metadata['foreign_keys'] = list(fk_dict.values())

        return metadata

    def get_explain_sql(self, sql):
        return f"EXPLAIN ANALYZE {sql}"


class SQLServerAdapter(DatabaseAdapter):
    """SQL Server数据库适配器"""

    def get_connection_params(self, conn_data):
        database = conn_data['database'] if conn_data['database'] else 'master'
        conn_str = (
            f"DRIVER={{SQL Server}};SERVER={conn_data['host']},{conn_data['port']};"
            f"DATABASE={database};"
            f"UID={conn_data['username']};PWD={conn_data['password']};"
            f"Connect Timeout={conn_data.get('timeout', 30)}"
        )
        return conn_str

    def test_connection(self, conn):
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            return True
        except Exception:
            return False

    def get_databases(self, cursor):
        cursor.execute("SELECT name FROM sys.databases")
        databases = cursor.fetchall()
        return [db[0] for db in databases]

    def get_tables(self, cursor, database):
        cursor.execute("SELECT name FROM sys.tables")
        tables = cursor.fetchall()
        return [table[0] for table in tables]

    def get_views(self, cursor, database):
        cursor.execute("SELECT name FROM sys.views")
        views = cursor.fetchall()
        return [view[0] for view in views]

    def get_procedures(self, cursor, database):
        cursor.execute("SELECT name FROM sys.procedures")
        procedures = cursor.fetchall()
        return [proc[0] for proc in procedures]

    def get_functions(self, cursor, database):
        cursor.execute("SELECT name FROM sys.objects WHERE type IN ('FN', 'IF', 'TF')")
        functions = cursor.fetchall()
        return [func[0] for func in functions]

    def get_triggers(self, cursor, database):
        cursor.execute("SELECT name FROM sys.triggers")
        triggers = cursor.fetchall()
        return [trigger[0] for trigger in triggers]

    def get_events(self, cursor, database):
        return []

    def get_table_metadata(self, cursor, table_name):
        metadata = {
            'fields': [],
            'indexes': [],
            'foreign_keys': [],
            'ddl': ''
        }

        cursor.execute("""
            SELECT c.name, t.name, c.is_nullable, c.default_object_id, ep.value
            FROM sys.columns c
            JOIN sys.types t ON c.user_type_id = t.user_type_id
            LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
            WHERE c.object_id = OBJECT_ID(%s)
            ORDER BY c.column_id
        """, (table_name,))
        fields = cursor.fetchall()

        cursor.execute("""
            SELECT col.name
            FROM sys.columns col
            JOIN sys.indexes idx ON col.object_id = idx.object_id
            JOIN sys.index_columns ic ON ic.object_id = idx.object_id AND ic.column_id = col.column_id
            WHERE idx.is_primary_key = 1 AND col.object_id = OBJECT_ID(%s)
        """, (table_name,))
        primary_keys = [pk[0] for pk in cursor.fetchall()]

        for field in fields:
            field_info = {
                'name': field[0],
                'type': field[1],
                'not_null': not field[2],
                'default': field[3],
                'primary': field[0] in primary_keys,
                'comment': field[4]
            }
            metadata['fields'].append(field_info)

        cursor.execute("""
            SELECT i.name, c.name, i.is_unique
            FROM sys.indexes i
            JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            WHERE i.object_id = OBJECT_ID(%s)
        """, (table_name,))
        indexes = cursor.fetchall()
        index_dict = {}
        for index in indexes:
            index_name = index[0]
            if index_name not in index_dict:
                index_dict[index_name] = {
                    'name': index_name,
                    'type': 'BTREE',
                    'fields': [],
                    'unique': index[2]
                }
            index_dict[index_name]['fields'].append(index[1])
        metadata['indexes'] = list(index_dict.values())

        cursor.execute("""
            SELECT fk.name, col.name, OBJECT_NAME(fk.referenced_object_id), ref_col.name
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            JOIN sys.columns col ON fkc.parent_object_id = col.object_id AND fkc.parent_column_id = col.column_id
            JOIN sys.columns ref_col ON fkc.referenced_object_id = ref_col.object_id AND fkc.referenced_column_id = ref_col.column_id
            WHERE fk.parent_object_id = OBJECT_ID(%s)
        """, (table_name,))
        foreign_keys = cursor.fetchall()
        fk_dict = {}
        for fk in foreign_keys:
            fk_name = fk[0]
            if fk_name not in fk_dict:
                fk_dict[fk_name] = {
                    'name': fk_name,
                    'fields': [],
                    'referenced_table': fk[2],
                    'referenced_fields': []
                }
            fk_dict[fk_name]['fields'].append(fk[1])
            fk_dict[fk_name]['referenced_fields'].append(fk[3])
        metadata['foreign_keys'] = list(fk_dict.values())

        return metadata

    def get_explain_sql(self, sql):
        return None


class SQLiteAdapter(DatabaseAdapter):
    """SQLite数据库适配器"""

    def get_connection_params(self, conn_data):
        return conn_data['database'] if conn_data['database'] else ':memory:'

    def test_connection(self, conn):
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            return True
        except Exception:
            return False

    def get_databases(self, cursor):
        return ['main']

    def get_tables(self, cursor, database):
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        tables = cursor.fetchall()
        return [table[0] for table in tables]

    def get_views(self, cursor, database):
        cursor.execute("SELECT name FROM sqlite_master WHERE type='view'")
        views = cursor.fetchall()
        return [view[0] for view in views]

    def get_procedures(self, cursor, database):
        return []

    def get_functions(self, cursor, database):
        return []

    def get_triggers(self, cursor, database):
        cursor.execute("SELECT name FROM sqlite_master WHERE type='trigger'")
        triggers = cursor.fetchall()
        return [trigger[0] for trigger in triggers]

    def get_events(self, cursor, database):
        return []

    def get_table_metadata(self, cursor, table_name):
        metadata = {
            'fields': [],
            'indexes': [],
            'foreign_keys': [],
            'ddl': ''
        }

        cursor.execute(f"PRAGMA table_info(`{table_name}`)")
        fields = cursor.fetchall()
        for field in fields:
            field_info = {
                'name': field[1],
                'type': field[2],
                'not_null': field[3],
                'default': field[4],
                'primary': field[5],
                'comment': ''
            }
            metadata['fields'].append(field_info)

        cursor.execute(f"PRAGMA index_list(`{table_name}`)")
        indexes = cursor.fetchall()
        for index in indexes:
            index_name = index[1]
            cursor.execute(f"PRAGMA index_info(`{index_name}`)")
            index_columns = cursor.fetchall()
            index_fields = [col[2] for col in index_columns]
            index_info = {
                'name': index_name,
                'type': 'BTREE',
                'fields': index_fields,
                'unique': index[2]
            }
            metadata['indexes'].append(index_info)

        cursor.execute(f"PRAGMA foreign_key_list(`{table_name}`)")
        foreign_keys = cursor.fetchall()
        fk_dict = {}
        for fk in foreign_keys:
            fk_name = f"fk_{table_name}_{fk[3]}"
            if fk_name not in fk_dict:
                fk_dict[fk_name] = {
                    'name': fk_name,
                    'fields': [],
                    'referenced_table': fk[2],
                    'referenced_fields': []
                }
            fk_dict[fk_name]['fields'].append(fk[3])
            fk_dict[fk_name]['referenced_fields'].append(fk[4])
        metadata['foreign_keys'] = list(fk_dict.values())

        cursor.execute(f"SELECT sql FROM sqlite_master WHERE name = '{table_name}' AND type = 'table'")
        ddl = cursor.fetchone()
        metadata['ddl'] = ddl[0] if ddl else ''

        return metadata

    def get_explain_sql(self, sql):
        return f"EXPLAIN QUERY PLAN {sql}"