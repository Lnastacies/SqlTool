#!/usr/bin/env python3
"""
数据库连接池管理
"""

# 尝试导入数据库驱动
import sys
print(f"Python版本: {sys.version}")
print("尝试导入数据库驱动...")

try:
    import pymysql
    pymysql_available = True
    print(f"pymysql导入成功: {pymysql.__version__}")
except ImportError as e:
    pymysql_available = False
    print(f"pymysql导入失败: {e}")
except Exception as e:
    pymysql_available = False
    print(f"pymysql导入异常: {e}")

try:
    import psycopg2
    psycopg2_available = True
    print(f"psycopg2导入成功: {psycopg2.__version__}")
except ImportError as e:
    psycopg2_available = False
    print(f"psycopg2导入失败: {e}")

try:
    import pyodbc
    pyodbc_available = True
    print(f"pyodbc导入成功: {pyodbc.version}")
except ImportError as e:
    pyodbc_available = False
    print(f"pyodbc导入失败: {e}")

try:
    import sqlite3
    sqlite3_available = True
    print(f"sqlite3导入成功")
except ImportError as e:
    sqlite3_available = False
    print(f"sqlite3导入失败: {e}")

print(f"驱动状态: pymysql={pymysql_available}, psycopg2={psycopg2_available}, pyodbc={pyodbc_available}, sqlite3={sqlite3_available}")

class ConnectionPool:
    """数据库连接池管理"""
    def __init__(self, max_connections=5):
        self.max_connections = max_connections
        self.connections = {}
        self.connection_count = {}
    
    def get_connection(self, conn_name, conn_data):
        """获取数据库连接"""
        print(f"尝试获取连接: {conn_name}, 类型: {conn_data['type']}")
        # 检查连接是否已存在且有效
        if conn_name in self.connections and self.connections[conn_name] is not None:
            # 检查连接是否有效
            if self._is_connection_valid(conn_name, conn_data['type']):
                print(f"使用现有连接: {conn_name}")
                return self.connections[conn_name]
            else:
                # 连接无效，释放并重新创建
                print(f"连接无效，释放并重新创建: {conn_name}")
                self.release_connection(conn_name)
        
        # 检查连接数是否超过限制
        if conn_name in self.connection_count and self.connection_count[conn_name] >= self.max_connections:
            raise Exception(f"连接池已满，最大连接数: {self.max_connections}")
        
        # 处理SSH隧道
        host = conn_data['host']
        port = conn_data['port']
        
        # 如果启用了SSH隧道
        if conn_data.get('ssh_enabled', 0) == 1:
            print(f"启用SSH隧道: {conn_data['ssh_host']}:{conn_data['ssh_port']}")
            try:
                import sshtunnel
                # 创建SSH隧道
                tunnel = sshtunnel.SSHTunnelForwarder(
                    (conn_data['ssh_host'], conn_data['ssh_port']),
                    ssh_username=conn_data['ssh_username'],
                    ssh_password=conn_data['ssh_password'],
                    remote_bind_address=(host, port)
                )
                tunnel.start()
                # 使用隧道的本地端口
                host = 'localhost'
                port = tunnel.local_bind_port
                print(f"SSH隧道已建立，本地端口: {port}")
            except ImportError:
                print("sshtunnel库未安装，无法使用SSH隧道")
            except Exception as e:
                print(f"SSH隧道建立失败: {e}")
        
        # 创建新连接
        conn = None
        try:
            if (conn_data['type'] == 'MySQL' or conn_data['type'] == 'MariaDB') and pymysql_available:
                print(f"创建{conn_data['type']}连接: {host}:{port}")
                # 构建连接参数
                connect_params = {
                    'host': host,
                    'port': port,
                    'user': conn_data['username'],
                    'password': conn_data['password'],
                    'database': conn_data['database'] if conn_data['database'] else None,
                    'cursorclass': pymysql.cursors.DictCursor,
                    'autocommit': False,
                    'connect_timeout': conn_data.get('timeout', 30),
                    'read_timeout': 30,
                    'write_timeout': 30
                }
                
                # 添加字符集
                if 'charset' in conn_data:
                    connect_params['charset'] = conn_data['charset']
                
                # 添加SSL参数
                if conn_data.get('ssl_mode', 0) > 0:
                    ssl_params = {}
                    if conn_data.get('ssl_key'):
                        ssl_params['key'] = conn_data['ssl_key']
                    if conn_data.get('ssl_cert'):
                        ssl_params['cert'] = conn_data['ssl_cert']
                    if conn_data.get('ssl_ca'):
                        ssl_params['ca'] = conn_data['ssl_ca']
                    if ssl_params:
                        connect_params['ssl'] = ssl_params
                
                conn = pymysql.connect(**connect_params)
                print(f"{conn_data['type']}连接创建成功")
            elif conn_data['type'] == 'PostgreSQL' and psycopg2_available:
                print(f"创建PostgreSQL连接: {host}:{port}")
                # 构建连接参数
                connect_params = {
                    'host': host,
                    'port': port,
                    'user': conn_data['username'],
                    'password': conn_data['password'],
                    'dbname': conn_data['database'] if conn_data['database'] else 'postgres',
                    'connect_timeout': conn_data.get('timeout', 30)
                }
                
                # 添加SSL参数
                if conn_data.get('ssl_mode', 0) > 0:
                    sslmode = 'require' if conn_data['ssl_mode'] == 1 else 'verify-ca'
                    connect_params['sslmode'] = sslmode
                    if conn_data.get('ssl_ca'):
                        connect_params['sslrootcert'] = conn_data['ssl_ca']
                    if conn_data.get('ssl_cert'):
                        connect_params['sslcert'] = conn_data['ssl_cert']
                    if conn_data.get('ssl_key'):
                        connect_params['sslkey'] = conn_data['ssl_key']
                
                conn = psycopg2.connect(**connect_params)
                print("PostgreSQL连接创建成功")
            elif conn_data['type'] == 'SQLite' and sqlite3_available:
                print(f"创建SQLite连接: {conn_data['database']}")
                conn = sqlite3.connect(conn_data['database'] if conn_data['database'] else ':memory:')
                print("SQLite连接创建成功")
            elif conn_data['type'] == 'SQL Server' and pyodbc_available:
                print(f"创建SQL Server连接: {host}:{port}")
                conn_str = f"DRIVER={{SQL Server}};SERVER={host},{port};DATABASE={conn_data['database'] if conn_data['database'] else 'master'};UID={conn_data['username']};PWD={conn_data['password']};Connect Timeout={conn_data.get('timeout', 30)}"
                conn = pyodbc.connect(conn_str)
                print("SQL Server连接创建成功")
            else:
                print(f"不支持的数据库类型或驱动不可用: {conn_data['type']}")
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
            print(f"连接存储成功: {conn_name}")
        
        return conn
    
    def _is_connection_valid(self, conn_name, db_type):
        """检查连接是否有效"""
        conn = self.connections.get(conn_name)
        if not conn:
            return False
        
        try:
            if db_type == 'MySQL' or db_type == 'MariaDB':
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