#!/usr/bin/env python3
"""
查询标签页组件
"""

from PyQt6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QComboBox, QSplitter, QTableWidget, QTextEdit, QTabWidget
from PyQt6.QtCore import Qt
from .sql_editor import SQLTextEdit

class QueryTab(QWidget):
    """查询标签页"""
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.logger = main_window.logger
        self.setup_ui()
    
    def setup_ui(self):
        """设置UI"""
        # 主布局
        tab_layout = QVBoxLayout(self)
        tab_layout.setContentsMargins(0, 0, 0, 0)
        
        # 创建SQL编辑器工具栏 - 移动到标签页栏下方
        top_toolbar = QWidget()
        top_toolbar.setStyleSheet("""
            QWidget {
                background-color: #F8F9FA;
                border-bottom: 1px solid #E0E0E0;
                padding: 4px 8px;
                height: 32px;
            }
        """)
        top_layout = QHBoxLayout(top_toolbar)
        top_layout.setContentsMargins(0, 0, 0, 0)
        top_layout.setSpacing(4)
        
        # 保存按钮
        save_btn = QPushButton("保存")
        save_btn.setStyleSheet("""
            QPushButton {
                padding: 3px 8px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #e0e0e0;
                border: 1px solid #b0b0b0;
            }
        """)
        save_btn.clicked.connect(self.main_window.event_handler.save_sql_file)
        top_layout.addWidget(save_btn)
        
        # 查询创建工具按钮
        query_tool_btn = QPushButton("查询创建工具")
        query_tool_btn.setStyleSheet("""
            QPushButton {
                padding: 3px 8px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #e0e0e0;
                border: 1px solid #b0b0b0;
            }
        """)
        query_tool_btn.clicked.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("查询创建工具"))
        top_layout.addWidget(query_tool_btn)
        
        # 美化SQL按钮
        format_btn = QPushButton("美化SQL")
        format_btn.setStyleSheet("""
            QPushButton {
                padding: 3px 8px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #e0e0e0;
                border: 1px solid #b0b0b0;
            }
        """)
        format_btn.clicked.connect(self.main_window.sql_operations.format_sql)
        top_layout.addWidget(format_btn)
        
        # 代码级按钮
        code_level_btn = QPushButton("代码级")
        code_level_btn.setStyleSheet("""
            QPushButton {
                padding: 3px 8px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #e0e0e0;
                border: 1px solid #b0b0b0;
            }
        """)
        code_level_btn.clicked.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("代码级"))
        top_layout.addWidget(code_level_btn)
        
        # 文本按钮
        text_btn = QPushButton("文本")
        text_btn.setStyleSheet("""
            QPushButton {
                padding: 3px 8px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #e0e0e0;
                border: 1px solid #b0b0b0;
            }
        """)
        text_btn.clicked.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("文本"))
        top_layout.addWidget(text_btn)
        
        # 导出结果按钮
        export_btn = QPushButton("导出结果")
        export_btn.setStyleSheet("""
            QPushButton {
                padding: 3px 8px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #e0e0e0;
                border: 1px solid #b0b0b0;
            }
        """)
        export_btn.clicked.connect(self.main_window.event_handler.export_data)
        top_layout.addWidget(export_btn)
        
        # 添加分隔符
        top_layout.addSpacing(10)
        top_layout.addStretch()
        
        # 连接选择
        self.conn_combo = QComboBox()
        self.conn_combo.setStyleSheet("""
            QComboBox {
                padding: 3px 8px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
                min-width: 120px;
            }
            QComboBox QAbstractItemView {
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
            }
        """)
        # 加载所有可用连接
        self.conn_combo.addItem("未连接")
        for conn_name in self.main_window.saved_connections.keys():
            self.conn_combo.addItem(conn_name)
        # 设置当前连接
        if hasattr(self.main_window, 'current_connection') and self.main_window.current_connection:
            index = self.conn_combo.findText(self.main_window.current_connection)
            if index >= 0:
                self.conn_combo.setCurrentIndex(index)
        # 连接切换事件
        def on_connection_changed(index):
            new_conn_name = self.conn_combo.itemText(index)
            if new_conn_name != "未连接" and new_conn_name != getattr(self.main_window, 'current_connection', None):
                self.main_window.event_handler.connect_to_database(new_conn_name)
                # 更新数据库下拉框
                self.update_database_combo()
        self.conn_combo.currentIndexChanged.connect(on_connection_changed)
        top_layout.addWidget(self.conn_combo)
        
        # 数据库选择
        self.db_combo = QComboBox()
        self.db_combo.setMinimumWidth(180)  # 增加下拉框宽度
        self.db_combo.setStyleSheet("""
            QComboBox {
                padding: 3px 8px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
                min-width: 180px;
            }
            QComboBox QAbstractItemView {
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                min-width: 250px;
            }
        """)
        
        # 更新数据库下拉框的函数
        def update_database_combo():
            self.db_combo.clear()
            self.db_combo.addItem("未选择")
            if hasattr(self.main_window, 'db_connection') and self.main_window.db_connection:
                try:
                    with self.main_window.db_connection.cursor() as cursor:
                        if self.main_window.current_db_type == 'MySQL' or self.main_window.current_db_type == 'MariaDB':
                            cursor.execute("SHOW DATABASES")
                            databases = cursor.fetchall()
                            for db in databases:
                                db_name = db['Database'] if isinstance(db, dict) else db[0]
                                self.db_combo.addItem(db_name)
                        elif self.main_window.current_db_type == 'PostgreSQL':
                            cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
                            databases = cursor.fetchall()
                            for db in databases:
                                db_name = db[0]
                                self.db_combo.addItem(db_name)
                        elif self.main_window.current_db_type == 'SQL Server':
                            cursor.execute("SELECT name FROM sys.databases")
                            databases = cursor.fetchall()
                            for db in databases:
                                db_name = db[0]
                                self.db_combo.addItem(db_name)
                    # 设置当前数据库
                    if hasattr(self.main_window, 'current_db') and self.main_window.current_db:
                        # 确保数据库名称完全匹配
                        index = -1
                        for i in range(self.db_combo.count()):
                            if self.db_combo.itemText(i) == self.main_window.current_db:
                                index = i
                                break
                        if index >= 0:
                            self.db_combo.setCurrentIndex(index)
                        else:
                            # 如果找不到，尝试获取当前实际使用的数据库
                            try:
                                with self.main_window.db_connection.cursor() as cursor:
                                    cursor.execute("SELECT DATABASE()")
                                    current_db = cursor.fetchone()
                                    if current_db:
                                        current_db_name = current_db['DATABASE()'] if isinstance(current_db, dict) else current_db[0]
                                        index = self.db_combo.findText(current_db_name)
                                        if index >= 0:
                                            self.db_combo.setCurrentIndex(index)
                                            self.main_window.current_db = current_db_name
                            except Exception as e:
                                self.logger.log('ERROR', f"获取当前数据库失败: {str(e)}")
                except Exception as e:
                    self.logger.log('ERROR', f"加载数据库列表失败: {str(e)}")
        
        # 保存更新数据库下拉框的函数
        self.update_database_combo = update_database_combo
        
        # 初始加载数据库列表
        update_database_combo()
        
        # 数据库切换事件
        def on_database_changed(index):
            new_db_name = self.db_combo.itemText(index)
            self.logger.log('INFO', f"数据库下拉框值变化: 索引={index}, 值='{new_db_name}'")
            if new_db_name != "未选择" and new_db_name != self.main_window.current_db and new_db_name.strip():
                try:
                    # 验证数据库名称
                    if not isinstance(new_db_name, str) or not new_db_name.strip():
                        self.logger.log('ERROR', f"无效的数据库名称: {new_db_name}")
                        from PyQt6.QtWidgets import QMessageBox
                        QMessageBox.warning(self.main_window, "切换数据库失败", "无效的数据库名称")
                        return
                    
                    # 执行切换数据库操作
                    sql = f"USE {new_db_name}"
                    self.logger.log('INFO', f"执行SQL: {sql}")
                    with self.main_window.db_connection.cursor() as cursor:
                        cursor.execute(sql)
                        self.main_window.current_db = new_db_name
                        # 重新加载数据库对象
                        self.main_window.load_database_objects()
                        # 更新连接状态
                        self.main_window.connection_status.setText(f"已连接: {self.main_window.current_connection} ({self.main_window.current_db_type}) - 数据库: {new_db_name}")
                        self.main_window.status_info.setText("已切换数据库")
                        self.logger.log('INFO', f"切换到数据库: {new_db_name} 成功")
                except Exception as e:
                    self.logger.log('ERROR', f"切换数据库失败: {str(e)}, 数据库名称: '{new_db_name}'")
                    from PyQt6.QtWidgets import QMessageBox
                    QMessageBox.critical(self.main_window, "切换数据库失败", f"切换到数据库 {new_db_name} 时出错: {str(e)}")
        self.db_combo.currentIndexChanged.connect(on_database_changed)
        top_layout.addWidget(self.db_combo)
        
        # 运行按钮
        run_btn = QPushButton("运行")
        run_btn.setStyleSheet("""
            QPushButton {
                padding: 4px 10px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #4CAF50;
                color: white;
                border: 1px solid #45a049;
                border-radius: 2px;
                margin-left: 8px;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
            QPushButton:pressed {
                background-color: #3d8b40;
            }
        """)
        run_btn.clicked.connect(self.main_window.sql_operations.execute_sql)
        top_layout.addWidget(run_btn)
        
        # 停止按钮
        stop_btn = QPushButton("停止")
        stop_btn.setStyleSheet("""
            QPushButton {
                padding: 4px 10px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #f44336;
                color: white;
                border: 1px solid #da190b;
                border-radius: 2px;
                margin-left: 4px;
            }
            QPushButton:hover {
                background-color: #da190b;
            }
            QPushButton:pressed {
                background-color: #b31204;
            }
        """)
        stop_btn.clicked.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("停止"))
        top_layout.addWidget(stop_btn)
        
        # 解释按钮
        explain_btn = QPushButton("解释")
        explain_btn.setStyleSheet("""
            QPushButton {
                padding: 4px 10px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
                margin-left: 4px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #e0e0e0;
                border: 1px solid #b0b0b0;
            }
        """)
        explain_btn.clicked.connect(self.main_window.sql_operations.explain_sql)
        top_layout.addWidget(explain_btn)
        
        tab_layout.addWidget(top_toolbar)
        
        # 创建主分隔器（SQL编辑器和结果区域之间）
        main_splitter = QSplitter(Qt.Orientation.Vertical)
        # 启用分隔条拖动
        main_splitter.setHandleWidth(4)
        main_splitter.setStyleSheet("""
            QSplitter::handle {
                background-color: #d0d0d0;
            }
            QSplitter::handle:hover {
                background-color: #b0b0b0;
            }
        """)
        
        # 创建SQL编辑器
        self.sql_editor = SQLTextEdit()
        main_splitter.addWidget(self.sql_editor)
        
        # 创建结果区域
        result_widget = QWidget()
        result_layout = QVBoxLayout(result_widget)
        result_layout.setContentsMargins(0, 0, 0, 0)
        
        # 结果标签页
        self.result_tabs = QTabWidget()
        self.result_tabs.setStyleSheet("""
            QTabWidget {
                background-color: #ffffff;
                border: 1px solid #e0e0e0;
            }
            QTabWidget::pane {
                background-color: #ffffff;
                border: 1px solid #e0e0e0;
            }
            QTabBar::tab {
                padding: 6px 12px;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                background-color: #F8F9FA;
                border: none;
                border-bottom: 2px solid transparent;
                margin-right: 2px;
                height: 28px;
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
        
        # 结果标签
        result_tab = QWidget()
        result_tab_layout = QVBoxLayout(result_tab)
        result_tab_layout.setContentsMargins(0, 0, 0, 0)
        
        # 查询结果表格
        self.result_table = QTableWidget()
        self.result_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.result_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.result_table.setShowGrid(True)
        self.result_table.setGridStyle(Qt.PenStyle.DotLine)
        self.result_table.setSortingEnabled(True)  # 启用排序
        self.result_table.horizontalHeader().setSortIndicatorShown(True)  # 显示排序指示器
        self.result_table.horizontalHeader().setStretchLastSection(True)  # 最后一列自适应宽度
        self.result_table.setAlternatingRowColors(True)  # 启用斑马纹
        # 启用右键菜单
        self.result_table.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.result_table.customContextMenuRequested.connect(self.show_result_context_menu)
        # 启用表头点击事件，用于筛选
        self.result_table.horizontalHeader().sectionClicked.connect(self.on_header_clicked)
        self.result_table.setStyleSheet("""
            QTableWidget {
                background-color: #ffffff;
                border: 1px solid #e0e0e0;
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
            QTableWidget QHeaderView::section:hover {
                background-color: #e8e8e8;
            }
            QTableWidget QHeaderView::section:selected {
                background-color: #e3f2fd;
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
        """)
        # 将结果表格添加到布局，设置为可伸缩
        result_tab_layout.addWidget(self.result_table, 1)  # 1表示占用剩余空间
        
        # 结果集底部工具栏
        result_toolbar = QWidget()
        result_toolbar.setStyleSheet("""
            QWidget {
                background-color: #f8f8f8;
                border-top: 1px solid #e0e0e0;
                padding: 3px 8px;
                height: 32px;
            }
        """)
        result_toolbar_layout = QHBoxLayout(result_toolbar)
        result_toolbar_layout.setContentsMargins(0, 0, 0, 0)
        result_toolbar_layout.setSpacing(4)
        
        # 刷新按钮
        refresh_btn = QPushButton("刷新")
        refresh_btn.setStyleSheet("""
            QPushButton {
                padding: 2px 6px;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #e0e0e0;
                border: 1px solid #b0b0b0;
            }
        """)
        refresh_btn.clicked.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("刷新"))
        result_toolbar_layout.addWidget(refresh_btn)
        
        # 导出按钮
        export_result_btn = QPushButton("导出")
        export_result_btn.setStyleSheet("""
            QPushButton {
                padding: 2px 6px;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #e0e0e0;
                border: 1px solid #b0b0b0;
            }
        """)
        export_result_btn.clicked.connect(self.main_window.event_handler.export_data)
        result_toolbar_layout.addWidget(export_result_btn)
        
        # 新增行按钮
        add_row_btn = QPushButton("+")
        add_row_btn.setStyleSheet("""
            QPushButton {
                padding: 2px 6px;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
                min-width: 24px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
        """)
        add_row_btn.clicked.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("新增行"))
        result_toolbar_layout.addWidget(add_row_btn)
        
        # 删除行按钮
        delete_row_btn = QPushButton("-")
        delete_row_btn.setStyleSheet("""
            QPushButton {
                padding: 2px 6px;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
                min-width: 24px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
        """)
        delete_row_btn.clicked.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("删除行"))
        result_toolbar_layout.addWidget(delete_row_btn)
        
        # 撤销修改按钮
        undo_btn = QPushButton("○")
        undo_btn.setStyleSheet("""
            QPushButton {
                padding: 2px 6px;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
                min-width: 24px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
        """)
        undo_btn.clicked.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("撤销修改"))
        result_toolbar_layout.addWidget(undo_btn)
        
        result_toolbar_layout.addStretch()
        
        # 消息输出
        self.message_output = QTextEdit()
        self.message_output.setReadOnly(True)
        self.message_output.setMaximumHeight(28)  # 调整为单行高度
        self.message_output.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)  # 禁止自动换行
        self.message_output.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)  # 隐藏水平滚动条
        self.message_output.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)  # 隐藏垂直滚动条
        self.message_output.setStyleSheet("""
            QTextEdit {
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 12px;
                background-color: #f8f8f8;
                border: 1px solid #e0e0e0;
                padding: 3px 6px;
                max-width: 400px;
                border-radius: 2px;
            }
        """)
        # 设置默认执行信息
        self.message_output.setText("SQL 执行成功 | 执行时间: 0.0000 秒 | 影响行数: 0")
        result_toolbar_layout.addWidget(self.message_output)
        
        # 将结果工具栏添加到布局
        result_tab_layout.addWidget(result_toolbar)
        
        # 消息标签
        message_tab = QWidget()
        message_tab_layout = QVBoxLayout(message_tab)
        message_tab_layout.setContentsMargins(0, 0, 0, 0)
        
        self.message_text = QTextEdit()
        self.message_text.setReadOnly(True)
        self.message_text.setStyleSheet("""
            QTextEdit {
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 10px;
                background-color: #f8f8f8;
                border: 1px solid #e0e0e0;
                padding: 8px;
            }
        """)
        message_tab_layout.addWidget(self.message_text)
        
        # 执行计划标签
        plan_tab = QWidget()
        plan_tab_layout = QVBoxLayout(plan_tab)
        plan_tab_layout.setContentsMargins(0, 0, 0, 0)
        
        self.plan_text = QTextEdit()
        self.plan_text.setReadOnly(True)
        self.plan_text.setStyleSheet("""
            QTextEdit {
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 10px;
                background-color: #f8f8f8;
                border: 1px solid #e0e0e0;
                padding: 8px;
            }
        """)
        plan_tab_layout.addWidget(self.plan_text)
        
        # 添加标签页
        self.result_tabs.addTab(result_tab, "结果")
        self.result_tabs.addTab(message_tab, "消息")
        self.result_tabs.addTab(plan_tab, "执行计划")
        
        # 将结果标签页添加到布局
        result_layout.addWidget(self.result_tabs)
        
        main_splitter.addWidget(result_widget)
        tab_layout.addWidget(main_splitter)
        
        # 设置分割器比例
        main_splitter.setSizes([400, 300])
    
    def update_combos(self):
        """更新下拉框"""
        # 更新连接下拉框
        current_conn = self.conn_combo.currentText()
        self.conn_combo.clear()
        self.conn_combo.addItem("未连接")
        for conn_name in self.main_window.saved_connections.keys():
            self.conn_combo.addItem(conn_name)
        if hasattr(self.main_window, 'current_connection') and self.main_window.current_connection:
            index = self.conn_combo.findText(self.main_window.current_connection)
            if index >= 0:
                self.conn_combo.blockSignals(True)
                self.conn_combo.setCurrentIndex(index)
                self.conn_combo.blockSignals(False)
        
        # 更新数据库下拉框
        self.update_database_combo()
    
    def show_result_context_menu(self, pos):
        """显示结果表格的上下文菜单"""
        from PyQt6.QtWidgets import QMenu
        menu = QMenu()
        
        # 获取选中的行
        selected_rows = self.result_table.selectionModel().selectedRows()
        has_selection = len(selected_rows) > 0
        
        # 复制操作
        copy_menu = menu.addMenu("复制")
        copy_menu.addAction("复制当前单元格", lambda: self.copy_current_cell())
        copy_menu.addAction("复制选中行", lambda: self.copy_selected_rows())
        copy_menu.addAction("复制所有行", lambda: self.copy_all_rows())
        menu.addSeparator()
        
        # 导出操作
        export_menu = menu.addMenu("导出")
        export_menu.addAction("导出为CSV", lambda: self.export_to_csv())
        export_menu.addAction("导出为Excel", lambda: self.export_to_excel())
        export_menu.addAction("导出为JSON", lambda: self.export_to_json())
        menu.addSeparator()
        
        # 选择操作
        select_menu = menu.addMenu("选择")
        select_menu.addAction("选择所有行", lambda: self.select_all_rows())
        if has_selection:
            select_menu.addAction("取消选择", lambda: self.clear_selection())
        menu.addSeparator()
        
        # 视图操作
        view_menu = menu.addMenu("视图")
        view_menu.addAction("刷新", lambda: self.refresh_result())
        view_menu.addAction("调整列宽", lambda: self.adjust_columns())
        view_menu.addAction("隐藏列...", lambda: self.hide_columns())
        menu.addSeparator()
        
        # 其他操作
        menu.addAction("查找...", lambda: self.find_in_result())
        if has_selection:
            menu.addAction("删除选中行", lambda: self.delete_selected_rows())
        
        # 显示菜单
        menu.exec(self.result_table.mapToGlobal(pos))
    
    # 结果表格操作方法
    def copy_current_cell(self):
        """复制当前单元格"""
        current_item = self.result_table.currentItem()
        if current_item:
            from PyQt6.QtWidgets import QApplication
            clipboard = QApplication.clipboard()
            clipboard.setText(current_item.text())
    
    def copy_selected_rows(self):
        """复制选中行"""
        selected_rows = self.result_table.selectionModel().selectedRows()
        if selected_rows:
            data = []
            # 先复制列名
            header_row = []
            for col in range(self.result_table.columnCount()):
                header_item = self.result_table.horizontalHeaderItem(col)
                if header_item:
                    header_row.append(header_item.text())
                else:
                    header_row.append(f"列{col+1}")
            data.append('\t'.join(header_row))
            
            # 复制选中行数据
            for row in selected_rows:
                row_data = []
                for col in range(self.result_table.columnCount()):
                    item = self.result_table.item(row.row(), col)
                    if item:
                        row_data.append(item.text())
                    else:
                        row_data.append('')
                data.append('\t'.join(row_data))
            
            from PyQt6.QtWidgets import QApplication
            clipboard = QApplication.clipboard()
            clipboard.setText('\n'.join(data))
    
    def copy_all_rows(self):
        """复制所有行"""
        data = []
        # 先复制列名
        header_row = []
        for col in range(self.result_table.columnCount()):
            header_item = self.result_table.horizontalHeaderItem(col)
            if header_item:
                header_row.append(header_item.text())
            else:
                header_row.append(f"列{col+1}")
        data.append('\t'.join(header_row))
        
        # 复制所有行数据
        for row in range(self.result_table.rowCount()):
            row_data = []
            for col in range(self.result_table.columnCount()):
                item = self.result_table.item(row, col)
                if item:
                    row_data.append(item.text())
                else:
                    row_data.append('')
            data.append('\t'.join(row_data))
        
        from PyQt6.QtWidgets import QApplication
        clipboard = QApplication.clipboard()
        clipboard.setText('\n'.join(data))
    
    def export_to_csv(self):
        """导出为CSV"""
        from PyQt6.QtWidgets import QFileDialog, QMessageBox
        import csv
        
        # 打开文件保存对话框
        file_path, _ = QFileDialog.getSaveFileName(self, "保存CSV文件", "", "CSV文件 (*.csv)")
        if not file_path:
            return
        
        try:
            # 获取表格数据
            rows = []
            # 先获取列名
            headers = []
            for col in range(self.result_table.columnCount()):
                header_item = self.result_table.horizontalHeaderItem(col)
                if header_item:
                    headers.append(header_item.text())
                else:
                    headers.append(f"列{col+1}")
            rows.append(headers)
            
            # 获取数据行
            for row in range(self.result_table.rowCount()):
                row_data = []
                for col in range(self.result_table.columnCount()):
                    item = self.result_table.item(row, col)
                    if item:
                        row_data.append(item.text())
                    else:
                        row_data.append('')
                rows.append(row_data)
            
            # 写入CSV文件
            with open(file_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerows(rows)
            
            QMessageBox.information(self, "导出CSV", f"成功导出 {len(rows)-1} 条记录到文件 {file_path}")
        except Exception as e:
            QMessageBox.critical(self, "导出CSV失败", f"导出CSV时出错: {str(e)}")
    
    def export_to_excel(self):
        """导出为Excel"""
        from PyQt6.QtWidgets import QFileDialog, QMessageBox
        
        # 打开文件保存对话框
        file_path, _ = QFileDialog.getSaveFileName(self, "保存Excel文件", "", "Excel文件 (*.xlsx)")
        if not file_path:
            return
        
        try:
            import pandas as pd
            
            # 获取表格数据
            data = []
            # 先获取列名
            headers = []
            for col in range(self.result_table.columnCount()):
                header_item = self.result_table.horizontalHeaderItem(col)
                if header_item:
                    headers.append(header_item.text())
                else:
                    headers.append(f"列{col+1}")
            
            # 获取数据行
            for row in range(self.result_table.rowCount()):
                row_data = []
                for col in range(self.result_table.columnCount()):
                    item = self.result_table.item(row, col)
                    if item:
                        row_data.append(item.text())
                    else:
                        row_data.append('')
                data.append(row_data)
            
            # 转换为DataFrame
            df = pd.DataFrame(data, columns=headers)
            
            # 写入Excel文件
            df.to_excel(file_path, index=False)
            
            QMessageBox.information(self, "导出Excel", f"成功导出 {len(data)} 条记录到文件 {file_path}")
        except ImportError:
            QMessageBox.warning(self, "导出Excel", "需要安装pandas和openpyxl库来导出Excel文件")
        except Exception as e:
            QMessageBox.critical(self, "导出Excel失败", f"导出Excel时出错: {str(e)}")
    
    def export_to_json(self):
        """导出为JSON"""
        from PyQt6.QtWidgets import QFileDialog, QMessageBox
        import json
        
        # 打开文件保存对话框
        file_path, _ = QFileDialog.getSaveFileName(self, "保存JSON文件", "", "JSON文件 (*.json)")
        if not file_path:
            return
        
        try:
            # 获取表格数据
            data = []
            # 先获取列名
            headers = []
            for col in range(self.result_table.columnCount()):
                header_item = self.result_table.horizontalHeaderItem(col)
                if header_item:
                    headers.append(header_item.text())
                else:
                    headers.append(f"列{col+1}")
            
            # 获取数据行
            for row in range(self.result_table.rowCount()):
                row_data = {}
                for col in range(self.result_table.columnCount()):
                    item = self.result_table.item(row, col)
                    if item:
                        row_data[headers[col]] = item.text()
                    else:
                        row_data[headers[col]] = ''
                data.append(row_data)
            
            # 写入JSON文件
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            QMessageBox.information(self, "导出JSON", f"成功导出 {len(data)} 条记录到文件 {file_path}")
        except Exception as e:
            QMessageBox.critical(self, "导出JSON失败", f"导出JSON时出错: {str(e)}")
    
    def select_all_rows(self):
        """选择所有行"""
        self.result_table.selectAll()
    
    def clear_selection(self):
        """取消选择"""
        self.result_table.clearSelection()
    
    def refresh_result(self):
        """刷新结果"""
        self.main_window.sql_operations.execute_sql()
    
    def adjust_columns(self):
        """调整列宽"""
        self.result_table.resizeColumnsToContents()
    
    def hide_columns(self):
        """隐藏列"""
        from PyQt6.QtWidgets import QDialog, QVBoxLayout, QListWidget, QPushButton, QHBoxLayout
        dialog = QDialog(self)
        dialog.setWindowTitle("隐藏列")
        dialog.setGeometry(300, 200, 400, 300)
        
        layout = QVBoxLayout(dialog)
        
        list_widget = QListWidget()
        for col in range(self.result_table.columnCount()):
            header_item = self.result_table.horizontalHeaderItem(col)
            if header_item:
                list_widget.addItem(header_item.text())
            else:
                list_widget.addItem(f"列{col+1}")
        layout.addWidget(list_widget)
        
        button_layout = QHBoxLayout()
        ok_btn = QPushButton("确定")
        cancel_btn = QPushButton("取消")
        button_layout.addWidget(ok_btn)
        button_layout.addWidget(cancel_btn)
        layout.addLayout(button_layout)
        
        def on_ok():
            # 这里可以实现隐藏列的逻辑
            dialog.accept()
        
        ok_btn.clicked.connect(on_ok)
        cancel_btn.clicked.connect(dialog.reject)
        dialog.exec()
    
    def find_in_result(self):
        """在结果中查找"""
        from PyQt6.QtWidgets import QInputDialog
        text, ok = QInputDialog.getText(self, "查找", "请输入要查找的内容:")
        if ok and text:
            # 实现查找逻辑
            found = False
            for row in range(self.result_table.rowCount()):
                for col in range(self.result_table.columnCount()):
                    item = self.result_table.item(row, col)
                    if item and text in item.text():
                        self.result_table.setCurrentItem(item)
                        found = True
                        break
                if found:
                    break
    
    def delete_selected_rows(self):
        """删除选中行"""
        from PyQt6.QtWidgets import QMessageBox
        if QMessageBox.question(self, "删除行", "确定要删除选中的行吗？", 
                               QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes:
            # 实现删除逻辑
            selected_rows = sorted([row.row() for row in self.result_table.selectionModel().selectedRows()], reverse=True)
            for row in selected_rows:
                self.result_table.removeRow(row)
    
    def on_header_clicked(self, logical_index):
        """表头点击事件，用于筛选"""
        # 检查是否是右键点击
        from PyQt6.QtWidgets import QMenu
        menu = QMenu()
        
        # 获取列名
        header_item = self.result_table.horizontalHeaderItem(logical_index)
        if header_item:
            column_name = header_item.text()
        else:
            column_name = f"列{logical_index+1}"
        
        # 添加筛选选项
        menu.addAction(f"筛选: {column_name}", lambda: self.show_filter_dialog(logical_index, column_name))
        menu.addSeparator()
        menu.addAction("升序排序", lambda: self.sort_column(logical_index, Qt.SortOrder.AscendingOrder))
        menu.addAction("降序排序", lambda: self.sort_column(logical_index, Qt.SortOrder.DescendingOrder))
        menu.addSeparator()
        menu.addAction("调整列宽", lambda: self.adjust_column(logical_index))
        menu.addAction("隐藏列", lambda: self.hide_column(logical_index))
        
        # 显示菜单
        from PyQt6.QtCore import QPoint
        header = self.result_table.horizontalHeader()
        menu.exec(header.mapToGlobal(QPoint(header.sectionPosition(logical_index), header.height())))
    
    def show_filter_dialog(self, column_index, column_name):
        """显示筛选对话框"""
        from PyQt6.QtWidgets import QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton, QListWidget, QCheckBox
        
        dialog = QDialog(self)
        dialog.setWindowTitle(f"筛选: {column_name}")
        dialog.setGeometry(300, 200, 400, 300)
        
        layout = QVBoxLayout(dialog)
        
        # 筛选条件
        condition_layout = QHBoxLayout()
        condition_label = QLabel("筛选条件:")
        self.filter_input = QLineEdit()
        condition_layout.addWidget(condition_label)
        condition_layout.addWidget(self.filter_input)
        layout.addLayout(condition_layout)
        
        # 筛选选项
        option_layout = QHBoxLayout()
        option_label = QLabel("筛选选项:")
        self.exact_match = QCheckBox("精确匹配")
        self.case_sensitive = QCheckBox("区分大小写")
        option_layout.addWidget(option_label)
        option_layout.addWidget(self.exact_match)
        option_layout.addWidget(self.case_sensitive)
        layout.addLayout(option_layout)
        
        # 唯一值列表
        unique_values_label = QLabel("唯一值:")
        layout.addWidget(unique_values_label)
        
        self.unique_values_list = QListWidget()
        # 收集唯一值
        unique_values = set()
        for row in range(self.result_table.rowCount()):
            item = self.result_table.item(row, column_index)
            if item:
                unique_values.add(item.text())
        # 添加到列表
        for value in sorted(unique_values):
            self.unique_values_list.addItem(value)
        layout.addWidget(self.unique_values_list)
        
        # 按钮
        button_layout = QHBoxLayout()
        filter_btn = QPushButton("筛选")
        reset_btn = QPushButton("重置")
        cancel_btn = QPushButton("取消")
        
        button_layout.addWidget(filter_btn)
        button_layout.addWidget(reset_btn)
        button_layout.addWidget(cancel_btn)
        layout.addLayout(button_layout)
        
        # 连接信号
        filter_btn.clicked.connect(lambda: self.apply_filter(column_index))
        reset_btn.clicked.connect(lambda: self.reset_filter(column_index))
        cancel_btn.clicked.connect(dialog.reject)
        
        dialog.exec()
    
    def apply_filter(self, column_index):
        """应用筛选"""
        filter_text = self.filter_input.text()
        exact_match = self.exact_match.isChecked()
        case_sensitive = self.case_sensitive.isChecked()
        
        # 遍历所有行
        for row in range(self.result_table.rowCount()):
            item = self.result_table.item(row, column_index)
            if item:
                cell_text = item.text()
                
                # 检查是否匹配
                match = False
                if exact_match:
                    if case_sensitive:
                        match = (cell_text == filter_text)
                    else:
                        match = (cell_text.lower() == filter_text.lower())
                else:
                    if case_sensitive:
                        match = (filter_text in cell_text)
                    else:
                        match = (filter_text.lower() in cell_text.lower())
                
                # 显示或隐藏行
                self.result_table.setRowHidden(row, not match)
        
        # 关闭对话框
        self.filter_input.parent().parent().accept()
    
    def reset_filter(self, column_index):
        """重置筛选"""
        # 显示所有行
        for row in range(self.result_table.rowCount()):
            self.result_table.setRowHidden(row, False)
        
        # 关闭对话框
        self.filter_input.parent().parent().accept()
    
    def sort_column(self, column_index, order):
        """排序列"""
        self.result_table.sortItems(column_index, order)
    
    def adjust_column(self, column_index):
        """调整列宽"""
        self.result_table.resizeColumnToContents(column_index)
    
    def hide_column(self, column_index):
        """隐藏列"""
        self.result_table.setColumnHidden(column_index, True)