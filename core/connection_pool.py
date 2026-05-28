#!/usr/bin/env python3
"""
数据库连接池管理 - 使用数据库适配器模式重构
"""

import sys
import time
import threading

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

from core.adapter_factory import AdapterFactory
from utils.thread_monitor import track_operation


class ConnectionPool:
    """数据库连接池管理"""

    def __init__(self, max_connections=5):
        self.max_connections = max_connections
        self.connections = {}
        self.connection_count = {}
        self.connection_data = {}
        self.connection_timestamps = {}
        self.lock = threading.RLock()
        self.max_idle_time = 300
        self.logger = None
        self.adapter_factory = AdapterFactory()

    def set_logger(self, logger):
        self.logger = logger

    def _log(self, level, message):
        if self.logger:
            self.logger.log(level, message)

    @track_operation('ConnectionPool.get_connection')
    def get_connection(self, conn_name, conn_data):
        """获取数据库连接"""
        with self.lock:
            self.connection_data[conn_name] = conn_data

            if conn_name in self.connections and self.connections[conn_name] is not None:
                if self._is_connection_valid(conn_name, conn_data['type']):
                    self.connection_timestamps[conn_name] = time.time()
                    return self.connections[conn_name]
                else:
                    self.release_connection(conn_name)

            if conn_name in self.connection_count and self.connection_count[conn_name] >= self.max_connections:
                raise Exception(f"连接池已满，最大连接数: {self.max_connections}")

            host = conn_data['host']
            port = conn_data['port']

            if conn_data.get('ssh_enabled', 0) == 1:
                ssh_result = self._setup_ssh_tunnel(conn_data, host, port)
                if ssh_result:
                    host, port = ssh_result

            conn = self._create_connection(conn_name, conn_data, host, port)
            if conn:
                self.connections[conn_name] = conn
                if conn_name not in self.connection_count:
                    self.connection_count[conn_name] = 0
                self.connection_count[conn_name] += 1
                self.connection_timestamps[conn_name] = time.time()
                self._log('INFO', f"连接创建成功: {conn_name} ({conn_data['type']})")

            return conn

    def _setup_ssh_tunnel(self, conn_data, host, port):
        """建立SSH隧道"""
        try:
            import sshtunnel
            tunnel = sshtunnel.SSHTunnelForwarder(
                (conn_data['ssh_host'], conn_data['ssh_port']),
                ssh_username=conn_data['ssh_username'],
                ssh_password=conn_data['ssh_password'],
                remote_bind_address=(host, port),
                ssh_timeout=10.0,
                timeout=10.0
            )
            tunnel.start()
            return ('localhost', tunnel.local_bind_port)
        except ImportError:
            self._log('ERROR', "sshtunnel库未安装，无法使用SSH隧道")
        except Exception as e:
            self._log('ERROR', f"SSH隧道建立失败: {e}")
        return None

    def _create_connection(self, conn_name, conn_data, host, port):
        """创建新连接"""
        conn = None
        db_type = conn_data['type']
        adapter = self.adapter_factory.get_adapter(db_type)

        try:
            if (db_type == 'MySQL' or db_type == 'MariaDB') and pymysql_available:
                connect_params = adapter.get_connection_params(conn_data)
                connect_params['host'] = host
                connect_params['port'] = port
                connect_params['cursorclass'] = pymysql.cursors.DictCursor

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

            elif db_type == 'PostgreSQL' and psycopg2_available:
                connect_params = adapter.get_connection_params(conn_data)
                connect_params['host'] = host
                connect_params['port'] = port

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

            elif db_type == 'SQLite' and sqlite3_available:
                db_path = adapter.get_connection_params(conn_data)
                conn = sqlite3.connect(db_path)

            elif db_type == 'SQL Server' and pyodbc_available:
                conn_str = adapter.get_connection_params(conn_data)
                conn = pyodbc.connect(conn_str)

        except Exception as e:
            self._log('ERROR', f"创建连接失败 [{db_type}]: {e}")
            return None

        return conn

    def refresh_connection(self, conn_name):
        """刷新连接（重新创建）"""
        with self.lock:
            if conn_name in self.connection_data:
                self.release_connection(conn_name)
                return self.get_connection(conn_name, self.connection_data[conn_name])
            return None

    def _is_connection_valid(self, conn_name, db_type):
        """检查连接是否有效"""
        conn = self.connections.get(conn_name)
        if not conn:
            return False

        adapter = self.adapter_factory.get_adapter(db_type)
        if adapter:
            return adapter.test_connection(conn)

        return False

    def cleanup_idle_connections(self):
        """清理空闲连接"""
        with self.lock:
            current_time = time.time()
            for conn_name in list(self.connections.keys()):
                if conn_name in self.connection_timestamps:
                    idle_time = current_time - self.connection_timestamps[conn_name]
                    if idle_time > self.max_idle_time:
                        self._log('INFO', f"清理空闲连接: {conn_name} (空闲 {idle_time:.0f} 秒)")
                        self.release_connection(conn_name)

    def release_connection(self, conn_name):
        """释放数据库连接"""
        with self.lock:
            if conn_name in self.connections and self.connections[conn_name] is not None:
                try:
                    self.connections[conn_name].close()
                except Exception as e:
                    self._log('ERROR', f"关闭连接失败: {e}")
                finally:
                    self.connections[conn_name] = None
                    if conn_name in self.connection_count:
                        self.connection_count[conn_name] = max(0, self.connection_count[conn_name] - 1)
                    self.connection_timestamps.pop(conn_name, None)

    def close_all_connections(self):
        """关闭所有连接"""
        self._log('INFO', "开始关闭所有数据库连接")
        with self.lock:
            for conn_name in list(self.connections.keys()):
                self.release_connection(conn_name)
        self._log('INFO', "所有数据库连接已关闭")

    def get_active_connections(self):
        """获取活跃连接统计"""
        with self.lock:
            return {
                conn_name: {
                    'count': self.connection_count.get(conn_name, 0),
                    'last_active': self.connection_timestamps.get(conn_name, 0)
                }
                for conn_name in list(self.connections.keys())
                if self.connections.get(conn_name) is not None
            }