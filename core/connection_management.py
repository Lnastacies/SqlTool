#!/usr/bin/env python3
"""
数据库连接管理模块
"""

import json
import os
import pymysql
import psycopg2
import sqlite3
import pyodbc
from utils.logger import OperationLogger

class ConnectionManager:
    """
    数据库连接管理器
    """
    def __init__(self):
        self.logger = OperationLogger()
        self.saved_connections = {}
        self.connection_groups = {}
    
    def load_connections(self):
        """
        加载保存的连接
        """
        conn_file = "connections.json"
        if os.path.exists(conn_file):
            try:
                with open(conn_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
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
        """
        保存连接
        """
        conn_file = "connections.json"
        try:
            data = {
                'connections': self.saved_connections,
                'groups': self.connection_groups
            }
            with open(conn_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self.logger.log('INFO', f"保存了 {len(self.saved_connections)} 个连接")
        except Exception as e:
            self.logger.log('ERROR', f"保存连接失败: {e}")
    
    def create_connection(self, conn_data):
        """
        创建数据库连接
        """
        try:
            if conn_data['type'] == 'MySQL':
                # 创建MySQL连接
                conn = pymysql.connect(
                    host=conn_data['host'],
                    port=conn_data['port'],
                    user=conn_data['username'],
                    password=conn_data['password'],
                    database=conn_data['database'] if conn_data['database'] else None,
                    charset='utf8mb4',
                    cursorclass=pymysql.cursors.DictCursor
                )
                return conn
            elif conn_data['type'] == 'PostgreSQL':
                # 创建PostgreSQL连接
                conn = psycopg2.connect(
                    host=conn_data['host'],
                    port=conn_data['port'],
                    user=conn_data['username'],
                    password=conn_data['password'],
                    dbname=conn_data['database'] if conn_data['database'] else 'postgres'
                )
                return conn
            elif conn_data['type'] == 'SQLite':
                # 创建SQLite连接
                conn = sqlite3.connect(conn_data['database'])
                return conn
            elif conn_data['type'] == 'SQL Server':
                # 创建SQL Server连接
                conn_str = f"DRIVER={{SQL Server}};SERVER={conn_data['host']};PORT={conn_data['port']};DATABASE={conn_data['database']};UID={conn_data['username']};PWD={conn_data['password']}"
                conn = pyodbc.connect(conn_str)
                return conn
            else:
                self.logger.log('ERROR', f"不支持的数据库类型: {conn_data['type']}")
                return None
        except Exception as e:
            self.logger.log('ERROR', f"创建连接失败: {str(e)}")
            return None
    
    def close_connection(self, conn):
        """
        关闭数据库连接
        """
        if conn:
            try:
                conn.close()
                self.logger.log('INFO', "数据库连接已关闭")
            except Exception as e:
                self.logger.log('ERROR', f"关闭连接失败: {str(e)}")
