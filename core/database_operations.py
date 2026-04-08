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
    
    def run(self):
        """执行SQL语句"""
        start_time = time.time()
        try:
            results = None
            affected_rows = 0
            
            # 执行SQL
            if self.db_type == 'MySQL' or self.db_type == 'PostgreSQL':
                with self.db_connection.cursor() as cursor:
                    cursor.execute(self.sql)
                    
                    # 检查是否是查询语句
                    if self.sql.strip().upper().startswith('SELECT') or self.sql.strip().upper().startswith('SHOW'):
                        # 获取结果
                        results = cursor.fetchall()
                    else:
                        # 非查询语句，获取影响行数
                        affected_rows = cursor.rowcount
                        if self.db_type == 'MySQL':
                            self.db_connection.commit()
            
            elif self.db_type == 'SQLite':
                cursor = self.db_connection.cursor()
                cursor.execute(self.sql)
                
                # 检查是否是查询语句
                if self.sql.strip().upper().startswith('SELECT'):
                    # 获取结果
                    results = cursor.fetchall()
                else:
                    # 非查询语句，获取影响行数
                    affected_rows = cursor.rowcount
                    self.db_connection.commit()
            
            elif self.db_type == 'SQL Server':
                cursor = self.db_connection.cursor()
                cursor.execute(self.sql)
                
                # 检查是否是查询语句
                if self.sql.strip().upper().startswith('SELECT') or self.sql.strip().upper().startswith('SHOW'):
                    # 获取结果
                    results = cursor.fetchall()
                else:
                    # 非查询语句，获取影响行数
                    affected_rows = cursor.rowcount
                    self.db_connection.commit()
            
            execution_time = time.time() - start_time
            
            # 发送结果
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
        """执行SQL语句"""
        worker = SQLWorker(sql, self.db_connection, self.db_type, None)
        return worker
    
    def get_database_objects(self, current_db=None):
        """获取数据库对象"""
        tables = []
        columns = []
        
        if not self.db_connection:
            return tables, columns
        
        try:
            if self.db_type == 'MySQL':
                with self.db_connection.cursor() as cursor:
                    # 如果指定了数据库，先切换到该数据库
                    if current_db:
                        try:
                            cursor.execute(f"USE {current_db}")
                        except Exception as e:
                            print(f"切换数据库失败: {e}")
                    
                    # 获取表名
                    cursor.execute("SHOW TABLES")
                    table_results = cursor.fetchall()
                    for table in table_results:
                        if isinstance(table, dict):
                            table_name = list(table.values())[0]
                        else:
                            table_name = table[0]
                        tables.append(table_name)
                        
                        # 获取列名
                        cursor.execute(f"DESCRIBE {table_name}")
                        column_results = cursor.fetchall()
                        for column in column_results:
                            if isinstance(column, dict):
                                column_name = column['Field']
                            else:
                                column_name = column[0]
                            columns.append(f"{table_name}.{column_name}")
            
            elif self.db_type == 'PostgreSQL':
                with self.db_connection.cursor() as cursor:
                    # 获取表名
                    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
                    table_results = cursor.fetchall()
                    for table in table_results:
                        table_name = table[0]
                        tables.append(table_name)
                        
                        # 获取列名
                        cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '{table_name}'")
                        column_results = cursor.fetchall()
                        for column in column_results:
                            column_name = column[0]
                            columns.append(f"{table_name}.{column_name}")
            
            elif self.db_type == 'SQLite':
                cursor = self.db_connection.cursor()
                # 获取表名
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                table_results = cursor.fetchall()
                for table in table_results:
                    table_name = table[0]
                    tables.append(table_name)
                    
                    # 获取列名
                    cursor.execute(f"PRAGMA table_info({table_name})")
                    column_results = cursor.fetchall()
                    for column in column_results:
                        column_name = column[1]
                        columns.append(f"{table_name}.{column_name}")
            
            elif self.db_type == 'SQL Server':
                cursor = self.db_connection.cursor()
                # 获取表名
                cursor.execute("SELECT name FROM sys.tables")
                table_results = cursor.fetchall()
                for table in table_results:
                    table_name = table[0]
                    tables.append(table_name)
                    
                    # 获取列名
                    cursor.execute(f"SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('{table_name}')")
                    column_results = cursor.fetchall()
                    for column in column_results:
                        column_name = column[0]
                        columns.append(f"{table_name}.{column_name}")
        
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
                        # 加载表
                        cursor.execute("SHOW TABLES")
                        results = cursor.fetchall()
                        for result in results:
                            if isinstance(result, dict):
                                obj_name = list(result.values())[0]
                            else:
                                obj_name = result[0]
                            objects.append(obj_name)
                    elif object_type == 'views':
                        # 加载视图
                        cursor.execute("SHOW FULL TABLES WHERE Table_type = 'VIEW'")
                        results = cursor.fetchall()
                        for result in results:
                            if isinstance(result, dict):
                                obj_name = list(result.values())[0]
                            else:
                                obj_name = result[0]
                            objects.append(obj_name)
                    elif object_type == 'procedures':
                        # 加载存储过程
                        cursor.execute("SHOW PROCEDURE STATUS WHERE Db = %s", (database_name,))
                        results = cursor.fetchall()
                        for result in results:
                            if isinstance(result, dict):
                                obj_name = result['Name']
                            else:
                                obj_name = result[1]
                            objects.append(obj_name)
                    elif object_type == 'functions':
                        # 加载函数
                        cursor.execute("SHOW FUNCTION STATUS WHERE Db = %s", (database_name,))
                        results = cursor.fetchall()
                        for result in results:
                            if isinstance(result, dict):
                                obj_name = result['Name']
                            else:
                                obj_name = result[1]
                            objects.append(obj_name)
                    elif object_type == 'events':
                        # 加载事件
                        cursor.execute("SHOW EVENTS WHERE Db = %s", (database_name,))
                        results = cursor.fetchall()
                        for result in results:
                            if isinstance(result, dict):
                                obj_name = result['Name']
                            else:
                                obj_name = result[1]
                            objects.append(obj_name)
            elif self.db_type == 'PostgreSQL':
                with self.db_connection.cursor() as cursor:
                    if object_type == 'tables':
                        # 加载表
                        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
                        results = cursor.fetchall()
                        for result in results:
                            objects.append(result[0])
                    elif object_type == 'views':
                        # 加载视图
                        cursor.execute("SELECT table_name FROM information_schema.views WHERE table_schema = 'public'")
                        results = cursor.fetchall()
                        for result in results:
                            objects.append(result[0])
                    elif object_type == 'procedures':
                        # 加载存储过程
                        cursor.execute("SELECT proname FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')")
                        results = cursor.fetchall()
                        for result in results:
                            objects.append(result[0])
                    elif object_type == 'functions':
                        # 加载函数
                        cursor.execute("SELECT proname FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')")
                        results = cursor.fetchall()
                        for result in results:
                            objects.append(result[0])
            elif self.db_type == 'SQL Server':
                with self.db_connection.cursor() as cursor:
                    if object_type == 'tables':
                        # 加载表
                        cursor.execute("SELECT name FROM sys.tables")
                        results = cursor.fetchall()
                        for result in results:
                            objects.append(result[0])
                    elif object_type == 'views':
                        # 加载视图
                        cursor.execute("SELECT name FROM sys.views")
                        results = cursor.fetchall()
                        for result in results:
                            objects.append(result[0])
                    elif object_type == 'procedures':
                        # 加载存储过程
                        cursor.execute("SELECT name FROM sys.procedures")
                        results = cursor.fetchall()
                        for result in results:
                            objects.append(result[0])
                    elif object_type == 'functions':
                        # 加载函数
                        cursor.execute("SELECT name FROM sys.objects WHERE type IN ('FN', 'IF', 'TF')")
                        results = cursor.fetchall()
                        for result in results:
                            objects.append(result[0])
            elif self.db_type == 'SQLite':
                with self.db_connection.cursor() as cursor:
                    if object_type == 'tables':
                        # 加载表
                        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                        results = cursor.fetchall()
                        for result in results:
                            objects.append(result[0])
        except Exception as e:
            print(f"获取{object_type}失败: {e}")
        
        return objects
    
    def get_tables_structure(self):
        """获取表结构"""
        tables = {}
        
        if self.db_type == 'MySQL':
            with self.db_connection.cursor() as cursor:
                # 获取所有表
                cursor.execute("SHOW TABLES")
                table_results = cursor.fetchall()
                
                for table_result in table_results:
                    table_name = list(table_result.values())[0]
                    # 获取表结构
                    cursor.execute(f"DESCRIBE {table_name}")
                    columns = cursor.fetchall()
                    
                    table_columns = []
                    for col in columns:
                        col_name = col['Field']
                        col_type = col['Type']
                        table_columns.append((col_name, col_type))
                    
                    tables[table_name] = table_columns
        elif self.db_type == 'PostgreSQL':
            with self.db_connection.cursor() as cursor:
                # 获取所有表
                cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
                table_results = cursor.fetchall()
                
                for table_result in table_results:
                    table_name = table_result[0]
                    # 获取表结构
                    cursor.execute(f"\nSELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}'")
                    columns = cursor.fetchall()
                    
                    table_columns = []
                    for col in columns:
                        col_name = col[0]
                        col_type = col[1]
                        table_columns.append((col_name, col_type))
                    
                    tables[table_name] = table_columns
        elif self.db_type == 'SQLite':
            cursor = self.db_connection.cursor()
            # 获取所有表
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            table_results = cursor.fetchall()
            
            for table_result in table_results:
                table_name = table_result[0]
                # 获取表结构
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = cursor.fetchall()
                
                table_columns = []
                for col in columns:
                    col_name = col[1]
                    col_type = col[2]
                    table_columns.append((col_name, col_type))
                
                tables[table_name] = table_columns
        
        return tables
    
    def get_execution_plan(self, sql):
        """获取SQL执行计划"""
        if self.db_type == 'MySQL':
            with self.db_connection.cursor() as cursor:
                # 生成执行计划
                cursor.execute(f"EXPLAIN {sql}")
                results = cursor.fetchall()
                
                if results:
                    # 提取列名
                    columns = list(results[0].keys())
                    plan = [columns]
                    
                    # 提取数据
                    for row in results:
                        plan.append(list(row.values()))
                    
                    return plan
        elif self.db_type == 'PostgreSQL':
            with self.db_connection.cursor() as cursor:
                # 生成执行计划
                cursor.execute(f"EXPLAIN {sql}")
                results = cursor.fetchall()
                
                if results:
                    plan = [['执行计划']]
                    for row in results:
                        plan.append([row[0]])
                    return plan
        elif self.db_type == 'SQL Server':
            with self.db_connection.cursor() as cursor:
                # 生成执行计划
                cursor.execute(f"EXPLAIN PLAN FOR {sql}")
                results = cursor.fetchall()
                
                if results:
                    plan = [['执行计划']]
                    for row in results:
                        plan.append([row[0]])
                    return plan
        
        # 默认返回空计划
        return [['执行计划'], ['无法生成执行计划']]
