#!/usr/bin/env python3
"""
同步引擎
"""

class SyncEngine:
    """同步引擎"""
    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
        self.metadata_fetcher = None
    
    def set_metadata_fetcher(self, metadata_fetcher):
        """设置元数据获取器"""
        self.metadata_fetcher = metadata_fetcher
    
    def compare_structures(self, source_conn, source_db_type, source_db, target_conn, target_db_type, target_db):
        """比较两个数据库的结构差异"""
        if not self.metadata_fetcher:
            return "元数据获取器未初始化", False
        
        try:
            # 获取源数据库对象
            source_objects = self.metadata_fetcher.get_database_objects(source_conn, source_db_type, source_db)
            # 获取目标数据库对象
            target_objects = self.metadata_fetcher.get_database_objects(target_conn, target_db_type, target_db)
            
            # 比较表结构
            diffs = {
                'add_tables': [],  # 需要添加的表
                'drop_tables': [],  # 需要删除的表
                'alter_tables': []   # 需要修改的表
            }
            
            # 检查需要添加的表
            for table in source_objects['tables']:
                if table not in target_objects['tables']:
                    # 获取表结构
                    table_metadata = self.metadata_fetcher.get_table_metadata(source_conn, source_db_type, source_db, table)
                    diffs['add_tables'].append((table, table_metadata))
            
            # 检查需要删除的表
            for table in target_objects['tables']:
                if table not in source_objects['tables']:
                    diffs['drop_tables'].append(table)
            
            # 检查需要修改的表
            for table in source_objects['tables']:
                if table in target_objects['tables']:
                    source_metadata = self.metadata_fetcher.get_table_metadata(source_conn, source_db_type, source_db, table)
                    target_metadata = self.metadata_fetcher.get_table_metadata(target_conn, target_db_type, target_db, table)
                    
                    # 比较字段
                    source_fields = {f['name']: f for f in source_metadata['fields']}
                    target_fields = {f['name']: f for f in target_metadata['fields']}
                    
                    add_fields = []
                    drop_fields = []
                    alter_fields = []
                    
                    # 需要添加的字段
                    for field_name, field in source_fields.items():
                        if field_name not in target_fields:
                            add_fields.append(field)
                    
                    # 需要删除的字段
                    for field_name, field in target_fields.items():
                        if field_name not in source_fields:
                            drop_fields.append(field_name)
                    
                    # 需要修改的字段
                    for field_name, source_field in source_fields.items():
                        if field_name in target_fields:
                            target_field = target_fields[field_name]
                            if source_field['type'] != target_field['type'] or \
                               source_field['not_null'] != target_field['not_null'] or \
                               source_field['default'] != target_field['default']:
                                alter_fields.append((source_field, target_field))
                    
                    if add_fields or drop_fields or alter_fields:
                        diffs['alter_tables'].append((table, add_fields, drop_fields, alter_fields))
            
            return diffs, True
        
        except Exception as e:
            return f"比较结构失败: {str(e)}", False
    
    def generate_sync_sql(self, diffs, target_db_type):
        """生成同步SQL语句"""
        sql_statements = []
        
        try:
            # 生成添加表的SQL
            for table_name, table_metadata in diffs.get('add_tables', []):
                if target_db_type == 'MySQL':
                    # 使用DDL直接创建表
                    sql_statements.append(table_metadata['ddl'])
                else:
                    # 对于其他数据库类型，需要生成相应的CREATE TABLE语句
                    # 这里简化处理，实际需要根据不同数据库类型生成不同的SQL
                    pass
            
            # 生成删除表的SQL
            for table_name in diffs.get('drop_tables', []):
                sql_statements.append(f"DROP TABLE IF EXISTS {table_name};")
            
            # 生成修改表的SQL
            for table_name, add_fields, drop_fields, alter_fields in diffs.get('alter_tables', []):
                # 添加字段
                for field in add_fields:
                    field_sql = f"ALTER TABLE {table_name} ADD COLUMN {field['name']} {field['type']}"
                    if field['not_null']:
                        field_sql += " NOT NULL"
                    if field['default'] is not None:
                        field_sql += f" DEFAULT {field['default']}"
                    if field.get('comment'):
                        field_sql += f" COMMENT '{field['comment']}'"
                    field_sql += ";"
                    sql_statements.append(field_sql)
                
                # 删除字段
                for field_name in drop_fields:
                    sql_statements.append(f"ALTER TABLE {table_name} DROP COLUMN {field_name};")
                
                # 修改字段
                for source_field, target_field in alter_fields:
                    field_sql = f"ALTER TABLE {table_name} MODIFY COLUMN {source_field['name']} {source_field['type']}"
                    if source_field['not_null']:
                        field_sql += " NOT NULL"
                    if source_field['default'] is not None:
                        field_sql += f" DEFAULT {source_field['default']}"
                    if source_field.get('comment'):
                        field_sql += f" COMMENT '{source_field['comment']}'"
                    field_sql += ";"
                    sql_statements.append(field_sql)
            
            return '\n'.join(sql_statements), True
        
        except Exception as e:
            return f"生成同步SQL失败: {str(e)}", False
    
    def compare_data(self, source_conn, source_db_type, source_db, source_table, target_conn, target_db_type, target_db, target_table):
        """比较两个表的数据差异"""
        try:
            # 获取源表数据
            source_cursor = source_conn.cursor()
            source_cursor.execute(f"SELECT * FROM {source_table}")
            source_columns = [desc[0] for desc in source_cursor.description]
            source_rows = source_cursor.fetchall()
            source_data = {tuple(row[:1]): row for row in source_rows}  # 假设第一列是主键
            source_cursor.close()
            
            # 获取目标表数据
            target_cursor = target_conn.cursor()
            target_cursor.execute(f"SELECT * FROM {target_table}")
            target_columns = [desc[0] for desc in target_cursor.description]
            target_rows = target_cursor.fetchall()
            target_data = {tuple(row[:1]): row for row in target_rows}  # 假设第一列是主键
            target_cursor.close()
            
            # 比较数据
            diffs = {
                'insert': [],  # 需要插入的数据
                'update': [],  # 需要更新的数据
                'delete': []   # 需要删除的数据
            }
            
            # 需要插入的数据
            for primary_key, row in source_data.items():
                if primary_key not in target_data:
                    diffs['insert'].append(row)
            
            # 需要更新的数据
            for primary_key, source_row in source_data.items():
                if primary_key in target_data:
                    target_row = target_data[primary_key]
                    if source_row != target_row:
                        diffs['update'].append((primary_key, source_row, target_row))
            
            # 需要删除的数据
            for primary_key, row in target_data.items():
                if primary_key not in source_data:
                    diffs['delete'].append(primary_key)
            
            return diffs, True
        
        except Exception as e:
            return f"比较数据失败: {str(e)}", False
    
    def generate_data_sync_sql(self, diffs, target_db_type, target_table, columns):
        """生成数据同步SQL语句"""
        sql_statements = []
        
        try:
            # 生成插入语句
            for row in diffs.get('insert', []):
                values = []
                for val in row:
                    if val is None:
                        values.append('NULL')
                    elif isinstance(val, str):
                        values.append(f"'{val.replace("'", "''")}'")
                    else:
                        values.append(str(val))
                insert_sql = f"INSERT INTO {target_table} ({', '.join(columns)}) VALUES ({', '.join(values)});"
                sql_statements.append(insert_sql)
            
            # 生成更新语句
            for primary_key, source_row, target_row in diffs.get('update', []):
                set_clause = []
                for i, (source_val, target_val) in enumerate(zip(source_row, target_row)):
                    if source_val != target_val:
                        if source_val is None:
                            set_clause.append(f"{columns[i]} = NULL")
                        elif isinstance(source_val, str):
                            set_clause.append(f"{columns[i]} = '{source_val.replace("'", "''")}'")
                        else:
                            set_clause.append(f"{columns[i]} = {source_val}")
                if set_clause:
                    update_sql = f"UPDATE {target_table} SET {', '.join(set_clause)} WHERE {columns[0]} = {primary_key[0]};"
                    sql_statements.append(update_sql)
            
            # 生成删除语句
            for primary_key in diffs.get('delete', []):
                delete_sql = f"DELETE FROM {target_table} WHERE {columns[0]} = {primary_key[0]};"
                sql_statements.append(delete_sql)
            
            return '\n'.join(sql_statements), True
        
        except Exception as e:
            return f"生成数据同步SQL失败: {str(e)}", False
