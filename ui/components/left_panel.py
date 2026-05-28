#!/usr/bin/env python3
"""
左侧面板模块
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QTabWidget, QTreeWidget, QTreeWidgetItem, 
    QHBoxLayout, QPushButton, QLineEdit, QLabel
)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QIcon, QPixmap
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
        self.setStyleSheet("QWidget { background-color: #ffffff; border-right: 1px solid #D0D0D0; }")

        # 添加标签页
        self.tab_widget = QTabWidget()
        self.tab_widget.setTabPosition(QTabWidget.TabPosition.North)
        self.tab_widget.setMinimumWidth(280)
        self.tab_widget.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #D0D0D0;
                background-color: #ffffff;
            }
            QTabBar::tab {
                padding: 8px 16px;
                font-size: 12px;
                font-family: 'Segoe UI';
                background-color: #F0F0F0;
                border: none;
                border-bottom: 2px solid transparent;
                margin-right: 2px;
                height: 32px;
            }
            QTabBar::tab:selected {
                background-color: #ffffff;
                border-bottom: 2px solid #007ACC;
                font-weight: normal;
            }
            QTabBar::tab:hover {
                background-color: #E3F2FD;
            }
        """)

        # 连接标签页（合并了对象浏览功能）
        self.create_connection_tab()

        # 收藏夹标签页
        self.create_favorites_tab()

        main_layout.addWidget(self.tab_widget)
    
    def create_connection_tab(self):
        """
        创建连接标签页（合并了对象浏览功能）
        """
        conn_tab = QWidget()
        conn_layout = QVBoxLayout(conn_tab)
        conn_layout.setContentsMargins(0, 0, 0, 0)

        # 搜索框
        search_layout = QHBoxLayout()
        search_layout.setContentsMargins(8, 8, 8, 8)
        self.connection_search = QLineEdit()
        self.connection_search.setPlaceholderText("输入对象名称...")
        self.connection_search.setStyleSheet("""
            QLineEdit {
                padding: 6px 8px;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                border: 1px solid #E0E0E0;
                border-radius: 2px;
                height: 28px;
                min-width: 200px;
            }
            QLineEdit:focus {
                border: 1px solid #007ACC;
                outline: none;
            }
        """)
        search_layout.addWidget(self.connection_search)
        conn_layout.addLayout(search_layout)

        # 连接树
        self.connection_tree = QTreeWidget()
        self.connection_tree.setHeaderLabel("")
        self.connection_tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.connection_tree.customContextMenuRequested.connect(self.main_window.event_handler.on_connection_context_menu)
        self.connection_tree.itemDoubleClicked.connect(self.main_window.event_handler.on_connection_double_clicked)
        self.connection_tree.itemClicked.connect(self.main_window.event_handler.on_connection_item_clicked)
        self.connection_tree.setIndentation(16)
        self.connection_tree.setStyleSheet("""
            QTreeWidget {
                background-color: #ffffff;
                border: none;
                font-family: 'Segoe UI';
                font-size: 12px;
            }
            QTreeWidget::item {
                padding: 3px 0;
                height: 22px;
            }
            QTreeWidget::item:hover {
                background-color: #E3F2FD;
            }
            QTreeWidget::item:selected {
                background-color: #E3F2FD;
                color: #333333;
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

        # 初始化图标
        self._init_icons()

        # 连接搜索信号
        self.connection_search_timer = QTimer()
        self.connection_search_timer.setSingleShot(True)
        self.connection_search_timer.timeout.connect(self._perform_search_on_connection_tree)
        self.connection_search.textChanged.connect(self._on_connection_search_text_changed)

    def create_favorites_tab(self):
        """
        创建收藏夹标签页
        """
        fav_tab = QWidget()
        fav_layout = QVBoxLayout(fav_tab)
        fav_layout.setContentsMargins(0, 0, 0, 0)

        # 收藏夹树
        self.favorites_tree = QTreeWidget()
        self.favorites_tree.setHeaderLabel("")
        self.favorites_tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        # self.favorites_tree.customContextMenuRequested.connect(self.main_window.event_handler.on_favorites_context_menu)
        # self.favorites_tree.itemDoubleClicked.connect(self.main_window.event_handler.on_favorites_double_clicked)
        self.favorites_tree.setIndentation(16)
        self.favorites_tree.setStyleSheet("""
            QTreeWidget {
                background-color: #ffffff;
                border: none;
                font-family: 'Segoe UI';
                font-size: 12px;
            }
            QTreeWidget::item {
                padding: 3px 0;
                height: 22px;
            }
            QTreeWidget::item:hover {
                background-color: #E3F2FD;
            }
            QTreeWidget::item:selected {
                background-color: #E3F2FD;
                color: #333333;
            }
        """)
        fav_layout.addWidget(self.favorites_tree)

        # 添加按钮
        fav_buttons = QHBoxLayout()
        fav_buttons.setContentsMargins(8, 8, 8, 8)
        fav_layout.addLayout(fav_buttons)

        self.add_fav_btn = QPushButton("+ 添加收藏")
        self.add_fav_btn.clicked.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("添加收藏"))
        self.add_fav_btn.setStyleSheet("""
            QPushButton {
                padding: 6px 12px;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                background-color: #007ACC;
                color: white;
                border: 1px solid #0056b3;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #0056b3;
                border: 1px solid #004085;
            }
            QPushButton:pressed {
                background-color: #004085;
                border: 1px solid #002752;
            }
        """)
        fav_buttons.addWidget(self.add_fav_btn)

        self.tab_widget.addTab(fav_tab, "收藏夹")

        # 加载收藏夹数据
        self.load_favorites()
    
    def load_connections_to_tree(self, show_only_current=False):
        """
        加载连接到树
        """
        self.connection_tree.clear()
        
        state = self.main_window.state_manager

        # 添加连接组
        for group_name, connections in state.connection_groups.items():
            # 过滤连接
            filtered_connections = []
            for conn_name in connections:
                if not show_only_current or conn_name == state.current_connection:
                    filtered_connections.append(conn_name)

            # 总是显示组，即使是空组
            group_item = QTreeWidgetItem(self.connection_tree, [group_name])
            group_item.setData(0, Qt.ItemDataRole.UserRole, ('group', group_name))
            # 为连接组添加图标
            group_item.setText(0, f"📁 {group_name}")
            
            for conn_name in filtered_connections:
                if conn_name in state.saved_connections:
                    conn_item = QTreeWidgetItem(group_item, [conn_name])
                    conn_item.setData(0, Qt.ItemDataRole.UserRole, ('connection', conn_name))
                    # 为连接添加图标
                    self._set_item_icon(conn_item, 'connection')
                    
                    # 如果是当前连接，加载数据库对象
                    if conn_name == state.current_connection and state.db_connection:
                        self._load_databases_to_connection_tree(conn_item)
        
        # 添加未分组的连接
        for conn_name, conn_data in state.saved_connections.items():
            # 检查是否已在组中
            in_group = False
            for group_name, connections in state.connection_groups.items():
                if conn_name in connections:
                    in_group = True
                    break
            
            if not in_group and (not show_only_current or conn_name == state.current_connection):
                conn_item = QTreeWidgetItem(self.connection_tree, [conn_name])
                conn_item.setData(0, Qt.ItemDataRole.UserRole, ('connection', conn_name))
                # 为连接添加图标
                self._set_item_icon(conn_item, 'connection')
                
                # 如果是当前连接，加载数据库对象
                if conn_name == state.current_connection and state.db_connection:
                    self._load_databases_to_connection_tree(conn_item)

        # 默认折叠所有节点，只在双击时展开
        # 不调用_expand_all_items，保持树结构默认折叠
    
    def _load_databases_to_connection_tree(self, conn_item):
        """
        加载数据库到连接树（只加载数据库列表，不加载内部对象）
        """
        state = self.main_window.state_manager
        if not state.db_connection:
            return

        try:
            with state.db_connection.cursor() as cursor:
                if state.current_db_type == 'MySQL' or state.current_db_type == 'MariaDB':
                    cursor.execute("SHOW DATABASES")
                    databases = cursor.fetchall()
                    for db in databases:
                        db_name = db['Database'] if isinstance(db, dict) else db[0]
                        if not db_name:
                            continue
                        self._add_database_to_tree(conn_item, db_name)
                elif state.current_db_type == 'PostgreSQL':
                    cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
                    databases = cursor.fetchall()
                    for db in databases:
                        db_name = db[0]
                        self._add_database_to_tree(conn_item, db_name)
                elif state.current_db_type == 'SQL Server':
                    cursor.execute("SELECT name FROM sys.databases")
                    databases = cursor.fetchall()
                    for db in databases:
                        db_name = db[0]
                        self._add_database_to_tree(conn_item, db_name)
        except Exception as e:
            self.logger.log('WARNING', f"加载数据库列表失败: {e}")

    def _add_database_to_tree(self, conn_item, db_name):
        """添加单个数据库到树中（不添加子文件夹，双击时再加载）"""
        db_item = QTreeWidgetItem(conn_item, [db_name])
        db_item.setData(0, Qt.ItemDataRole.UserRole, ('database', db_name))
        self._set_item_icon(db_item, 'database')

    def load_database_objects(self, db_item, db_name):
        """加载指定数据库的对象到树中"""
        try:
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type == 'MySQL' or self.main_window.current_db_type == 'MariaDB':
                    cursor.execute(f"USE `{db_name}`")
                    
                    tables = []
                    views = []
                    functions = []
                    events = []
                    
                    cursor.execute("SHOW TABLES")
                    tables_result = cursor.fetchall()
                    for table in tables_result:
                        table_name = table[f'Tables_in_{db_name}'] if isinstance(table, dict) else table[0]
                        tables.append(table_name)
                    
                    cursor.execute("SHOW FULL TABLES WHERE Table_type = 'VIEW'")
                    views_result = cursor.fetchall()
                    for view in views_result:
                        view_name = view[f'Tables_in_{db_name}'] if isinstance(view, dict) else view[0]
                        views.append(view_name)
                    
                    cursor.execute("SHOW FUNCTION STATUS WHERE Db = %s", (db_name,))
                    functions_result = cursor.fetchall()
                    for func in functions_result:
                        func_name = func['Name'] if isinstance(func, dict) else func[1]
                        functions.append(func_name)
                    
                    cursor.execute("SHOW EVENTS WHERE Db = %s", (db_name,))
                    events_result = cursor.fetchall()
                    for event in events_result:
                        event_name = event['Name'] if isinstance(event, dict) else event[1]
                        events.append(event_name)
                    
                    if tables:
                        tables_item = QTreeWidgetItem(db_item, ['表'])
                        tables_item.setData(0, Qt.ItemDataRole.UserRole, ('tables', db_name))
                        self._set_item_icon(tables_item, 'tables')
                        for table_name in tables:
                            table_item = QTreeWidgetItem(tables_item, [table_name])
                            table_item.setData(0, Qt.ItemDataRole.UserRole, ('table', table_name))
                            self._set_item_icon(table_item, 'table')
                    
                    if views:
                        views_item = QTreeWidgetItem(db_item, ['视图'])
                        views_item.setData(0, Qt.ItemDataRole.UserRole, ('views', db_name))
                        self._set_item_icon(views_item, 'views')
                        for view_name in views:
                            view_item = QTreeWidgetItem(views_item, [view_name])
                            view_item.setData(0, Qt.ItemDataRole.UserRole, ('view', view_name))
                            self._set_item_icon(view_item, 'view')
                    
                    if functions:
                        functions_item = QTreeWidgetItem(db_item, ['函数'])
                        functions_item.setData(0, Qt.ItemDataRole.UserRole, ('functions', db_name))
                        self._set_item_icon(functions_item, 'functions')
                        for func_name in functions:
                            func_item = QTreeWidgetItem(functions_item, [func_name])
                            func_item.setData(0, Qt.ItemDataRole.UserRole, ('function', func_name))
                            self._set_item_icon(func_item, 'function')
                    
                    if events:
                        events_item = QTreeWidgetItem(db_item, ['事件'])
                        events_item.setData(0, Qt.ItemDataRole.UserRole, ('events', db_name))
                        self._set_item_icon(events_item, 'events')
                        for event_name in events:
                            event_item = QTreeWidgetItem(events_item, [event_name])
                            event_item.setData(0, Qt.ItemDataRole.UserRole, ('event', event_name))
                            self._set_item_icon(event_item, 'event')
        except Exception as e:
            self.logger.log('WARNING', f"加载数据库对象失败: {e}")
    
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
    
    def _init_icons(self):
        """
        初始化图标
        """
        # Navicat风格的图标
        self.icons = {
            'connection': '🖥️',  # 服务器图标
            'database': '📁',      # 数据库图标
            'tables': '📁',        # 表文件夹图标
            'table': '📊',         # 表图标
            'views': '📁',         # 视图文件夹图标
            'view': '👁️',         # 视图图标
            'functions': '📁',     # 函数文件夹图标
            'function': 'fx',      # 函数图标
            'procedures': '📁',    # 存储过程文件夹图标
            'procedure': '⚙️',     # 存储过程图标
            'events': '📁',        # 事件文件夹图标
            'event': '⏰',         # 事件图标
            'queries': '📁',       # 查询文件夹图标
            'query': '🔍',         # 查询图标
            'reports': '📁',       # 报表文件夹图标
            'report': '📄',        # 报表图标
            'backups': '📁',       # 备份文件夹图标
            'backup': '💾',        # 备份图标
            'indexes': '📈',       # 索引文件夹图标
            'index': '📈'          # 索引图标
        }
    
    def _set_item_icon(self, item, item_type):
        """
        为树节点设置图标
        """
        if item_type in self.icons:
            # 使用文字图标作为替代
            item.setText(0, f"{self.icons[item_type]} {item.text(0)}")
    
    def _on_connection_search_text_changed(self, text):
        """
        搜索文本变化时的处理
        """
        self.connection_search_timer.start(300)
    
    def _perform_search_on_connection_tree(self):
        """
        在连接树上执行搜索
        """
        search_text = self.connection_search.text().lower()
        if not search_text:
            self._show_all_items_on_tree(self.connection_tree)
            return
        
        self._filter_items_on_tree(self.connection_tree, search_text)
    
    def _show_all_items_on_tree(self, tree):
        """
        显示树上的所有节点
        """
        for i in range(tree.topLevelItemCount()):
            item = tree.topLevelItem(i)
            item.setHidden(False)
            self._show_all_children(item)
    
    def _show_all_children(self, item):
        """
        显示所有子节点
        """
        for i in range(item.childCount()):
            child = item.child(i)
            child.setHidden(False)
            self._show_all_children(child)
    
    def _filter_items_on_tree(self, tree, search_text):
        """
        过滤树上的节点
        """
        for i in range(tree.topLevelItemCount()):
            item = tree.topLevelItem(i)
            self._filter_item(item, search_text)
    
    def _filter_item(self, item, search_text):
        """
        过滤单个节点
        """
        item_text = item.text(0).lower()
        matches = search_text in item_text
        
        has_matching_child = False
        for i in range(item.childCount()):
            child = item.child(i)
            child_matches = self._filter_item(child, search_text)
            if child_matches:
                has_matching_child = True
        
        if matches or has_matching_child:
            item.setHidden(False)
            return True
        else:
            item.setHidden(True)
            return False
    
    def load_favorites(self):
        """
        加载收藏夹数据
        """
        self.favorites_tree.clear()
        
        # 示例收藏夹数据
        # 实际应用中，应该从配置文件或数据库中加载
        favorites = {
            '常用连接': ['Local MySQL', 'Local PostgreSQL'],
            '常用表': ['employees.employees', 'employees.departments'],
            '常用查询': ['查询员工信息', '查询部门统计']
        }
        
        for category, items in favorites.items():
            category_item = QTreeWidgetItem(self.favorites_tree, [category])
            category_item.setData(0, Qt.ItemDataRole.UserRole, ('category', category))
            category_item.setText(0, f"📁 {category}")
            
            for item_name in items:
                fav_item = QTreeWidgetItem(category_item, [item_name])
                fav_item.setData(0, Qt.ItemDataRole.UserRole, ('favorite', item_name))
                if '.' in item_name:
                    # 表收藏
                    fav_item.setText(0, f"📊 {item_name}")
                else:
                    # 连接或查询收藏
                    fav_item.setText(0, f"🔗 {item_name}")
            
            # 展开分类
            category_item.setExpanded(True)
