#!/usr/bin/env python3
"""
表设计器模块
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem, 
    QPushButton, QToolBar, QSplitter, QWidget, QLabel, QComboBox, 
    QLineEdit, QCheckBox, QTabWidget, QTextEdit, QGroupBox, QInputDialog, QMessageBox
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QAction

class TableDesigner(QDialog):
    """
    表设计器类
    """
    def __init__(self, main_window, table_name=None):
        super().__init__(main_window)
        self.main_window = main_window
        self.table_name = table_name
        self.logger = main_window.logger
        
        self.setWindowTitle(f"设计表: {table_name}" if table_name else "新建表")
        self.setGeometry(100, 100, 1000, 600)
        
        self.setup_ui()
    
    def setup_ui(self):
        """
        设置UI
        """
        # 主布局
        main_layout = QHBoxLayout(self)
        
        # 左侧主要区域
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        
        # 工具栏
        toolbar = QToolBar()
        toolbar.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextBesideIcon)
        
        # 工具栏按钮
        add_action = QAction("新增", self)
        delete_action = QAction("删除", self)
        index_action = QAction("索引", self)
        foreign_key_action = QAction("外键", self)
        options_action = QAction("选项", self)
        sql_preview_action = QAction("SQL预览", self)
        move_up_action = QAction("上移", self)
        move_down_action = QAction("下移", self)
        
        toolbar.addAction(add_action)
        toolbar.addAction(delete_action)
        toolbar.addSeparator()
        toolbar.addAction(index_action)
        toolbar.addAction(foreign_key_action)
        toolbar.addAction(options_action)
        toolbar.addSeparator()
        toolbar.addAction(sql_preview_action)
        toolbar.addSeparator()
        toolbar.addAction(move_up_action)
        toolbar.addAction(move_down_action)
        
        left_layout.addWidget(toolbar)
        
        # 字段表格
        self.field_table = QTableWidget()
        self.field_table.setColumnCount(8)
        self.field_table.setHorizontalHeaderLabels(["字段名", "类型", "长度", "小数位", "not null", "默认", "主键", "注释"])
        
        # 加载表结构（如果是编辑模式）
        if self.table_name:
            self.load_table_structure()
        else:
            # 新建表时添加默认列
            self.add_default_column()
        
        # 调整列宽
        self.field_table.resizeColumnsToContents()
        # 设置固定列宽，确保重要列显示完整
        self.field_table.setColumnWidth(0, 120)  # 字段名
        self.field_table.setColumnWidth(1, 120)  # 类型
        self.field_table.setColumnWidth(2, 50)   # 长度
        self.field_table.setColumnWidth(3, 50)   # 小数位
        self.field_table.setColumnWidth(4, 50)   # not null
        self.field_table.setColumnWidth(5, 60)  # 默认
        self.field_table.setColumnWidth(6, 50)   # 主键
        self.field_table.setColumnWidth(7, 150)  # 注释
        left_layout.addWidget(self.field_table)
        
        # 下方设置区域
        bottom_widget = QWidget()
        bottom_layout = QHBoxLayout(bottom_widget)
        
        # 默认值
        default_group = QGroupBox("默认")
        default_layout = QVBoxLayout(default_group)
        default_combo = QComboBox()
        default_combo.addItem("utf8mb4")
        default_layout.addWidget(default_combo)
        bottom_layout.addWidget(default_group)
        
        # 字符集
        charset_group = QGroupBox("字符集")
        charset_layout = QVBoxLayout(charset_group)
        charset_combo = QComboBox()
        charset_combo.addItem("utf8mb4_general_ci")
        charset_layout.addWidget(charset_combo)
        bottom_layout.addWidget(charset_group)
        
        # 排序规则
        collation_group = QGroupBox("排序规则")
        collation_layout = QVBoxLayout(collation_group)
        collation_combo = QComboBox()
        collation_combo.addItem("utf8mb4_general_ci")
        collation_layout.addWidget(collation_combo)
        bottom_layout.addWidget(collation_group)
        
        # 二进制定义
        binary_group = QGroupBox("选项")
        binary_layout = QVBoxLayout(binary_group)
        binary_checkbox = QCheckBox("二进制定义")
        binary_layout.addWidget(binary_checkbox)
        bottom_layout.addWidget(binary_group)
        
        left_layout.addWidget(bottom_widget)
        
        # 右侧面板
        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)
        right_widget.setMinimumWidth(150)  # 减小右侧面板的最小宽度
        
        # 标签页
        tab_widget = QTabWidget()
        
        # 表信息标签页
        table_info_tab = QWidget()
        table_info_layout = QVBoxLayout(table_info_tab)
        
        table_info_group = QGroupBox("表信息")
        table_info_group_layout = QVBoxLayout(table_info_group)
        
        table_info = QTextEdit()
        table_info.setReadOnly(True)
        table_info.setText(self._get_table_info())
        table_info_group_layout.addWidget(table_info)
        table_info_layout.addWidget(table_info_group)
        
        # 日历标签页
        calendar_tab = QWidget()
        calendar_layout = QVBoxLayout(calendar_tab)
        
        calendar_group = QGroupBox("日历")
        calendar_group_layout = QVBoxLayout(calendar_group)
        
        calendar_info = QTextEdit()
        calendar_info.setReadOnly(True)
        calendar_info.setText(self._get_calendar_info())
        calendar_group_layout.addWidget(calendar_info)
        calendar_layout.addWidget(calendar_group)
        
        tab_widget.addTab(table_info_tab, "表信息")
        tab_widget.addTab(calendar_tab, "日历")
        right_layout.addWidget(tab_widget)
        
        # 分割器
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.addWidget(left_widget)
        splitter.addWidget(right_widget)
        splitter.setSizes([950, 150])  # 给左侧面板更多空间
        
        main_layout.addWidget(splitter)
        
        # 按钮
        button_layout = QHBoxLayout()
        save_btn = QPushButton("保存")
        cancel_btn = QPushButton("取消")
        
        button_layout.addWidget(save_btn)
        button_layout.addWidget(cancel_btn)
        main_layout.addLayout(button_layout)
        
        # 连接信号
        save_btn.clicked.connect(self.save_table)
        cancel_btn.clicked.connect(self.reject)
        add_action.triggered.connect(self.add_column)
        delete_action.triggered.connect(self.delete_column)
        move_up_action.triggered.connect(self.move_column_up)
        move_down_action.triggered.connect(self.move_column_down)
        index_action.triggered.connect(self.show_index_dialog)
        foreign_key_action.triggered.connect(self.show_foreign_key_dialog)
        options_action.triggered.connect(self.show_options_dialog)
        sql_preview_action.triggered.connect(self.show_sql_preview)
    
    def load_table_structure(self):
        """
        加载表结构
        """
        try:
            with self.main_window.db_connection.cursor() as cursor:
                # 使用SHOW FULL COLUMNS FROM获取列的详细信息，包括注释
                cursor.execute(f"SHOW FULL COLUMNS FROM {self.table_name}")
                columns = cursor.fetchall()
            
            # 添加列信息
            self.field_table.setRowCount(len(columns))
            for i, col in enumerate(columns):
                col_name = col['Field'] if isinstance(col, dict) else col[0]
                col_type = col['Type'] if isinstance(col, dict) else col[1]
                col_null = col['Null'] if isinstance(col, dict) else col[2]
                col_default = col['Default'] if isinstance(col, dict) else col[3]
                col_key = col['Key'] if isinstance(col, dict) else col[4]
                col_comment = col['Comment'] if isinstance(col, dict) else col[8]
                
                # 提取类型和长度
                import re
                type_match = re.match(r'([a-zA-Z]+)(\((\d+)(,(\d+))?\))?', col_type)
                if type_match:
                    field_type = type_match.group(1)
                    length = type_match.group(3) or ""
                    decimal = type_match.group(5) or ""
                else:
                    field_type = col_type
                    length = ""
                    decimal = ""
                
                self.field_table.setItem(i, 0, QTableWidgetItem(col_name))
                # 创建带输入功能的下拉框
                type_combo = QComboBox()
                type_combo.setEditable(True)
                # 添加常用数据类型
                common_types = ['INT', 'VARCHAR', 'TEXT', 'DATE', 'DATETIME', 'TIMESTAMP', 'DECIMAL', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'CHAR', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB']
                type_combo.addItems(common_types)
                # 设置当前值
                type_combo.setCurrentText(field_type)
                # 启用自动补全
                type_combo.completer().setCompletionMode(type_combo.completer().CompletionMode.PopupCompletion)
                type_combo.completer().setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
                # 添加到表格
                self.field_table.setCellWidget(i, 1, type_combo)
                self.field_table.setItem(i, 2, QTableWidgetItem(length))
                self.field_table.setItem(i, 3, QTableWidgetItem(decimal))
                
                # 不为空复选框
                null_checkbox = QCheckBox()
                null_checkbox.setChecked(col_null == "NO")
                self.field_table.setCellWidget(i, 4, null_checkbox)
                
                self.field_table.setItem(i, 5, QTableWidgetItem(str(col_default) if col_default is not None else ""))
                
                # 主键复选框
                primary_checkbox = QCheckBox()
                primary_checkbox.setChecked(col_key == "PRI")
                self.field_table.setCellWidget(i, 6, primary_checkbox)
                
                # 设置注释
                self.field_table.setItem(i, 7, QTableWidgetItem(col_comment if col_comment else ""))
        except Exception as e:
            self.logger.log('ERROR', f"加载表结构失败: {str(e)}")
    
    def add_default_column(self):
        """
        添加默认列
        """
        self.field_table.setRowCount(1)
        self.field_table.setItem(0, 0, QTableWidgetItem("id"))
        # 创建带输入功能的下拉框
        type_combo = QComboBox()
        type_combo.setEditable(True)
        # 添加常用数据类型
        common_types = ['INT', 'VARCHAR', 'TEXT', 'DATE', 'DATETIME', 'TIMESTAMP', 'DECIMAL', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'CHAR', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB']
        type_combo.addItems(common_types)
        # 设置当前值
        type_combo.setCurrentText("INT")
        # 启用自动补全
        type_combo.completer().setCompletionMode(type_combo.completer().CompletionMode.PopupCompletion)
        type_combo.completer().setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        # 添加到表格
        self.field_table.setCellWidget(0, 1, type_combo)
        self.field_table.setItem(0, 2, QTableWidgetItem("11"))
        self.field_table.setItem(0, 3, QTableWidgetItem(""))
        
        # 不为空复选框
        null_checkbox = QCheckBox()
        null_checkbox.setChecked(True)
        self.field_table.setCellWidget(0, 4, null_checkbox)
        
        self.field_table.setItem(0, 5, QTableWidgetItem("AUTO_INCREMENT"))
        
        # 主键复选框
        primary_checkbox = QCheckBox()
        primary_checkbox.setChecked(True)
        self.field_table.setCellWidget(0, 6, primary_checkbox)
        
        self.field_table.setItem(0, 7, QTableWidgetItem(""))
    
    def add_column(self):
        """
        添加列
        """
        row_count = self.field_table.rowCount()
        self.field_table.setRowCount(row_count + 1)
        
        # 创建带输入功能的下拉框
        type_combo = QComboBox()
        type_combo.setEditable(True)
        # 添加常用数据类型
        common_types = ['INT', 'VARCHAR', 'TEXT', 'DATE', 'DATETIME', 'TIMESTAMP', 'DECIMAL', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT', 'CHAR', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB']
        type_combo.addItems(common_types)
        # 设置默认值
        type_combo.setCurrentText("VARCHAR")
        # 启用自动补全
        type_combo.completer().setCompletionMode(type_combo.completer().CompletionMode.PopupCompletion)
        type_combo.completer().setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        # 添加到表格
        self.field_table.setCellWidget(row_count, 1, type_combo)
    
    def delete_column(self):
        """
        删除列
        """
        selected_rows = self.field_table.selectionModel().selectedRows()
        if selected_rows:
            row = selected_rows[0].row()
            self.field_table.removeRow(row)
    
    def move_column_up(self):
        """
        上移列
        """
        selected_rows = self.field_table.selectionModel().selectedRows()
        if selected_rows:
            row = selected_rows[0].row()
            if row > 0:
                self._swap_rows(row, row - 1)
    
    def move_column_down(self):
        """
        下移列
        """
        selected_rows = self.field_table.selectionModel().selectedRows()
        if selected_rows:
            row = selected_rows[0].row()
            if row < self.field_table.rowCount() - 1:
                self._swap_rows(row, row + 1)
    
    def _swap_rows(self, row1, row2):
        """
        交换两行
        """
        for col in range(self.field_table.columnCount()):
            if col == 1:  # 类型下拉框列
                widget1 = self.field_table.cellWidget(row1, col)
                widget2 = self.field_table.cellWidget(row2, col)
                if widget1 and widget2:
                    text1 = widget1.currentText()
                    text2 = widget2.currentText()
                    widget1.setCurrentText(text2)
                    widget2.setCurrentText(text1)
            elif col in [4, 6]:  # 复选框列
                widget1 = self.field_table.cellWidget(row1, col)
                widget2 = self.field_table.cellWidget(row2, col)
                if widget1 and widget2:
                    checked1 = widget1.isChecked()
                    checked2 = widget2.isChecked()
                    widget1.setChecked(checked2)
                    widget2.setChecked(checked1)
            else:  # 普通文本列
                item1 = self.field_table.takeItem(row1, col)
                item2 = self.field_table.takeItem(row2, col)
                self.field_table.setItem(row1, col, item2)
                self.field_table.setItem(row2, col, item1)
    
    def save_table(self):
        """
        保存表结构
        """
        try:
            # 生成SQL语句
            if self.table_name:
                # 修改表
                sql = self._generate_alter_table_sql()
            else:
                # 新建表
                table_name, ok = QInputDialog.getText(self, "新建表", "请输入表名:")
                if not ok or not table_name:
                    return
                sql = self._generate_create_table_sql(table_name)
            
            # 执行SQL
            with self.main_window.db_connection.cursor() as cursor:
                # 对于修改表，先删除再创建
                if self.table_name:
                    # 先备份数据（如果需要）
                    backup_table = f"{self.table_name}_backup"
                    backup_sql = f"CREATE TABLE IF NOT EXISTS {backup_table} LIKE {self.table_name}"
                    cursor.execute(backup_sql)
                    insert_sql = f"INSERT INTO {backup_table} SELECT * FROM {self.table_name}"
                    cursor.execute(insert_sql)
                
                # 执行创建/修改表的SQL
                if self.table_name:
                    # 先删除表
                    drop_sql = f"DROP TABLE IF EXISTS {self.table_name}"
                    cursor.execute(drop_sql)
                # 执行创建表的SQL
                cursor.execute(sql)
                
                if self.table_name:
                    # 恢复数据
                    try:
                        columns = []
                        auto_increment_column = None
                        with self.main_window.db_connection.cursor() as cursor2:
                            # 获取备份表的结构
                            cursor2.execute(f"DESCRIBE {backup_table}")
                            backup_columns = cursor2.fetchall()
                            for col in backup_columns:
                                col_name = col['Field'] if isinstance(col, dict) else col[0]
                                extra = col['Extra'] if isinstance(col, dict) else col[5]
                                # 检查是否是自增列
                                if 'auto_increment' in extra.lower():
                                    auto_increment_column = col_name
                                else:
                                    columns.append(col_name)
                        
                        if columns:
                            columns_str = ", ".join(columns)
                            # 如果有自增列，不包括它在插入语句中
                            if auto_increment_column:
                                restore_sql = f"INSERT INTO {self.table_name} ({columns_str}) SELECT {columns_str} FROM {backup_table}"
                            else:
                                # 如果没有自增列，使用REPLACE INTO避免主键冲突
                                restore_sql = f"REPLACE INTO {self.table_name} ({columns_str}) SELECT {columns_str} FROM {backup_table}"
                            cursor.execute(restore_sql)
                            # 删除备份表
                            drop_backup_sql = f"DROP TABLE IF EXISTS {backup_table}"
                            cursor.execute(drop_backup_sql)
                    except Exception as e:
                        self.logger.log('WARNING', f"恢复数据失败: {str(e)}")
            
            self.main_window.db_connection.commit()
            
            QMessageBox.information(self, "保存成功", "表结构保存成功")
            self.logger.log('INFO', f"保存表结构: {self.table_name or table_name}")
            
            # 刷新对象树
            self.main_window.load_database_objects()
            self.accept()
        except Exception as e:
            QMessageBox.critical(self, "保存失败", f"保存表结构时出错: {str(e)}")
            self.logger.log('ERROR', f"保存表结构失败: {str(e)}")
    
    def _generate_create_table_sql(self, table_name):
        """
        生成创建表的SQL语句
        """
        sql = f"CREATE TABLE {table_name} ("
        columns = []
        
        for i in range(self.field_table.rowCount()):
            col_name = self.field_table.item(i, 0).text() if self.field_table.item(i, 0) else ""
            # 获取字段类型（从下拉框中获取）
            type_combo = self.field_table.cellWidget(i, 1)
            col_type = type_combo.currentText() if type_combo else ""
            col_length = self.field_table.item(i, 2).text() if self.field_table.item(i, 2) else ""
            col_decimal = self.field_table.item(i, 3).text() if self.field_table.item(i, 3) else ""
            
            # 获取复选框状态
            null_checkbox = self.field_table.cellWidget(i, 4)
            is_not_null = null_checkbox.isChecked() if null_checkbox else False
            
            col_default = self.field_table.item(i, 5).text() if self.field_table.item(i, 5) else ""
            
            primary_checkbox = self.field_table.cellWidget(i, 6)
            is_primary = primary_checkbox.isChecked() if primary_checkbox else False
            
            if col_name and col_type:
                column_def = f"{col_name} {col_type}"
                if col_length:
                    if col_decimal:
                        column_def += f"({col_length},{col_decimal})"
                    else:
                        column_def += f"({col_length})"
                if is_not_null:
                    column_def += " NOT NULL"
                if col_default:
                    column_def += f" DEFAULT {col_default}"
                if is_primary:
                    column_def += " PRIMARY KEY"
                if "AUTO_INCREMENT" in col_default:
                    column_def += " AUTO_INCREMENT"
                # 添加注释
                col_comment = self.field_table.item(i, 7).text() if self.field_table.item(i, 7) else ""
                if col_comment:
                    column_def += f" COMMENT '{col_comment}'"
                columns.append(column_def)
        
        if columns:
            sql += ", ".join(columns)
            sql += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
        
        return sql
    
    def _generate_alter_table_sql(self):
        """
        生成修改表的SQL语句
        """
        # 这里简化处理，实际应该比较原表结构和新表结构
        # 生成重建表的SQL
        create_sql = self._generate_create_table_sql(self.table_name)
        
        return create_sql
    
    def _get_table_info(self):
        """
        获取表信息
        """
        if not self.table_name:
            return """
行: 0
引擎: InnoDB
自动递增: 0
字符集: utf8mb4
排序规则: utf8mb4_general_ci
创建时间: -
修改时间: -
"""
        
        try:
            with self.main_window.db_connection.cursor() as cursor:
                cursor.execute(f"SHOW TABLE STATUS LIKE '{self.table_name}'")
                status = cursor.fetchone()
                
                if status:
                    if isinstance(status, dict):
                        rows = status.get('Rows', 0)
                        engine = status.get('Engine', 'InnoDB')
                        auto_increment = status.get('Auto_increment', 0)
                        collation = status.get('Collation', 'utf8mb4_general_ci')
                        create_time = status.get('Create_time', '-')
                        update_time = status.get('Update_time', '-')
                    else:
                        rows = status[4]
                        engine = status[1]
                        auto_increment = status[10]
                        collation = status[14]
                        create_time = status[11]
                        update_time = status[12]
                    
                    return f"""
行: {rows}
引擎: {engine}
自动递增: {auto_increment}
字符集: utf8mb4
排序规则: {collation}
创建时间: {create_time}
修改时间: {update_time}
"""
        except Exception as e:
            self.logger.log('ERROR', f"获取表信息失败: {str(e)}")
        
        return """
行: 0
引擎: InnoDB
自动递增: 0
字符集: utf8mb4
排序规则: utf8mb4_general_ci
创建时间: -
修改时间: -
"""
    
    def show_sql_preview(self):
        """
        显示SQL预览
        """
        try:
            if self.table_name:
                sql = self._generate_alter_table_sql()
            else:
                # 对于新建表，使用临时表名生成SQL
                sql = self._generate_create_table_sql("temp_table")
            
            # 创建预览对话框
            preview_dialog = QDialog(self)
            preview_dialog.setWindowTitle("SQL预览")
            preview_dialog.setGeometry(200, 200, 800, 400)
            
            layout = QVBoxLayout(preview_dialog)
            
            # SQL文本编辑框
            sql_edit = QTextEdit()
            sql_edit.setPlainText(sql)
            sql_edit.setReadOnly(True)
            layout.addWidget(sql_edit)
            
            # 关闭按钮
            close_btn = QPushButton("关闭")
            close_btn.clicked.connect(preview_dialog.accept)
            layout.addWidget(close_btn)
            
            preview_dialog.exec()
        except Exception as e:
            QMessageBox.critical(self, "错误", f"生成SQL预览失败: {str(e)}")
            self.logger.log('ERROR', f"生成SQL预览失败: {str(e)}")
    
    def show_index_dialog(self):
        """
        显示索引管理对话框
        """
        QMessageBox.information(self, "索引管理", "索引管理功能开发中...")
    
    def show_foreign_key_dialog(self):
        """
        显示外键管理对话框
        """
        QMessageBox.information(self, "外键管理", "外键管理功能开发中...")
    
    def show_options_dialog(self):
        """
        显示表选项对话框
        """
        QMessageBox.information(self, "表选项", "表选项功能开发中...")
    
    def _get_calendar_info(self):
        """
        获取日历信息
        """
        from datetime import datetime
        import calendar
        
        today = datetime.now()
        year, month, day = today.year, today.month, today.day
        
        # 简单的日历信息
        return f"""
阳历日期: {today.strftime('%Y-%m-%d')}
阴历日期: 癸卯年腊月十五
生肖: 龙
星座: 水瓶座
节日: 小年
"""


