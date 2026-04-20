#!/usr/bin/env python3
"""
数据库连接管理器
"""

import json
import os
from cryptography.fernet import Fernet

class ConnectionManager:
    """数据库连接管理器"""
    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
        self.saved_connections = {}
        self.connection_groups = {}
        self.key_file = "encryption.key"
        self.key = self._load_or_generate_key()
        self.fernet = Fernet(self.key)
    
    def _load_or_generate_key(self):
        """加载或生成加密密钥"""
        if os.path.exists(self.key_file):
            with open(self.key_file, 'rb') as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            with open(self.key_file, 'wb') as f:
                f.write(key)
            return key
    
    def load_connections(self):
        """加载保存的连接"""
        conn_file = "connections.json"
        if os.path.exists(conn_file):
            try:
                with open(conn_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # 解密密码
                    for conn_name, conn_data in data.get('connections', {}).items():
                        if 'password' in conn_data and conn_data['password']:
                            try:
                                decrypted_password = self.fernet.decrypt(conn_data['password'].encode()).decode()
                                conn_data['password'] = decrypted_password
                            except:
                                # 如果解密失败，保持原密码
                                pass
                    self.saved_connections = data.get('connections', {})
                    self.connection_groups = data.get('groups', {})
            except Exception as e:
                self.logger.log('ERROR', f"加载连接失败: {e}")
        else:
            # 示例连接
            self.saved_connections = {
                'Local MySQL': {
                    'type': 'MySQL',
                    'host': 'localhost',
                    'port': 3306,
                    'username': 'root',
                    'password': '',
                    'database': ''
                },
                'Local PostgreSQL': {
                    'type': 'PostgreSQL',
                    'host': 'localhost',
                    'port': 5432,
                    'username': 'postgres',
                    'password': '',
                    'database': ''
                }
            }
    
    def save_connections(self):
        """保存连接"""
        conn_file = "connections.json"
        try:
            # 加密密码
            encrypted_connections = {}
            for conn_name, conn_data in self.saved_connections.items():
                encrypted_conn = conn_data.copy()
                if 'password' in encrypted_conn and encrypted_conn['password']:
                    encrypted_password = self.fernet.encrypt(encrypted_conn['password'].encode()).decode()
                    encrypted_conn['password'] = encrypted_password
                encrypted_connections[conn_name] = encrypted_conn
            
            data = {
                'connections': encrypted_connections,
                'groups': self.connection_groups
            }
            
            with open(conn_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            self.logger.log('ERROR', f"保存连接失败: {e}")
    
    def add_connection(self, conn_name, conn_data):
        """添加连接"""
        self.saved_connections[conn_name] = conn_data
        self.save_connections()
    
    def update_connection(self, conn_name, conn_data):
        """更新连接"""
        if conn_name in self.saved_connections:
            self.saved_connections[conn_name] = conn_data
            self.save_connections()
    
    def delete_connection(self, conn_name):
        """删除连接"""
        if conn_name in self.saved_connections:
            del self.saved_connections[conn_name]
            self.save_connections()
    
    def get_connection(self, conn_name):
        """获取连接信息"""
        return self.saved_connections.get(conn_name, None)
    
    def get_all_connections(self):
        """获取所有连接"""
        return self.saved_connections
    
    def test_connection(self, conn_data):
        """测试连接"""
        try:
            conn = None
            conn_type = conn_data.get('type')
            
            if conn_type == 'MySQL':
                import mysql.connector
                connect_params = {
                    'host': conn_data.get('host', 'localhost'),
                    'port': conn_data.get('port', 3306),
                    'user': conn_data.get('username', 'root'),
                    'password': conn_data.get('password', ''),
                    'database': conn_data.get('database', ''),
                    'connect_timeout': conn_data.get('timeout', 30)
                }
                conn = mysql.connector.connect(**connect_params)
            
            elif conn_type == 'PostgreSQL':
                import psycopg2
                connect_params = {
                    'host': conn_data.get('host', 'localhost'),
                    'port': conn_data.get('port', 5432),
                    'user': conn_data.get('username', 'postgres'),
                    'password': conn_data.get('password', ''),
                    'dbname': conn_data.get('database', 'postgres'),
                    'connect_timeout': conn_data.get('timeout', 30)
                }
                conn = psycopg2.connect(**connect_params)
            
            elif conn_type == 'SQLite':
                import sqlite3
                conn = sqlite3.connect(conn_data.get('database', ':memory:'))
            
            elif conn_type == 'SQL Server':
                import pyodbc
                conn_str = f"DRIVER={{SQL Server}};SERVER={conn_data.get('host', 'localhost')},{conn_data.get('port', 1433)};DATABASE={conn_data.get('database', 'master')};UID={conn_data.get('username', 'sa')};PWD={conn_data.get('password', '')}"
                conn = pyodbc.connect(conn_str, timeout=conn_data.get('timeout', 30))
            
            elif conn_type == 'MariaDB':
                import mariadb
                connect_params = {
                    'host': conn_data.get('host', 'localhost'),
                    'port': conn_data.get('port', 3306),
                    'user': conn_data.get('username', 'root'),
                    'password': conn_data.get('password', ''),
                    'database': conn_data.get('database', ''),
                    'connect_timeout': conn_data.get('timeout', 30)
                }
                conn = mariadb.connect(**connect_params)
            
            if conn:
                conn.close()
                return True, "连接成功"
            else:
                return False, "未支持的数据库类型"
        
        except Exception as e:
            return False, str(e)
