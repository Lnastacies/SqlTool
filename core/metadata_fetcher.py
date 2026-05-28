#!/usr/bin/env python3
"""
元数据获取器 - 使用数据库适配器模式重构
"""

from core.adapter_factory import AdapterFactory


class MetadataFetcher:
    """元数据获取器"""

    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
        self.adapter_factory = AdapterFactory()

    def get_database_objects(self, connection, db_type, database):
        """获取数据库对象"""
        adapter = self.adapter_factory.get_adapter(db_type)
        if not adapter:
            self.logger.log('ERROR', f"不支持的数据库类型: {db_type}")
            return {
                'tables': [],
                'views': [],
                'procedures': [],
                'functions': [],
                'triggers': [],
                'events': []
            }

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

            objects['tables'] = adapter.get_tables(cursor, database)
            objects['views'] = adapter.get_views(cursor, database)
            objects['procedures'] = adapter.get_procedures(cursor, database)
            objects['functions'] = adapter.get_functions(cursor, database)
            objects['triggers'] = adapter.get_triggers(cursor, database)
            objects['events'] = adapter.get_events(cursor, database)

            cursor.close()

        except Exception as e:
            self.logger.log('ERROR', f"获取数据库对象失败: {str(e)}")

        return objects

    def get_table_metadata(self, connection, db_type, database, table_name):
        """获取表的元数据"""
        adapter = self.adapter_factory.get_adapter(db_type)
        if not adapter:
            self.logger.log('ERROR', f"不支持的数据库类型: {db_type}")
            return {
                'fields': [],
                'indexes': [],
                'foreign_keys': [],
                'ddl': ''
            }

        try:
            cursor = connection.cursor()
            metadata = adapter.get_table_metadata(cursor, table_name)
            cursor.close()
            return metadata

        except Exception as e:
            self.logger.log('ERROR', f"获取表元数据失败: {str(e)}")
            return {
                'fields': [],
                'indexes': [],
                'foreign_keys': [],
                'ddl': ''
            }