#!/usr/bin/env python3
"""
数据库适配器工厂模块
"""

from core.database_adapter import (
    DatabaseAdapter,
    MySQLAdapter,
    PostgreSQLAdapter,
    SQLServerAdapter,
    SQLiteAdapter
)


class AdapterFactory:
    """数据库适配器工厂"""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._adapters = {}
            cls._instance._register_adapters()
        return cls._instance

    def _register_adapters(self):
        """注册所有数据库适配器"""
        self._adapters = {
            'MySQL': MySQLAdapter(),
            'MariaDB': MySQLAdapter(),
            'PostgreSQL': PostgreSQLAdapter(),
            'SQL Server': SQLServerAdapter(),
            'SQLite': SQLiteAdapter()
        }

    def get_adapter(self, db_type):
        """获取数据库适配器"""
        return self._adapters.get(db_type)

    def register_adapter(self, db_type, adapter):
        """注册自定义数据库适配器"""
        if isinstance(adapter, DatabaseAdapter):
            self._adapters[db_type] = adapter
            return True
        return False

    def get_supported_databases(self):
        """获取支持的数据库类型列表"""
        return list(self._adapters.keys())

    def is_supported(self, db_type):
        """检查数据库类型是否支持"""
        return db_type in self._adapters
