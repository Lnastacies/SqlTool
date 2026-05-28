#!/usr/bin/env python3
"""
主应用窗口
"""

import sys
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QSplitter,
    QLabel, QStatusBar, QPushButton, QMessageBox
)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QIcon

from core.connection_pool import ConnectionPool
from core.state_manager import ApplicationStateManager
from core.event_bus import EventBus
from core.query_history import QueryHistoryManager
from core.shortcut_manager import SQLEditorShortcutManager
from core.snippet_manager import SnippetManager
from core.task_scheduler import TaskScheduler
from ui.components.left_panel import LeftPanel
from ui.components.right_panel import RightPanel
from ui.components.info_panel import InfoPanel
from ui.components.menu_toolbar import MenuToolbarManager
from ui.components.event_handler import EventHandler
from ui.components.sql_operations import SQLOperations
from ui.components.table_operations import TableOperations
from ui.components.data_import_export import DataImportExport
from ui.components.connection_manager import ConnectionManager
from ui.components.view_manager import ViewManager
from ui.components.routine_manager import RoutineManager
from ui.components.trigger_manager import TriggerManager
from ui.components.er_diagram import ERDiagramGenerator
from ui.components.data_transfer import DataTransfer
from ui.components.context_menus import ContextMenuManager, StatusBarEnhancer
from utils.logger import OperationLogger
from utils.thread_monitor import thread_monitor, setup_periodic_monitor

class NavicatStyleSQLTool(QMainWindow):
    """Navicat风格的数据库管理工具"""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Navicat Style - 数据库管理工具")
        self.setGeometry(100, 100, 1496, 960)
        self.setMinimumSize(1024, 768)

        # 初始化日志
        self.logger = OperationLogger()
        
        # 初始化线程监控
        thread_monitor.set_logger(self.logger)
        setup_periodic_monitor(interval=10.0, threshold=5.0)
        self.logger.log('INFO', '线程监控已启动')
        
        # 初始化状态管理器
        self.state_manager = ApplicationStateManager()
        
        # 初始化事件总线
        self.event_bus = EventBus()
        
        # 初始化连接池
        self.connection_pool = ConnectionPool(max_connections=5)
        self.connection_pool.set_logger(self.logger)
        
        # 初始化连接监控定时器
        self.connection_monitor_timer = QTimer()
        self.connection_monitor_timer.timeout.connect(self.monitor_connections)
        self.connection_monitor_timer.start(60000)

        # 初始化空闲连接清理定时器
        self.cleanup_timer = QTimer()
        self.cleanup_timer.timeout.connect(self.connection_pool.cleanup_idle_connections)
        self.cleanup_timer.start(300000)  # 每5分钟清理一次

        # 初始化连接管理器
        self.connection_manager = ConnectionManager(self)
        # 加载保存的连接
        self.connection_manager.load_connections()
        
        # 初始化事件处理器
        self.event_handler = EventHandler(self)
        
        # 初始化菜单工具栏管理器
        self.menu_toolbar_manager = MenuToolbarManager(self)
        
        # 初始化左侧面板
        self.left_panel = LeftPanel(self)
        
        # 初始化中央工作区
        self.right_panel = RightPanel(self)
        
        # 初始化右侧信息面板
        self.info_panel = InfoPanel(self)
        
        # 初始化业务组件
        self.table_operations = TableOperations(self)
        self.sql_operations = SQLOperations(self)
        self.data_import_export = DataImportExport(self)
        
        # 初始化查询历史管理器
        self.history_manager = QueryHistoryManager(self)
        
        # 初始化快捷键管理器
        self.shortcut_manager = SQLEditorShortcutManager(self)
        
        # 初始化代码片段管理器
        self.snippet_manager = SnippetManager()
        
        # 初始化任务调度器
        self.task_scheduler = TaskScheduler()
        self.task_scheduler.set_logger(self.logger)
        
        # 初始化视图管理器
        self.view_manager = None  # 延迟初始化
        
        # 初始化存储过程管理器
        self.routine_manager = None  # 延迟初始化
        
        # 初始化触发器管理器
        self.trigger_manager = None  # 延迟初始化
        
        # 初始化ER图生成器
        self.er_diagram = None  # 延迟初始化
        
        # 初始化右键菜单管理器
        self.context_menu_manager = ContextMenuManager(self)
        
        # 初始化状态栏增强
        self.status_bar_enhancer = StatusBarEnhancer(self)
        
        # 加载布局配置
        self.load_layout_config()
        
        # 创建UI
        self.setup_ui()

        # 设置默认主题
        self.set_theme('light')
        
        # 加载连接到左侧面板
        self.load_connections_to_tree()

        print("Navicat Style SQLTool初始化完成")

    def setup_ui(self):
        """设置UI布局"""
        # 创建中央组件和布局
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.main_layout = QVBoxLayout(self.central_widget)
        
        # 设置主布局边距为0，确保菜单栏紧贴窗口顶部
        self.main_layout.setContentsMargins(0, 0, 0, 0)
        # 设置布局间距为0，消除菜单栏和工具栏之间的空白
        self.main_layout.setSpacing(0)
        
        # 消除QMainWindow的默认标题栏边距
        self.setContentsMargins(0, 0, 0, 0)
        
        # 隐藏默认的菜单栏，避免占用空间
        menu_bar = self.menuBar()
        if menu_bar:
            menu_bar.hide()
        
        # 创建菜单栏
        self.menu_toolbar_manager.create_menu_bar()

        # 创建工具栏
        self.menu_toolbar_manager.create_toolbar()

        # 创建主分割器
        self.main_splitter = QSplitter(Qt.Orientation.Horizontal)
        # 设置分割器样式，确保可拖拽
        self.main_splitter.setStyleSheet("""
            QSplitter::handle {
                background-color: #E0E0E0;
                width: 4px;
                height: 4px;
            }
            QSplitter::handle:hover {
                background-color: #007ACC;
            }
        """)
        self.main_layout.addWidget(self.main_splitter)

        # 添加面板
        self.main_splitter.addWidget(self.left_panel)
        self.main_splitter.addWidget(self.right_panel)
        self.main_splitter.addWidget(self.info_panel)

        # 设置分割器比例，确保初始宽度分别为280px、剩余宽度、300px
        central_width = max(100, self.width() - 580)
        self.main_splitter.setSizes([280, central_width, 300])

        # 创建状态栏
        self.create_status_bar()

        # 窗口显示后检查菜单栏状态
        QTimer.singleShot(100, self.check_menu_bar_visibility)

    def create_status_bar(self):
        """创建状态栏"""
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)

        # 设置状态栏样式
        self.status_bar.setStyleSheet("""
            QStatusBar {
                background-color: #F0F0F0;
                border-top: 1px solid #D0D0D0;
                font-size: 11px;
                font-family: 'Segoe UI';
                padding: 4px 12px;
                min-height: 24px;
                height: 24px;
            }
            QStatusBar QLabel {
                margin-right: 20px;
                color: #333333;
                padding: 2px 0;
            }
        """)

        # 连接状态
        self.connection_status = QLabel("✅ 未连接")
        self.status_bar.addWidget(self.connection_status)

        # 当前数据库
        self.current_db_label = QLabel("数据库: 未选择")
        self.status_bar.addWidget(self.current_db_label)

        # 当前模式
        self.current_schema_label = QLabel("模式: 无")
        self.status_bar.addWidget(self.current_schema_label)

        # 执行时间
        self.execution_time = QLabel("执行时间: 0.0000 秒")
        self.status_bar.addWidget(self.execution_time)

        # 记录数
        self.record_count = QLabel("记录数: 0")
        self.status_bar.addWidget(self.record_count)

        # 光标位置
        self.cursor_position = QLabel("行: 1 / 列: 1")
        self.status_bar.addWidget(self.cursor_position)

        # 右侧工具按钮
        # 设置按钮
        settings_button = QPushButton("⚙️")
        settings_button.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                border: none;
                padding: 0 4px;
                font-size: 11px;
            }
            QPushButton:hover {
                background-color: #E3F2FD;
            }
        """)
        settings_button.setToolTip("设置")
        self.status_bar.addPermanentWidget(settings_button)

        # 刷新按钮
        refresh_button = QPushButton("🔄")
        refresh_button.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                border: none;
                padding: 0 4px;
                font-size: 11px;
            }
            QPushButton:hover {
                background-color: #E3F2FD;
            }
        """)
        refresh_button.setToolTip("刷新")
        refresh_button.clicked.connect(self.event_handler.refresh_objects)
        self.status_bar.addPermanentWidget(refresh_button)

        # 视图切换按钮
        list_view_button = QPushButton("☰")
        list_view_button.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                border: none;
                padding: 0 4px;
                font-size: 11px;
            }
            QPushButton:hover {
                background-color: #E3F2FD;
            }
        """)
        list_view_button.setToolTip("列表视图")
        self.status_bar.addPermanentWidget(list_view_button)

        details_view_button = QPushButton("📋")
        details_view_button.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                border: none;
                padding: 0 4px;
                font-size: 11px;
            }
            QPushButton:hover {
                background-color: #E3F2FD;
            }
        """)
        details_view_button.setToolTip("详细信息视图")
        self.status_bar.addPermanentWidget(details_view_button)

        icon_view_button = QPushButton("🖼️")
        icon_view_button.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                border: none;
                padding: 0 4px;
                font-size: 11px;
            }
            QPushButton:hover {
                background-color: #E3F2FD;
            }
        """)
        icon_view_button.setToolTip("大图标视图")
        self.status_bar.addPermanentWidget(icon_view_button)
        
        # 右下角信息
        self.status_info = QLabel("就绪")
        self.status_bar.addPermanentWidget(self.status_info)
        
        # 加载动画
        self.loading_timer = QTimer()
        self.loading_timer.timeout.connect(self.update_loading_status)
        self.loading_icons = ['|', '/', '-', '\\']
        self.loading_index = 0

    def check_menu_bar_visibility(self):
        """检查菜单栏可见性"""
        if self.menuBar():
            print(f"默认菜单栏可见性: {self.menuBar().isVisible()}, 几何: {self.menuBar().geometry()}")
        else:
            print("默认菜单栏不存在")
        
        if hasattr(self.menu_toolbar_manager, 'menu_bar_widget'):
            menu_bar = self.menu_toolbar_manager.menu_bar_widget
            print(f"自定义菜单栏可见性: {menu_bar.isVisible()}, 几何: {menu_bar.geometry()}")
        else:
            print("自定义菜单栏不存在")
    
    def load_connections(self):
        """加载保存的连接"""
        self.connection_manager.load_connections()

    def load_connections_to_tree(self, show_only_current=False):
        """加载连接到树"""
        self.left_panel.load_connections_to_tree(show_only_current)

    def save_connections(self):
        """保存连接"""
        try:
            self.connection_manager.saved_connections = self.state_manager.saved_connections
            self.connection_manager.connection_groups = self.state_manager.connection_groups
            self.connection_manager.save_connections()
        except Exception as e:
            self.logger.log('ERROR', f"保存连接失败: {e}")

    def update_all_tab_combos(self):
        """更新所有标签页的连接和数据库下拉框"""
        self.right_panel.update_all_tab_combos()

    def add_new_query_tab(self):
        """添加新的查询标签页"""
        self.right_panel.add_new_query_tab()
    
    def update_query_tab_info(self):
        """更新查询标签页的连接信息"""
        pass
    
    def show_object_details(self, item_type, item_name):
        """显示对象详情"""
        # 显示对象详情到右侧信息面板
        self.info_panel.show_object_details(item_type, item_name)

    def monitor_connections(self):
        """监控连接状态"""
        if hasattr(self, 'sql_executing') and self.sql_executing:
            return
        
        state = self.state_manager
        if state.db_connection:
            try:
                if state.current_db_type == 'MySQL' or state.current_db_type == 'MariaDB':
                    with state.db_connection.cursor() as cursor:
                        cursor.execute("SELECT 1")
                        cursor.fetchone()
                elif state.current_db_type == 'PostgreSQL':
                    with state.db_connection.cursor() as cursor:
                        cursor.execute("SELECT 1")
                        cursor.fetchone()
                elif state.current_db_type == 'SQL Server':
                    cursor = state.db_connection.cursor()
                    cursor.execute("SELECT 1")
                    cursor.fetchone()
                    cursor.close()
                
                self.connection_status.setText(f"✅ 已连接: {state.current_connection} ({state.current_db_type})")
            except Exception as e:
                self.logger.log('ERROR', f"连接监控发现连接断开: {str(e)}")
                if state.current_connection:
                    conn_data = state.saved_connections.get(state.current_connection)
                    if conn_data:
                        new_conn = self.connection_pool.refresh_connection(state.current_connection)
                        if new_conn:
                            state.db_connection = new_conn
                            self.logger.log('INFO', "连接已自动重连")
                            self.connection_status.setText(f"✅ 已连接: {state.current_connection} ({state.current_db_type})")
                            self.status_info.setText("连接已自动重连")
                        else:
                            self.logger.log('ERROR', "自动重连失败")
                            self.connection_status.setText(f"❌ 连接断开: {state.current_connection}")
                            self.status_info.setText("连接已断开，自动重连失败")

    def closeEvent(self, event):
        """关闭事件"""
        # 保存布局配置
        self.save_layout_config()
        
        if hasattr(self, 'connection_pool'):
            self.connection_pool.close_all_connections()
            self.logger.log('INFO', "关闭所有数据库连接")
        if hasattr(self, 'connection_monitor_timer'):
            self.connection_monitor_timer.stop()
        if hasattr(self, 'cleanup_timer'):
            self.cleanup_timer.stop()
        event.accept()
    
    def load_layout_config(self):
        """加载布局配置"""
        import json
        import os
        
        config_file = "layout_config.json"
        if os.path.exists(config_file):
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                
                # 恢复窗口大小和位置
                if 'window_geometry' in config:
                    geom = config['window_geometry']
                    self.setGeometry(
                        geom.get('x', 100),
                        geom.get('y', 100),
                        geom.get('width', 1496),
                        geom.get('height', 960)
                    )
                
                # 恢复分割器比例
                if 'splitter_sizes' in config and hasattr(self, 'main_splitter'):
                    self.main_splitter.setSizes(config['splitter_sizes'])
                
                # 恢复面板可见性
                if 'left_panel_visible' in config:
                    self.left_panel.setVisible(config['left_panel_visible'])
                if 'info_panel_visible' in config:
                    self.info_panel.setVisible(config['info_panel_visible'])
                
                self.logger.log('INFO', "布局配置已加载")
            except Exception as e:
                self.logger.log('WARNING', f"加载布局配置失败: {str(e)}")
    
    def save_layout_config(self):
        """保存布局配置"""
        import json
        
        config = {}
        
        # 保存窗口大小和位置
        geom = self.geometry()
        config['window_geometry'] = {
            'x': geom.x(),
            'y': geom.y(),
            'width': geom.width(),
            'height': geom.height()
        }
        
        # 保存分割器比例
        if hasattr(self, 'main_splitter'):
            config['splitter_sizes'] = self.main_splitter.sizes()
        
        # 保存面板可见性
        if hasattr(self, 'left_panel'):
            config['left_panel_visible'] = self.left_panel.isVisible()
        if hasattr(self, 'info_panel'):
            config['info_panel_visible'] = self.info_panel.isVisible()
        
        # 保存主题设置
        if hasattr(self, 'state_manager'):
            config['theme'] = self.state_manager.theme
        
        try:
            with open("layout_config.json", 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            self.logger.log('INFO', "布局配置已保存")
        except Exception as e:
            self.logger.log('WARNING', f"保存布局配置失败: {str(e)}")
    
    def set_theme(self, theme):
        """设置主题"""
        self.state_manager.set_theme(theme)
        self.apply_theme()
    
    def apply_theme(self):
        """应用主题"""
        theme = self.state_manager.theme
        if theme == 'dark':
            self.apply_dark_theme()
        elif theme == 'high_contrast':
            self.apply_high_contrast_theme()
        else:
            self.apply_light_theme()
    
    def apply_light_theme(self):
        """应用浅色主题"""
        self.setStyleSheet("""
            QMainWindow {
                background-color: #FFFFFF;
            }
            QWidget {
                background-color: #FFFFFF;
                color: #333333;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                font-size: 12px;
            }
            QMenuBar {
                background-color: #F8F9FA;
                border-bottom: 1px solid #E0E0E0;
                height: 30px;
            }
            QMenuBar::item {
                padding: 4px 12px;
                color: #333333;
            }
            QMenuBar::item:selected {
                background-color: #007ACC;
                color: #FFFFFF;
            }
            QToolBar {
                background-color: #FFFFFF;
                border-bottom: 1px solid #E0E0E0;
                height: 40px;
                padding: 4px;
                spacing: 4px;
            }
            QToolButton {
                background-color: transparent;
                border: none;
                padding: 6px;
                border-radius: 2px;
                margin: 0 2px;
            }
            QToolButton:hover {
                background-color: #E3F2FD;
            }
            QToolButton:pressed {
                background-color: #BBDEFB;
            }
            QSplitter::handle {
                background-color: #E0E0E0;
                width: 4px;
                height: 4px;
            }
            QSplitter::handle:hover {
                background-color: #007ACC;
            }
            QTreeWidget {
                background-color: #FFFFFF;
                border: none;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                font-size: 12px;
            }
            QTreeWidget::item {
                padding: 3px 0;
                height: 24px;
            }
            QTreeWidget::item:hover {
                background-color: #E3F2FD;
            }
            QTreeWidget::item:selected {
                background-color: #E3F2FD;
                color: #333333;
            }
            QTabWidget::pane {
                border: 1px solid #E0E0E0;
                background-color: #FFFFFF;
            }
            QTabBar::tab {
                padding: 8px 16px;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                background-color: #F8F9FA;
                border: none;
                border-bottom: 2px solid transparent;
                margin-right: 2px;
                height: 32px;
            }
            QTabBar::tab:selected {
                background-color: #FFFFFF;
                border-bottom: 2px solid #007ACC;
                font-weight: normal;
            }
            QTabBar::tab:hover {
                background-color: #E3F2FD;
            }
            QTableWidget {
                background-color: #FFFFFF;
                border: 1px solid #E0E0E0;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                gridline-color: #f0f0f0;
            }
            QTableWidget QHeaderView::section {
                background-color: #f8f8f8;
                border: 1px solid #e0e0e0;
                padding: 4px 8px;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                font-weight: bold;
                text-align: left;
            }
            QTableWidget::item {
                padding: 4px 8px;
                height: 24px;
                border: 1px solid transparent;
            }
            QTableWidget::item:hover {
                background-color: #f5f5f5;
            }
            QTableWidget::item:selected {
                background-color: #e3f2fd;
                color: #333333;
                border: 1px solid #bbdefb;
            }
            QTableWidget::alternatingRowColors {
                background-color: #F8F9FA;
            }
            QPushButton {
                background-color: #F8F9FA;
                border: 1px solid #E0E0E0;
                border-radius: 2px;
                padding: 6px 12px;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
            }
            QPushButton:hover {
                background-color: #E3F2FD;
                border-color: #007ACC;
            }
            QPushButton:pressed {
                background-color: #007ACC;
                color: #FFFFFF;
            }
            QPushButton[style="primary"] {
                background-color: #2ECC71;
                color: white;
                border: 1px solid #27AE60;
            }
            QPushButton[style="danger"] {
                background-color: #E74C3C;
                color: white;
                border: 1px solid #C0392B;
            }
            QLineEdit {
                border: 1px solid #E0E0E0;
                border-radius: 2px;
                padding: 6px 8px;
                background-color: #FFFFFF;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                height: 28px;
            }
            QLineEdit:focus {
                border-color: #007ACC;
                outline: none;
            }
            QComboBox {
                border: 1px solid #E0E0E0;
                border-radius: 2px;
                padding: 6px 8px;
                background-color: #FFFFFF;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
            }
            QComboBox:focus {
                border-color: #007ACC;
                outline: none;
            }
            QTextEdit {
                border: 1px solid #E0E0E0;
                border-radius: 2px;
                padding: 6px 8px;
                background-color: #FFFFFF;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
            }
            QTextEdit:focus {
                border-color: #007ACC;
                outline: none;
            }
        """)
        
        if hasattr(self, 'left_panel'):
            self.left_panel.setStyleSheet("""
                QWidget {
                    background-color: #FFFFFF;
                    color: #333333;
                }
                QGroupBox {
                    border: 1px solid #E0E0E0;
                    border-radius: 2px;
                    margin-top: 8px;
                }
                QGroupBox::title {
                    subcontrol-origin: margin;
                    left: 8px;
                    top: -6px;
                    padding: 0 4px;
                    background-color: #FFFFFF;
                }
            """)
        
        if hasattr(self, 'right_panel'):
            self.right_panel.setStyleSheet("""
                QWidget {
                    background-color: #FFFFFF;
                    color: #333333;
                }
            """)
        
        if hasattr(self, 'status_bar'):
            self.status_bar.setStyleSheet("""
                QStatusBar {
                    background-color: #F8F9FA;
                    border-top: 1px solid #E0E0E0;
                    font-size: 11px;
                    font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                    padding: 4px 12px;
                    min-height: 24px;
                }
                QStatusBar QLabel {
                    margin-right: 20px;
                    color: #333333;
                    padding: 2px 0;
                }
            """)
    
    def apply_dark_theme(self):
        """应用深色主题"""
        self.setStyleSheet("""
            QMainWindow {
                background-color: #1E1E1E;
            }
            QWidget {
                background-color: #1E1E1E;
                color: #D4D4D4;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                font-size: 12px;
            }
            QMenuBar {
                background-color: #252526;
                border-bottom: 1px solid #3C3C3C;
                height: 30px;
            }
            QMenuBar::item {
                padding: 4px 12px;
                color: #D4D4D4;
            }
            QMenuBar::item:selected {
                background-color: #007ACC;
                color: #FFFFFF;
            }
            QToolBar {
                background-color: #252526;
                border-bottom: 1px solid #3C3C3C;
                height: 40px;
            }
            QToolButton {
                background-color: transparent;
                border: none;
                padding: 6px;
                border-radius: 2px;
            }
            QToolButton:hover {
                background-color: #3C3C3C;
            }
            QToolButton:pressed {
                background-color: #007ACC;
            }
            QSplitter::handle {
                background-color: #3C3C3C;
                width: 4px;
                height: 4px;
            }
            QSplitter::handle:hover {
                background-color: #007ACC;
            }
            QTreeWidget {
                background-color: #1E1E1E;
                border: 1px solid #3C3C3C;
            }
            QTreeWidget::item {
                padding: 4px;
            }
            QTreeWidget::item:hover {
                background-color: #3C3C3C;
            }
            QTreeWidget::item:selected {
                background-color: #007ACC;
                color: #FFFFFF;
            }
            QTabWidget::pane {
                border: 1px solid #3C3C3C;
            }
            QTabBar::tab {
                padding: 8px 16px;
                border: 1px solid #3C3C3C;
                border-bottom: none;
                background-color: #252526;
                color: #D4D4D4;
            }
            QTabBar::tab:selected {
                background-color: #1E1E1E;
                border-top: 2px solid #007ACC;
                color: #D4D4D4;
            }
            QTableWidget {
                background-color: #1E1E1E;
                border: 1px solid #3C3C3C;
            }
            QTableWidget::item {
                padding: 4px;
            }
            QTableWidget::item:selected {
                background-color: #007ACC;
                color: #FFFFFF;
            }
            QTableWidget::alternatingRowColors {
                background-color: #252526;
            }
            QPushButton {
                background-color: #252526;
                border: 1px solid #3C3C3C;
                border-radius: 2px;
                padding: 6px 12px;
                color: #D4D4D4;
            }
            QPushButton:hover {
                background-color: #3C3C3C;
                border-color: #007ACC;
            }
            QPushButton:pressed {
                background-color: #007ACC;
                color: #FFFFFF;
            }
            QLineEdit {
                border: 1px solid #3C3C3C;
                border-radius: 2px;
                padding: 6px;
                background-color: #252526;
                color: #D4D4D4;
            }
            QLineEdit:focus {
                border-color: #007ACC;
            }
            QComboBox {
                border: 1px solid #3C3C3C;
                border-radius: 2px;
                padding: 6px;
                background-color: #252526;
                color: #D4D4D4;
            }
            QComboBox:focus {
                border-color: #007ACC;
            }
        """)
        
        if hasattr(self, 'left_panel'):
            self.left_panel.setStyleSheet("""
                QWidget {
                    background-color: #1E1E1E;
                    color: #D4D4D4;
                }
                QGroupBox {
                    border: 1px solid #3C3C3C;
                    border-radius: 2px;
                    margin-top: 8px;
                }
                QGroupBox::title {
                    subcontrol-origin: margin;
                    left: 8px;
                    top: -6px;
                    padding: 0 4px;
                    background-color: #1E1E1E;
                    color: #D4D4D4;
                }
            """)
        
        if hasattr(self, 'right_panel'):
            self.right_panel.setStyleSheet("""
                QWidget {
                    background-color: #1E1E1E;
                    color: #D4D4D4;
                }
            """)
        
        if hasattr(self, 'status_bar'):
            self.status_bar.setStyleSheet("""
                QStatusBar {
                    background-color: #252526;
                    border-top: 1px solid #3C3C3C;
                    font-size: 11px;
                    font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                    padding: 4px 12px;
                    min-height: 24px;
                    color: #D4D4D4;
                }
                QStatusBar QLabel {
                    margin-right: 20px;
                    color: #D4D4D4;
                    padding: 2px 0;
                }
            """)
    
    def apply_high_contrast_theme(self):
        """应用高对比度主题"""
        self.setStyleSheet("""
            QMainWindow {
                background-color: #000000;
            }
            QWidget {
                background-color: #000000;
                color: #FFFFFF;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                font-size: 12px;
            }
            QMenuBar {
                background-color: #222222;
                border-bottom: 1px solid #444444;
                height: 30px;
            }
            QMenuBar::item {
                padding: 4px 12px;
                color: #FFFFFF;
            }
            QMenuBar::item:selected {
                background-color: #007ACC;
                color: #FFFFFF;
            }
            QToolBar {
                background-color: #222222;
                border-bottom: 1px solid #444444;
                height: 40px;
            }
            QToolButton {
                background-color: transparent;
                border: none;
                padding: 6px;
                border-radius: 2px;
            }
            QToolButton:hover {
                background-color: #444444;
            }
            QToolButton:pressed {
                background-color: #007ACC;
            }
            QSplitter::handle {
                background-color: #444444;
                width: 4px;
                height: 4px;
            }
            QSplitter::handle:hover {
                background-color: #007ACC;
            }
            QTreeWidget {
                background-color: #000000;
                border: 1px solid #444444;
            }
            QTreeWidget::item {
                padding: 4px;
            }
            QTreeWidget::item:hover {
                background-color: #444444;
            }
            QTreeWidget::item:selected {
                background-color: #007ACC;
                color: #FFFFFF;
            }
            QTabWidget::pane {
                border: 1px solid #444444;
            }
            QTabBar::tab {
                padding: 8px 16px;
                border: 1px solid #444444;
                border-bottom: none;
                background-color: #222222;
                color: #FFFFFF;
            }
            QTabBar::tab:selected {
                background-color: #000000;
                border-top: 2px solid #007ACC;
                color: #FFFFFF;
            }
            QTableWidget {
                background-color: #000000;
                border: 1px solid #444444;
            }
            QTableWidget::item {
                padding: 4px;
            }
            QTableWidget::item:selected {
                background-color: #007ACC;
                color: #FFFFFF;
            }
            QTableWidget::alternatingRowColors {
                background-color: #222222;
            }
            QPushButton {
                background-color: #222222;
                border: 1px solid #444444;
                border-radius: 2px;
                padding: 6px 12px;
                color: #FFFFFF;
            }
            QPushButton:hover {
                background-color: #444444;
                border-color: #007ACC;
            }
            QPushButton:pressed {
                background-color: #007ACC;
                color: #FFFFFF;
            }
            QLineEdit {
                border: 1px solid #444444;
                border-radius: 2px;
                padding: 6px;
                background-color: #222222;
                color: #FFFFFF;
            }
            QLineEdit:focus {
                border-color: #007ACC;
            }
            QComboBox {
                border: 1px solid #444444;
                border-radius: 2px;
                padding: 6px;
                background-color: #222222;
                color: #FFFFFF;
            }
            QComboBox:focus {
                border-color: #007ACC;
            }
        """)
        
        if hasattr(self, 'left_panel'):
            self.left_panel.setStyleSheet("""
                QWidget {
                    background-color: #000000;
                    color: #FFFFFF;
                }
                QGroupBox {
                    border: 1px solid #444444;
                    border-radius: 2px;
                    margin-top: 8px;
                }
                QGroupBox::title {
                    subcontrol-origin: margin;
                    left: 8px;
                    top: -6px;
                    padding: 0 4px;
                    background-color: #000000;
                    color: #FFFFFF;
                }
            """)
        
        if hasattr(self, 'right_panel'):
            self.right_panel.setStyleSheet("""
                QWidget {
                    background-color: #000000;
                    color: #FFFFFF;
                }
            """)
        
        if hasattr(self, 'status_bar'):
            self.status_bar.setStyleSheet("""
                QStatusBar {
                    background-color: #222222;
                    border-top: 1px solid #444444;
                    font-size: 11px;
                    font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                    padding: 4px 12px;
                    min-height: 24px;
                    color: #FFFFFF;
                }
                QStatusBar QLabel {
                    margin-right: 20px;
                    color: #FFFFFF;
                    padding: 2px 0;
                }
            """)

    def start_loading(self, message="加载中..."):
        """开始加载动画"""
        self.status_info.setText(f"{message} {self.loading_icons[0]}")
        self.loading_timer.start(200)
    
    def stop_loading(self):
        """停止加载动画"""
        self.loading_timer.stop()
        self.status_info.setText("就绪")
    
    def update_loading_status(self):
        """更新加载状态"""
        self.loading_index = (self.loading_index + 1) % len(self.loading_icons)
        current_text = self.status_info.text()
        if ' ' in current_text:
            message = current_text.rsplit(' ', 1)[0]
        else:
            message = current_text
        self.status_info.setText(f"{message} {self.loading_icons[self.loading_index]}")

    @property
    def current_connection(self):
        return self.state_manager.current_connection
    
    @current_connection.setter
    def current_connection(self, value):
        self.state_manager.current_connection = value
    
    @property
    def current_db(self):
        return self.state_manager.current_db
    
    @current_db.setter
    def current_db(self, value):
        self.state_manager.set_database(value)
    
    @property
    def current_db_type(self):
        return self.state_manager.current_db_type
    
    @current_db_type.setter
    def current_db_type(self, value):
        self.state_manager.current_db_type = value
    
    @property
    def db_connection(self):
        return self.state_manager.db_connection
    
    @db_connection.setter
    def db_connection(self, value):
        self.state_manager.db_connection = value
    
    @property
    def saved_connections(self):
        return self.state_manager.saved_connections
    
    @saved_connections.setter
    def saved_connections(self, value):
        self.state_manager.saved_connections = value
    
    @property
    def connection_groups(self):
        return self.state_manager.connection_groups
    
    @connection_groups.setter
    def connection_groups(self, value):
        self.state_manager.connection_groups = value

    def show_view_manager(self):
        """显示视图管理器"""
        if not self.check_connection():
            return
        from ui.components.view_manager import ViewManager
        dialog = ViewManager(self)
        dialog.exec()

    def show_routine_manager(self):
        """显示存储过程/函数管理器"""
        if not self.check_connection():
            return
        from ui.components.routine_manager import RoutineManager
        dialog = RoutineManager(self)
        dialog.exec()

    def show_trigger_manager(self):
        """显示触发器管理器"""
        if not self.check_connection():
            return
        from ui.components.trigger_manager import TriggerManager
        dialog = TriggerManager(self)
        dialog.exec()

    def show_er_diagram(self):
        """显示ER图"""
        if not self.check_connection():
            return
        from ui.components.er_diagram import ERDiagramGenerator
        dialog = ERDiagramGenerator(self)
        dialog.exec()

    def show_data_transfer(self):
        """显示数据传输向导"""
        # 数据传输功能会让用户自己选择源和目标连接，不需要预先连接到数据库
        from ui.components.data_transfer import DataTransfer
        dialog = DataTransfer(self)
        dialog.exec()

    def show_structure_sync(self):
        """显示结构同步对话框"""
        # 结构同步功能会让用户自己选择源和目标连接，不需要预先连接到数据库
        from ui.components.structure_sync import StructureSync
        dialog = StructureSync(self)
        dialog.exec()

    def show_task_scheduler(self):
        """显示计划任务对话框"""
        from core.task_scheduler import TaskSchedulerDialog
        dialog = TaskSchedulerDialog(self)
        dialog.exec()

    def show_snippet_manager(self):
        """显示代码片段对话框"""
        from core.snippet_manager import SnippetDialog
        dialog = SnippetDialog(self)
        if dialog.exec():
            if dialog.selected_sql:
                current_tab = self.right_panel.tabs.currentWidget()
                if current_tab and hasattr(current_tab, 'sql_editor'):
                    current_tab.sql_editor.setPlainText(dialog.selected_sql)

    def show_utility_tools(self):
        """显示实用工具对话框"""
        from core.utility_tools import UtilityToolsDialog
        dialog = UtilityToolsDialog(self)
        dialog.exec()

    def show_performance_monitor(self):
        """显示性能监控对话框"""
        from core.performance_monitor import PerformanceMonitor
        dialog = PerformanceMonitor(self)
        dialog.exec()

    def check_connection(self):
        """检查数据库连接"""
        # 通过状态管理器检查连接
        if hasattr(self, 'state_manager') and self.state_manager.db_connection:
            return True
        
        # 兼容旧的检查方式
        if hasattr(self, 'db_connection') and self.db_connection:
            return True
            
        from PyQt6.QtWidgets import QMessageBox
        QMessageBox.warning(self, "未连接", "请先连接到数据库")
        return False