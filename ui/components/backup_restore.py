#!/usr/bin/env python3
"""
数据库备份与恢复模块
"""

from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QTabWidget, QWidget, 
                            QLabel, QComboBox, QTextEdit, QTableWidget, QTableWidgetItem, 
                            QSplitter, QGroupBox, QMessageBox, QFileDialog, QProgressBar, QCheckBox)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont
import os
import mysql.connector
import psycopg2
import pyodbc
import mariadb
import sqlite3

class BackupWorker(QThread):
    progress = pyqtSignal(int, str)
    finished = pyqtSignal(bool, str)
    
    def __init__(self, conn_info, db_name, tables, backup_type, include_create_db, include_drop_table, file_path):
        super().__init__()
        self.conn_info = conn_info
        self.db_name = db_name
        self.tables = tables
        self.backup_type = backup_type
        self.include_create_db = include_create_db
        self.include_drop_table = include_drop_table
        self.file_path = file_path
    
    def run(self):
        try:
            self.progress.emit(0, "正在建立数据库连接...")
            
            conn = self._create_connection()
            if not conn:
                self.finished.emit(False, "无法建立数据库连接")
                return
            
            try:
                self.progress.emit(10, "开始生成备份SQL...")
                
                sql = f"-- 数据库备份脚本\n-- 数据库: {self.db_name}\n-- 备份类型: {self.backup_type}\n\n"
                
                if self.include_create_db:
                    sql += self._generate_create_db_sql()
                
                total_tables = len(self.tables)
                for i, table_name in enumerate(self.tables):
                    progress = 10 + int((i + 1) / total_tables * 80)
                    self.progress.emit(progress, f"正在备份表: {table_name}")
                    
                    if self.backup_type in ['structure', 'both']:
                        sql += self._get_create_table_sql(conn, table_name)
                    
                    if self.backup_type in ['data', 'both']:
                        sql += self._get_insert_sql(conn, table_name)
                
                self.progress.emit(95, "正在写入备份文件...")
                
                with open(self.file_path, 'w', encoding='utf-8') as f:
                    f.write(sql)
                
                self.progress.emit(100, "备份完成")
                self.finished.emit(True, f"备份成功，文件保存到: {self.file_path}")
            finally:
                conn.close()
        except Exception as e:
            self.finished.emit(False, f"备份失败: {str(e)}")
    
    def _create_connection(self):
        conn_type = self.conn_info.get('type')
        
        try:
            if conn_type == 'MySQL':
                return mysql.connector.connect(
                    host=self.conn_info.get('host', 'localhost'),
                    port=self.conn_info.get('port', 3306),
                    user=self.conn_info.get('username', 'root'),
                    password=self.conn_info.get('password', ''),
                    database=self.db_name
                )
            elif conn_type == 'PostgreSQL':
                return psycopg2.connect(
                    host=self.conn_info.get('host', 'localhost'),
                    port=self.conn_info.get('port', 5432),
                    user=self.conn_info.get('username', 'postgres'),
                    password=self.conn_info.get('password', ''),
                    dbname=self.db_name
                )
            elif conn_type == 'SQL Server':
                conn_str = f"DRIVER={{SQL Server}};SERVER={self.conn_info.get('host', 'localhost')},{self.conn_info.get('port', 1433)};DATABASE={self.db_name};UID={self.conn_info.get('username', 'sa')};PWD={self.conn_info.get('password', '')}"
                return pyodbc.connect(conn_str)
            elif conn_type == 'MariaDB':
                return mariadb.connect(
                    host=self.conn_info.get('host', 'localhost'),
                    port=self.conn_info.get('port', 3306),
                    user=self.conn_info.get('username', 'root'),
                    password=self.conn_info.get('password', ''),
                    database=self.db_name
                )
            elif conn_type == 'SQLite':
                return sqlite3.connect(self.conn_info.get('database', ':memory:'))
        except Exception as e:
            return None
    
    def _generate_create_db_sql(self):
        db_type = self.conn_info.get('type')
        if db_type == 'MySQL':
            return f"CREATE DATABASE IF NOT EXISTS `{self.db_name}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE `{self.db_name}`;\n\n"
        elif db_type == 'PostgreSQL':
            return f"CREATE DATABASE {self.db_name};\n\\c {self.db_name};\n\n"
        elif db_type == 'SQL Server':
            return f"CREATE DATABASE {self.db_name};\nUSE {self.db_name};\n\n"
        return ""
    
    def _get_create_table_sql(self, conn, table_name):
        sql = ""
        if self.include_drop_table:
            sql += f"DROP TABLE IF EXISTS `{table_name}`;\n"
        
        db_type = self.conn_info.get('type')
        
        try:
            if db_type == 'MySQL':
                cursor = conn.cursor(dictionary=True)
                cursor.execute(f"SHOW CREATE TABLE {table_name}")
                create_table = cursor.fetchone()
                cursor.close()
                if create_table:
                    sql += f"{create_table['Create Table']};\n"
            elif db_type == 'PostgreSQL':
                cursor = conn.cursor()
                cursor.execute(f"""
                    SELECT column_name, data_type, is_nullable, column_default 
                    FROM information_schema.columns 
                    WHERE table_name = '{table_name}' AND table_schema = 'public'
                """)
                columns = cursor.fetchall()
                cursor.close()
                
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
                create_table_sql += ");\n"
                sql += create_table_sql
            elif db_type == 'SQL Server':
                cursor = conn.cursor()
                cursor.execute(f"""
                    SELECT column_name, data_type, is_nullable, column_default 
                    FROM information_schema.columns 
                    WHERE table_name = '{table_name}'
                """)
                columns = cursor.fetchall()
                cursor.close()
                
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
                create_table_sql += ");\n"
                sql += create_table_sql
            elif db_type == 'MariaDB':
                cursor = conn.cursor(dictionary=True)
                cursor.execute(f"SHOW CREATE TABLE {table_name}")
                create_table = cursor.fetchone()
                cursor.close()
                if create_table:
                    sql += f"{create_table['Create Table']};\n"
            elif db_type == 'SQLite':
                cursor = conn.cursor()
                cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table_name}'")
                result = cursor.fetchone()
                cursor.close()
                if result:
                    sql += f"{result[0]};\n"
        except Exception as e:
            sql += f"-- 获取表结构失败: {table_name}\n"
        
        sql += "\n"
        return sql
    
    def _get_insert_sql(self, conn, table_name):
        sql = f"-- 插入表 {table_name} 的数据\n"
        
        db_type = self.conn_info.get('type')
        
        try:
            cursor = conn.cursor()
            cursor.execute(f"SELECT * FROM {table_name}")
            results = cursor.fetchall()
            
            if results:
                columns = [desc[0] for desc in cursor.description]
                columns_str = ', '.join([f"`{col}`" for col in columns])
                
                for row in results:
                    values = []
                    for value in row:
                        if value is None:
                            values.append('NULL')
                        elif isinstance(value, str):
                            value = value.replace("'", "''")
                            values.append(f"'{value}'")
                        else:
                            values.append(str(value))
                    values_str = ', '.join(values)
                    sql += f"INSERT INTO `{table_name}` ({columns_str}) VALUES ({values_str});\n"
            
            cursor.close()
        except Exception as e:
            sql += f"-- 获取表数据失败: {table_name}\n"
        
        sql += "\n"
        return sql

class RestoreWorker(QThread):
    progress = pyqtSignal(int, str)
    finished = pyqtSignal(bool, str)
    
    def __init__(self, conn_info, db_name, file_path, drop_existing, ignore_errors):
        super().__init__()
        self.conn_info = conn_info
        self.db_name = db_name
        self.file_path = file_path
        self.drop_existing = drop_existing
        self.ignore_errors = ignore_errors
    
    def run(self):
        try:
            self.progress.emit(0, "正在建立数据库连接...")
            
            conn = self._create_connection()
            if not conn:
                self.finished.emit(False, "无法建立数据库连接")
                return
            
            try:
                self.progress.emit(10, "正在读取备份文件...")
                
                with open(self.file_path, 'r', encoding='utf-8') as f:
                    sql_content = f.read()
                
                self.progress.emit(20, "开始执行SQL语句...")
                
                cursor = conn.cursor()
                db_type = self.conn_info.get('type')
                
                if db_type in ['MySQL', 'SQL Server']:
                    cursor.execute(f"USE {self.db_name}")
                elif db_type == 'PostgreSQL':
                    cursor.execute(f"SET search_path TO {self.db_name}")
                
                sql_statements = sql_content.split(';')
                total_statements = len([s for s in sql_statements if s.strip()])
                executed = 0
                errors = 0
                
                for i, statement in enumerate(sql_statements):
                    statement = statement.strip()
                    if statement:
                        try:
                            cursor.execute(statement)
                            executed += 1
                            progress = 20 + int(executed / total_statements * 75)
                            self.progress.emit(progress, f"已执行 {executed}/{total_statements} 条语句")
                        except Exception as e:
                            errors += 1
                            if not self.ignore_errors:
                                raise
                            self.progress.emit(progress, f"执行失败: {str(e)[:50]}...")
                
                conn.commit()
                cursor.close()
                
                self.progress.emit(100, "恢复完成")
                self.finished.emit(True, f"恢复完成，执行了 {executed} 条SQL语句，{errors} 条错误")
            finally:
                conn.close()
        except Exception as e:
            self.finished.emit(False, f"恢复失败: {str(e)}")
    
    def _create_connection(self):
        conn_type = self.conn_info.get('type')
        
        try:
            if conn_type == 'MySQL':
                return mysql.connector.connect(
                    host=self.conn_info.get('host', 'localhost'),
                    port=self.conn_info.get('port', 3306),
                    user=self.conn_info.get('username', 'root'),
                    password=self.conn_info.get('password', ''),
                    database=self.db_name
                )
            elif conn_type == 'PostgreSQL':
                return psycopg2.connect(
                    host=self.conn_info.get('host', 'localhost'),
                    port=self.conn_info.get('port', 5432),
                    user=self.conn_info.get('username', 'postgres'),
                    password=self.conn_info.get('password', ''),
                    dbname=self.db_name
                )
            elif conn_type == 'SQL Server':
                conn_str = f"DRIVER={{SQL Server}};SERVER={self.conn_info.get('host', 'localhost')},{self.conn_info.get('port', 1433)};DATABASE={self.db_name};UID={self.conn_info.get('username', 'sa')};PWD={self.conn_info.get('password', '')}"
                return pyodbc.connect(conn_str)
            elif conn_type == 'MariaDB':
                return mariadb.connect(
                    host=self.conn_info.get('host', 'localhost'),
                    port=self.conn_info.get('port', 3306),
                    user=self.conn_info.get('username', 'root'),
                    password=self.conn_info.get('password', ''),
                    database=self.db_name
                )
            elif conn_type == 'SQLite':
                return sqlite3.connect(self.conn_info.get('database', ':memory:'))
        except Exception as e:
            return None

class BackupRestore(QDialog):
    """
    备份与恢复类
    """
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        
        self.setWindowTitle("备份与恢复")
        self.setGeometry(100, 100, 900, 650)
        
        self.current_conn_info = None
        self.backup_worker = None
        self.restore_worker = None
        
        self.setup_ui()
    
    def setup_ui(self):
        """
        设置UI
        """
        main_layout = QVBoxLayout(self)
        
        self.tab_widget = QTabWidget()
        
        backup_tab = QWidget()
        backup_layout = QVBoxLayout(backup_tab)
        
        conn_group = QGroupBox("连接设置")
        conn_layout = QHBoxLayout(conn_group)
        
        conn_label = QLabel("连接:")
        self.conn_combo = QComboBox()
        self.conn_combo.setMinimumWidth(200)
        
        test_conn_btn = QPushButton("测试连接")
        conn_layout.addWidget(conn_label)
        conn_layout.addWidget(self.conn_combo)
        conn_layout.addWidget(test_conn_btn)
        conn_layout.addStretch()
        
        backup_layout.addWidget(conn_group)
        
        db_selection_layout = QHBoxLayout()
        db_label = QLabel("数据库:")
        self.db_combo = QComboBox()
        self.db_combo.setMinimumWidth(200)
        db_selection_layout.addWidget(db_label)
        db_selection_layout.addWidget(self.db_combo)
        backup_layout.addLayout(db_selection_layout)
        
        table_selection_group = QGroupBox("表选择")
        table_selection_layout = QVBoxLayout(table_selection_group)
        
        self.tables_table = QTableWidget()
        self.tables_table.setColumnCount(2)
        self.tables_table.setHorizontalHeaderLabels(["表名", "包含"])
        self.tables_table.horizontalHeader().setStretchLastSection(True)
        table_selection_layout.addWidget(self.tables_table)
        
        select_all_btn = QPushButton("全选")
        deselect_all_btn = QPushButton("取消全选")
        select_layout = QHBoxLayout()
        select_layout.addWidget(select_all_btn)
        select_layout.addWidget(deselect_all_btn)
        select_layout.addStretch()
        table_selection_layout.addLayout(select_layout)
        
        backup_layout.addWidget(table_selection_group)
        
        options_group = QGroupBox("备份选项")
        options_layout = QVBoxLayout(options_group)
        
        backup_type_layout = QHBoxLayout()
        self.structure_radio = QCheckBox("仅结构")
        self.data_radio = QCheckBox("仅数据")
        self.both_radio = QCheckBox("结构和数据")
        self.both_radio.setChecked(True)
        backup_type_layout.addWidget(self.structure_radio)
        backup_type_layout.addWidget(self.data_radio)
        backup_type_layout.addWidget(self.both_radio)
        backup_type_layout.addStretch()
        options_layout.addLayout(backup_type_layout)
        
        self.include_create_db_checkbox = QCheckBox("包含CREATE DATABASE语句")
        self.include_drop_table_checkbox = QCheckBox("包含DROP TABLE语句")
        self.compact_checkbox = QCheckBox("压缩备份文件")
        options_layout.addWidget(self.include_create_db_checkbox)
        options_layout.addWidget(self.include_drop_table_checkbox)
        options_layout.addWidget(self.compact_checkbox)
        
        backup_layout.addWidget(options_group)
        
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
        
        progress_layout = QHBoxLayout()
        self.backup_progress = QProgressBar()
        self.backup_progress.setVisible(False)
        progress_layout.addWidget(self.backup_progress)
        backup_layout.addLayout(progress_layout)
        
        backup_btn = QPushButton("开始备份")
        backup_layout.addWidget(backup_btn)
        
        log_group = QGroupBox("备份日志")
        log_layout = QVBoxLayout(log_group)
        self.backup_log = QTextEdit()
        self.backup_log.setReadOnly(True)
        self.backup_log.setFont(QFont("Consolas", 10))
        log_layout.addWidget(self.backup_log)
        backup_layout.addWidget(log_group)
        
        self.tab_widget.addTab(backup_tab, "备份")
        
        restore_tab = QWidget()
        restore_layout = QVBoxLayout(restore_tab)
        
        restore_conn_group = QGroupBox("连接设置")
        restore_conn_layout = QHBoxLayout(restore_conn_group)
        
        restore_conn_label = QLabel("目标连接:")
        self.restore_conn_combo = QComboBox()
        self.restore_conn_combo.setMinimumWidth(200)
        
        restore_test_conn_btn = QPushButton("测试连接")
        restore_conn_layout.addWidget(restore_conn_label)
        restore_conn_layout.addWidget(self.restore_conn_combo)
        restore_conn_layout.addWidget(restore_test_conn_btn)
        restore_conn_layout.addStretch()
        
        restore_layout.addWidget(restore_conn_group)
        
        restore_db_layout = QHBoxLayout()
        restore_db_label = QLabel("目标数据库:")
        self.restore_db_combo = QComboBox()
        self.restore_db_combo.setMinimumWidth(200)
        restore_db_layout.addWidget(restore_db_label)
        restore_db_layout.addWidget(self.restore_db_combo)
        restore_layout.addLayout(restore_db_layout)
        
        restore_file_group = QGroupBox("恢复文件")
        restore_file_layout = QVBoxLayout(restore_file_group)
        
        restore_file_path_layout = QHBoxLayout()
        self.restore_file_path_edit = QTextEdit()
        self.restore_file_path_edit.setPlaceholderText("选择恢复文件路径")
        self.restore_file_path_edit.setMaximumHeight(40)
        restore_browse_btn = QPushButton("浏览...")
        restore_file_path_layout.addWidget(self.restore_file_path_edit)
        restore_file_path_layout.addWidget(restore_browse_btn)
        restore_file_layout.addLayout(restore_file_path_layout)
        
        restore_options_layout = QVBoxLayout()
        self.drop_existing_checkbox = QCheckBox("在恢复前删除现有表")
        self.ignore_errors_checkbox = QCheckBox("忽略错误继续恢复")
        restore_options_layout.addWidget(self.drop_existing_checkbox)
        restore_options_layout.addWidget(self.ignore_errors_checkbox)
        restore_file_layout.addLayout(restore_options_layout)
        
        restore_layout.addWidget(restore_file_group)
        
        restore_progress_layout = QHBoxLayout()
        self.restore_progress = QProgressBar()
        self.restore_progress.setVisible(False)
        restore_progress_layout.addWidget(self.restore_progress)
        restore_layout.addLayout(restore_progress_layout)
        
        restore_btn = QPushButton("开始恢复")
        restore_layout.addWidget(restore_btn)
        
        restore_log_group = QGroupBox("恢复日志")
        restore_log_layout = QVBoxLayout(restore_log_group)
        self.restore_log = QTextEdit()
        self.restore_log.setReadOnly(True)
        self.restore_log.setFont(QFont("Consolas", 10))
        restore_log_layout.addWidget(self.restore_log)
        restore_layout.addWidget(restore_log_group)
        
        self.tab_widget.addTab(restore_tab, "恢复")
        
        main_layout.addWidget(self.tab_widget)
        
        self.load_connections()
        
        self.conn_combo.currentTextChanged.connect(self.on_conn_changed)
        self.restore_conn_combo.currentTextChanged.connect(self.on_restore_conn_changed)
        self.db_combo.currentTextChanged.connect(self.update_tables)
        select_all_btn.clicked.connect(self.select_all_tables)
        deselect_all_btn.clicked.connect(self.deselect_all_tables)
        browse_btn.clicked.connect(self.browse_backup_file)
        backup_btn.clicked.connect(self.start_backup)
        restore_browse_btn.clicked.connect(self.browse_restore_file)
        restore_btn.clicked.connect(self.start_restore)
        test_conn_btn.clicked.connect(self.test_backup_connection)
        restore_test_conn_btn.clicked.connect(self.test_restore_connection)
        
        if self.conn_combo.count() > 0:
            self.on_conn_changed(self.conn_combo.currentText())
        if self.restore_conn_combo.count() > 0:
            self.on_restore_conn_changed(self.restore_conn_combo.currentText())
    
    def load_connections(self):
        """
        加载所有保存的连接
        """
        self.conn_combo.clear()
        self.restore_conn_combo.clear()
        connections = self.main_window.saved_connections
        for conn_name in connections.keys():
            self.conn_combo.addItem(conn_name)
            self.restore_conn_combo.addItem(conn_name)
    
    def on_conn_changed(self, conn_name):
        """
        当连接选择改变时触发
        """
        self.current_conn_info = self.main_window.saved_connections.get(conn_name)
        self.load_databases(self.db_combo, conn_name)
    
    def on_restore_conn_changed(self, conn_name):
        """
        当恢复连接选择改变时触发
        """
        self.load_databases(self.restore_db_combo, conn_name)
    
    def load_databases(self, combo, conn_name):
        """
        根据连接加载数据库列表
        """
        combo.clear()
        conn_info = self.main_window.saved_connections.get(conn_name)
        if not conn_info:
            return
        
        try:
            conn = None
            conn_type = conn_info.get('type')
            
            if conn_type == 'MySQL':
                conn = mysql.connector.connect(
                    host=conn_info.get('host', 'localhost'),
                    port=conn_info.get('port', 3306),
                    user=conn_info.get('username', 'root'),
                    password=conn_info.get('password', '')
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SHOW DATABASES")
                databases = cursor.fetchall()
                for db in databases:
                    db_name = db['Database'] if isinstance(db, dict) else db[0]
                    combo.addItem(db_name)
                cursor.close()
            
            elif conn_type == 'PostgreSQL':
                conn = psycopg2.connect(
                    host=conn_info.get('host', 'localhost'),
                    port=conn_info.get('port', 5432),
                    user=conn_info.get('username', 'postgres'),
                    password=conn_info.get('password', ''),
                    dbname='postgres'
                )
                cursor = conn.cursor()
                cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
                databases = cursor.fetchall()
                for db in databases:
                    combo.addItem(db[0])
                cursor.close()
            
            elif conn_type == 'SQL Server':
                conn_str = f"DRIVER={{SQL Server}};SERVER={conn_info.get('host', 'localhost')},{conn_info.get('port', 1433)};DATABASE=master;UID={conn_info.get('username', 'sa')};PWD={conn_info.get('password', '')}"
                conn = pyodbc.connect(conn_str)
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sys.databases WHERE database_id > 4")
                databases = cursor.fetchall()
                for db in databases:
                    combo.addItem(db[0])
                cursor.close()
            
            elif conn_type == 'MariaDB':
                conn = mariadb.connect(
                    host=conn_info.get('host', 'localhost'),
                    port=conn_info.get('port', 3306),
                    user=conn_info.get('username', 'root'),
                    password=conn_info.get('password', '')
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SHOW DATABASES")
                databases = cursor.fetchall()
                for db in databases:
                    db_name = db['Database'] if isinstance(db, dict) else db[0]
                    combo.addItem(db_name)
                cursor.close()
            
            elif conn_type == 'SQLite':
                combo.addItem(conn_info.get('database', 'SQLite'))
            
            if conn:
                conn.close()
        
        except Exception as e:
            try:
                error_msg = str(e)
            except:
                error_msg = repr(e)
            self.logger.log('ERROR', f"加载数据库列表失败: {error_msg}")
            QMessageBox.warning(self, "错误", f"加载数据库列表失败: {error_msg}")
    
    def update_tables(self):
        """
        更新表列表
        """
        db_name = self.db_combo.currentText()
        conn_name = self.conn_combo.currentText()
        conn_info = self.main_window.saved_connections.get(conn_name)
        
        if not db_name or not conn_info:
            return
        
        self.tables_table.setRowCount(0)
        
        try:
            conn = None
            conn_type = conn_info.get('type')
            
            if conn_type == 'MySQL':
                conn = mysql.connector.connect(
                    host=conn_info.get('host', 'localhost'),
                    port=conn_info.get('port', 3306),
                    user=conn_info.get('username', 'root'),
                    password=conn_info.get('password', ''),
                    database=db_name
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SHOW TABLES")
                tables = cursor.fetchall()
                cursor.close()
                
                self.tables_table.setRowCount(len(tables))
                for i, table in enumerate(tables):
                    table_name = table['Tables_in_' + db_name] if isinstance(table, dict) else table[0]
                    self.tables_table.setItem(i, 0, QTableWidgetItem(table_name))
                    checkbox = QCheckBox()
                    checkbox.setChecked(True)
                    self.tables_table.setCellWidget(i, 1, checkbox)
            
            elif conn_type == 'PostgreSQL':
                conn = psycopg2.connect(
                    host=conn_info.get('host', 'localhost'),
                    port=conn_info.get('port', 5432),
                    user=conn_info.get('username', 'postgres'),
                    password=conn_info.get('password', ''),
                    dbname=db_name
                )
                cursor = conn.cursor()
                cursor.execute(f"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
                tables = cursor.fetchall()
                cursor.close()
                
                self.tables_table.setRowCount(len(tables))
                for i, table in enumerate(tables):
                    table_name = table[0]
                    self.tables_table.setItem(i, 0, QTableWidgetItem(table_name))
                    checkbox = QCheckBox()
                    checkbox.setChecked(True)
                    self.tables_table.setCellWidget(i, 1, checkbox)
            
            elif conn_type == 'SQL Server':
                conn_str = f"DRIVER={{SQL Server}};SERVER={conn_info.get('host', 'localhost')},{conn_info.get('port', 1433)};DATABASE={db_name};UID={conn_info.get('username', 'sa')};PWD={conn_info.get('password', '')}"
                conn = pyodbc.connect(conn_str)
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sys.tables")
                tables = cursor.fetchall()
                cursor.close()
                
                self.tables_table.setRowCount(len(tables))
                for i, table in enumerate(tables):
                    table_name = table[0]
                    self.tables_table.setItem(i, 0, QTableWidgetItem(table_name))
                    checkbox = QCheckBox()
                    checkbox.setChecked(True)
                    self.tables_table.setCellWidget(i, 1, checkbox)
            
            elif conn_type == 'MariaDB':
                conn = mariadb.connect(
                    host=conn_info.get('host', 'localhost'),
                    port=conn_info.get('port', 3306),
                    user=conn_info.get('username', 'root'),
                    password=conn_info.get('password', ''),
                    database=db_name
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SHOW TABLES")
                tables = cursor.fetchall()
                cursor.close()
                
                self.tables_table.setRowCount(len(tables))
                for i, table in enumerate(tables):
                    table_name = table['Tables_in_' + db_name] if isinstance(table, dict) else table[0]
                    self.tables_table.setItem(i, 0, QTableWidgetItem(table_name))
                    checkbox = QCheckBox()
                    checkbox.setChecked(True)
                    self.tables_table.setCellWidget(i, 1, checkbox)
            
            elif conn_type == 'SQLite':
                conn = sqlite3.connect(conn_info.get('database', ':memory:'))
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = cursor.fetchall()
                cursor.close()
                
                self.tables_table.setRowCount(len(tables))
                for i, table in enumerate(tables):
                    table_name = table[0]
                    self.tables_table.setItem(i, 0, QTableWidgetItem(table_name))
                    checkbox = QCheckBox()
                    checkbox.setChecked(True)
                    self.tables_table.setCellWidget(i, 1, checkbox)
            
            if conn:
                conn.close()
        
        except Exception as e:
            try:
                error_msg = str(e)
            except:
                error_msg = repr(e)
            self.logger.log('ERROR', f"更新表列表失败: {error_msg}")
            QMessageBox.warning(self, "错误", f"更新表列表失败: {error_msg}")
    
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
            if not file_path.lower().endswith('.sql'):
                file_path += '.sql'
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
    
    def test_backup_connection(self):
        """
        测试备份连接
        """
        conn_name = self.conn_combo.currentText()
        self._test_connection(conn_name, "备份")
    
    def test_restore_connection(self):
        """
        测试恢复连接
        """
        conn_name = self.restore_conn_combo.currentText()
        self._test_connection(conn_name, "恢复")
    
    def _test_connection(self, conn_name, conn_type):
        """
        测试连接
        """
        conn_info = self.main_window.saved_connections.get(conn_name)
        if not conn_info:
            QMessageBox.warning(self, "错误", "请选择一个连接")
            return
        
        try:
            conn = None
            db_type = conn_info.get('type')
            
            if db_type == 'MySQL':
                conn = mysql.connector.connect(
                    host=conn_info.get('host', 'localhost'),
                    port=conn_info.get('port', 3306),
                    user=conn_info.get('username', 'root'),
                    password=conn_info.get('password', '')
                )
            elif db_type == 'PostgreSQL':
                conn = psycopg2.connect(
                    host=conn_info.get('host', 'localhost'),
                    port=conn_info.get('port', 5432),
                    user=conn_info.get('username', 'postgres'),
                    password=conn_info.get('password', ''),
                    dbname='postgres'
                )
            elif db_type == 'SQL Server':
                conn_str = f"DRIVER={{SQL Server}};SERVER={conn_info.get('host', 'localhost')},{conn_info.get('port', 1433)};DATABASE=master;UID={conn_info.get('username', 'sa')};PWD={conn_info.get('password', '')}"
                conn = pyodbc.connect(conn_str)
            elif db_type == 'MariaDB':
                conn = mariadb.connect(
                    host=conn_info.get('host', 'localhost'),
                    port=conn_info.get('port', 3306),
                    user=conn_info.get('username', 'root'),
                    password=conn_info.get('password', '')
                )
            elif db_type == 'SQLite':
                conn = sqlite3.connect(conn_info.get('database', ':memory:'))
            
            if conn:
                conn.close()
                QMessageBox.information(self, "连接测试", f"{conn_type}连接测试成功")
        
        except Exception as e:
            try:
                error_msg = str(e)
            except:
                error_msg = repr(e)
            QMessageBox.critical(self, "连接测试失败", f"{conn_type}连接测试失败: {error_msg}")
            self.logger.log('ERROR', f"{conn_type}连接测试失败: {error_msg}")
    
    def start_backup(self):
        """
        开始备份
        """
        conn_name = self.conn_combo.currentText()
        conn_info = self.main_window.saved_connections.get(conn_name)
        db_name = self.db_combo.currentText()
        file_path = self.file_path_edit.toPlainText().strip()
        
        if not conn_name:
            QMessageBox.warning(self, "备份", "请选择连接")
            return
        
        if not conn_info:
            QMessageBox.warning(self, "备份", "连接信息不存在")
            return
        
        if not db_name:
            QMessageBox.warning(self, "备份", "请选择数据库")
            return
        
        if not file_path:
            QMessageBox.warning(self, "备份", "请选择备份文件路径")
            return
        
        selected_tables = []
        for i in range(self.tables_table.rowCount()):
            checkbox = self.tables_table.cellWidget(i, 1)
            if checkbox and checkbox.isChecked():
                table_name = self.tables_table.item(i, 0).text()
                selected_tables.append(table_name)
        
        if not selected_tables:
            QMessageBox.warning(self, "备份", "请至少选择一个表")
            return
        
        backup_type = "both"
        if self.structure_radio.isChecked():
            backup_type = "structure"
        elif self.data_radio.isChecked():
            backup_type = "data"
        
        include_create_db = self.include_create_db_checkbox.isChecked()
        include_drop_table = self.include_drop_table_checkbox.isChecked()
        
        self.backup_log.clear()
        self.backup_log.append(f"开始备份数据库: {db_name}")
        self.backup_log.append(f"连接: {conn_name}")
        self.backup_log.append(f"备份类型: {backup_type}")
        self.backup_log.append(f"表数量: {len(selected_tables)}")
        
        self.backup_progress.setVisible(True)
        self.backup_progress.setValue(0)
        
        self.backup_worker = BackupWorker(
            conn_info, db_name, selected_tables, backup_type, 
            include_create_db, include_drop_table, file_path
        )
        self.backup_worker.progress.connect(self.on_backup_progress)
        self.backup_worker.finished.connect(self.on_backup_finished)
        self.backup_worker.start()
    
    def on_backup_progress(self, value, message):
        """
        备份进度更新
        """
        self.backup_progress.setValue(value)
        self.backup_log.append(message)
    
    def on_backup_finished(self, success, message):
        """
        备份完成
        """
        self.backup_progress.setVisible(False)
        self.backup_log.append(message)
        
        if success:
            QMessageBox.information(self, "备份", "备份成功")
        else:
            QMessageBox.critical(self, "备份失败", message)
            self.logger.log('ERROR', message)
    
    def start_restore(self):
        """
        开始恢复
        """
        conn_name = self.restore_conn_combo.currentText()
        conn_info = self.main_window.saved_connections.get(conn_name)
        db_name = self.restore_db_combo.currentText()
        file_path = self.restore_file_path_edit.toPlainText().strip()
        
        if not conn_name:
            QMessageBox.warning(self, "恢复", "请选择目标连接")
            return
        
        if not conn_info:
            QMessageBox.warning(self, "恢复", "连接信息不存在")
            return
        
        if not db_name:
            QMessageBox.warning(self, "恢复", "请选择目标数据库")
            return
        
        if not file_path:
            QMessageBox.warning(self, "恢复", "请选择恢复文件路径")
            return
        
        if not os.path.exists(file_path):
            QMessageBox.warning(self, "恢复", "恢复文件不存在")
            return
        
        drop_existing = self.drop_existing_checkbox.isChecked()
        ignore_errors = self.ignore_errors_checkbox.isChecked()
        
        self.restore_log.clear()
        self.restore_log.append(f"开始恢复数据库: {db_name}")
        self.restore_log.append(f"连接: {conn_name}")
        self.restore_log.append(f"恢复文件: {file_path}")
        
        self.restore_progress.setVisible(True)
        self.restore_progress.setValue(0)
        
        self.restore_worker = RestoreWorker(
            conn_info, db_name, file_path, drop_existing, ignore_errors
        )
        self.restore_worker.progress.connect(self.on_restore_progress)
        self.restore_worker.finished.connect(self.on_restore_finished)
        self.restore_worker.start()
    
    def on_restore_progress(self, value, message):
        """
        恢复进度更新
        """
        self.restore_progress.setValue(value)
        self.restore_log.append(message)
    
    def on_restore_finished(self, success, message):
        """
        恢复完成
        """
        self.restore_progress.setVisible(False)
        self.restore_log.append(message)
        
        if success:
            QMessageBox.information(self, "恢复", "恢复成功")
        else:
            QMessageBox.critical(self, "恢复失败", message)
            self.logger.log('ERROR', message)