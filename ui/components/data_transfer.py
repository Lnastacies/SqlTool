#!/usr/bin/env python3
"""
数据传输模块
"""

from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QTabWidget, QWidget, 
                            QLabel, QComboBox, QTextEdit, QTableWidget, QTableWidgetItem, 
                            QSplitter, QGroupBox, QMessageBox, QProgressBar, QRadioButton)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont

class DataTransfer(QDialog):
    """
    数据传输类
    """
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        
        self.setWindowTitle("数据传输")
        self.setGeometry(100, 100, 1000, 600)
        
        self.setup_ui()
    
    def setup_ui(self):
        """
        设置UI
        """
        # 主布局
        main_layout = QVBoxLayout(self)
        
        # 标签页
        self.tab_widget = QTabWidget()
        
        # 常规标签页
        general_tab = QWidget()
        general_layout = QVBoxLayout(general_tab)
        
        # 源和目标选择
        source_target_layout = QHBoxLayout()
        
        # 源
        source_group = QGroupBox("源")
        source_layout = QVBoxLayout(source_group)
        
        # 源连接选择
        source_conn_layout = QHBoxLayout()
        source_conn_layout.addWidget(QLabel("连接:"))
        self.source_conn_combo = QComboBox()
        self.load_connections(self.source_conn_combo)
        source_conn_layout.addWidget(self.source_conn_combo)
        source_layout.addLayout(source_conn_layout)
        
        # 源数据库选择
        source_db_layout = QHBoxLayout()
        source_db_layout.addWidget(QLabel("数据库:"))
        self.source_db_combo = QComboBox()
        source_db_layout.addWidget(self.source_db_combo)
        source_layout.addLayout(source_db_layout)
        
        source_target_layout.addWidget(source_group)
        
        # 目标
        target_group = QGroupBox("目标")
        target_layout = QVBoxLayout(target_group)
        
        # 目标连接选择
        target_conn_layout = QHBoxLayout()
        target_conn_layout.addWidget(QLabel("连接:"))
        self.target_conn_combo = QComboBox()
        self.load_connections(self.target_conn_combo)
        target_conn_layout.addWidget(self.target_conn_combo)
        target_layout.addLayout(target_conn_layout)
        
        # 目标数据库选择
        target_db_layout = QHBoxLayout()
        target_db_layout.addWidget(QLabel("数据库:"))
        self.target_db_combo = QComboBox()
        target_db_layout.addWidget(self.target_db_combo)
        target_layout.addLayout(target_db_layout)
        
        source_target_layout.addWidget(target_group)
        
        general_layout.addLayout(source_target_layout)
        
        # 下一步按钮
        next_btn = QPushButton("下一步")
        general_layout.addWidget(next_btn)
        
        self.tab_widget.addTab(general_tab, "常规")
        
        # 选项标签页
        options_tab = QWidget()
        options_layout = QVBoxLayout(options_tab)
        
        # 选项设置
        options_group = QGroupBox("选项")
        options_group_layout = QVBoxLayout(options_group)
        
        # 表选项
        table_options_group = QGroupBox("表选项")
        table_options_layout = QVBoxLayout(table_options_group)
        
        self.include_indexes_check = QRadioButton("包含索引")
        self.include_foreign_keys_check = QRadioButton("包含外键")
        self.include_triggers_check = QRadioButton("包含触发器")
        self.include_partitions_check = QRadioButton("包含分区")
        
        table_options_layout.addWidget(self.include_indexes_check)
        table_options_layout.addWidget(self.include_foreign_keys_check)
        table_options_layout.addWidget(self.include_triggers_check)
        table_options_layout.addWidget(self.include_partitions_check)
        
        options_group_layout.addWidget(table_options_group)
        
        # 记录选项
        record_options_group = QGroupBox("记录选项")
        record_options_layout = QVBoxLayout(record_options_group)
        
        self.include_records_check = QRadioButton("包含记录")
        self.include_delete_target_check = QRadioButton("删除目标记录")
        self.include_truncate_table_check = QRadioButton("使用TRUNCATE语句")
        
        record_options_layout.addWidget(self.include_records_check)
        record_options_layout.addWidget(self.include_delete_target_check)
        record_options_layout.addWidget(self.include_truncate_table_check)
        
        options_group_layout.addWidget(record_options_group)
        
        # 其他选项
        other_options_group = QGroupBox("其他选项")
        other_options_layout = QVBoxLayout(other_options_group)
        
        self.ignore_errors_check = QRadioButton("忽略错误")
        self.create_target_table_check = QRadioButton("创建目标表结构（如果不存在）")
        
        other_options_layout.addWidget(self.ignore_errors_check)
        other_options_layout.addWidget(self.create_target_table_check)
        
        options_group_layout.addWidget(other_options_group)
        
        options_layout.addWidget(options_group)
        
        # 下一步按钮
        next_btn2 = QPushButton("下一步")
        options_layout.addWidget(next_btn2)
        
        self.tab_widget.addTab(options_tab, "选项")
        
        main_layout.addWidget(self.tab_widget)
        
        # 连接信号
        self.source_conn_combo.currentTextChanged.connect(self.update_source_databases)
        self.target_conn_combo.currentTextChanged.connect(self.update_target_databases)
    
    def load_connections(self, combo):
        """
        加载连接列表
        """
        try:
            for conn_name in self.main_window.saved_connections:
                combo.addItem(conn_name)
        except Exception as e:
            self.logger.log('ERROR', f"加载连接列表失败: {str(e)}")
    
    def update_source_databases(self):
        """
        更新源数据库列表
        """
        conn_name = self.source_conn_combo.currentText()
        if conn_name:
            self.source_db_combo.clear()
            self.load_databases(self.source_db_combo, conn_name)
    
    def update_target_databases(self):
        """
        更新目标数据库列表
        """
        conn_name = self.target_conn_combo.currentText()
        if conn_name:
            self.target_db_combo.clear()
            self.load_databases(self.target_db_combo, conn_name)
    
    def load_databases(self, combo, conn_name):
        """
        加载数据库列表
        """
        try:
            # 获取连接信息
            conn_data = self.main_window.saved_connections.get(conn_name)
            if conn_data:
                # 临时创建一个不指定数据库的连接数据
                temp_conn_data = conn_data.copy()
                if temp_conn_data['type'] == 'MySQL' or temp_conn_data['type'] == 'MariaDB':
                    # 对于MySQL/MariaDB，不指定数据库
                    temp_conn_data['database'] = ''
                elif temp_conn_data['type'] == 'PostgreSQL':
                    # 对于PostgreSQL，使用默认数据库
                    temp_conn_data['database'] = 'postgres'
                elif temp_conn_data['type'] == 'SQL Server':
                    # 对于SQL Server，使用master数据库
                    temp_conn_data['database'] = 'master'
                
                # 从连接池获取连接
                conn = self.main_window.connection_pool.get_connection(conn_name, temp_conn_data)
                if conn:
                    with conn.cursor() as cursor:
                        if conn_data['type'] == 'MySQL' or conn_data['type'] == 'MariaDB':
                            cursor.execute("SHOW DATABASES")
                            databases = cursor.fetchall()
                            for db in databases:
                                db_name = db['Database'] if isinstance(db, dict) else db[0]
                                combo.addItem(db_name)
                        elif conn_data['type'] == 'PostgreSQL':
                            cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
                            databases = cursor.fetchall()
                            for db in databases:
                                db_name = db[0]
                                combo.addItem(db_name)
                        elif conn_data['type'] == 'SQL Server':
                            cursor.execute("SELECT name FROM sys.databases WHERE database_id > 4")
                            databases = cursor.fetchall()
                            for db in databases:
                                db_name = db[0]
                                combo.addItem(db_name)
        except Exception as e:
            self.logger.log('ERROR', f"加载数据库列表失败: {str(e)}")
            print(f"加载数据库列表失败: {str(e)}")
