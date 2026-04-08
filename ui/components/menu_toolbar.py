#!/usr/bin/env python3
"""
菜单和工具栏模块
"""

from PyQt6.QtWidgets import QMenuBar, QToolBar
from PyQt6.QtGui import QAction
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QIcon, QPainter, QPixmap

class MenuToolbarManager:
    """
    菜单和工具栏管理器
    """
    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
    
    def create_menu_bar(self):
        """
        创建菜单栏
        """
        menu_bar = self.main_window.menuBar()
        
        # 设置菜单栏样式
        menu_bar.setStyleSheet("""
            QMenuBar {
                background-color: #f0f0f0;
                border-bottom: 1px solid #d0d0d0;
                padding: 4px 0;
            }
            QMenuBar::item {
                padding: 6px 12px;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: transparent;
            }
            QMenuBar::item:hover {
                background-color: #e8e8e8;
                border-radius: 4px;
            }
            QMenuBar::item:selected {
                background-color: #e3f2fd;
                color: #1976d2;
                border-radius: 4px;
            }
            QMenu {
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
            }
            QMenu::item {
                padding: 6px 24px;
            }
            QMenu::item:hover {
                background-color: #e3f2fd;
                color: #1976d2;
            }
            QMenu::separator {
                height: 1px;
                background-color: #d0d0d0;
                margin: 4px 0;
            }
        """)

        # 文件菜单
        file_menu = menu_bar.addMenu("文件")
        file_menu.addAction("新建连接", self.main_window.event_handler.new_connection)
        file_menu.addAction("编辑连接", self.main_window.event_handler.edit_connection)
        file_menu.addAction("删除连接", self.main_window.event_handler.delete_connection)
        file_menu.addSeparator()
        file_menu.addAction("新建查询", self.main_window.event_handler.new_query)
        file_menu.addAction("打开SQL文件", self.main_window.event_handler.open_sql_file)
        file_menu.addAction("保存SQL文件", self.main_window.event_handler.save_sql_file)
        file_menu.addSeparator()
        file_menu.addAction("导入数据", self.main_window.event_handler.import_data)
        file_menu.addAction("导出数据", self.main_window.event_handler.export_data)
        file_menu.addSeparator()
        file_menu.addAction("退出", self.main_window.close)

        # 编辑菜单
        edit_menu = menu_bar.addMenu("编辑")
        edit_menu.addAction("复制", lambda: self.main_window.sql_operations.copy_sql())
        edit_menu.addAction("粘贴", lambda: self.main_window.sql_operations.paste_sql())
        edit_menu.addAction("剪切", lambda: self.main_window.sql_operations.cut_sql())
        edit_menu.addSeparator()
        edit_menu.addAction("全选", lambda: self.main_window.sql_operations.select_all_sql())
        edit_menu.addAction("查找", self.main_window.sql_operations.find_sql)
        edit_menu.addAction("替换", self.main_window.sql_operations.replace_sql)

        # 数据库菜单
        db_menu = menu_bar.addMenu("数据库")
        db_menu.addAction("新建数据库", self.main_window.event_handler.create_database)
        db_menu.addAction("删除数据库", self.main_window.event_handler.drop_database)
        db_menu.addSeparator()
        db_menu.addAction("备份数据库", self.main_window.event_handler.backup_database)
        db_menu.addAction("还原数据库", self.main_window.event_handler.restore_database)
        db_menu.addSeparator()
        db_menu.addAction("数据同步", self.main_window.event_handler.sync_data)
        db_menu.addAction("结构同步", self.main_window.event_handler.sync_structure)

        # 工具菜单
        tool_menu = menu_bar.addMenu("工具")
        tool_menu.addAction("SQL格式化", self.main_window.sql_operations.format_sql)
        tool_menu.addAction("执行计划", self.main_window.sql_operations.explain_sql)
        tool_menu.addSeparator()
        tool_menu.addAction("ER图表", self.main_window.event_handler.generate_er_diagram)
        tool_menu.addAction("数据传输", self.main_window.event_handler.transfer_data)
        tool_menu.addSeparator()
        tool_menu.addAction("计划任务", self.main_window.event_handler.scheduled_tasks)

        # 视图菜单
        view_menu = menu_bar.addMenu("视图")
        view_menu.addAction("刷新", self.main_window.event_handler.refresh_objects)
        view_menu.addSeparator()
        view_menu.addAction("显示/隐藏对象浏览器", self.main_window.event_handler.toggle_object_browser)
        view_menu.addAction("显示/隐藏状态栏", self.main_window.event_handler.toggle_status_bar)
        view_menu.addSeparator()
        view_menu.addAction("深色模式", self.main_window.event_handler.toggle_dark_mode)

        # 帮助菜单
        help_menu = menu_bar.addMenu("帮助")
        help_menu.addAction("使用帮助", self.main_window.event_handler.show_help)
        help_menu.addAction("关于", self.main_window.event_handler.about)
    
    def create_toolbar(self):
        """
        创建工具栏
        """
        # 主工具栏
        self.main_window.main_toolbar = self.main_window.addToolBar("主工具栏")
        self.main_window.main_toolbar.setIconSize(QSize(16, 16))
        self.main_window.main_toolbar.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonIconOnly)

        # 设置工具栏样式 - 完全匹配Navicat
        self.main_window.main_toolbar.setStyleSheet("""
            QToolBar {
                background-color: #f8f8f8;
                border: 1px solid #e0e0e0;
                padding: 2px;
                spacing: 1px;
            }
            QToolButton {
                padding: 4px 6px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                border: 1px solid transparent;
                border-radius: 2px;
                background-color: transparent;
                margin: 0 1px;
            }
            QToolButton:hover {
                background-color: #e8e8e8;
                border: 1px solid #d0d0d0;
            }
            QToolButton:pressed {
                background-color: #d0d0d0;
                border: 1px solid #b0b0b0;
            }
            QToolButton:checked {
                background-color: #e3f2fd;
                border: 1px solid #1976d2;
                color: #1976d2;
            }
        """)

        # 创建图标
        def create_icon(text):
            """创建简单图标"""
            pixmap = QPixmap(16, 16)
            pixmap.fill(Qt.GlobalColor.transparent)
            painter = QPainter(pixmap)
            painter.drawText(2, 12, text[0])
            painter.end()
            return QIcon(pixmap)

        # 按钮排列 - 完全按照Navicat的顺序
        # 新建连接
        self.main_window.new_conn_action = QAction(create_icon("新建"), "新建连接", self.main_window)
        self.main_window.new_conn_action.setToolTip("新建数据库连接")
        self.main_window.new_conn_action.triggered.connect(self.main_window.event_handler.new_connection)
        self.main_window.main_toolbar.addAction(self.main_window.new_conn_action)

        # 新建查询
        self.main_window.new_query_action = QAction(create_icon("查询"), "新建查询", self.main_window)
        self.main_window.new_query_action.setToolTip("新建SQL查询")
        self.main_window.new_query_action.triggered.connect(self.main_window.event_handler.new_query)
        self.main_window.main_toolbar.addAction(self.main_window.new_query_action)

        # 打开表
        self.main_window.open_table_action = QAction(create_icon("打开"), "打开表", self.main_window)
        self.main_window.open_table_action.setToolTip("打开表")
        self.main_window.open_table_action.triggered.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("打开表"))
        self.main_window.main_toolbar.addAction(self.main_window.open_table_action)

        # 设计表
        self.main_window.design_table_action = QAction(create_icon("设计"), "设计表", self.main_window)
        self.main_window.design_table_action.setToolTip("设计表")
        self.main_window.design_table_action.triggered.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("设计表"))
        self.main_window.main_toolbar.addAction(self.main_window.design_table_action)

        # 数据传输
        self.main_window.transfer_action = QAction(create_icon("传输"), "数据传输", self.main_window)
        self.main_window.transfer_action.setToolTip("数据传输")
        self.main_window.transfer_action.triggered.connect(self.main_window.event_handler.transfer_data)
        self.main_window.main_toolbar.addAction(self.main_window.transfer_action)

        # 导入向导
        self.main_window.import_wizard_action = QAction(create_icon("导入"), "导入向导", self.main_window)
        self.main_window.import_wizard_action.setToolTip("导入向导")
        self.main_window.import_wizard_action.triggered.connect(self.main_window.event_handler.import_data)
        self.main_window.main_toolbar.addAction(self.main_window.import_wizard_action)

        # 导出向导
        self.main_window.export_wizard_action = QAction(create_icon("导出"), "导出向导", self.main_window)
        self.main_window.export_wizard_action.setToolTip("导出向导")
        self.main_window.export_wizard_action.triggered.connect(self.main_window.event_handler.export_data)
        self.main_window.main_toolbar.addAction(self.main_window.export_wizard_action)

        # 自动运行
        self.main_window.auto_run_action = QAction(create_icon("自动"), "自动运行", self.main_window)
        self.main_window.auto_run_action.setToolTip("自动运行")
        self.main_window.auto_run_action.triggered.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("自动运行"))
        self.main_window.main_toolbar.addAction(self.main_window.auto_run_action)

        # 模型
        self.main_window.model_action = QAction(create_icon("模型"), "模型", self.main_window)
        self.main_window.model_action.setToolTip("数据库模型")
        self.main_window.model_action.triggered.connect(self.main_window.event_handler.generate_er_diagram)
        self.main_window.main_toolbar.addAction(self.main_window.model_action)

        # 添加分隔符
        self.main_window.main_toolbar.addSeparator()

        # 执行按钮
        self.main_window.execute_action = QAction(create_icon("执行"), "执行", self.main_window)
        self.main_window.execute_action.setToolTip("执行SQL")
        self.main_window.execute_action.triggered.connect(self.main_window.sql_operations.execute_sql)
        self.main_window.main_toolbar.addAction(self.main_window.execute_action)

        # 提交按钮
        self.main_window.commit_action = QAction(create_icon("提交"), "提交", self.main_window)
        self.main_window.commit_action.setToolTip("提交事务")
        self.main_window.commit_action.triggered.connect(self.main_window.event_handler.commit_transaction)
        self.main_window.main_toolbar.addAction(self.main_window.commit_action)

        # 回滚按钮
        self.main_window.rollback_action = QAction(create_icon("回滚"), "回滚", self.main_window)
        self.main_window.rollback_action.setToolTip("回滚事务")
        self.main_window.rollback_action.triggered.connect(self.main_window.event_handler.rollback_transaction)
        self.main_window.main_toolbar.addAction(self.main_window.rollback_action)
