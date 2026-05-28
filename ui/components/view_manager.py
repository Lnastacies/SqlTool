#!/usr/bin/env python3
"""
视图管理组件
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QLabel, QLineEdit, QComboBox, QMessageBox, QMenu,
    QToolBar, QApplication, QHeaderView, QAbstractItemView
)
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QAction, QCursor
from PyQt6.QtWidgets import QInputDialog


class ViewManager(QDialog):
    """视图管理器"""
    
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        self.current_views = []
        
        self.setWindowTitle("视图管理")
        self.setGeometry(150, 100, 900, 600)
        self.setMinimumSize(700, 400)
        self.setStyleSheet(self._get_dialog_style())
        
        self.setup_ui()
        self.load_views()
    
    def _get_dialog_style(self):
        return """
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QTableWidget {
                background-color: #ffffff;
                alternate-background-color: #f9f9f9;
                border: 1px solid #d0d0d0;
                gridline-color: #e8e8e8;
                font-size: 12px;
            }
            QTableWidget::item {
                padding: 6px 8px;
            }
            QTableWidget::item:selected {
                background-color: #e3f2fd;
                color: #1a73e8;
            }
            QHeaderView::section {
                background-color: #f0f0f0;
                padding: 8px;
                border: none;
                border-right: 1px solid #d0d0d0;
                border-bottom: 2px solid #1a73e8;
                font-weight: 600;
                font-size: 11px;
            }
            QPushButton {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
                border-radius: 3px;
                padding: 6px 16px;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
            }
            QPushButton:pressed {
                background-color: #d0d0d0;
            }
            QPushButton#primary {
                background-color: #1a73e8;
                color: white;
                border: none;
            }
            QPushButton#primary:hover {
                background-color: #1557b0;
            }
            QPushButton#danger {
                background-color: #dc3545;
                color: white;
                border: none;
            }
            QPushButton#danger:hover {
                background-color: #c82333;
            }
            QLineEdit {
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 6px 10px;
                font-size: 12px;
                background-color: #ffffff;
            }
            QLineEdit:focus {
                border: 1px solid #1a73e8;
            }
            QLabel {
                font-size: 13px;
                color: #333333;
            }
            QToolBar {
                background-color: #f8f8f8;
                border: none;
                border-bottom: 1px solid #e0e0e0;
                padding: 4px;
                spacing: 4px;
            }
            QToolBar QToolButton {
                padding: 6px 12px;
                border: 1px solid transparent;
                border-radius: 3px;
                background-color: transparent;
            }
            QToolBar QToolButton:hover {
                background-color: #e0e0e0;
                border: 1px solid #c0c0c0;
            }
        """
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(8)
        
        # 工具栏
        toolbar = QToolBar()
        
        refresh_action = QAction("刷新", self)
        refresh_action.triggered.connect(self.load_views)
        toolbar.addAction(refresh_action)
        
        toolbar.addSeparator()
        
        open_action = QAction("打开视图", self)
        open_action.triggered.connect(self.open_view)
        toolbar.addAction(open_action)
        
        design_action = QAction("设计视图", self)
        design_action.triggered.connect(self.design_view)
        toolbar.addAction(design_action)
        
        create_action = QAction("新建视图", self)
        create_action.triggered.connect(self.create_view)
        toolbar.addAction(create_action)
        
        toolbar.addSeparator()
        
        drop_action = QAction("删除视图", self)
        drop_action.triggered.connect(self.drop_view)
        toolbar.addAction(drop_action)
        
        layout.addWidget(toolbar)
        
        # 搜索栏
        search_layout = QHBoxLayout()
        search_layout.addWidget(QLabel("搜索:"))
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("输入视图名称搜索...")
        self.search_input.textChanged.connect(self.filter_views)
        search_layout.addWidget(self.search_input, 1)
        layout.addLayout(search_layout)
        
        # 视图列表
        self.view_table = QTableWidget()
        self.view_table.setColumnCount(5)
        self.view_table.setHorizontalHeaderLabels(["视图名称", "创建时间", "修改时间", "定义", "字符集"])
        self.view_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.view_table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.view_table.setAlternatingRowColors(True)
        self.view_table.setShowGrid(True)
        self.view_table.horizontalHeader().setStretchLastSection(True)
        self.view_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Interactive)
        self.view_table.setColumnWidth(0, 180)
        self.view_table.setColumnWidth(1, 150)
        self.view_table.setColumnWidth(2, 150)
        self.view_table.setColumnWidth(3, 200)
        self.view_table.itemDoubleClicked.connect(self.open_view)
        self.view_table.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.view_table.customContextMenuRequested.connect(self.show_context_menu)
        layout.addWidget(self.view_table, 1)
        
        # 底部按钮
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(self.accept)
        button_layout.addWidget(close_btn)
        
        layout.addLayout(button_layout)
    
    def load_views(self):
        """加载视图列表"""
        try:
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    cursor.execute("""
                        SELECT 
                            TABLE_NAME as view_name,
                            CREATE_TIME,
                            UPDATE_TIME,
                            TABLE_COMMENT as definition
                        FROM INFORMATION_SCHEMA.VIEWS 
                        WHERE TABLE_SCHEMA = %s
                        ORDER BY TABLE_NAME
                    """, (self.main_window.current_db,))
                elif self.main_window.current_db_type == 'PostgreSQL':
                    cursor.execute("""
                        SELECT 
                            v.schemaname,
                            v.viewname,
                            v.definition
                        FROM pg_views v
                        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                        ORDER BY v.viewname
                    """)
                elif self.main_window.current_db_type == 'SQL Server':
                    cursor.execute("""
                        SELECT 
                            s.name + '.' + v.name as view_name,
                            v.create_date,
                            v.modify_date
                        FROM sys.views v
                        INNER JOIN sys.schemas s ON v.schema_id = s.schema_id
                        ORDER BY s.name, v.name
                    """)
                else:
                    cursor.execute("""
                        SELECT name as view_name, sql as definition
                        FROM sqlite_master 
                        WHERE type = 'view'
                        ORDER BY name
                    """)
                
                self.current_views = cursor.fetchall()
            
            self.populate_view_table()
            self.logger.log('INFO', f"加载视图列表: {len(self.current_views)} 个视图")
            
        except Exception as e:
            QMessageBox.critical(self, "加载失败", f"加载视图列表时出错:\n{str(e)}")
            self.logger.log('ERROR', f"加载视图列表失败: {str(e)}")
    
    def populate_view_table(self, views=None):
        """填充视图表格"""
        views = views or self.current_views
        self.view_table.setRowCount(len(views))
        
        for row, view in enumerate(views):
            if isinstance(view, dict):
                view_name = view.get('view_name', view.get('viewname', ''))
                create_time = view.get('create_time', view.get('CREATE_TIME', ''))
                modify_time = view.get('modify_time', view.get('UPDATE_TIME', ''))
                definition = str(view.get('definition', ''))[:100]
                charset = view.get('TABLE_COLLATION', '')
            else:
                view_name = str(view[0])
                create_time = str(view[1]) if len(view) > 1 else ''
                modify_time = str(view[2]) if len(view) > 2 else ''
                definition = str(view[3]) if len(view) > 3 else ''[:100]
                charset = ''
            
            self.view_table.setItem(row, 0, QTableWidgetItem(view_name))
            self.view_table.setItem(row, 1, QTableWidgetItem(str(create_time)))
            self.view_table.setItem(row, 2, QTableWidgetItem(str(modify_time)))
            self.view_table.setItem(row, 3, QTableWidgetItem(definition))
            self.view_table.setItem(row, 4, QTableWidgetItem(charset))
    
    def filter_views(self, text):
        """筛选视图"""
        if not text:
            self.populate_view_table()
            return
        
        text_lower = text.lower()
        filtered = [
            v for v in self.current_views
            if text_lower in str(v[0] if isinstance(v, tuple) else v.get('view_name', '')).lower()
        ]
        self.populate_view_table(filtered)
    
    def get_selected_view(self):
        """获取选中的视图"""
        row = self.view_table.currentRow()
        if row >= 0:
            view_name = self.view_table.item(row, 0).text()
            return view_name
        return None
    
    def open_view(self):
        """打开视图"""
        view_name = self.get_selected_view()
        if not view_name:
            QMessageBox.warning(self, "提示", "请先选择一个视图")
            return
        
        try:
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    cursor.execute("""
                        SELECT VIEW_DEFINITION 
                        FROM INFORMATION_SCHEMA.VIEWS 
                        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
                    """, (self.main_window.current_db, view_name))
                    result = cursor.fetchone()
                    if result:
                        view_sql = result[0]
                    else:
                        view_sql = ""
                elif self.main_window.current_db_type == 'PostgreSQL':
                    view_sql = ""
                else:
                    view_sql = ""
            
            # 创建查询标签页并显示视图数据
            self.main_window.add_new_query_tab()
            current_tab = self.main_window.right_panel.tabs.currentWidget()
            if current_tab and hasattr(current_tab, 'sql_editor'):
                sql = f"SELECT * FROM `{view_name}` LIMIT 1000;"
                current_tab.sql_editor.setPlainText(sql)
                self.main_window.sql_operations.execute_sql()
            
            self.logger.log('INFO', f"打开视图: {view_name}")
            
        except Exception as e:
            QMessageBox.critical(self, "打开失败", f"打开视图时出错:\n{str(e)}")
            self.logger.log('ERROR', f"打开视图失败: {str(e)}")
    
    def design_view(self):
        """设计视图"""
        view_name = self.get_selected_view()
        if not view_name:
            QMessageBox.warning(self, "提示", "请先选择一个视图")
            return
        
        designer = ViewDesigner(self.main_window, view_name)
        if designer.exec():
            self.load_views()
    
    def create_view(self):
        """创建视图"""
        designer = ViewDesigner(self.main_window)
        if designer.exec():
            self.load_views()
    
    def drop_view(self):
        """删除视图"""
        view_name = self.get_selected_view()
        if not view_name:
            QMessageBox.warning(self, "提示", "请先选择一个视图")
            return
        
        if QMessageBox.question(self, "删除视图", 
                              f"确定要删除视图 '{view_name}' 吗？\n此操作不可恢复！",
                              QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) != QMessageBox.StandardButton.Yes:
            return
        
        try:
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                cursor.execute(f"DROP VIEW `{view_name}`")
                self.main_window.db_connection.commit()
            
            QMessageBox.information(self, "删除成功", f"视图 '{view_name}' 已删除")
            self.logger.log('INFO', f"删除视图: {view_name}")
            self.load_views()
            
        except Exception as e:
            QMessageBox.critical(self, "删除失败", f"删除视图时出错:\n{str(e)}")
            self.logger.log('ERROR', f"删除视图失败: {str(e)}")
    
    def show_context_menu(self, pos):
        """显示右键菜单"""
        menu = QMenu()
        
        open_action = menu.addAction("打开视图数据")
        open_action.triggered.connect(self.open_view)
        
        menu.addAction("查看定义").triggered.connect(self.show_view_definition)
        
        menu.addSeparator()
        
        menu.addAction("设计视图").triggered.connect(self.design_view)
        
        menu.addSeparator()
        
        drop_action = menu.addAction("删除视图")
        drop_action.triggered.connect(self.drop_view)
        
        menu.exec(QCursor.pos())


class ViewDesigner(QDialog):
    """视图设计器"""
    
    def __init__(self, main_window, view_name=None):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        self.view_name = view_name
        
        self.setWindowTitle(f"设计视图: {view_name}" if view_name else "新建视图")
        self.setGeometry(150, 100, 1000, 700)
        self.setMinimumSize(800, 500)
        self.setStyleSheet("""
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QTextEdit {
                border: 1px solid #d0d0d0;
                background-color: #ffffff;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 12px;
            }
            QPushButton {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
                border-radius: 3px;
                padding: 6px 16px;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
            }
            QPushButton#primary {
                background-color: #1a73e8;
                color: white;
                border: none;
            }
            QPushButton#primary:hover {
                background-color: #1557b0;
            }
            QLabel {
                font-size: 12px;
                color: #333333;
            }
            QGroupBox {
                font-weight: 600;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                margin-top: 8px;
                padding-top: 8px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
            }
        """)
        
        self.setup_ui()
        if view_name:
            self.load_view_definition()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)
        
        # 视图名称
        name_layout = QHBoxLayout()
        name_layout.addWidget(QLabel("视图名称:"))
        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("输入视图名称...")
        name_layout.addWidget(self.name_input, 1)
        layout.addLayout(name_layout)
        
        # SQL定义
        sql_group = QLabel("视图定义 (SELECT语句):")
        layout.addWidget(sql_group)
        
        self.sql_editor = QTextEdit()
        self.sql_editor.setPlaceholderText("""输入创建视图的SELECT语句，例如:
CREATE VIEW view_name AS
SELECT column1, column2
FROM table_name
WHERE condition""")
        layout.addWidget(self.sql_editor, 1)
        
        # 表选择帮助
        help_layout = QHBoxLayout()
        help_layout.addWidget(QLabel("提示: 视图是基于SELECT语句的虚拟表，保存视图定义即可。"))
        help_layout.addStretch()
        layout.addLayout(help_layout)
        
        # 按钮
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        
        preview_btn = QPushButton("预览SQL")
        preview_btn.clicked.connect(self.preview_sql)
        button_layout.addWidget(preview_btn)
        
        save_btn = QPushButton("保存")
        save_btn.setObjectName("primary")
        save_btn.clicked.connect(self.save_view)
        button_layout.addWidget(save_btn)
        
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)
        
        layout.addLayout(button_layout)
    
    def load_view_definition(self):
        """加载视图定义"""
        try:
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    cursor.execute("""
                        SELECT TABLE_NAME, VIEW_DEFINITION
                        FROM INFORMATION_SCHEMA.VIEWS 
                        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
                    """, (self.main_window.current_db, self.view_name))
                    result = cursor.fetchone()
                    if result:
                        self.name_input.setText(result[0])
                        self.sql_editor.setPlainText(result[1])
                elif self.main_window.current_db_type == 'PostgreSQL':
                    cursor.execute("""
                        SELECT viewname, definition
                        FROM pg_views
                        WHERE viewname = %s
                    """, (self.view_name,))
                    result = cursor.fetchone()
                    if result:
                        self.name_input.setText(result[0])
                        self.sql_editor.setPlainText(result[1])
            
        except Exception as e:
            QMessageBox.critical(self, "加载失败", f"加载视图定义时出错:\n{str(e)}")
            self.logger.log('ERROR', f"加载视图定义失败: {str(e)}")
    
    def preview_sql(self):
        """预览SQL"""
        view_name = self.name_input.text().strip()
        sql = self.sql_editor.toPlainText().strip()
        
        if not view_name:
            QMessageBox.warning(self, "提示", "请输入视图名称")
            return
        
        if not sql:
            QMessageBox.warning(self, "提示", "请输入视图定义SQL")
            return
        
        if sql.upper().startswith('CREATE'):
            preview = sql
        else:
            preview = f"CREATE OR REPLACE VIEW `{view_name}` AS\n{sql}"
        
        preview_dialog = QDialog(self)
        preview_dialog.setWindowTitle("SQL预览")
        preview_dialog.setGeometry(200, 200, 700, 400)
        
        layout = QVBoxLayout(preview_dialog)
        text_edit = QTextEdit()
        text_edit.setPlainText(preview)
        text_edit.setReadOnly(True)
        layout.addWidget(text_edit)
        
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(preview_dialog.accept)
        layout.addWidget(close_btn)
        
        preview_dialog.exec()
    
    def save_view(self):
        """保存视图"""
        view_name = self.name_input.text().strip()
        sql = self.sql_editor.toPlainText().strip()
        
        if not view_name:
            QMessageBox.warning(self, "提示", "请输入视图名称")
            return
        
        if not sql:
            QMessageBox.warning(self, "提示", "请输入视图定义SQL")
            return
        
        # 构建CREATE VIEW语句
        if sql.upper().startswith('CREATE'):
            full_sql = sql
        else:
            full_sql = f"CREATE OR REPLACE VIEW `{view_name}` AS\n{sql}"
        
        try:
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                cursor.execute(full_sql)
                self.main_window.db_connection.commit()
            
            QMessageBox.information(self, "保存成功", f"视图 '{view_name}' 保存成功")
            self.logger.log('INFO', f"保存视图: {view_name}")
            self.accept()
            
        except Exception as e:
            QMessageBox.critical(self, "保存失败", f"保存视图时出错:\n{str(e)}")
            self.logger.log('ERROR', f"保存视图失败: {str(e)}")
