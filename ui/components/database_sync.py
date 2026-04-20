#!/usr/bin/env python3
"""
数据库结构同步与数据同步模块
"""

from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QTabWidget, QWidget, 
                            QLabel, QComboBox, QTextEdit, QTableWidget, QTableWidgetItem, 
                            QSplitter, QGroupBox, QMessageBox, QProgressBar)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont

class DatabaseSync(QDialog):
    """
    数据库同步类
    """
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        
        self.setWindowTitle("数据库同步")
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
        
        # 结构同步标签页
        structure_tab = QWidget()
        structure_layout = QVBoxLayout(structure_tab)
        
        # 源数据库和目标数据库选择
        db_selection_layout = QHBoxLayout()
        
        # 源数据库
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
        
        db_selection_layout.addWidget(source_group)
        
        # 目标数据库
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
        
        db_selection_layout.addWidget(target_group)
        
        structure_layout.addLayout(db_selection_layout)
        
        # 比较按钮
        compare_btn = QPushButton("比较结构")
        structure_layout.addWidget(compare_btn)
        
        # 比较结果
        compare_result_layout = QHBoxLayout()
        
        # 源表和目标表列表
        self.source_tables_table = QTableWidget()
        self.source_tables_table.setColumnCount(2)
        self.source_tables_table.setHorizontalHeaderLabels(["表名", "状态"])
        
        self.target_tables_table = QTableWidget()
        self.target_tables_table.setColumnCount(2)
        self.target_tables_table.setHorizontalHeaderLabels(["表名", "状态"])
        
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.addWidget(self.source_tables_table)
        splitter.addWidget(self.target_tables_table)
        splitter.setSizes([500, 500])
        
        compare_result_layout.addWidget(splitter)
        structure_layout.addLayout(compare_result_layout)
        
        # SQL预览
        sql_preview_group = QGroupBox("同步SQL预览")
        sql_preview_layout = QVBoxLayout(sql_preview_group)
        self.sql_preview = QTextEdit()
        self.sql_preview.setReadOnly(True)
        self.sql_preview.setFont(QFont("Consolas", 10))
        sql_preview_layout.addWidget(self.sql_preview)
        structure_layout.addWidget(sql_preview_group)
        
        # 执行按钮
        execute_layout = QHBoxLayout()
        execute_btn = QPushButton("执行同步")
        cancel_btn = QPushButton("取消")
        execute_layout.addWidget(execute_btn)
        execute_layout.addWidget(cancel_btn)
        structure_layout.addLayout(execute_layout)
        
        self.tab_widget.addTab(structure_tab, "结构同步")
        
        # 数据同步标签页
        data_tab = QWidget()
        data_layout = QVBoxLayout(data_tab)
        
        # 源表和目标表选择
        table_selection_layout = QHBoxLayout()
        
        # 源表
        source_table_group = QGroupBox("源表")
        source_table_layout = QVBoxLayout(source_table_group)
        self.source_table_combo = QComboBox()
        source_table_layout.addWidget(self.source_table_combo)
        table_selection_layout.addWidget(source_table_group)
        
        # 目标表
        target_table_group = QGroupBox("目标表")
        target_table_layout = QVBoxLayout(target_table_group)
        self.target_table_combo = QComboBox()
        target_table_layout.addWidget(self.target_table_combo)
        table_selection_layout.addWidget(target_table_group)
        
        data_layout.addLayout(table_selection_layout)
        
        # 同步选项
        options_group = QGroupBox("同步选项")
        options_layout = QVBoxLayout(options_group)
        
        # 同步方式
        sync_method_group = QGroupBox("同步方式")
        sync_method_layout = QHBoxLayout(sync_method_group)
        
        self.insert_only_radio = QPushButton("仅插入")
        self.update_only_radio = QPushButton("仅更新")
        self.insert_update_radio = QPushButton("插入和更新")
        self.delete_radio = QPushButton("删除")
        
        sync_method_layout.addWidget(self.insert_only_radio)
        sync_method_layout.addWidget(self.update_only_radio)
        sync_method_layout.addWidget(self.insert_update_radio)
        sync_method_layout.addWidget(self.delete_radio)
        
        options_layout.addWidget(sync_method_group)
        
        # 条件选项
        condition_group = QGroupBox("条件选项")
        condition_layout = QVBoxLayout(condition_group)
        condition_layout.addWidget(QLabel("WHERE条件:"))
        self.condition_edit = QTextEdit()
        self.condition_edit.setPlaceholderText("输入WHERE条件，例如：id > 100")
        condition_layout.addWidget(self.condition_edit)
        options_layout.addWidget(condition_group)
        
        data_layout.addWidget(options_group)
        
        # 比较数据按钮
        compare_data_btn = QPushButton("比较数据")
        data_layout.addWidget(compare_data_btn)
        
        # 数据差异
        data_diff_group = QGroupBox("数据差异")
        data_diff_layout = QVBoxLayout(data_diff_group)
        
        self.data_diff_table = QTableWidget()
        self.data_diff_table.setColumnCount(3)
        self.data_diff_table.setHorizontalHeaderLabels(["操作", "源数据", "目标数据"])
        data_diff_layout.addWidget(self.data_diff_table)
        
        data_layout.addWidget(data_diff_group)
        
        # 数据同步SQL预览
        data_sql_preview_group = QGroupBox("同步SQL预览")
        data_sql_preview_layout = QVBoxLayout(data_sql_preview_group)
        self.data_sql_preview = QTextEdit()
        self.data_sql_preview.setReadOnly(True)
        self.data_sql_preview.setFont(QFont("Consolas", 10))
        data_sql_preview_layout.addWidget(self.data_sql_preview)
        data_layout.addWidget(data_sql_preview_group)
        
        # 执行数据同步按钮
        data_execute_layout = QHBoxLayout()
        data_execute_btn = QPushButton("执行数据同步")
        data_cancel_btn = QPushButton("取消")
        data_execute_layout.addWidget(data_execute_btn)
        data_execute_layout.addWidget(data_cancel_btn)
        data_layout.addLayout(data_execute_layout)
        
        self.tab_widget.addTab(data_tab, "数据同步")
        
        main_layout.addWidget(self.tab_widget)
        
        # 连接信号
        compare_btn.clicked.connect(self.compare_structure)
        execute_btn.clicked.connect(self.execute_structure_sync)
        cancel_btn.clicked.connect(self.reject)
        compare_data_btn.clicked.connect(self.compare_data)
        data_execute_btn.clicked.connect(self.execute_data_sync)
        data_cancel_btn.clicked.connect(self.reject)
        
        # 连接选择变化时更新数据库列表
        self.source_conn_combo.currentTextChanged.connect(self.update_source_databases)
        self.target_conn_combo.currentTextChanged.connect(self.update_target_databases)
        
        # 数据库选择变化时更新表列表
        self.source_db_combo.currentTextChanged.connect(self.update_source_tables)
        self.target_db_combo.currentTextChanged.connect(self.update_target_tables)
    
    def load_connections(self, combo):
        """
        加载连接列表
        """
        try:
            for conn_name in self.main_window.saved_connections:
                combo.addItem(conn_name)
        except Exception as e:
            self.logger.log('ERROR', f"加载连接列表失败: {str(e)}")
    
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
    
    def update_source_tables(self):
        """
        更新源表列表
        """
        db_name = self.source_db_combo.currentText()
        if db_name:
            self._update_table_combo(self.source_table_combo, db_name)
    
    def update_target_tables(self):
        """
        更新目标表列表
        """
        db_name = self.target_db_combo.currentText()
        if db_name:
            self._update_table_combo(self.target_table_combo, db_name)
    
    def _update_table_combo(self, combo, db_name):
        """
        更新表下拉框
        """
        try:
            combo.clear()
            # 获取当前连接名称
            conn_name = self.source_conn_combo.currentText() if combo == self.source_table_combo else self.target_conn_combo.currentText()
            
            # 获取连接信息
            conn_data = self.main_window.saved_connections.get(conn_name)
            if conn_data:
                # 从连接池获取连接
                conn = self.main_window.connection_pool.get_connection(conn_name, conn_data)
                if conn:
                    with conn.cursor() as cursor:
                        if conn_data['type'] == 'MySQL' or conn_data['type'] == 'MariaDB':
                            cursor.execute(f"USE {db_name}")
                            cursor.execute("SHOW TABLES")
                            tables = cursor.fetchall()
                            for table in tables:
                                table_name = table['Tables_in_' + db_name] if isinstance(table, dict) else table[0]
                                combo.addItem(table_name)
                        elif conn_data['type'] == 'PostgreSQL':
                            cursor.execute(f"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_catalog = '{db_name}'")
                            tables = cursor.fetchall()
                            for table in tables:
                                table_name = table[0]
                                combo.addItem(table_name)
                        elif conn_data['type'] == 'SQL Server':
                            cursor.execute(f"USE {db_name}")
                            cursor.execute("SELECT name FROM sys.tables")
                            tables = cursor.fetchall()
                            for table in tables:
                                table_name = table[0]
                                combo.addItem(table_name)
        except Exception as e:
            self.logger.log('ERROR', f"更新表列表失败: {str(e)}")
    
    def compare_structure(self):
        """
        比较数据库结构
        """
        source_conn = self.source_conn_combo.currentText()
        source_db = self.source_db_combo.currentText()
        target_conn = self.target_conn_combo.currentText()
        target_db = self.target_db_combo.currentText()
        
        if not source_conn or not source_db or not target_conn or not target_db:
            QMessageBox.warning(self, "比较结构", "请选择源连接、源数据库、目标连接和目标数据库")
            return
        
        try:
            # 加载源数据库表结构
            source_tables = self._get_tables_structure(source_conn, source_db)
            target_tables = self._get_tables_structure(target_conn, target_db)
            
            # 比较表结构
            differences = self._compare_table_structures(source_tables, target_tables)
            
            # 显示比较结果
            self._display_structure_differences(source_tables, target_tables, differences)
            
            # 生成同步SQL
            sync_sql = self._generate_structure_sync_sql(differences, target_db)
            self.sql_preview.setPlainText(sync_sql)
            
            QMessageBox.information(self, "比较结构", "结构比较完成")
        except Exception as e:
            QMessageBox.critical(self, "比较结构失败", f"比较结构时出错: {str(e)}")
            self.logger.log('ERROR', f"比较结构失败: {str(e)}")
    
    def _get_tables_structure(self, db_name):
        """
        获取数据库表结构
        """
        tables = {}
        with self.main_window.db_connection.cursor() as cursor:
            if self.main_window.current_db_type == 'MySQL':
                cursor.execute(f"USE {db_name}")
                cursor.execute("SHOW TABLES")
                table_results = cursor.fetchall()
                
                for table_result in table_results:
                    table_name = table_result['Tables_in_' + db_name] if isinstance(table_result, dict) else table_result[0]
                    cursor.execute(f"SHOW CREATE TABLE {table_name}")
                    create_table = cursor.fetchone()
                    create_table_sql = create_table['Create Table'] if isinstance(create_table, dict) else create_table[1]
                    tables[table_name] = create_table_sql
            elif self.main_window.current_db_type == 'PostgreSQL':
                cursor.execute(f"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_catalog = '{db_name}'")
                table_results = cursor.fetchall()
                
                for table_result in table_results:
                    table_name = table_result[0]
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
                    tables[table_name] = create_table_sql
            elif self.main_window.current_db_type == 'SQL Server':
                cursor.execute(f"USE {db_name}")
                cursor.execute("SELECT name FROM sys.tables")
                table_results = cursor.fetchall()
                
                for table_result in table_results:
                    table_name = table_result[0]
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
                    tables[table_name] = create_table_sql
        return tables
    
    def _compare_table_structures(self, source_tables, target_tables):
        """
        比较表结构
        """
        differences = {
            'missing_tables': [],  # 目标数据库缺少的表
            'extra_tables': [],    # 目标数据库多余的表
            'different_tables': []  # 结构不同的表
        }
        
        # 检查缺少的表
        for table_name in source_tables:
            if table_name not in target_tables:
                differences['missing_tables'].append(table_name)
        
        # 检查多余的表
        for table_name in target_tables:
            if table_name not in source_tables:
                differences['extra_tables'].append(table_name)
        
        # 检查结构不同的表
        for table_name in source_tables:
            if table_name in target_tables:
                if source_tables[table_name] != target_tables[table_name]:
                    differences['different_tables'].append(table_name)
        
        return differences
    
    def _display_structure_differences(self, source_tables, target_tables, differences):
        """
        显示结构差异
        """
        # 显示源表
        self.source_tables_table.setRowCount(len(source_tables))
        row = 0
        for table_name in source_tables:
            self.source_tables_table.setItem(row, 0, QTableWidgetItem(table_name))
            if table_name in differences['missing_tables']:
                self.source_tables_table.setItem(row, 1, QTableWidgetItem("在目标库中缺失"))
            elif table_name in differences['different_tables']:
                self.source_tables_table.setItem(row, 1, QTableWidgetItem("结构不同"))
            else:
                self.source_tables_table.setItem(row, 1, QTableWidgetItem("结构相同"))
            row += 1
        
        # 显示目标表
        self.target_tables_table.setRowCount(len(target_tables))
        row = 0
        for table_name in target_tables:
            self.target_tables_table.setItem(row, 0, QTableWidgetItem(table_name))
            if table_name in differences['extra_tables']:
                self.target_tables_table.setItem(row, 1, QTableWidgetItem("在源库中不存在"))
            elif table_name in differences['different_tables']:
                self.target_tables_table.setItem(row, 1, QTableWidgetItem("结构不同"))
            else:
                self.target_tables_table.setItem(row, 1, QTableWidgetItem("结构相同"))
            row += 1
    
    def _generate_structure_sync_sql(self, differences, target_db):
        """
        生成结构同步SQL
        """
        sql = f"-- 数据库结构同步脚本\n-- 目标数据库: {target_db}\n\n"
        
        # 添加缺失的表
        for table_name in differences['missing_tables']:
            sql += f"-- 创建表: {table_name}\n"
            sql += f"{self.source_tables[table_name]}\n\n"
        
        # 修改结构不同的表
        for table_name in differences['different_tables']:
            sql += f"-- 修改表: {table_name}\n"
            sql += f"DROP TABLE IF EXISTS {table_name};\n"
            sql += f"{self.source_tables[table_name]}\n\n"
        
        return sql
    
    def execute_structure_sync(self):
        """
        执行结构同步
        """
        sync_sql = self.sql_preview.toPlainText()
        if not sync_sql:
            QMessageBox.warning(self, "执行同步", "没有生成同步SQL")
            return
        
        if QMessageBox.question(self, "执行同步", "确定要执行结构同步吗？这可能会影响目标数据库的现有数据。", 
                               QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes:
            try:
                target_db = self.target_db_combo.currentText()
                with self.main_window.db_connection.cursor() as cursor:
                    if self.main_window.current_db_type == 'MySQL':
                        cursor.execute(f"USE {target_db}")
                    elif self.main_window.current_db_type == 'SQL Server':
                        cursor.execute(f"USE {target_db}")
                    
                    # 执行同步SQL
                    sql_statements = sync_sql.split(';')
                    for statement in sql_statements:
                        statement = statement.strip()
                        if statement:
                            cursor.execute(statement)
                
                self.main_window.db_connection.commit()
                QMessageBox.information(self, "执行同步", "结构同步成功")
            except Exception as e:
                QMessageBox.critical(self, "执行同步失败", f"执行同步时出错: {str(e)}")
                self.logger.log('ERROR', f"执行结构同步失败: {str(e)}")
    
    def compare_data(self):
        """
        比较数据
        """
        source_table = self.source_table_combo.currentText()
        target_table = self.target_table_combo.currentText()
        
        if not source_table or not target_table:
            QMessageBox.warning(self, "比较数据", "请选择源表和目标表")
            return
        
        try:
            # 加载源表数据
            source_data = self._get_table_data(self.source_db_combo.currentText(), source_table)
            target_data = self._get_table_data(self.target_db_combo.currentText(), target_table)
            
            # 比较数据
            differences = self._compare_data(source_data, target_data)
            
            # 显示数据差异
            self._display_data_differences(differences)
            
            # 生成同步SQL
            sync_sql = self._generate_data_sync_sql(differences, target_table)
            self.data_sql_preview.setPlainText(sync_sql)
            
            QMessageBox.information(self, "比较数据", "数据比较完成")
        except Exception as e:
            QMessageBox.critical(self, "比较数据失败", f"比较数据时出错: {str(e)}")
            self.logger.log('ERROR', f"比较数据失败: {str(e)}")
    
    def _get_table_data(self, db_name, table_name):
        """
        获取表数据
        """
        data = []
        with self.main_window.db_connection.cursor() as cursor:
            if self.main_window.current_db_type == 'MySQL':
                cursor.execute(f"USE {db_name}")
            elif self.main_window.current_db_type == 'SQL Server':
                cursor.execute(f"USE {db_name}")
            
            cursor.execute(f"SELECT * FROM {table_name}")
            results = cursor.fetchall()
            
            for row in results:
                if isinstance(row, dict):
                    data.append(row)
                else:
                    # 转换为字典
                    row_dict = {}
                    for i, desc in enumerate(cursor.description):
                        row_dict[desc[0]] = row[i]
                    data.append(row_dict)
        return data
    
    def _compare_data(self, source_data, target_data):
        """
        比较数据
        """
        differences = {
            'insert': [],  # 需要插入的数据
            'update': [],  # 需要更新的数据
            'delete': []   # 需要删除的数据
        }
        
        # 假设第一列是主键
        if source_data and target_data:
            primary_key = list(source_data[0].keys())[0]
            
            # 构建目标数据的主键映射
            target_data_map = {row[primary_key]: row for row in target_data}
            
            # 检查需要插入和更新的数据
            for source_row in source_data:
                source_pk = source_row[primary_key]
                if source_pk not in target_data_map:
                    differences['insert'].append(source_row)
                elif source_row != target_data_map[source_pk]:
                    differences['update'].append((source_row, target_data_map[source_pk]))
            
            # 检查需要删除的数据
            source_data_map = {row[primary_key]: row for row in source_data}
            for target_row in target_data:
                target_pk = target_row[primary_key]
                if target_pk not in source_data_map:
                    differences['delete'].append(target_row)
        
        return differences
    
    def _display_data_differences(self, differences):
        """
        显示数据差异
        """
        total_rows = len(differences['insert']) + len(differences['update']) + len(differences['delete'])
        self.data_diff_table.setRowCount(total_rows)
        
        row = 0
        # 显示需要插入的数据
        for insert_row in differences['insert']:
            self.data_diff_table.setItem(row, 0, QTableWidgetItem("插入"))
            self.data_diff_table.setItem(row, 1, QTableWidgetItem(str(insert_row)))
            self.data_diff_table.setItem(row, 2, QTableWidgetItem(""))
            row += 1
        
        # 显示需要更新的数据
        for update_row, old_row in differences['update']:
            self.data_diff_table.setItem(row, 0, QTableWidgetItem("更新"))
            self.data_diff_table.setItem(row, 1, QTableWidgetItem(str(update_row)))
            self.data_diff_table.setItem(row, 2, QTableWidgetItem(str(old_row)))
            row += 1
        
        # 显示需要删除的数据
        for delete_row in differences['delete']:
            self.data_diff_table.setItem(row, 0, QTableWidgetItem("删除"))
            self.data_diff_table.setItem(row, 1, QTableWidgetItem(""))
            self.data_diff_table.setItem(row, 2, QTableWidgetItem(str(delete_row)))
            row += 1
    
    def _generate_data_sync_sql(self, differences, target_table):
        """
        生成数据同步SQL
        """
        sql = f"-- 数据同步脚本\n-- 目标表: {target_table}\n\n"
        
        # 生成插入语句
        for insert_row in differences['insert']:
            columns = ', '.join(insert_row.keys())
            values = ', '.join([f"'{v}'" if isinstance(v, str) else str(v) for v in insert_row.values()])
            sql += f"INSERT INTO {target_table} ({columns}) VALUES ({values});\n"
        
        # 生成更新语句
        for update_row, old_row in differences['update']:
            primary_key = list(update_row.keys())[0]
            set_clause = ', '.join([f"{k} = '{v}'" if isinstance(v, str) else f"{k} = {v}" for k, v in update_row.items() if k != primary_key])
            sql += f"UPDATE {target_table} SET {set_clause} WHERE {primary_key} = {update_row[primary_key]};\n"
        
        # 生成删除语句
        for delete_row in differences['delete']:
            primary_key = list(delete_row.keys())[0]
            sql += f"DELETE FROM {target_table} WHERE {primary_key} = {delete_row[primary_key]};\n"
        
        return sql
    
    def execute_data_sync(self):
        """
        执行数据同步
        """
        sync_sql = self.data_sql_preview.toPlainText()
        if not sync_sql:
            QMessageBox.warning(self, "执行数据同步", "没有生成同步SQL")
            return
        
        if QMessageBox.question(self, "执行数据同步", "确定要执行数据同步吗？这可能会影响目标表的现有数据。", 
                               QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes:
            try:
                target_db = self.target_db_combo.currentText()
                with self.main_window.db_connection.cursor() as cursor:
                    if self.main_window.current_db_type == 'MySQL':
                        cursor.execute(f"USE {target_db}")
                    elif self.main_window.current_db_type == 'SQL Server':
                        cursor.execute(f"USE {target_db}")
                    
                    # 执行同步SQL
                    sql_statements = sync_sql.split(';')
                    for statement in sql_statements:
                        statement = statement.strip()
                        if statement:
                            cursor.execute(statement)
                
                self.main_window.db_connection.commit()
                QMessageBox.information(self, "执行数据同步", "数据同步成功")
            except Exception as e:
                QMessageBox.critical(self, "执行数据同步失败", f"执行数据同步时出错: {str(e)}")
                self.logger.log('ERROR', f"执行数据同步失败: {str(e)}")