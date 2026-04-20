#!/usr/bin/env python3
"""
数据库备份与恢复模块
"""

from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QTabWidget, QWidget, 
                            QLabel, QComboBox, QTextEdit, QTableWidget, QTableWidgetItem, 
                            QSplitter, QGroupBox, QMessageBox, QFileDialog, QProgressBar, QCheckBox)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont

class BackupRestore(QDialog):
    """
    备份与恢复类
    """
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        
        self.setWindowTitle("备份与恢复")
        self.setGeometry(100, 100, 800, 600)
        
        self.setup_ui()
    
    def setup_ui(self):
        """
        设置UI
        """
        # 主布局
        main_layout = QVBoxLayout(self)
        
        # 标签页
        self.tab_widget = QTabWidget()
        
        # 备份标签页
        backup_tab = QWidget()
        backup_layout = QVBoxLayout(backup_tab)
        
        # 数据库选择
        db_selection_layout = QHBoxLayout()
        db_label = QLabel("数据库:")
        self.db_combo = QComboBox()
        self.load_databases(self.db_combo)
        db_selection_layout.addWidget(db_label)
        db_selection_layout.addWidget(self.db_combo)
        backup_layout.addLayout(db_selection_layout)
        
        # 表选择
        table_selection_group = QGroupBox("表选择")
        table_selection_layout = QVBoxLayout(table_selection_group)
        
        # 表列表
        self.tables_table = QTableWidget()
        self.tables_table.setColumnCount(2)
        self.tables_table.setHorizontalHeaderLabels(["表名", "包含"])
        table_selection_layout.addWidget(self.tables_table)
        
        # 全选按钮
        select_all_btn = QPushButton("全选")
        deselect_all_btn = QPushButton("取消全选")
        select_layout = QHBoxLayout()
        select_layout.addWidget(select_all_btn)
        select_layout.addWidget(deselect_all_btn)
        table_selection_layout.addLayout(select_layout)
        
        backup_layout.addWidget(table_selection_group)
        
        # 备份选项
        options_group = QGroupBox("备份选项")
        options_layout = QVBoxLayout(options_group)
        
        # 备份类型
        backup_type_layout = QHBoxLayout()
        self.structure_radio = QCheckBox("仅结构")
        self.data_radio = QCheckBox("仅数据")
        self.both_radio = QCheckBox("结构和数据")
        self.both_radio.setChecked(True)
        backup_type_layout.addWidget(self.structure_radio)
        backup_type_layout.addWidget(self.data_radio)
        backup_type_layout.addWidget(self.both_radio)
        options_layout.addLayout(backup_type_layout)
        
        # 其他选项
        self.include_create_db_checkbox = QCheckBox("包含CREATE DATABASE语句")
        self.include_drop_table_checkbox = QCheckBox("包含DROP TABLE语句")
        self.compact_checkbox = QCheckBox("压缩备份文件")
        options_layout.addWidget(self.include_create_db_checkbox)
        options_layout.addWidget(self.include_drop_table_checkbox)
        options_layout.addWidget(self.compact_checkbox)
        
        backup_layout.addWidget(options_group)
        
        # 备份文件
        file_group = QGroupBox("备份文件")
        file_layout = QVBoxLayout(file_group)
        
        file_path_layout = QHBoxLayout()
        self.file_path_edit = QTextEdit()
        self.file_path_edit.setPlaceholderText("选择备份文件路径")
        self.file_path_edit.setMaximumHeight(40)
        browse_btn = QPushButton("浏览...")
        file_path_layout.addWidget(self.file_path_edit)
        file_path_layout.addWidget(browse_btn)
        file_layout.addLayout(file_path_layout)
        
        backup_layout.addWidget(file_group)
        
        # 备份按钮
        backup_btn = QPushButton("开始备份")
        backup_layout.addWidget(backup_btn)
        
        # 备份日志
        log_group = QGroupBox("备份日志")
        log_layout = QVBoxLayout(log_group)
        self.backup_log = QTextEdit()
        self.backup_log.setReadOnly(True)
        self.backup_log.setFont(QFont("Consolas", 10))
        log_layout.addWidget(self.backup_log)
        backup_layout.addWidget(log_group)
        
        self.tab_widget.addTab(backup_tab, "备份")
        
        # 恢复标签页
        restore_tab = QWidget()
        restore_layout = QVBoxLayout(restore_tab)
        
        # 数据库选择
        restore_db_layout = QHBoxLayout()
        restore_db_label = QLabel("目标数据库:")
        self.restore_db_combo = QComboBox()
        self.load_databases(self.restore_db_combo)
        restore_db_layout.addWidget(restore_db_label)
        restore_db_layout.addWidget(self.restore_db_combo)
        restore_layout.addLayout(restore_db_layout)
        
        # 恢复文件
        restore_file_group = QGroupBox("恢复文件")
        restore_file_layout = QVBoxLayout(restore_file_group)
        
        restore_file_path_layout = QHBoxLayout()
        self.restore_file_path_edit = QTextEdit()
        self.restore_file_path_edit.setPlaceholderText("选择恢复文件路径")
        self.restore_file_path_edit.setMaximumHeight(40)
        restore_browse_btn = QPushButton("浏览...")
        restore_file_path_layout.addWidget(self.restore_file_path_edit)
        restore_file_path_layout.addWidget(restore_browse_btn)
        restore_file_layout.addLayout(restore_file_path_edit)
        
        # 恢复选项
        restore_options_layout = QVBoxLayout()
        self.drop_existing_checkbox = QCheckBox("在恢复前删除现有表")
        self.ignore_errors_checkbox = QCheckBox("忽略错误继续恢复")
        restore_options_layout.addWidget(self.drop_existing_checkbox)
        restore_options_layout.addWidget(self.ignore_errors_checkbox)
        restore_file_layout.addLayout(restore_options_layout)
        
        restore_layout.addWidget(restore_file_group)
        
        # 恢复按钮
        restore_btn = QPushButton("开始恢复")
        restore_layout.addWidget(restore_btn)
        
        # 恢复日志
        restore_log_group = QGroupBox("恢复日志")
        restore_log_layout = QVBoxLayout(restore_log_group)
        self.restore_log = QTextEdit()
        self.restore_log.setReadOnly(True)
        self.restore_log.setFont(QFont("Consolas", 10))
        restore_log_layout.addWidget(self.restore_log)
        restore_layout.addWidget(restore_log_group)
        
        self.tab_widget.addTab(restore_tab, "恢复")
        
        main_layout.addWidget(self.tab_widget)
        
        # 连接信号
        self.db_combo.currentTextChanged.connect(self.update_tables)
        select_all_btn.clicked.connect(self.select_all_tables)
        deselect_all_btn.clicked.connect(self.deselect_all_tables)
        browse_btn.clicked.connect(self.browse_backup_file)
        backup_btn.clicked.connect(self.start_backup)
        restore_browse_btn.clicked.connect(self.browse_restore_file)
        restore_btn.clicked.connect(self.start_restore)
    
    def load_databases(self, combo):
        """
        加载数据库列表
        """
        try:
            if hasattr(self.main_window, 'db_connection'):
                with self.main_window.db_connection.cursor() as cursor:
                    if self.main_window.current_db_type == 'MySQL':
                        cursor.execute("SHOW DATABASES")
                        databases = cursor.fetchall()
                        for db in databases:
                            db_name = db['Database'] if isinstance(db, dict) else db[0]
                            combo.addItem(db_name)
                    elif self.main_window.current_db_type == 'PostgreSQL':
                        cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
                        databases = cursor.fetchall()
                        for db in databases:
                            db_name = db[0]
                            combo.addItem(db_name)
                    elif self.main_window.current_db_type == 'SQL Server':
                        cursor.execute("SELECT name FROM sys.databases WHERE database_id > 4")
                        databases = cursor.fetchall()
                        for db in databases:
                            db_name = db[0]
                            combo.addItem(db_name)
        except Exception as e:
            self.logger.log('ERROR', f"加载数据库列表失败: {str(e)}")
    
    def update_tables(self):
        """
        更新表列表
        """
        db_name = self.db_combo.currentText()
        if not db_name:
            return
        
        try:
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type == 'MySQL':
                    cursor.execute(f"USE {db_name}")
                    cursor.execute("SHOW TABLES")
                    tables = cursor.fetchall()
                    
                    self.tables_table.setRowCount(len(tables))
                    for i, table in enumerate(tables):
                        table_name = table['Tables_in_' + db_name] if isinstance(table, dict) else table[0]
                        self.tables_table.setItem(i, 0, QTableWidgetItem(table_name))
                        checkbox = QCheckBox()
                        checkbox.setChecked(True)
                        self.tables_table.setCellWidget(i, 1, checkbox)
                elif self.main_window.current_db_type == 'PostgreSQL':
                    cursor.execute(f"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_catalog = '{db_name}'")
                    tables = cursor.fetchall()
                    
                    self.tables_table.setRowCount(len(tables))
                    for i, table in enumerate(tables):
                        table_name = table[0]
                        self.tables_table.setItem(i, 0, QTableWidgetItem(table_name))
                        checkbox = QCheckBox()
                        checkbox.setChecked(True)
                        self.tables_table.setCellWidget(i, 1, checkbox)
                elif self.main_window.current_db_type == 'SQL Server':
                    cursor.execute(f"USE {db_name}")
                    cursor.execute("SELECT name FROM sys.tables")
                    tables = cursor.fetchall()
                    
                    self.tables_table.setRowCount(len(tables))
                    for i, table in enumerate(tables):
                        table_name = table[0]
                        self.tables_table.setItem(i, 0, QTableWidgetItem(table_name))
                        checkbox = QCheckBox()
                        checkbox.setChecked(True)
                        self.tables_table.setCellWidget(i, 1, checkbox)
        except Exception as e:
            self.logger.log('ERROR', f"更新表列表失败: {str(e)}")
    
    def select_all_tables(self):
        """
        全选表
        """
        for i in range(self.tables_table.rowCount()):
            checkbox = self.tables_table.cellWidget(i, 1)
            if checkbox:
                checkbox.setChecked(True)
    
    def deselect_all_tables(self):
        """
        取消全选表
        """
        for i in range(self.tables_table.rowCount()):
            checkbox = self.tables_table.cellWidget(i, 1)
            if checkbox:
                checkbox.setChecked(False)
    
    def browse_backup_file(self):
        """
        浏览备份文件
        """
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存备份文件", "", "SQL文件 (*.sql);;所有文件 (*.*)"
        )
        if file_path:
            self.file_path_edit.setText(file_path)
    
    def browse_restore_file(self):
        """
        浏览恢复文件
        """
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择恢复文件", "", "SQL文件 (*.sql);;所有文件 (*.*)"
        )
        if file_path:
            self.restore_file_path_edit.setText(file_path)
    
    def start_backup(self):
        """
        开始备份
        """
        db_name = self.db_combo.currentText()
        file_path = self.file_path_edit.toPlainText().strip()
        
        if not db_name:
            QMessageBox.warning(self, "备份", "请选择数据库")
            return
        
        if not file_path:
            QMessageBox.warning(self, "备份", "请选择备份文件路径")
            return
        
        # 获取选中的表
        selected_tables = []
        for i in range(self.tables_table.rowCount()):
            checkbox = self.tables_table.cellWidget(i, 1)
            if checkbox and checkbox.isChecked():
                table_name = self.tables_table.item(i, 0).text()
                selected_tables.append(table_name)
        
        if not selected_tables:
            QMessageBox.warning(self, "备份", "请至少选择一个表")
            return
        
        # 获取备份选项
        backup_type = "both"
        if self.structure_radio.isChecked():
            backup_type = "structure"
        elif self.data_radio.isChecked():
            backup_type = "data"
        
        include_create_db = self.include_create_db_checkbox.isChecked()
        include_drop_table = self.include_drop_table_checkbox.isChecked()
        compact = self.compact_checkbox.isChecked()
        
        try:
            self.backup_log.clear()
            self.backup_log.append(f"开始备份数据库: {db_name}")
            
            # 生成备份SQL
            backup_sql = self._generate_backup_sql(db_name, selected_tables, backup_type, include_create_db, include_drop_table)
            
            # 写入备份文件
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(backup_sql)
            
            self.backup_log.append(f"备份成功，文件保存到: {file_path}")
            QMessageBox.information(self, "备份", "备份成功")
        except Exception as e:
            QMessageBox.critical(self, "备份失败", f"备份时出错: {str(e)}")
            self.logger.log('ERROR', f"备份失败: {str(e)}")
    
    def _generate_backup_sql(self, db_name, tables, backup_type, include_create_db, include_drop_table):
        """
        生成备份SQL
        """
        sql = f"-- 数据库备份脚本\n-- 数据库: {db_name}\n-- 备份类型: {backup_type}\n\n"
        
        # 添加CREATE DATABASE语句
        if include_create_db:
            if self.main_window.current_db_type == 'MySQL':
                sql += f"CREATE DATABASE IF NOT EXISTS `{db_name}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n"
                sql += f"USE `{db_name}`;\n\n"
            elif self.main_window.current_db_type == 'PostgreSQL':
                sql += f"CREATE DATABASE {db_name};\n"
                sql += f"\c {db_name};\n\n"
            elif self.main_window.current_db_type == 'SQL Server':
                sql += f"CREATE DATABASE {db_name};\n"
                sql += f"USE {db_name};\n\n"
        
        # 生成表结构和数据
        for table_name in tables:
            if backup_type in ['structure', 'both']:
                # 生成表结构
                create_table_sql = self._get_create_table_sql(db_name, table_name, include_drop_table)
                sql += create_table_sql
                sql += "\n"
            
            if backup_type in ['data', 'both']:
                # 生成数据
                insert_sql = self._get_insert_sql(db_name, table_name)
                sql += insert_sql
                sql += "\n"
        
        return sql
    
    def _get_create_table_sql(self, db_name, table_name, include_drop_table):
        """
        获取创建表的SQL
        """
        sql = ""
        
        if include_drop_table:
            sql += f"DROP TABLE IF EXISTS `{table_name}`;\n"
        
        with self.main_window.db_connection.cursor() as cursor:
            if self.main_window.current_db_type == 'MySQL':
                cursor.execute(f"USE {db_name}")
                cursor.execute(f"SHOW CREATE TABLE {table_name}")
                create_table = cursor.fetchone()
                create_table_sql = create_table['Create Table'] if isinstance(create_table, dict) else create_table[1]
                sql += f"{create_table_sql};\n"
            elif self.main_window.current_db_type == 'PostgreSQL':
                cursor.execute(f"SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '{table_name}' AND table_schema = 'public' AND table_catalog = '{db_name}'")
                columns = cursor.fetchall()
                # 构建CREATE TABLE语句
                create_table_sql = f"CREATE TABLE {table_name} ("
                column_defs = []
                for col in columns:
                    col_name, col_type, is_nullable, col_default = col
                    column_def = f"{col_name} {col_type}"
                    if is_nullable == 'NO':
                        column_def += " NOT NULL"
                    if col_default:
                        column_def += f" DEFAULT {col_default}"
                    column_defs.append(column_def)
                create_table_sql += ", ".join(column_defs)
                create_table_sql += ")"
                sql += f"{create_table_sql};\n"
            elif self.main_window.current_db_type == 'SQL Server':
                cursor.execute(f"USE {db_name}")
                cursor.execute(f"SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '{table_name}'")
                columns = cursor.fetchall()
                # 构建CREATE TABLE语句
                create_table_sql = f"CREATE TABLE {table_name} ("
                column_defs = []
                for col in columns:
                    col_name, col_type, is_nullable, col_default = col
                    column_def = f"{col_name} {col_type}"
                    if is_nullable == 'NO':
                        column_def += " NOT NULL"
                    if col_default:
                        column_def += f" DEFAULT {col_default}"
                    column_defs.append(column_def)
                create_table_sql += ", ".join(column_defs)
                create_table_sql += ")"
                sql += f"{create_table_sql};\n"
        
        return sql
    
    def _get_insert_sql(self, db_name, table_name):
        """
        获取插入数据的SQL
        """
        sql = f"-- 插入表 {table_name} 的数据\n"
        
        with self.main_window.db_connection.cursor() as cursor:
            if self.main_window.current_db_type == 'MySQL':
                cursor.execute(f"USE {db_name}")
            elif self.main_window.current_db_type == 'SQL Server':
                cursor.execute(f"USE {db_name}")
            
            cursor.execute(f"SELECT * FROM {table_name}")
            results = cursor.fetchall()
            
            if results:
                # 获取列名
                columns = [desc[0] for desc in cursor.description]
                columns_str = ', '.join([f"`{col}`" for col in columns])
                
                # 生成插入语句
                for row in results:
                    values = []
                    for value in row:
                        if value is None:
                            values.append('NULL')
                        elif isinstance(value, str):
                            # 转义单引号
                            value = value.replace("'", "''")
                            values.append(f"'{value}'")
                        else:
                            values.append(str(value))
                    values_str = ', '.join(values)
                    sql += f"INSERT INTO `{table_name}` ({columns_str}) VALUES ({values_str});\n"
        
        return sql
    
    def start_restore(self):
        """
        开始恢复
        """
        db_name = self.restore_db_combo.currentText()
        file_path = self.restore_file_path_edit.toPlainText().strip()
        
        if not db_name:
            QMessageBox.warning(self, "恢复", "请选择目标数据库")
            return
        
        if not file_path:
            QMessageBox.warning(self, "恢复", "请选择恢复文件路径")
            return
        
        # 获取恢复选项
        drop_existing = self.drop_existing_checkbox.isChecked()
        ignore_errors = self.ignore_errors_checkbox.isChecked()
        
        try:
            self.restore_log.clear()
            self.restore_log.append(f"开始恢复数据库: {db_name}")
            
            # 读取恢复文件
            with open(file_path, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            # 执行恢复SQL
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type == 'MySQL':
                    cursor.execute(f"USE {db_name}")
                elif self.main_window.current_db_type == 'SQL Server':
                    cursor.execute(f"USE {db_name}")
                
                # 分割SQL语句
                sql_statements = sql_content.split(';')
                executed = 0
                errors = 0
                
                for statement in sql_statements:
                    statement = statement.strip()
                    if statement:
                        try:
                            cursor.execute(statement)
                            executed += 1
                        except Exception as e:
                            errors += 1
                            if not ignore_errors:
                                raise
                            self.restore_log.append(f"执行SQL语句失败: {str(e)}")
                
            self.main_window.db_connection.commit()
            
            self.restore_log.append(f"恢复完成，执行了 {executed} 条SQL语句，{errors} 条错误")
            QMessageBox.information(self, "恢复", "恢复成功")
        except Exception as e:
            QMessageBox.critical(self, "恢复失败", f"恢复时出错: {str(e)}")
            self.logger.log('ERROR', f"恢复失败: {str(e)}")