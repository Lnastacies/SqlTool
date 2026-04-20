#!/usr/bin/env python3
"""
元数据获取器
"""

class MetadataFetcher:
    """元数据获取器"""
    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
    
    def get_database_objects(self, connection, db_type, database):
        """获取数据库对象"""
        objects = {
            'tables': [],
            'views': [],
            'procedures': [],
            'functions': [],
            'triggers': [],
            'events': []
        }
        
        try:
            cursor = connection.cursor()
            
            if db_type == 'MySQL':
                # 获取表
                cursor.execute("SHOW TABLES")
                tables = cursor.fetchall()
                objects['tables'] = [table[0] for table in tables]
                
                # 获取视图
                cursor.execute("SHOW FULL TABLES WHERE Table_type = 'VIEW'")
                views = cursor.fetchall()
                objects['views'] = [view[0] for view in views]
                
                # 获取存储过程
                cursor.execute("SHOW PROCEDURE STATUS WHERE Db = %s", (database,))
                procedures = cursor.fetchall()
                objects['procedures'] = [proc[1] for proc in procedures]
                
                # 获取函数
                cursor.execute("SHOW FUNCTION STATUS WHERE Db = %s", (database,))
                functions = cursor.fetchall()
                objects['functions'] = [func[1] for func in functions]
                
                # 获取触发器
                cursor.execute("SHOW TRIGGERS")
                triggers = cursor.fetchall()
                objects['triggers'] = [trigger[0] for trigger in triggers]
                
                # 获取事件
                cursor.execute("SHOW EVENTS")
                events = cursor.fetchall()
                objects['events'] = [event[1] for event in events]
            
            elif db_type == 'PostgreSQL':
                # 获取表
                cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
                tables = cursor.fetchall()
                objects['tables'] = [table[0] for table in tables]
                
                # 获取视图
                cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'VIEW'")
                views = cursor.fetchall()
                objects['views'] = [view[0] for view in views]
                
                # 获取存储过程
                cursor.execute("SELECT proname FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND prokind = 'p'")
                procedures = cursor.fetchall()
                objects['procedures'] = [proc[0] for proc in procedures]
                
                # 获取函数
                cursor.execute("SELECT proname FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND prokind = 'f'")
                functions = cursor.fetchall()
                objects['functions'] = [func[0] for func in functions]
                
                # 获取触发器
                cursor.execute("SELECT tgname FROM pg_trigger WHERE tgisinternal = false")
                triggers = cursor.fetchall()
                objects['triggers'] = [trigger[0] for trigger in triggers]
            
            elif db_type == 'SQL Server':
                # 获取表
                cursor.execute("SELECT name FROM sys.tables")
                tables = cursor.fetchall()
                objects['tables'] = [table[0] for table in tables]
                
                # 获取视图
                cursor.execute("SELECT name FROM sys.views")
                views = cursor.fetchall()
                objects['views'] = [view[0] for view in views]
                
                # 获取存储过程
                cursor.execute("SELECT name FROM sys.procedures")
                procedures = cursor.fetchall()
                objects['procedures'] = [proc[0] for proc in procedures]
                
                # 获取函数
                cursor.execute("SELECT name FROM sys.objects WHERE type IN ('FN', 'IF', 'TF')")
                functions = cursor.fetchall()
                objects['functions'] = [func[0] for func in functions]
                
                # 获取触发器
                cursor.execute("SELECT name FROM sys.triggers")
                triggers = cursor.fetchall()
                objects['triggers'] = [trigger[0] for trigger in triggers]
            
            elif db_type == 'SQLite':
                # 获取表
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                tables = cursor.fetchall()
                objects['tables'] = [table[0] for table in tables]
                
                # 获取视图
                cursor.execute("SELECT name FROM sqlite_master WHERE type='view'")
                views = cursor.fetchall()
                objects['views'] = [view[0] for view in views]
            
            cursor.close()
        
        except Exception as e:
            self.logger.log('ERROR', f"获取数据库对象失败: {str(e)}")
        
        return objects
    
    def get_table_metadata(self, connection, db_type, database, table_name):
        """获取表的元数据"""
        metadata = {
            'fields': [],
            'indexes': [],
            'foreign_keys': [],
            'ddl': ''
        }
        
        try:
            cursor = connection.cursor()
            
            if db_type == 'MySQL':
                # 获取字段信息
                cursor.execute(f"DESCRIBE {table_name}")
                fields = cursor.fetchall()
                for field in fields:
                    field_info = {
                        'name': field[0],
                        'type': field[1],
                        'not_null': field[2] == 'NO',
                        'default': field[4],
                        'primary': field[3] == 'PRI',
                        'comment': ''
                    }
                    metadata['fields'].append(field_info)
                
                # 获取索引信息
                cursor.execute(f"SHOW INDEX FROM {table_name}")
                indexes = cursor.fetchall()
                index_dict = {}
                for index in indexes:
                    index_name = index[2]
                    if index_name not in index_dict:
                        index_dict[index_name] = {
                            'name': index_name,
                            'type': 'BTREE',  # MySQL默认索引类型
                            'fields': [],
                            'unique': index[1] == 0
                        }
                    index_dict[index_name]['fields'].append(index[4])
                metadata['indexes'] = list(index_dict.values())
                
                # 获取外键信息
                cursor.execute(f"SHOW CREATE TABLE {table_name}")
                create_table = cursor.fetchone()[1]
                metadata['ddl'] = create_table
                
                # 解析外键
                import re
                foreign_keys = re.findall(r'CONSTRAINT `(.*?)` FOREIGN KEY `(.*?)` REFERENCES `(.*?)` \(`(.*?)`\)', create_table)
                for fk in foreign_keys:
                    foreign_key_info = {
                        'name': fk[0],
                        'fields': [fk[1]],
                        'referenced_table': fk[2],
                        'referenced_fields': [fk[3]]
                    }
                    metadata['foreign_keys'].append(foreign_key_info)
            
            elif db_type == 'PostgreSQL':
                # 获取字段信息
                cursor.execute("""
                    SELECT column_name, data_type, is_nullable, column_default, column_comment
                    FROM information_schema.columns
                    WHERE table_name = %s AND table_schema = 'public'
                    ORDER BY ordinal_position
                """, (table_name,))
                fields = cursor.fetchall()
                
                # 获取主键信息
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
                
                # 获取索引信息
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
                            'type': 'BTREE',  # PostgreSQL默认索引类型
                            'fields': [],
                            'unique': index[2]
                        }
                    index_dict[index_name]['fields'].append(index[1])
                metadata['indexes'] = list(index_dict.values())
                
                # 获取外键信息
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
                
                # 获取DDL
                cursor.execute(f"\dt+ {table_name}")
                ddl = cursor.fetchone()
                metadata['ddl'] = str(ddl)
            
            elif db_type == 'SQL Server':
                # 获取字段信息
                cursor.execute("""
                    SELECT c.name, t.name, c.is_nullable, c.default_object_id, ep.value
                    FROM sys.columns c
                    JOIN sys.types t ON c.user_type_id = t.user_type_id
                    LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
                    WHERE c.object_id = OBJECT_ID(%s)
                    ORDER BY c.column_id
                """, (table_name,))
                fields = cursor.fetchall()
                
                # 获取主键信息
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
                
                # 获取索引信息
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
                            'type': 'BTREE',  # SQL Server默认索引类型
                            'fields': [],
                            'unique': index[2]
                        }
                    index_dict[index_name]['fields'].append(index[1])
                metadata['indexes'] = list(index_dict.values())
                
                # 获取外键信息
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
                
                # 获取DDL
                cursor.execute(f"EXEC sp_help '{table_name}'")
                ddl = cursor.fetchall()
                metadata['ddl'] = str(ddl)
            
            elif db_type == 'SQLite':
                # 获取字段信息
                cursor.execute(f"PRAGMA table_info({table_name})")
                fields = cursor.fetchall()
                for field in fields:
                    field_info = {
                        'name': field[1],
                        'type': field[2],
                        'not_null': field[3],
                        'default': field[4],
                        'primary': field[5]
                    }
                    metadata['fields'].append(field_info)
                
                # 获取索引信息
                cursor.execute(f"PRAGMA index_list({table_name})")
                indexes = cursor.fetchall()
                for index in indexes:
                    index_name = index[1]
                    cursor.execute(f"PRAGMA index_info({index_name})")
                    index_columns = cursor.fetchall()
                    fields = [col[2] for col in index_columns]
                    index_info = {
                        'name': index_name,
                        'type': 'BTREE',  # SQLite默认索引类型
                        'fields': fields,
                        'unique': index[2]
                    }
                    metadata['indexes'].append(index_info)
                
                # 获取外键信息
                cursor.execute(f"PRAGMA foreign_key_list({table_name})")
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
                
                # 获取DDL
                cursor.execute(f"SELECT sql FROM sqlite_master WHERE name = '{table_name}' AND type = 'table'")
                ddl = cursor.fetchone()
                metadata['ddl'] = ddl[0] if ddl else ''
            
            cursor.close()
        
        except Exception as e:
            self.logger.log('ERROR', f"获取表元数据失败: {str(e)}")
        
        return metadata
