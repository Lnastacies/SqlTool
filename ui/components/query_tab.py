#!/usr/bin/env python3
"""
查询标签页组件
"""

from PyQt6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QComboBox, QSplitter, QTableWidget, QTextEdit
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
        
        # 创建顶部工具栏 - 匹配Navicat风格
        top_toolbar = QWidget()
        top_toolbar.setStyleSheet("""
            QWidget {
                background-color: #f8f8f8;
                border-bottom: 1px solid #e0e0e0;
                padding: 4px 8px;
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
            if new_conn_name != "未连接" and new_conn_name != self.main_window.current_connection:
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
                        if self.main_window.current_db_type == 'MySQL':
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
        self.sql_editor.setStyleSheet("""
            QTextEdit {
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 11px;
                padding: 0 8px 0 35px;
                line-height: 1.4;
            }
        """)
        main_splitter.addWidget(self.sql_editor)
        
        # 创建结果区域
        result_widget = QWidget()
        result_layout = QVBoxLayout(result_widget)
        result_layout.setContentsMargins(0, 0, 0, 0)
        
        # 查询结果表格
        self.result_table = QTableWidget()
        self.result_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.result_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.result_table.setShowGrid(True)
        self.result_table.setGridStyle(Qt.PenStyle.DotLine)
        self.result_table.setStyleSheet("""
            QTableWidget {
                background-color: #ffffff;
                border: 1px solid #e0e0e0;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
            }
            QTableWidget::header {
                background-color: #f8f8f8;
                border-bottom: 1px solid #e0e0e0;
                padding: 3px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                font-weight: bold;
            }
            QTableWidget::item {
                padding: 3px 6px;
                height: 22px;
            }
            QTableWidget::item:selected {
                background-color: #e3f2fd;
                color: #1976d2;
            }
        """)
        # 将结果表格添加到布局，设置为可伸缩
        result_layout.addWidget(self.result_table, 1)  # 1表示占用剩余空间
        
        # 结果集底部工具栏
        result_toolbar = QWidget()
        result_toolbar.setStyleSheet("""
            QWidget {
                background-color: #f8f8f8;
                border-top: 1px solid #e0e0e0;
                padding: 3px 8px;
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
        refresh_btn.clicked.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("刷新"))
        result_toolbar_layout.addWidget(refresh_btn)
        
        # 导出按钮
        export_result_btn = QPushButton("导出")
        export_result_btn.setStyleSheet("""
            QPushButton {
                padding: 2px 6px;
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
        export_result_btn.clicked.connect(self.main_window.event_handler.export_data)
        result_toolbar_layout.addWidget(export_result_btn)
        
        # 其他按钮
        zoom_in_btn = QPushButton("+")
        zoom_in_btn.setStyleSheet("""
            QPushButton {
                padding: 2px 6px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
                min-width: 20px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
        """)
        zoom_in_btn.clicked.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("放大"))
        result_toolbar_layout.addWidget(zoom_in_btn)
        
        zoom_out_btn = QPushButton("-")
        zoom_out_btn.setStyleSheet("""
            QPushButton {
                padding: 2px 6px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
                min-width: 20px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
        """)
        zoom_out_btn.clicked.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("缩小"))
        result_toolbar_layout.addWidget(zoom_out_btn)
        
        fit_btn = QPushButton("○")
        fit_btn.setStyleSheet("""
            QPushButton {
                padding: 2px 6px;
                font-size: 10px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
                min-width: 20px;
            }
            QPushButton:hover {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
            }
        """)
        fit_btn.clicked.connect(lambda: self.main_window.event_handler.show_feature_not_implemented("适应"))
        result_toolbar_layout.addWidget(fit_btn)
        
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
                font-size: 10px;
                background-color: #f8f8f8;
                border: 1px solid #e0e0e0;
                padding: 3px 6px;
                max-width: 400px;
                border-radius: 2px;
            }
        """)
        result_toolbar_layout.addWidget(self.message_output)
        
        # 将结果工具栏添加到布局
        result_layout.addWidget(result_toolbar)
        
        main_splitter.addWidget(result_widget)
        tab_layout.addWidget(main_splitter)
        
        # 设置分割器比例
        main_splitter.setSizes([300, 200])
    
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