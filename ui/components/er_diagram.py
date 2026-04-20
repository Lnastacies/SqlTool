#!/usr/bin/env python3
"""
ER图逆向工程模块
"""

from PyQt6.QtWidgets import QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QWidget, QLabel, QComboBox, QSplitter, QTableWidget, QTableWidgetItem, QMessageBox
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QPainter, QPen, QBrush, QColor, QFont

class ERDiagram(QDialog):
    """
    ER图逆向工程类
    """
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        
        self.setWindowTitle("ER图表")
        self.setGeometry(100, 100, 1000, 600)
        
        self.setup_ui()
    
    def setup_ui(self):
        """
        设置UI
        """
        # 主布局
        main_layout = QVBoxLayout(self)
        
        # 工具栏
        toolbar = QWidget()
        toolbar_layout = QHBoxLayout(toolbar)
        
        # 数据库选择
        db_label = QLabel("数据库:")
        self.db_combo = QComboBox()
        self.load_databases()
        
        # 按钮
        generate_btn = QPushButton("生成ER图")
        export_btn = QPushButton("导出图片")
        refresh_btn = QPushButton("刷新")
        
        toolbar_layout.addWidget(db_label)
        toolbar_layout.addWidget(self.db_combo)
        toolbar_layout.addStretch()
        toolbar_layout.addWidget(generate_btn)
        toolbar_layout.addWidget(export_btn)
        toolbar_layout.addWidget(refresh_btn)
        
        main_layout.addWidget(toolbar)
        
        # 分割器
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # 左侧表列表
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        
        tables_label = QLabel("表列表")
        self.tables_table = QTableWidget()
        self.tables_table.setColumnCount(2)
        self.tables_table.setHorizontalHeaderLabels(["表名", "描述"])
        
        left_layout.addWidget(tables_label)
        left_layout.addWidget(self.tables_table)
        
        # 右侧ER图绘制区域
        right_widget = QWidget()
        self.er_canvas = ERCanvas(right_widget)
        right_layout = QVBoxLayout(right_widget)
        right_layout.addWidget(self.er_canvas)
        
        splitter.addWidget(left_widget)
        splitter.addWidget(right_widget)
        splitter.setSizes([200, 800])
        
        main_layout.addWidget(splitter)
        
        # 连接信号
        generate_btn.clicked.connect(self.generate_er_diagram)
        export_btn.clicked.connect(self.export_diagram)
        refresh_btn.clicked.connect(self.refresh_tables)
        self.db_combo.currentTextChanged.connect(self.refresh_tables)
    
    def load_databases(self):
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
                            self.db_combo.addItem(db_name)
                    elif self.main_window.current_db_type == 'PostgreSQL':
                        cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
                        databases = cursor.fetchall()
                        for db in databases:
                            db_name = db[0]
                            self.db_combo.addItem(db_name)
                    elif self.main_window.current_db_type == 'SQL Server':
                        cursor.execute("SELECT name FROM sys.databases WHERE database_id > 4")
                        databases = cursor.fetchall()
                        for db in databases:
                            db_name = db[0]
                            self.db_combo.addItem(db_name)
        except Exception as e:
            self.logger.log('ERROR', f"加载数据库列表失败: {str(e)}")
    
    def refresh_tables(self):
        """
        刷新表列表
        """
        try:
            db_name = self.db_combo.currentText()
            if not db_name:
                return
            
            with self.main_window.db_connection.cursor() as cursor:
                # 切换到选中的数据库
                if self.main_window.current_db_type == 'MySQL':
                    cursor.execute(f"USE {db_name}")
                    cursor.execute("SHOW TABLES")
                    tables = cursor.fetchall()
                    
                    self.tables_table.setRowCount(len(tables))
                    for i, table in enumerate(tables):
                        table_name = table['Tables_in_' + db_name] if isinstance(table, dict) else table[0]
                        self.tables_table.setItem(i, 0, QTableWidgetItem(table_name))
                        
                        # 获取表注释
                        cursor.execute(f"SHOW TABLE STATUS LIKE '{table_name}'")
                        status = cursor.fetchone()
                        comment = status['Comment'] if (isinstance(status, dict) and 'Comment' in status) else ''
                        self.tables_table.setItem(i, 1, QTableWidgetItem(comment))
                elif self.main_window.current_db_type == 'PostgreSQL':
                    # 切换到选中的数据库
                    # 注意：PostgreSQL需要使用连接字符串切换数据库，这里简化处理
                    cursor.execute(f"SELECT table_name, table_comment FROM information_schema.tables WHERE table_schema = 'public' AND table_catalog = '{db_name}'")
                    tables = cursor.fetchall()
                    
                    self.tables_table.setRowCount(len(tables))
                    for i, table in enumerate(tables):
                        table_name = table[0]
                        comment = table[1] if table[1] else ''
                        self.tables_table.setItem(i, 0, QTableWidgetItem(table_name))
                        self.tables_table.setItem(i, 1, QTableWidgetItem(comment))
                elif self.main_window.current_db_type == 'SQL Server':
                    # 切换到选中的数据库
                    cursor.execute(f"USE {db_name}")
                    cursor.execute("SELECT name, create_date FROM sys.tables")
                    tables = cursor.fetchall()
                    
                    self.tables_table.setRowCount(len(tables))
                    for i, table in enumerate(tables):
                        table_name = table[0]
                        self.tables_table.setItem(i, 0, QTableWidgetItem(table_name))
                        self.tables_table.setItem(i, 1, QTableWidgetItem(''))
        except Exception as e:
            self.logger.log('ERROR', f"刷新表列表失败: {str(e)}")
    
    def generate_er_diagram(self):
        """
        生成ER图
        """
        try:
            db_name = self.db_combo.currentText()
            if not db_name:
                QMessageBox.warning(self, "生成ER图", "请先选择数据库")
                return
            
            # 加载表结构和关系
            tables = []
            relationships = []
            
            with self.main_window.db_connection.cursor() as cursor:
                # 切换到选中的数据库
                if self.main_window.current_db_type == 'MySQL':
                    cursor.execute(f"USE {db_name}")
                    
                    # 获取所有表
                    cursor.execute("SHOW TABLES")
                    table_results = cursor.fetchall()
                    
                    for table_result in table_results:
                        table_name = table_result['Tables_in_' + db_name] if isinstance(table_result, dict) else table_result[0]
                        
                        # 获取表结构
                        cursor.execute(f"SHOW COLUMNS FROM {table_name}")
                        columns = cursor.fetchall()
                        
                        # 获取外键关系
                        cursor.execute(f"SHOW CREATE TABLE {table_name}")
                        create_table = cursor.fetchone()
                        create_table_sql = create_table['Create Table'] if isinstance(create_table, dict) else create_table[1]
                        
                        # 解析外键关系
                        import re
                        fk_pattern = r'CONSTRAINT `(.*?)` FOREIGN KEY \(`(.*?)`\) REFERENCES `(.*?)` \(`(.*?)`\)'
                        fk_matches = re.findall(fk_pattern, create_table_sql)
                        
                        for fk_match in fk_matches:
                            fk_name, fk_column, ref_table, ref_column = fk_match
                            relationships.append({
                                'source_table': table_name,
                                'source_column': fk_column,
                                'target_table': ref_table,
                                'target_column': ref_column
                            })
                        
                        # 构建表结构
                        table = {
                            'name': table_name,
                            'columns': []
                        }
                        
                        for col in columns:
                            col_name = col['Field'] if isinstance(col, dict) else col[0]
                            col_type = col['Type'] if isinstance(col, dict) else col[1]
                            col_null = col['Null'] if isinstance(col, dict) else col[2]
                            col_key = col['Key'] if isinstance(col, dict) else col[4]
                            col_comment = col['Comment'] if (isinstance(col, dict) and 'Comment' in col) else ''
                            
                            table['columns'].append({
                                'name': col_name,
                                'type': col_type,
                                'null': col_null == 'YES',
                                'key': col_key,
                                'comment': col_comment
                            })
                        
                        tables.append(table)
                elif self.main_window.current_db_type == 'PostgreSQL':
                    # 简化处理，获取表和外键
                    cursor.execute(f"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_catalog = '{db_name}'")
                    table_results = cursor.fetchall()
                    
                    for table_result in table_results:
                        table_name = table_result[0]
                        
                        # 获取表结构
                        cursor.execute(f"SELECT column_name, data_type, is_nullable, column_default, column_comment FROM information_schema.columns WHERE table_name = '{table_name}' AND table_schema = 'public' AND table_catalog = '{db_name}'")
                        columns = cursor.fetchall()
                        
                        # 获取外键关系
                        cursor.execute("""
                            SELECT 
                                conname, 
                                a.attname as source_column, 
                                cl.relname as target_table, 
                                b.attname as target_column
                            FROM 
                                pg_constraint con
                            JOIN 
                                pg_class cl ON con.confrelid = cl.oid
                            JOIN 
                                pg_attribute a ON a.attnum = con.conkey[1] AND a.attrelid = con.conrelid
                            JOIN 
                                pg_attribute b ON b.attnum = con.confkey[1] AND b.attrelid = con.confrelid
                            WHERE 
                                con.contype = 'f' AND 
                                con.conrelid = (SELECT oid FROM pg_class WHERE relname = '{table_name}')
                        """)
                        fk_results = cursor.fetchall()
                        
                        for fk_result in fk_results:
                            fk_name, source_column, target_table, target_column = fk_result
                            relationships.append({
                                'source_table': table_name,
                                'source_column': source_column,
                                'target_table': target_table,
                                'target_column': target_column
                            })
                        
                        # 构建表结构
                        table = {
                            'name': table_name,
                            'columns': []
                        }
                        
                        for col in columns:
                            col_name, col_type, is_nullable, col_default, col_comment = col
                            
                            table['columns'].append({
                                'name': col_name,
                                'type': col_type,
                                'null': is_nullable == 'YES',
                                'key': '',
                                'comment': col_comment
                            })
                        
                        tables.append(table)
                elif self.main_window.current_db_type == 'SQL Server':
                    # 切换到选中的数据库
                    cursor.execute(f"USE {db_name}")
                    
                    # 获取所有表
                    cursor.execute("SELECT name FROM sys.tables")
                    table_results = cursor.fetchall()
                    
                    for table_result in table_results:
                        table_name = table_result[0]
                        
                        # 获取表结构
                        cursor.execute(f"SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '{table_name}'")
                        columns = cursor.fetchall()
                        
                        # 构建表结构
                        table = {
                            'name': table_name,
                            'columns': []
                        }
                        
                        for col in columns:
                            col_name, col_type, is_nullable, col_default = col
                            
                            table['columns'].append({
                                'name': col_name,
                                'type': col_type,
                                'null': is_nullable == 'YES',
                                'key': '',
                                'comment': ''
                            })
                        
                        tables.append(table)
            
            # 绘制ER图
            self.er_canvas.draw_er_diagram(tables, relationships)
            
            QMessageBox.information(self, "生成ER图", "ER图生成成功")
        except Exception as e:
            QMessageBox.critical(self, "生成ER图失败", f"生成ER图时出错: {str(e)}")
            self.logger.log('ERROR', f"生成ER图失败: {str(e)}")
    
    def export_diagram(self):
        """
        导出ER图为图片
        """
        from PyQt6.QtWidgets import QFileDialog
        from PyQt6.QtGui import QPixmap
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出ER图", "", "PNG文件 (*.png);;JPEG文件 (*.jpg);;BMP文件 (*.bmp)"
        )
        
        if file_path:
            try:
                # 捕获画布内容
                pixmap = QPixmap(self.er_canvas.size())
                self.er_canvas.render(pixmap)
                pixmap.save(file_path)
                
                QMessageBox.information(self, "导出成功", f"ER图已导出到: {file_path}")
            except Exception as e:
                QMessageBox.critical(self, "导出失败", f"导出ER图时出错: {str(e)}")
                self.logger.log('ERROR', f"导出ER图失败: {str(e)}")

class ERCanvas(QWidget):
    """
    ER图画布类
    """
    def __init__(self, parent=None):
        super().__init__(parent)
        self.tables = []
        self.relationships = []
        self.setMinimumSize(800, 500)
    
    def draw_er_diagram(self, tables, relationships):
        """
        绘制ER图
        """
        self.tables = tables
        self.relationships = relationships
        self.update()
    
    def paintEvent(self, event):
        """
        绘制事件
        """
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # 绘制背景
        painter.fillRect(self.rect(), QColor(240, 240, 240))
        
        # 计算表的位置
        table_positions = {}
        x, y = 50, 50
        for table in self.tables:
            table_positions[table['name']] = (x, y)
            x += 200
            if x > self.width() - 200:
                x = 50
                y += 150
        
        # 绘制关系
        for relationship in self.relationships:
            source_table = relationship['source_table']
            target_table = relationship['target_table']
            
            if source_table in table_positions and target_table in table_positions:
                source_x, source_y = table_positions[source_table]
                target_x, target_y = table_positions[target_table]
                
                # 绘制连接线
                painter.setPen(QPen(QColor(0, 0, 0), 1))
                painter.drawLine(
                    source_x + 150, source_y + 50,
                    target_x, target_y + 50
                )
        
        # 绘制表
        for table in self.tables:
            x, y = table_positions[table['name']]
            
            # 绘制表框
            painter.setPen(QPen(QColor(0, 0, 0), 1))
            painter.setBrush(QBrush(QColor(255, 255, 255)))
            painter.drawRect(x, y, 150, 100 + len(table['columns']) * 20)
            
            # 绘制表名
            painter.setPen(QPen(QColor(0, 0, 255), 1))
            painter.setFont(QFont("Arial", 10, QFont.Weight.Bold))
            painter.drawText(x + 10, y + 20, table['name'])
            
            # 绘制列
            painter.setPen(QPen(QColor(0, 0, 0), 1))
            painter.setFont(QFont("Arial", 8))
            for i, column in enumerate(table['columns']):
                column_text = f"{column['name']}: {column['type']}"
                if column['key'] == 'PRI':
                    painter.setPen(QPen(QColor(255, 0, 0), 1))
                else:
                    painter.setPen(QPen(QColor(0, 0, 0), 1))
                painter.drawText(x + 10, y + 40 + i * 20, column_text)