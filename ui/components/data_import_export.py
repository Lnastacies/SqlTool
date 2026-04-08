#!/usr/bin/env python3
"""
数据导入导出模块
"""

import csv
from PyQt6.QtWidgets import QMessageBox, QInputDialog, QFileDialog, QDialog, QVBoxLayout, QHBoxLayout, QLabel, QComboBox, QPushButton, QTableWidget, QTableWidgetItem, QHeaderView

class DataImportExport:
    """
    数据导入导出类
    """
    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
    
    def import_data(self):
        """
        导入数据
        """
        # 打开文件选择对话框
        file_path, file_type = QFileDialog.getOpenFileName(
            self.main_window, "选择导入文件", "", "CSV文件 (*.csv);;SQL文件 (*.sql);;Excel文件 (*.xlsx)")
        
        if not file_path:
            return
        
        # 检查是否已连接数据库
        if not hasattr(self.main_window, 'db_connection'):
            QMessageBox.warning(self.main_window, "导入数据", "请先连接到数据库")
            return
        
        try:
            if file_type == 'CSV文件 (*.csv)':
                self._import_csv(file_path)
            elif file_type == 'SQL文件 (*.sql)':
                self._import_sql(file_path)
            elif file_type == 'Excel文件 (*.xlsx)':
                self._import_excel(file_path)
            
            self.main_window.status_info.setText("数据导入成功")
            self.logger.log('INFO', f"导入数据文件: {file_path}")
            
        except Exception as e:
            QMessageBox.critical(self.main_window, "导入数据", f"导入数据失败: {str(e)}")
            self.logger.log('ERROR', f"导入数据失败: {str(e)}")
    
    def _import_csv(self, file_path):
        """
        导入CSV文件
        """
        # 获取目标表名
        table_name, ok = QInputDialog.getText(self.main_window, "导入CSV", "请输入目标表名:")
        if not ok or not table_name:
            return
        
        # 读取CSV文件
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                headers = next(reader)  # 读取表头
                rows = list(reader)  # 读取数据行
            
            if not rows:
                QMessageBox.warning(self.main_window, "导入CSV", "CSV文件为空")
                return
            
            # 构建SQL语句
            if self.main_window.current_db_type == 'MySQL':
                # 构建列名
                columns = ', '.join(headers)
                # 构建占位符
                placeholders = ', '.join(['%s'] * len(headers))
                # 构建插入语句
                sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
                
                # 执行批量插入
                with self.main_window.db_connection.cursor() as cursor:
                    cursor.executemany(sql, rows)
                    self.main_window.db_connection.commit()
                
                QMessageBox.information(self.main_window, "导入CSV", f"成功导入 {len(rows)} 条记录到表 {table_name}")
            elif self.main_window.current_db_type == 'PostgreSQL':
                # 构建列名
                columns = ', '.join(headers)
                # 构建占位符
                placeholders = ', '.join(['%s'] * len(headers))
                # 构建插入语句
                sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
                
                # 执行批量插入
                with self.main_window.db_connection.cursor() as cursor:
                    cursor.executemany(sql, rows)
                    self.main_window.db_connection.commit()
                
                QMessageBox.information(self.main_window, "导入CSV", f"成功导入 {len(rows)} 条记录到表 {table_name}")
            elif self.main_window.current_db_type == 'SQL Server':
                # 构建列名
                columns = ', '.join(headers)
                # 构建占位符
                placeholders = ', '.join(['?'] * len(headers))
                # 构建插入语句
                sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
                
                # 执行批量插入
                with self.main_window.db_connection.cursor() as cursor:
                    cursor.executemany(sql, rows)
                    self.main_window.db_connection.commit()
                
                QMessageBox.information(self.main_window, "导入CSV", f"成功导入 {len(rows)} 条记录到表 {table_name}")
        except Exception as e:
            raise e
    
    def _import_sql(self, file_path):
        """
        导入SQL文件
        """
        # 读取SQL文件
        with open(file_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        if not sql_content.strip():
            QMessageBox.warning(self.main_window, "导入SQL", "SQL文件为空")
            return
        
        # 执行SQL语句
        with self.main_window.db_connection.cursor() as cursor:
            # 分割SQL语句
            sql_statements = sql_content.split(';')
            executed = 0
            
            for statement in sql_statements:
                statement = statement.strip()
                if statement:
                    try:
                        cursor.execute(statement)
                        executed += 1
                    except Exception as e:
                        self.logger.log('WARNING', f"执行SQL语句失败: {str(e)}")
                        continue
            
            self.main_window.db_connection.commit()
        
        QMessageBox.information(self.main_window, "导入SQL", f"成功执行 {executed} 条SQL语句")
    
    def _import_excel(self, file_path):
        """
        导入Excel文件
        """
        try:
            import pandas as pd
            # 读取Excel文件
            df = pd.read_excel(file_path)
            
            # 获取目标表名
            table_name, ok = QInputDialog.getText(self.main_window, "导入Excel", "请输入目标表名:")
            if not ok or not table_name:
                return
            
            # 构建SQL语句
            if self.main_window.current_db_type == 'MySQL':
                # 构建列名
                columns = ', '.join(df.columns)
                # 构建占位符
                placeholders = ', '.join(['%s'] * len(df.columns))
                # 构建插入语句
                sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
                
                # 执行批量插入
                with self.main_window.db_connection.cursor() as cursor:
                    # 转换数据为元组列表
                    data = [tuple(row) for row in df.values]
                    cursor.executemany(sql, data)
                    self.main_window.db_connection.commit()
                
                QMessageBox.information(self.main_window, "导入Excel", f"成功导入 {len(df)} 条记录到表 {table_name}")
            elif self.main_window.current_db_type == 'PostgreSQL':
                # 构建列名
                columns = ', '.join(df.columns)
                # 构建占位符
                placeholders = ', '.join(['%s'] * len(df.columns))
                # 构建插入语句
                sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
                
                # 执行批量插入
                with self.main_window.db_connection.cursor() as cursor:
                    # 转换数据为元组列表
                    data = [tuple(row) for row in df.values]
                    cursor.executemany(sql, data)
                    self.main_window.db_connection.commit()
                
                QMessageBox.information(self.main_window, "导入Excel", f"成功导入 {len(df)} 条记录到表 {table_name}")
            elif self.main_window.current_db_type == 'SQL Server':
                # 构建列名
                columns = ', '.join(df.columns)
                # 构建占位符
                placeholders = ', '.join(['?'] * len(df.columns))
                # 构建插入语句
                sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
                
                # 执行批量插入
                with self.main_window.db_connection.cursor() as cursor:
                    # 转换数据为元组列表
                    data = [tuple(row) for row in df.values]
                    cursor.executemany(sql, data)
                    self.main_window.db_connection.commit()
                
                QMessageBox.information(self.main_window, "导入Excel", f"成功导入 {len(df)} 条记录到表 {table_name}")
        except ImportError:
            QMessageBox.warning(self.main_window, "导入Excel", "需要安装pandas和openpyxl库来导入Excel文件")
        except Exception as e:
            raise e
    
    def export_data(self):
        """
        导出数据
        """
        # 打开文件保存对话框
        file_path, file_type = QFileDialog.getSaveFileName(
            self.main_window, "保存导出文件", "", "CSV文件 (*.csv);;SQL文件 (*.sql);;Excel文件 (*.xlsx)")
        
        if not file_path:
            return
        
        # 检查是否已连接数据库
        if not hasattr(self.main_window, 'db_connection'):
            QMessageBox.warning(self.main_window, "导出数据", "请先连接到数据库")
            return
        
        # 获取要导出的表名
        table_name, ok = QInputDialog.getText(self.main_window, "导出数据", "请输入要导出的表名:")
        if not ok or not table_name:
            return
        
        try:
            if file_type == 'CSV文件 (*.csv)':
                self._export_csv(file_path, table_name)
            elif file_type == 'SQL文件 (*.sql)':
                self._export_sql(file_path, table_name)
            elif file_type == 'Excel文件 (*.xlsx)':
                self._export_excel(file_path, table_name)
            
            self.main_window.status_info.setText("数据导出成功")
            self.logger.log('INFO', f"导出数据文件: {file_path}")
            
        except Exception as e:
            QMessageBox.critical(self.main_window, "导出数据", f"导出数据失败: {str(e)}")
            self.logger.log('ERROR', f"导出数据失败: {str(e)}")
    
    def _export_csv(self, file_path, table_name):
        """
        导出CSV文件
        """
        with self.main_window.db_connection.cursor() as cursor:
            # 查询表数据
            cursor.execute(f"SELECT * FROM {table_name}")
            results = cursor.fetchall()
            
            if not results:
                QMessageBox.warning(self.main_window, "导出CSV", f"表 {table_name} 无数据")
                return
            
            # 获取列名
            columns = list(results[0].keys())
            
            # 写入CSV文件
            with open(file_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                # 写入表头
                writer.writerow(columns)
                # 写入数据
                for row in results:
                    writer.writerow(list(row.values()))
            
            QMessageBox.information(self.main_window, "导出CSV", f"成功导出 {len(results)} 条记录到文件 {file_path}")
    
    def _export_sql(self, file_path, table_name):
        """
        导出SQL文件
        """
        with self.main_window.db_connection.cursor() as cursor:
            # 查询表结构
            if self.main_window.current_db_type == 'MySQL':
                cursor.execute(f"DESCRIBE {table_name}")
                columns = cursor.fetchall()
                column_names = [col['Field'] for col in columns]
            elif self.main_window.current_db_type == 'PostgreSQL':
                # 简化处理，直接查询列名
                cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table_name}'")
                column_results = cursor.fetchall()
                column_names = [col[0] for col in column_results]
            elif self.main_window.current_db_type == 'SQL Server':
                cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table_name}'")
                column_results = cursor.fetchall()
                column_names = [col[0] for col in column_results]
            else:
                # 默认处理
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 1")
                sample = cursor.fetchone()
                if sample:
                    column_names = list(sample.keys())
                else:
                    column_names = []
            
            # 查询表数据
            cursor.execute(f"SELECT * FROM {table_name}")
            results = cursor.fetchall()
            
            # 构建SQL语句
            sql_content = f"-- 导出表 {table_name} 的数据\n\n"
            
            # 构建插入语句
            if results and column_names:
                # 构建列名
                columns_str = ', '.join(column_names)
                
                for row in results:
                    # 构建值
                    values = []
                    for col in column_names:
                        value = row.get(col)
                        if value is None:
                            values.append('NULL')
                        elif isinstance(value, str):
                            values.append(f"'{value.replace("'", "''")}'")
                        else:
                            values.append(str(value))
                    values_str = ', '.join(values)
                    
                    sql_content += f"INSERT INTO {table_name} ({columns_str}) VALUES ({values_str});\n"
            
            # 写入SQL文件
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(sql_content)
            
            QMessageBox.information(self.main_window, "导出SQL", f"成功导出 {len(results)} 条记录到文件 {file_path}")
    
    def _export_excel(self, file_path, table_name):
        """
        导出Excel文件
        """
        try:
            import pandas as pd
        except ImportError:
            QMessageBox.warning(self.main_window, "导出Excel", "需要安装pandas和openpyxl库来导出Excel文件")
            return
        
        with self.main_window.db_connection.cursor() as cursor:
            # 查询表数据
            cursor.execute(f"SELECT * FROM {table_name}")
            results = cursor.fetchall()
            
            if not results:
                QMessageBox.warning(self.main_window, "导出Excel", f"表 {table_name} 无数据")
                return
            
            # 转换为DataFrame
            df = pd.DataFrame(results)
            
            # 写入Excel文件
            df.to_excel(file_path, index=False)
            
            QMessageBox.information(self.main_window, "导出Excel", f"成功导出 {len(results)} 条记录到文件 {file_path}")
