#!/usr/bin/env python3
"""
数据库连接池管理
"""

# 尝试导入数据库驱动
try:
    import pymysql
    pymysql_available = True
except ImportError:
    pymysql_available = False

try:
    import psycopg2
    psycopg2_available = True
except ImportError:
    psycopg2_available = False

try:
    import pyodbc
    pyodbc_available = True
except ImportError:
    pyodbc_available = False

try:
    import sqlite3
    sqlite3_available = True
except ImportError:
    sqlite3_available = False

class ConnectionPool:
    """数据库连接池管理"""
    def __init__(self, max_connections=5):
        self.max_connections = max_connections
        self.connections = {}
        self.connection_count = {}
    
    def get_connection(self, conn_name, conn_data):
        """获取数据库连接"""
        # 检查连接是否已存在且有效
        if conn_name in self.connections and self.connections[conn_name] is not None:
            # 检查连接是否有效
            if self._is_connection_valid(conn_name, conn_data['type']):
                return self.connections[conn_name]
            else:
                # 连接无效，释放并重新创建
                self.release_connection(conn_name)
        
        # 检查连接数是否超过限制
        if conn_name in self.connection_count and self.connection_count[conn_name] >= self.max_connections:
            raise Exception(f"连接池已满，最大连接数: {self.max_connections}")
        
        # 创建新连接
        conn = None
        try:
            if conn_data['type'] == 'MySQL' and pymysql_available:
                conn = pymysql.connect(
                    host=conn_data['host'],
                    port=conn_data['port'],
                    user=conn_data['username'],
                    password=conn_data['password'],
                    database=conn_data['database'] if conn_data['database'] else None,
                    cursorclass=pymysql.cursors.DictCursor,
                    autocommit=False,
                    connect_timeout=10,
                    read_timeout=30,
                    write_timeout=30
                )
            elif conn_data['type'] == 'PostgreSQL' and psycopg2_available:
                conn = psycopg2.connect(
                    host=conn_data['host'],
                    port=conn_data['port'],
                    user=conn_data['username'],
                    password=conn_data['password'],
                    dbname=conn_data['database'] if conn_data['database'] else 'postgres',
                    connect_timeout=10
                )
            elif conn_data['type'] == 'SQLite' and sqlite3_available:
                conn = sqlite3.connect(conn_data['database'] if conn_data['database'] else ':memory:')
            elif conn_data['type'] == 'SQL Server' and pyodbc_available:
                conn_str = f"DRIVER={{SQL Server}};SERVER={conn_data['host']},{conn_data['port']};DATABASE={conn_data['database'] if conn_data['database'] else 'master'};UID={conn_data['username']};PWD={conn_data['password']};Connect Timeout=10"
                conn = pyodbc.connect(conn_str)
        except Exception as e:
            print(f"创建连接失败: {e}")
            return None
        
        if conn:
            # 存储连接
            self.connections[conn_name] = conn
            # 更新连接计数
            if conn_name not in self.connection_count:
                self.connection_count[conn_name] = 0
            self.connection_count[conn_name] += 1
        
        return conn
    
    def _is_connection_valid(self, conn_name, db_type):
        """检查连接是否有效"""
        conn = self.connections.get(conn_name)
        if not conn:
            return False
        
        try:
            if db_type == 'MySQL':
                # 执行一个简单的查询来检查连接
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    cursor.fetchone()
            elif db_type == 'PostgreSQL':
                # 执行一个简单的查询来检查连接
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    cursor.fetchone()
            elif db_type == 'SQLite':
                # SQLite连接总是有效的
                return True
            elif db_type == 'SQL Server':
                # 执行一个简单的查询来检查连接
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
                cursor.close()
            return True
        except Exception as e:
            print(f"连接无效: {e}")
            return False
    
    def release_connection(self, conn_name):
        """释放数据库连接"""
        if conn_name in self.connections and self.connections[conn_name] is not None:
            try:
                self.connections[conn_name].close()
            except Exception as e:
                print(f"关闭连接失败: {e}")
            finally:
                self.connections[conn_name] = None
                if conn_name in self.connection_count:
                    self.connection_count[conn_name] = max(0, self.connection_count[conn_name] - 1)
    
    def close_all_connections(self):
        """关闭所有连接"""
        for conn_name in list(self.connections.keys()):
            self.release_connection(conn_name)