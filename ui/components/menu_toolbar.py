#!/usr/bin/env python3
"""
菜单和工具栏模块
"""

from PyQt6.QtWidgets import QMenuBar, QToolBar
from PyQt6.QtGui import QAction, QFont
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
        创建菜单栏 - 独立组件，紧贴应用边框
        """
        from PyQt6.QtWidgets import QWidget, QHBoxLayout, QPushButton, QMenu
        
        # 创建独立的菜单栏组件
        self.menu_bar_widget = QWidget()
        self.menu_bar_widget.setObjectName("menuBarWidget")
        
        # 设置菜单栏样式 - 紧贴应用边框，上移到顶部
        self.menu_bar_widget.setStyleSheet("""
            #menuBarWidget {
                background-color: #F0F0F0;
                border-bottom: 1px solid #D0D0D0;
                margin: 0;
                padding: 0;
                height: 24px;
                max-height: 24px;
                min-height: 24px;
            }
        """)
        
        # 创建菜单布局
        menu_layout = QHBoxLayout(self.menu_bar_widget)
        menu_layout.setContentsMargins(0, 0, 0, 0)
        menu_layout.setSpacing(0)
        
        # 菜单项样式 - 按要求设置
        menu_item_style = """
            QPushButton {
                background-color: #F0F0F0;
                border: none;
                padding: 4px 8px;
                font-size: 12px;
                font-family: 'Segoe UI';
                color: #333333;
                margin: 0;
                min-height: 22px;
            }
            QPushButton:hover {
                background-color: #E3F2FD;
                color: #007ACC;
            }
            QPushButton:pressed {
                background-color: #BBDEFB;
            }
        """
        
        # 下拉菜单样式
        menu_style = """
            QMenu {
                background-color: #FFFFFF;
                border: 1px solid #D0D0D0;
                padding: 3px 0;
            }
            QMenu::item {
                padding: 4px 25px 4px 15px;
                font-size: 11px;
                font-family: 'Segoe UI';
                color: #333333;
            }
            QMenu::item:selected {
                background-color: #E3F2FD;
                color: #007ACC;
            }
            QMenu::separator {
                height: 1px;
                background-color: #E0E0E0;
                margin: 3px 8px;
            }
        """
        
        # 定义菜单项和对应的子菜单
        menus = [
            ("文件", self._create_file_menu),
            ("编辑", self._create_edit_menu),
            ("查看", self._create_view_menu),
            ("收藏夹", self._create_favorites_menu),
            ("工具", self._create_tool_menu),
            ("窗口", self._create_window_menu),
            ("帮助", self._create_help_menu),
        ]
        
        # 创建菜单按钮
        for menu_name, create_func in menus:
            btn = QPushButton(menu_name)
            btn.setStyleSheet(menu_item_style)
            
            # 创建下拉菜单
            menu = QMenu(menu_name, self.menu_bar_widget)
            menu.setStyleSheet(menu_style)
            create_func(menu)
            
            # 设置按钮点击显示菜单
            btn.setMenu(menu)
            
            menu_layout.addWidget(btn)
        
        # 添加弹性空间，将登录按钮推到右边
        menu_layout.addStretch()
        
        # 添加登录按钮
        login_button = QPushButton("登录")
        login_button.setStyleSheet(menu_item_style)
        menu_layout.addWidget(login_button)
        
        # 将菜单栏添加到主布局的最顶部
        self.main_window.main_layout.insertWidget(0, self.menu_bar_widget)
        
        print(f"自定义菜单栏创建完成")
    
    def create_toolbar(self):
        """
        创建工具栏 - 独立组件，添加到菜单栏下方
        """
        from PyQt6.QtWidgets import QToolBar
        
        # 主工具栏 - 创建为独立widget
        self.main_window.main_toolbar = QToolBar("主工具栏")
        self.main_window.main_toolbar.setIconSize(QSize(16, 16))
        self.main_window.main_toolbar.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextUnderIcon)
        
        # 设置工具栏为可移动的浮动窗口样式，但固定位置
        self.main_window.main_toolbar.setMovable(False)
        self.main_window.main_toolbar.setFloatable(False)

        # 设置工具栏样式 - 紧凑模式
        self.main_window.main_toolbar.setStyleSheet("""
            QToolBar {
                background-color: #F0F0F0;
                border-bottom: 1px solid #D0D0D0;
                height: 30px;
                padding: 1px 4px;
                spacing: 2px;
                margin: 0;
            }
            QToolButton {
                background-color: transparent;
                border: none;
                padding: 1px;
                border-radius: 2px;
                margin: 0 1px;
                min-width: 36px;
            }
            QToolButton:hover {
                background-color: #E3F2FD;
            }
            QToolButton:pressed {
                background-color: #E3F2FD;
            }
            QToolButton:checked {
                background-color: #E3F2FD;
                border: 1px solid #007ACC;
            }
            QToolButton QLabel {
                font-size: 9px;
                font-family: 'Segoe UI';
            }
        """)

        # 创建图标
        def create_icon(text):
            """创建简单图标"""
            pixmap = QPixmap(16, 16)
            pixmap.fill(Qt.GlobalColor.transparent)
            painter = QPainter(pixmap)
            painter.setFont(QFont('Segoe UI', 10))
            painter.drawText(2, 14, text)
            painter.end()
            return QIcon(pixmap)

        # 按钮排列 - 完全按照Navicat 16的顺序：连接、新建查询、表、视图、函数、事件、用户、查询、报表、备份、自动运行、模型
        # 连接
        self.main_window.connect_action = QAction(create_icon("🖥️"), "连接", self.main_window)
        self.main_window.connect_action.setToolTip("数据库连接")
        self.main_window.connect_action.triggered.connect(self.main_window.event_handler.new_connection)
        self.main_window.main_toolbar.addAction(self.main_window.connect_action)

        # 新建查询
        self.main_window.new_query_action = QAction(create_icon("📄"), "新建查询", self.main_window)
        self.main_window.new_query_action.setToolTip("新建SQL查询")
        self.main_window.new_query_action.triggered.connect(self.main_window.event_handler.new_query)
        self.main_window.main_toolbar.addAction(self.main_window.new_query_action)

        # 表
        self.main_window.table_action = QAction(create_icon("📊"), "表", self.main_window)
        self.main_window.table_action.setToolTip("表管理")
        self.main_window.table_action.triggered.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("表管理"))
        self.main_window.main_toolbar.addAction(self.main_window.table_action)

        # 视图
        self.main_window.view_action = QAction(create_icon("👁️"), "视图", self.main_window)
        self.main_window.view_action.setToolTip("视图管理")
        self.main_window.view_action.triggered.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("视图管理"))
        self.main_window.main_toolbar.addAction(self.main_window.view_action)

        # 函数
        self.main_window.function_action = QAction(create_icon("fx"), "函数", self.main_window)
        self.main_window.function_action.setToolTip("函数管理")
        self.main_window.function_action.triggered.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("函数管理"))
        self.main_window.main_toolbar.addAction(self.main_window.function_action)

        # 事件
        self.main_window.event_action = QAction(create_icon("⏰"), "事件", self.main_window)
        self.main_window.event_action.setToolTip("事件管理")
        self.main_window.event_action.triggered.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("事件管理"))
        self.main_window.main_toolbar.addAction(self.main_window.event_action)

        # 用户
        self.main_window.user_action = QAction(create_icon("👤"), "用户", self.main_window)
        self.main_window.user_action.setToolTip("用户管理")
        self.main_window.user_action.triggered.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("用户管理"))
        self.main_window.main_toolbar.addAction(self.main_window.user_action)

        # 查询
        self.main_window.query_action = QAction(create_icon("🔍"), "查询", self.main_window)
        self.main_window.query_action.setToolTip("查询管理")
        self.main_window.query_action.triggered.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("查询管理"))
        self.main_window.main_toolbar.addAction(self.main_window.query_action)

        # 报表
        self.main_window.report_action = QAction(create_icon("📄"), "报表", self.main_window)
        self.main_window.report_action.setToolTip("报表管理")
        self.main_window.report_action.triggered.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("报表管理"))
        self.main_window.main_toolbar.addAction(self.main_window.report_action)

        # 备份
        self.main_window.backup_action = QAction(create_icon("💾"), "备份", self.main_window)
        self.main_window.backup_action.setToolTip("备份管理")
        self.main_window.backup_action.triggered.connect(self.main_window.event_handler.backup_database)
        self.main_window.main_toolbar.addAction(self.main_window.backup_action)

        # 自动运行
        self.main_window.auto_run_action = QAction(create_icon("🔄"), "自动运行", self.main_window)
        self.main_window.auto_run_action.setToolTip("自动运行")
        self.main_window.auto_run_action.triggered.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("自动运行"))
        self.main_window.main_toolbar.addAction(self.main_window.auto_run_action)

        # 模型
        self.main_window.model_action = QAction(create_icon("📋"), "模型", self.main_window)
        self.main_window.model_action.setToolTip("模型管理")
        self.main_window.model_action.triggered.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("模型管理"))
        self.main_window.main_toolbar.addAction(self.main_window.model_action)
        
        # 将工具栏添加到主布局中（在菜单栏下方）
        self.main_window.main_layout.insertWidget(1, self.main_window.main_toolbar)
        
        # 调试信息
        print(f"工具栏创建完成，已添加到主布局")
    
    def _apply_menu_bar_style(self):
        """重新应用菜单栏样式（确保不被主题覆盖）"""
        if hasattr(self, 'menu_bar_widget') and self.menu_bar_widget:
            self.menu_bar_widget.show()
            self.menu_bar_widget.raise_()
    
    def _create_file_menu(self, menu):
        """创建文件菜单"""
        menu.addAction("新建查询", self.main_window.event_handler.new_query)
        menu.addAction("打开", self.main_window.event_handler.open_sql_file)
        menu.addAction("保存", self.main_window.event_handler.save_sql_file)
        menu.addAction("另存为", lambda: self.main_window.event_handler.show_feature_not_implemented("另存为"))
        menu.addSeparator()
        menu.addAction("关闭", lambda: self.main_window.event_handler.show_feature_not_implemented("关闭"))
        menu.addAction("关闭所有", lambda: self.main_window.event_handler.show_feature_not_implemented("关闭所有"))
        menu.addSeparator()
        menu.addAction("打印", lambda: self.main_window.event_handler.show_feature_not_implemented("打印"))
        menu.addSeparator()
        menu.addAction("退出", self.main_window.close)
    
    def _create_edit_menu(self, menu):
        """创建编辑菜单"""
        menu.addAction("撤销", lambda: self.main_window.event_handler.show_feature_not_implemented("撤销"))
        menu.addAction("重做", lambda: self.main_window.event_handler.show_feature_not_implemented("重做"))
        menu.addSeparator()
        menu.addAction("剪切", lambda: self.main_window.sql_operations.cut_sql())
        menu.addAction("复制", lambda: self.main_window.sql_operations.copy_sql())
        menu.addAction("粘贴", lambda: self.main_window.sql_operations.paste_sql())
        menu.addAction("删除", lambda: self.main_window.event_handler.show_feature_not_implemented("删除"))
        menu.addSeparator()
        menu.addAction("全选", lambda: self.main_window.sql_operations.select_all_sql())
        menu.addSeparator()
        menu.addAction("查找", self.main_window.sql_operations.find_sql)
        menu.addAction("替换", self.main_window.sql_operations.replace_sql)
    
    def _create_view_menu(self, menu):
        """创建查看菜单"""
        menu.addAction("显示工具栏", lambda: self.main_window.event_handler.show_feature_not_implemented("显示工具栏"))
        menu.addAction("显示状态栏", lambda: self.main_window.event_handler.show_feature_not_implemented("显示状态栏"))
        menu.addSeparator()
        menu.addAction("显示导航栏", lambda: self.main_window.event_handler.show_feature_not_implemented("显示导航栏"))
        menu.addAction("显示信息面板", lambda: self.main_window.event_handler.show_feature_not_implemented("显示信息面板"))
        menu.addSeparator()
        
        # 主题子菜单
        theme_menu = menu.addMenu("主题")
        theme_menu.addAction("浅色", lambda: self.main_window.set_theme('light'))
        theme_menu.addAction("深色", lambda: self.main_window.set_theme('dark'))
        theme_menu.addAction("高对比度", lambda: self.main_window.set_theme('high_contrast'))
    
    def _create_favorites_menu(self, menu):
        """创建收藏夹菜单"""
        menu.addAction("添加到收藏夹", lambda: self.main_window.event_handler.show_feature_not_implemented("添加到收藏夹"))
        menu.addAction("管理收藏夹", lambda: self.main_window.event_handler.show_feature_not_implemented("管理收藏夹"))
    
    def _create_tool_menu(self, menu):
        """创建工具菜单"""
        menu.addAction("备份", self.main_window.event_handler.backup_database)
        menu.addAction("还原", self.main_window.event_handler.restore_database)
        menu.addSeparator()
        menu.addAction("数据传输", self.main_window.event_handler.transfer_data)
        menu.addSeparator()
        menu.addAction("结构同步", self.main_window.event_handler.sync_structure)
        menu.addAction("数据同步", self.main_window.event_handler.sync_data)
        menu.addSeparator()
        menu.addAction("选项设置", lambda: self.main_window.event_handler.show_feature_not_implemented("选项设置"))
    
    def _create_window_menu(self, menu):
        """创建窗口菜单"""
        menu.addAction("新建窗口", lambda: self.main_window.event_handler.show_feature_not_implemented("新建窗口"))
        menu.addAction("层叠窗口", lambda: self.main_window.event_handler.show_feature_not_implemented("层叠窗口"))
        menu.addAction("平铺窗口", lambda: self.main_window.event_handler.show_feature_not_implemented("平铺窗口"))
        menu.addSeparator()
        menu.addAction("关闭所有窗口", lambda: self.main_window.event_handler.show_feature_not_implemented("关闭所有窗口"))
    
    def _create_help_menu(self, menu):
        """创建帮助菜单"""
        menu.addAction("关于", self.main_window.event_handler.about)
        menu.addAction("检查更新", lambda: self.main_window.event_handler.show_feature_not_implemented("检查更新"))
