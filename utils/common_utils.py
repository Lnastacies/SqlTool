#!/usr/bin/env python3
"""
通用工具类
"""

from PyQt6.QtGui import QIcon, QPainter, QPixmap
from PyQt6.QtCore import Qt
import json
import os
import time

class UITools:
    """
    UI相关工具
    """
    @staticmethod
    def create_icon(text):
        """
        创建简单图标
        """
        pixmap = QPixmap(16, 16)
        pixmap.fill(Qt.GlobalColor.transparent)
        painter = QPainter(pixmap)
        painter.drawText(2, 12, text[0])
        painter.end()
        return QIcon(pixmap)
    
    @staticmethod
    def get_toolbar_style():
        """
        获取工具栏样式
        """
        return """
            QToolBar {
                background-color: #f0f0f0;
                border: 1px solid #d0d0d0;
                padding: 3px;
                spacing: 1px;
            }
            QToolButton {
                padding: 5px 10px;
                font-size: 10px;
                font-family: Arial;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
                background-color: #ffffff;
            }
            QToolButton:hover {
                background-color: #e8e8e8;
                border: 1px solid #c0c0c0;
            }
            QToolButton:pressed {
                background-color: #d0d0d0;
                border: 1px solid #b0b0b0;
            }
        """
    
    @staticmethod
    def get_tab_widget_style():
        """
        获取标签页样式
        """
        return """
            QTabWidget::pane {
                border: 1px solid #d0d0d0;
                background-color: #ffffff;
            }
            QTabBar::tab {
                padding: 6px 12px;
                font-size: 10px;
                font-family: Arial;
                background-color: #f0f0f0;
                border: 1px solid #d0d0d0;
                border-bottom: none;
                margin-right: 2px;
            }
            QTabBar::tab:selected {
                background-color: #ffffff;
                border-bottom: 1px solid #ffffff;
            }
            QTabBar::tab:hover {
                background-color: #e8e8e8;
            }
            QTabBar::close-button {
                image: url(:/close.png);
                subcontrol-position: right;
                subcontrol-origin: margin;
                width: 12px;
                height: 12px;
                margin: 0 4px 0 4px;
            }
            QTabBar::close-button:hover {
                background-color: #e0e0e0;
                border-radius: 6px;
            }
        """
    
    @staticmethod
    def get_tree_widget_style():
        """
        获取树形控件样式
        """
        return """
            QTreeWidget {
                background-color: #ffffff;
                border: none;
                font-size: 10px;
                font-family: Arial;
            }
            QTreeWidget::item {
                padding: 2px 0;
                height: 18px;
            }
            QTreeWidget::item:selected {
                background-color: #e0e0e0;
                color: #000000;
            }
            QTreeWidget::item:hover {
                background-color: #f0f0f0;
            }
        """

class DatabaseTools:
    """
    数据库相关工具
    """
    @staticmethod
    def load_connections():
        """
        加载保存的连接
        """
        conn_file = "connections.json"
        saved_connections = {}
        connection_groups = {}
        
        if os.path.exists(conn_file):
            try:
                with open(conn_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    saved_connections = data.get('connections', {})
                    connection_groups = data.get('groups', {})
            except Exception as e:
                print(f"加载连接失败: {e}")
        else:
            # 示例连接
            saved_connections = {
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
        
        return saved_connections, connection_groups
    
    @staticmethod
    def save_connections(saved_connections, connection_groups):
        """
        保存连接
        """
        conn_file = "connections.json"
        try:
            data = {
                'connections': saved_connections,
                'groups': connection_groups
            }
            with open(conn_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存连接失败: {e}")
            return False
    
    @staticmethod
    def get_object_type_name(object_type):
        """
        获取对象类型的中文名称
        """
        type_names = {
            'tables': '表',
            'views': '视图',
            'procedures': '存储过程',
            'functions': '函数',
            'events': '事件',
            'queries': '查询',
            'reports': '报表',
            'backups': '备份'
        }
        return type_names.get(object_type, object_type)

class CommonTools:
    """
    通用工具
    """
    @staticmethod
    def format_time(seconds):
        """
        格式化时间
        """
        if seconds < 0.001:
            return f"{seconds * 1000000:.2f} μs"
        elif seconds < 1:
            return f"{seconds * 1000:.2f} ms"
        else:
            return f"{seconds:.2f} s"
    
    @staticmethod
    def get_current_timestamp():
        """
        获取当前时间戳
        """
        return time.strftime("%Y-%m-%d %H:%M:%S")
    
    @staticmethod
    def validate_sql(sql):
        """
        验证SQL语句
        """
        if not sql or not sql.strip():
            return False, "SQL语句为空"
        return True, ""
    
    @staticmethod
    def split_sql_statements(sql):
        """
        分割SQL语句
        """
        statements = []
        current_statement = []
        in_string = False
        string_delimiter = None
        
        for char in sql:
            if char in ('"', "'", '`') and not in_string:
                in_string = True
                string_delimiter = char
                current_statement.append(char)
            elif char == string_delimiter and in_string:
                in_string = False
                current_statement.append(char)
            elif char == ';' and not in_string:
                current_statement.append(char)
                statements.append(''.join(current_statement))
                current_statement = []
            else:
                current_statement.append(char)
        
        if current_statement:
            statements.append(''.join(current_statement))
        
        return statements
