#!/usr/bin/env python3
"""
表操作相关组件
"""

from PyQt6.QtWidgets import QMessageBox, QInputDialog, QDialog, QVBoxLayout, QTableWidget, QTableWidgetItem, QPushButton, QHBoxLayout, QToolBar, QSplitter, QWidget, QLabel, QComboBox, QLineEdit, QCheckBox
from PyQt6.QtGui import QAction
from PyQt6.QtCore import Qt

class TableOperations:
    """表操作类"""
    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
    
    def open_table(self, table_name):
        """打开表"""
        try:
            # 创建新的查询标签页
            self.main_window.add_new_query_tab()
            
            # 获取当前标签页的SQL编辑器
            current_tab = self.main_window.right_panel.tabs.currentWidget()
            if current_tab:
                for widget in current_tab.findChildren(QWidget):
                    from .sql_editor import SQLTextEdit
                    if isinstance(widget, SQLTextEdit):
                        # 生成查询表数据的SQL语句
                        sql = f"SELECT * FROM {table_name} LIMIT 1000;"
                        widget.setPlainText(sql)
                        # 执行SQL
                        self.main_window.sql_operations.execute_sql()
                        break
            
            self.logger.log('INFO', f"打开表: {table_name}")
        except Exception as e:
            QMessageBox.critical(self.main_window, "打开表失败", f"打开表 {table_name} 时出错: {str(e)}")
            self.logger.log('ERROR', f"打开表失败: {str(e)}")
    
    def design_table(self, table_name):
        """设计表"""
        try:
            # 使用表设计器
            from .table_designer import TableDesigner
            designer = TableDesigner(self.main_window, table_name)
            designer.exec()
            
            self.logger.log('INFO', f"设计表: {table_name}")
        except Exception as e:
            QMessageBox.critical(self.main_window, "设计表失败", f"设计表 {table_name} 时出错: {str(e)}")
            self.logger.log('ERROR', f"设计表失败: {str(e)}")
    
    def new_table(self):
        """新建表"""
        try:
            # 获取表名
            table_name, ok = QInputDialog.getText(self.main_window, "新建表", "请输入表名:")
            if not ok or not table_name:
                return
            
            # 创建表结构对话框
            dialog = QDialog(self.main_window)
            dialog.setWindowTitle(f"新建表: {table_name}")
            dialog.setGeometry(300, 200, 800, 400)
            
            layout = QVBoxLayout(dialog)
            
            # 创建工具栏
            toolbar = QToolBar()
            add_col_action = QAction("添加列", dialog)
            del_col_action = QAction("删除列", dialog)
            toolbar.addAction(add_col_action)
            toolbar.addAction(del_col_action)
            layout.addWidget(toolbar)
            
            # 创建表结构表格
            table = QTableWidget()
            table.setColumnCount(6)
            table.setHorizontalHeaderLabels(["字段名", "数据类型", "长度", "是否为空", "默认值", "主键"])
            
            # 添加默认列
            table.setRowCount(1)
            table.setItem(0, 0, QTableWidgetItem("id"))
            table.setItem(0, 1, QTableWidgetItem("INT"))
            table.setItem(0, 2, QTableWidgetItem("11"))
            table.setItem(0, 3, QTableWidgetItem("NO"))
            table.setItem(0, 4, QTableWidgetItem("AUTO_INCREMENT"))
            table.setItem(0, 5, QTableWidgetItem("PRI"))
            
            table.resizeColumnsToContents()
            layout.addWidget(table)
            
            # 按钮
            button_layout = QHBoxLayout()
            create_btn = QPushButton("创建")
            cancel_btn = QPushButton("取消")
            
            button_layout.addWidget(create_btn)
            button_layout.addWidget(cancel_btn)
            layout.addLayout(button_layout)
            
            # 连接信号
            def add_column():
                row_count = table.rowCount()
                table.setRowCount(row_count + 1)
            
            def delete_column():
                selected_rows = table.selectionModel().selectedRows()
                if selected_rows:
                    row = selected_rows[0].row()
                    table.removeRow(row)
            
            def create_table():
                try:
                    # 生成创建表的SQL语句
                    sql = f"CREATE TABLE {table_name} ("
                    columns = []
                    
                    for i in range(table.rowCount()):
                        col_name = table.item(i, 0).text() if table.item(i, 0) else ""
                        col_type = table.item(i, 1).text() if table.item(i, 1) else ""
                        col_length = table.item(i, 2).text() if table.item(i, 2) else ""
                        col_null = table.item(i, 3).text() if table.item(i, 3) else ""
                        col_default = table.item(i, 4).text() if table.item(i, 4) else ""
                        col_key = table.item(i, 5).text() if table.item(i, 5) else ""
                        
                        if col_name and col_type:
                            column_def = f"{col_name} {col_type}"
                            if col_length:
                                column_def += f"({col_length})"
                            if col_null == "NO":
                                column_def += " NOT NULL"
                            if col_default:
                                column_def += f" DEFAULT {col_default}"
                            if col_key == "PRI":
                                column_def += " PRIMARY KEY"
                            if "AUTO_INCREMENT" in col_default:
                                column_def += " AUTO_INCREMENT"
                            columns.append(column_def)
                    
                    if columns:
                        sql += ", ".join(columns)
                        sql += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
                        
                        # 执行SQL
                        with self.main_window.db_connection.cursor() as cursor:
                            cursor.execute(sql)
                            self.main_window.db_connection.commit()
                        
                        QMessageBox.information(self.main_window, "新建表成功", f"表 {table_name} 创建成功")
                        self.logger.log('INFO', f"新建表: {table_name}")
                        # 刷新对象树
                        self.main_window.load_database_objects()
                        dialog.accept()
                except Exception as e:
                    QMessageBox.critical(self.main_window, "新建表失败", f"创建表 {table_name} 时出错: {str(e)}")
                    self.logger.log('ERROR', f"新建表失败: {str(e)}")
            
            add_col_action.triggered.connect(add_column)
            del_col_action.triggered.connect(delete_column)
            create_btn.clicked.connect(create_table)
            cancel_btn.clicked.connect(dialog.reject)
            
            dialog.exec()
        except Exception as e:
            QMessageBox.critical(self.main_window, "新建表失败", f"新建表时出错: {str(e)}")
            self.logger.log('ERROR', f"新建表失败: {str(e)}")
    
    def delete_table(self, table_name):
        """删除表"""
        try:
            # 确认删除
            if QMessageBox.question(self.main_window, "删除表", f"确定要删除表 {table_name} 吗？此操作不可恢复！", 
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes:
                # 执行删除表的SQL语句
                with self.main_window.db_connection.cursor() as cursor:
                    cursor.execute(f"DROP TABLE {table_name}")
                    self.main_window.db_connection.commit()
                
                QMessageBox.information(self.main_window, "删除表成功", f"表 {table_name} 删除成功")
                self.logger.log('INFO', f"删除表: {table_name}")
                # 刷新对象树
                self.main_window.load_database_objects()
        except Exception as e:
            QMessageBox.critical(self.main_window, "删除表失败", f"删除表 {table_name} 时出错: {str(e)}")
            self.logger.log('ERROR', f"删除表失败: {str(e)}")
    
    def truncate_table(self, table_name, is_truncate):
        """清空表或截断表"""
        try:
            # 确认操作
            action = "截断" if is_truncate else "清空"
            if QMessageBox.question(self.main_window, f"{action}表", f"确定要{action}表 {table_name} 吗？此操作不可恢复！", 
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes:
                # 执行SQL语句
                with self.main_window.db_connection.cursor() as cursor:
                    if is_truncate:
                        cursor.execute(f"TRUNCATE TABLE {table_name}")
                    else:
                        cursor.execute(f"DELETE FROM {table_name}")
                    self.main_window.db_connection.commit()
                
                QMessageBox.information(self.main_window, f"{action}表成功", f"表 {table_name} {action}成功")
                self.logger.log('INFO', f"{action}表: {table_name}")
        except Exception as e:
            QMessageBox.critical(self.main_window, f"{action}表失败", f"{action}表 {table_name} 时出错: {str(e)}")
            self.logger.log('ERROR', f"{action}表失败: {str(e)}")
    
    def copy_table(self, table_name, copy_structure, copy_data):
        """复制表"""
        try:
            # 获取新表名
            new_table_name, ok = QInputDialog.getText(self.main_window, "复制表", f"请输入新表名 (原表: {table_name}):")
            if not ok or not new_table_name:
                return
            
            # 生成复制表的SQL语句
            if copy_structure and copy_data:
                sql = f"CREATE TABLE {new_table_name} SELECT * FROM {table_name}"
            elif copy_structure:
                sql = f"CREATE TABLE {new_table_name} LIKE {table_name}"
            else:
                # 先创建表结构
                with self.main_window.db_connection.cursor() as cursor:
                    cursor.execute(f"CREATE TABLE {new_table_name} LIKE {table_name}")
                    # 再复制数据
                    cursor.execute(f"INSERT INTO {new_table_name} SELECT * FROM {table_name}")
                    self.main_window.db_connection.commit()
                QMessageBox.information(self.main_window, "复制表成功", f"表 {table_name} 复制成功为 {new_table_name}")
                self.logger.log('INFO', f"复制表: {table_name} -> {new_table_name}")
                # 刷新对象树
                self.main_window.load_database_objects()
                return
            
            # 执行SQL
            with self.main_window.db_connection.cursor() as cursor:
                cursor.execute(sql)
                self.main_window.db_connection.commit()
            
            QMessageBox.information(self.main_window, "复制表成功", f"表 {table_name} 复制成功为 {new_table_name}")
            self.logger.log('INFO', f"复制表: {table_name} -> {new_table_name}")
            # 刷新对象树
            self.main_window.load_database_objects()
        except Exception as e:
            QMessageBox.critical(self.main_window, "复制表失败", f"复制表 {table_name} 时出错: {str(e)}")
            self.logger.log('ERROR', f"复制表失败: {str(e)}")
    
    def dump_sql(self, table_name, dump_structure, dump_data):
        """转储SQL文件"""
        try:
            # 打开文件保存对话框
            from PyQt6.QtWidgets import QFileDialog
            file_path, _ = QFileDialog.getSaveFileName(
                self.main_window, "保存SQL文件", f"{table_name}.sql", "SQL文件 (*.sql);;所有文件 (*.*)")
            
            if not file_path:
                return
            
            # 生成SQL内容
            sql_content = f"-- 转储表 {table_name} 的SQL\n\n"
            
            if dump_structure:
                # 获取表结构
                with self.main_window.db_connection.cursor() as cursor:
                    cursor.execute(f"SHOW CREATE TABLE {table_name}")
                    result = cursor.fetchone()
                    if result:
                        create_table_sql = result['Create Table'] if isinstance(result, dict) else result[1]
                        sql_content += f"{create_table_sql};\n\n"
            
            if dump_data:
                # 获取表数据
                with self.main_window.db_connection.cursor() as cursor:
                    cursor.execute(f"SELECT * FROM {table_name}")
                    results = cursor.fetchall()
                    
                    if results:
                        # 获取列名
                        columns = list(results[0].keys()) if isinstance(results[0], dict) else [f'col{i+1}' for i in range(len(results[0]))]
                        columns_str = ', '.join(columns)
                        
                        # 生成插入语句
                        sql_content += f"-- 插入表 {table_name} 的数据\n"
                        for row in results:
                            values = []
                            for col in columns:
                                value = row[col] if isinstance(row, dict) else row[columns.index(col)]
                                if value is None:
                                    values.append('NULL')
                                elif isinstance(value, str):
                                    values.append(f"'{value.replace("'", "''")}'")
                                else:
                                    values.append(str(value))
                            values_str = ', '.join(values)
                            sql_content += f"INSERT INTO {table_name} ({columns_str}) VALUES ({values_str});\n"
                        sql_content += "\n"
            
            # 写入SQL文件
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(sql_content)
            
            QMessageBox.information(self.main_window, "转储SQL成功", f"表 {table_name} 的SQL已保存到 {file_path}")
            self.logger.log('INFO', f"转储SQL文件: {table_name} -> {file_path}")
        except Exception as e:
            QMessageBox.critical(self.main_window, "转储SQL失败", f"转储表 {table_name} 的SQL时出错: {str(e)}")
            self.logger.log('ERROR', f"转储SQL失败: {str(e)}")
    
    def maintain_table(self, table_name, operation):
        """维护表"""
        try:
            # 执行维护操作
            with self.main_window.db_connection.cursor() as cursor:
                cursor.execute(f"{operation} TABLE {table_name}")
                self.main_window.db_connection.commit()
            
            QMessageBox.information(self.main_window, f"{operation}表成功", f"表 {table_name} {operation}成功")
            self.logger.log('INFO', f"{operation}表: {table_name}")
        except Exception as e:
            QMessageBox.critical(self.main_window, f"{operation}表失败", f"{operation}表 {table_name} 时出错: {str(e)}")
            self.logger.log('ERROR', f"{operation}表失败: {str(e)}")
    
    def rename_table(self, table_name):
        """重命名表"""
        try:
            # 获取新表名
            new_table_name, ok = QInputDialog.getText(self.main_window, "重命名表", f"请输入新表名 (原表: {table_name}):")
            if not ok or not new_table_name:
                return
            
            # 执行重命名操作
            with self.main_window.db_connection.cursor() as cursor:
                cursor.execute(f"RENAME TABLE {table_name} TO {new_table_name}")
                self.main_window.db_connection.commit()
            
            QMessageBox.information(self.main_window, "重命名表成功", f"表 {table_name} 已重命名为 {new_table_name}")
            self.logger.log('INFO', f"重命名表: {table_name} -> {new_table_name}")
            # 刷新对象树
            self.main_window.load_database_objects()
        except Exception as e:
            QMessageBox.critical(self.main_window, "重命名表失败", f"重命名表 {table_name} 时出错: {str(e)}")
            self.logger.log('ERROR', f"重命名表失败: {str(e)}")
    
    def show_table_info(self, table_name):
        """显示表信息"""
        try:
            # 获取表信息
            with self.main_window.db_connection.cursor() as cursor:
                # 获取表结构
                cursor.execute(f"DESCRIBE {table_name}")
                columns = cursor.fetchall()
                
                # 获取表状态
                cursor.execute(f"SHOW TABLE STATUS LIKE '{table_name}'")
                status = cursor.fetchone()
                
                # 获取表索引
                cursor.execute(f"SHOW INDEX FROM {table_name}")
                indexes = cursor.fetchall()
            
            # 创建信息对话框
            dialog = QDialog(self.main_window)
            dialog.setWindowTitle(f"表信息: {table_name}")
            dialog.setGeometry(300, 200, 800, 500)
            
            layout = QVBoxLayout(dialog)
            
            # 创建标签页
            from PyQt6.QtWidgets import QTabWidget
            tab_widget = QTabWidget()
            
            # 表结构标签页
            structure_tab = QWidget()
            structure_layout = QVBoxLayout(structure_tab)
            
            structure_table = QTableWidget()
            structure_table.setColumnCount(6)
            structure_table.setHorizontalHeaderLabels(["字段名", "数据类型", "是否为空", "默认值", "主键", "额外信息"])
            
            structure_table.setRowCount(len(columns))
            for i, col in enumerate(columns):
                col_name = col['Field'] if isinstance(col, dict) else col[0]
                col_type = col['Type'] if isinstance(col, dict) else col[1]
                col_null = col['Null'] if isinstance(col, dict) else col[2]
                col_default = col['Default'] if isinstance(col, dict) else col[3]
                col_key = col['Key'] if isinstance(col, dict) else col[4]
                col_extra = col['Extra'] if isinstance(col, dict) else col[5]
                
                structure_table.setItem(i, 0, QTableWidgetItem(col_name))
                structure_table.setItem(i, 1, QTableWidgetItem(col_type))
                structure_table.setItem(i, 2, QTableWidgetItem(col_null))
                structure_table.setItem(i, 3, QTableWidgetItem(str(col_default) if col_default is not None else ""))
                structure_table.setItem(i, 4, QTableWidgetItem(col_key))
                structure_table.setItem(i, 5, QTableWidgetItem(col_extra))
            
            structure_table.resizeColumnsToContents()
            structure_layout.addWidget(structure_table)
            tab_widget.addTab(structure_tab, "表结构")
            
            # 表状态标签页
            status_tab = QWidget()
            status_layout = QVBoxLayout(status_tab)
            
            from PyQt6.QtWidgets import QTextEdit
            status_text = QTextEdit()
            status_text.setReadOnly(True)
            
            if status:
                status_info = "表状态信息:\n\n"
                if isinstance(status, dict):
                    for key, value in status.items():
                        status_info += f"{key}: {value}\n"
                else:
                    # 假设状态结果是元组，需要根据实际情况调整
                    status_info += f"Name: {status[0]}\n"
                    status_info += f"Engine: {status[1]}\n"
                    status_info += f"Version: {status[2]}\n"
                    status_info += f"Row_format: {status[3]}\n"
                    status_info += f"Rows: {status[4]}\n"
                    status_info += f"Avg_row_length: {status[5]}\n"
                    status_info += f"Data_length: {status[6]}\n"
                    status_info += f"Max_data_length: {status[7]}\n"
                    status_info += f"Index_length: {status[8]}\n"
                    status_info += f"Data_free: {status[9]}\n"
                    status_info += f"Auto_increment: {status[10]}\n"
                    status_info += f"Create_time: {status[11]}\n"
                    status_info += f"Update_time: {status[12]}\n"
                    status_info += f"Check_time: {status[13]}\n"
                    status_info += f"Collation: {status[14]}\n"
                    status_info += f"Checksum: {status[15]}\n"
                    status_info += f"Create_options: {status[16]}\n"
                    status_info += f"Comment: {status[17]}\n"
            else:
                status_info = "无法获取表状态信息"
            
            status_text.setPlainText(status_info)
            status_layout.addWidget(status_text)
            tab_widget.addTab(status_tab, "表状态")
            
            # 索引标签页
            index_tab = QWidget()
            index_layout = QVBoxLayout(index_tab)
            
            index_table = QTableWidget()
            index_table.setColumnCount(6)
            index_table.setHorizontalHeaderLabels(["索引名", "唯一", "列名", "排序", "基数", "子_part"])
            
            index_table.setRowCount(len(indexes))
            for i, index in enumerate(indexes):
                if isinstance(index, dict):
                    index_name = index['Key_name']
                    non_unique = index['Non_unique']
                    column_name = index['Column_name']
                    collation = index['Collation']
                    cardinality = index['Cardinality']
                    sub_part = index['Sub_part']
                else:
                    # 假设索引结果是元组，需要根据实际情况调整
                    index_name = index[2]
                    non_unique = index[1]
                    column_name = index[4]
                    collation = index[5]
                    cardinality = index[6]
                    sub_part = index[7]
                
                index_table.setItem(i, 0, QTableWidgetItem(index_name))
                index_table.setItem(i, 1, QTableWidgetItem("否" if non_unique == 0 else "是"))
                index_table.setItem(i, 2, QTableWidgetItem(column_name))
                index_table.setItem(i, 3, QTableWidgetItem(collation))
                index_table.setItem(i, 4, QTableWidgetItem(str(cardinality)))
                index_table.setItem(i, 5, QTableWidgetItem(str(sub_part) if sub_part else ""))
            
            index_table.resizeColumnsToContents()
            index_layout.addWidget(index_table)
            tab_widget.addTab(index_tab, "索引")
            
            layout.addWidget(tab_widget)
            
            # 关闭按钮
            close_btn = QPushButton("关闭")
            close_btn.clicked.connect(dialog.reject)
            layout.addWidget(close_btn)
            
            dialog.exec()
            
            self.logger.log('INFO', f"查看表信息: {table_name}")
        except Exception as e:
            QMessageBox.critical(self.main_window, "显示表信息失败", f"显示表 {table_name} 信息时出错: {str(e)}")
            self.logger.log('ERROR', f"显示表信息失败: {str(e)}")