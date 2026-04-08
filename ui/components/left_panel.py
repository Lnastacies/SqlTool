#!/usr/bin/env python3
"""
左侧面板模块
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QTabWidget, QTreeWidget, QTreeWidgetItem, 
    QHBoxLayout, QPushButton
)
from PyQt6.QtCore import Qt
from utils.common_utils import UITools

class LeftPanel(QWidget):
    """
    左侧面板类，包含连接管理器和对象浏览器
    """
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.logger = main_window.logger
        
        self.setup_ui()
    
    def setup_ui(self):
        """
        设置左侧面板UI
        """
        # 主布局
        main_layout = QVBoxLayout(self)
        self.setStyleSheet("QWidget { background-color: #f5f5f5; border-right: 1px solid #d0d0d0; }")

        # 添加标签页
        self.tab_widget = QTabWidget()
        self.tab_widget.setTabPosition(QTabWidget.TabPosition.North)
        self.tab_widget.setMinimumWidth(220)
        self.tab_widget.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #d0d0d0;
                background-color: #ffffff;
            }
            QTabBar::tab {
                padding: 8px 16px;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #f0f0f0;
                border: 1px solid #d0d0d0;
                border-bottom: none;
                margin-right: 2px;
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
            }
            QTabBar::tab:selected {
                background-color: #ffffff;
                border-bottom: 1px solid #ffffff;
                font-weight: bold;
            }
            QTabBar::tab:hover {
                background-color: #e8e8e8;
            }
        """)

        # 连接标签页
        self.create_connection_tab()

        # 对象标签页
        self.create_object_tab()

        main_layout.addWidget(self.tab_widget)
    
    def create_connection_tab(self):
        """
        创建连接标签页
        """
        conn_tab = QWidget()
        conn_layout = QVBoxLayout(conn_tab)
        conn_layout.setContentsMargins(0, 0, 0, 0)

        # 连接树
        self.connection_tree = QTreeWidget()
        self.connection_tree.setHeaderLabel("")
        self.connection_tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.connection_tree.customContextMenuRequested.connect(self.main_window.event_handler.on_connection_context_menu)
        self.connection_tree.itemDoubleClicked.connect(self.main_window.event_handler.on_connection_double_clicked)
        self.connection_tree.setIndentation(18)
        self.connection_tree.setStyleSheet("""
            QTreeWidget {
                background-color: #ffffff;
                border: none;
                font-family: 'Microsoft YaHei', Arial;
                font-size: 11px;
            }
            QTreeWidget::item {
                padding: 3px 0;
                height: 22px;
            }
            QTreeWidget::item:hover {
                background-color: #f0f0f0;
            }
            QTreeWidget::item:selected {
                background-color: #e3f2fd;
                color: #1976d2;
            }
        """)
        conn_layout.addWidget(self.connection_tree)

        # 添加按钮
        conn_buttons = QHBoxLayout()
        conn_buttons.setContentsMargins(8, 8, 8, 8)
        conn_layout.addLayout(conn_buttons)

        self.add_conn_btn = QPushButton("+ 新建连接")
        self.add_conn_btn.clicked.connect(self.main_window.event_handler.new_connection)
        self.add_conn_btn.setStyleSheet("""
            QPushButton {
                padding: 6px 12px;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #4285f4;
                color: white;
                border: 1px solid #3367d6;
                border-radius: 4px;
            }
            QPushButton:hover {
                background-color: #3367d6;
                border: 1px solid #2a56c6;
            }
            QPushButton:pressed {
                background-color: #2a56c6;
                border: 1px solid #1a45a0;
            }
        """)
        conn_buttons.addWidget(self.add_conn_btn)

        self.add_group_btn = QPushButton("+ 新建组")
        self.add_group_btn.clicked.connect(self.main_window.event_handler.new_connection_group)
        self.add_group_btn.setStyleSheet("""
            QPushButton {
                padding: 6px 12px;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #f0f0f0;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                margin-left: 8px;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #d0d0d0;
                border: 1px solid #b0b0b0;
            }
        """)
        conn_buttons.addWidget(self.add_group_btn)

        self.tab_widget.addTab(conn_tab, "连接")
    
    def create_object_tab(self):
        """
        创建对象标签页
        """
        obj_tab = QWidget()
        obj_layout = QVBoxLayout(obj_tab)
        obj_layout.setContentsMargins(0, 0, 0, 0)

        # 对象树
        self.object_tree = QTreeWidget()
        self.object_tree.setHeaderLabel("")
        self.object_tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.object_tree.customContextMenuRequested.connect(self.main_window.on_object_context_menu)
        self.object_tree.itemDoubleClicked.connect(self.main_window.on_object_double_clicked)
        self.object_tree.itemClicked.connect(self.main_window.on_object_clicked)
        self.object_tree.setIndentation(18)
        self.object_tree.setStyleSheet("""
            QTreeWidget {
                background-color: #ffffff;
                border: none;
                font-family: 'Microsoft YaHei', Arial;
                font-size: 11px;
            }
            QTreeWidget::item {
                padding: 3px 0;
                height: 22px;
            }
            QTreeWidget::item:hover {
                background-color: #f0f0f0;
            }
            QTreeWidget::item:selected {
                background-color: #e3f2fd;
                color: #1976d2;
            }
            QTreeWidget::branch:closed:has-children {
                image: url(:/icons/closed_folder.png);
            }
            QTreeWidget::branch:open:has-children {
                image: url(:/icons/open_folder.png);
            }
        """)
        obj_layout.addWidget(self.object_tree)

        self.tab_widget.addTab(obj_tab, "对象")
    
    def load_connections_to_tree(self, show_only_current=False):
        """
        加载连接到树
        """
        self.connection_tree.clear()

        # 添加连接组
        for group_name, connections in self.main_window.connection_groups.items():
            # 过滤连接
            filtered_connections = []
            for conn_name in connections:
                if not show_only_current or conn_name == self.main_window.current_connection:
                    filtered_connections.append(conn_name)

            if filtered_connections:
                group_item = QTreeWidgetItem(self.connection_tree, [group_name])
                group_item.setData(0, Qt.ItemDataRole.UserRole, ('group', group_name))

                for conn_name in filtered_connections:
                    if conn_name in self.main_window.saved_connections:
                        conn_item = QTreeWidgetItem(group_item, [conn_name])
                        conn_item.setData(0, Qt.ItemDataRole.UserRole, ('connection', conn_name))

                        # 如果是当前连接，加载数据库对象
                        if conn_name == self.main_window.current_connection and hasattr(self.main_window, 'db_connection') and self.main_window.db_connection:
                            self._load_databases_to_connection_tree(conn_item)

        # 添加未分组的连接
        for conn_name, conn_data in self.main_window.saved_connections.items():
            # 检查是否已在组中
            in_group = False
            for group_name, connections in self.main_window.connection_groups.items():
                if conn_name in connections:
                    in_group = True
                    break

            if not in_group and (not show_only_current or conn_name == self.main_window.current_connection):
                conn_item = QTreeWidgetItem(self.connection_tree, [conn_name])
                conn_item.setData(0, Qt.ItemDataRole.UserRole, ('connection', conn_name))

                # 如果是当前连接，加载数据库对象
                if conn_name == self.main_window.current_connection and hasattr(self.main_window, 'db_connection') and self.main_window.db_connection:
                    self._load_databases_to_connection_tree(conn_item)

        # 展开所有节点
        self._expand_all_items(self.connection_tree)
    
    def _load_databases_to_connection_tree(self, conn_item):
        """
        加载数据库到连接树
        """
        if not hasattr(self.main_window, 'db_connection') or not self.main_window.db_connection:
            return

        try:
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type == 'MySQL':
                    # 显示所有数据库
                    cursor.execute("SHOW DATABASES")
                    databases = cursor.fetchall()

                    for db in databases:
                        db_name = db['Database'] if isinstance(db, dict) else db[0]
                        if not db_name:
                            continue
                        db_item = QTreeWidgetItem(conn_item, [db_name])
                        db_item.setData(0, Qt.ItemDataRole.UserRole, ('database', db_name))

                        # 如果是当前数据库，加载各种对象类型
                        if db_name == self.main_window.current_db:
                            try:
                                cursor.execute(f"USE {db_name}")
                                
                                # 加载表
                                cursor.execute("SHOW TABLES")
                                tables = cursor.fetchall()
                                
                                tables_item = QTreeWidgetItem(db_item, ['表'])
                                tables_item.setData(0, Qt.ItemDataRole.UserRole, ('tables', db_name))
                                
                                for table in tables:
                                    table_name = table[f'Tables_in_{db_name}'] if isinstance(table, dict) else table[0]
                                    table_item = QTreeWidgetItem(tables_item, [table_name])
                                    table_item.setData(0, Qt.ItemDataRole.UserRole, ('table', table_name))
                                
                                # 加载视图
                                cursor.execute("SHOW VIEWS")
                                views = cursor.fetchall()
                                
                                views_item = QTreeWidgetItem(db_item, ['视图'])
                                views_item.setData(0, Qt.ItemDataRole.UserRole, ('views', db_name))
                                
                                for view in views:
                                    view_name = view[f'Views_in_{db_name}'] if isinstance(view, dict) else view[0]
                                    view_item = QTreeWidgetItem(views_item, [view_name])
                                    view_item.setData(0, Qt.ItemDataRole.UserRole, ('view', view_name))
                                
                                # 加载函数
                                cursor.execute("SHOW FUNCTION STATUS WHERE Db = %s", (db_name,))
                                functions = cursor.fetchall()
                                
                                functions_item = QTreeWidgetItem(db_item, ['函数'])
                                functions_item.setData(0, Qt.ItemDataRole.UserRole, ('functions', db_name))
                                
                                for func in functions:
                                    func_name = func['Name'] if isinstance(func, dict) else func[1]
                                    func_item = QTreeWidgetItem(functions_item, [func_name])
                                    func_item.setData(0, Qt.ItemDataRole.UserRole, ('function', func_name))
                                
                                # 加载存储过程
                                cursor.execute("SHOW PROCEDURE STATUS WHERE Db = %s", (db_name,))
                                procedures = cursor.fetchall()
                                
                                procedures_item = QTreeWidgetItem(db_item, ['存储过程'])
                                procedures_item.setData(0, Qt.ItemDataRole.UserRole, ('procedures', db_name))
                                
                                for proc in procedures:
                                    proc_name = proc['Name'] if isinstance(proc, dict) else proc[1]
                                    proc_item = QTreeWidgetItem(procedures_item, [proc_name])
                                    proc_item.setData(0, Qt.ItemDataRole.UserRole, ('procedure', proc_name))
                                
                                # 加载事件
                                cursor.execute("SHOW EVENTS WHERE Db = %s", (db_name,))
                                events = cursor.fetchall()
                                
                                events_item = QTreeWidgetItem(db_item, ['事件'])
                                events_item.setData(0, Qt.ItemDataRole.UserRole, ('events', db_name))
                                
                                for event in events:
                                    event_name = event['Name'] if isinstance(event, dict) else event[1]
                                    event_item = QTreeWidgetItem(events_item, [event_name])
                                    event_item.setData(0, Qt.ItemDataRole.UserRole, ('event', event_name))
                                
                                # 展开表节点
                                tables_item.setExpanded(True)
                            except Exception as e:
                                self.logger.log('WARNING', f"加载数据库对象失败: {e}")
                elif self.main_window.current_db_type == 'PostgreSQL':
                    # PostgreSQL显示所有数据库
                    cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
                    databases = cursor.fetchall()

                    for db in databases:
                        db_name = db[0]
                        db_item = QTreeWidgetItem(conn_item, [db_name])
                        db_item.setData(0, Qt.ItemDataRole.UserRole, ('database', db_name))
                elif self.main_window.current_db_type == 'SQL Server':
                    # SQL Server显示所有数据库
                    cursor.execute("SELECT name FROM sys.databases")
                    databases = cursor.fetchall()

                    for db in databases:
                        db_name = db[0]
                        db_item = QTreeWidgetItem(conn_item, [db_name])
                        db_item.setData(0, Qt.ItemDataRole.UserRole, ('database', db_name))
        except Exception as e:
            self.logger.log('ERROR', f"加载数据库到连接树失败: {str(e)}")
    
    def _expand_all_items(self, tree):
        """
        展开所有节点
        """
        for i in range(tree.topLevelItemCount()):
            item = tree.topLevelItem(i)
            item.setExpanded(True)
            self._expand_all_children(item)
    
    def _expand_all_children(self, item):
        """
        展开所有子节点
        """
        for i in range(item.childCount()):
            child = item.child(i)
            child.setExpanded(True)
            self._expand_all_children(child)
