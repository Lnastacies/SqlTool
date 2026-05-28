#!/usr/bin/env python3
"""
存储过程和函数管理器
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QLabel, QLineEdit, QComboBox, QMessageBox, QMenu,
    QToolBar, QApplication, QHeaderView, QAbstractItemView, QTextEdit,
    QTabWidget, QWidget, QInputDialog
)
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QAction, QCursor


class RoutineManager(QDialog):
    """存储过程和函数管理器"""
    
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        self.current_routines = []
        self.routine_type = 'PROCEDURE'
        
        self.setWindowTitle("存储过程和函数管理")
        self.setGeometry(150, 100, 1000, 650)
        self.setMinimumSize(800, 500)
        self.setStyleSheet("""
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QTabWidget::pane {
                border: 1px solid #d0d0d0;
                background-color: #ffffff;
            }
            QTabBar::tab {
                padding: 8px 20px;
                background-color: #f0f0f0;
                border: 1px solid #d0d0d0;
                border-bottom: none;
                font-size: 12px;
            }
            QTabBar::tab:selected {
                background-color: #ffffff;
                border-bottom: 2px solid #1a73e8;
            }
            QTableWidget {
                background-color: #ffffff;
                alternate-background-color: #f9f9f9;
                border: 1px solid #d0d0d0;
                gridline-color: #e8e8e8;
                font-size: 12px;
            }
            QTableWidget::item {
                padding: 6px 8px;
            }
            QTableWidget::item:selected {
                background-color: #e3f2fd;
                color: #1a73e8;
            }
            QHeaderView::section {
                background-color: #f0f0f0;
                padding: 8px;
                border: none;
                border-right: 1px solid #d0d0d0;
                border-bottom: 2px solid #1a73e8;
                font-weight: 600;
                font-size: 11px;
            }
            QPushButton {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
                border-radius: 3px;
                padding: 6px 16px;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
            }
            QPushButton:pressed {
                background-color: #d0d0d0;
            }
            QPushButton#primary {
                background-color: #1a73e8;
                color: white;
                border: none;
            }
            QPushButton#primary:hover {
                background-color: #1557b0;
            }
            QPushButton#danger {
                background-color: #dc3545;
                color: white;
                border: none;
            }
            QPushButton#danger:hover {
                background-color: #c82333;
            }
            QLineEdit {
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 6px 10px;
                font-size: 12px;
            }
            QToolBar {
                background-color: #f8f8f8;
                border: none;
                border-bottom: 1px solid #e0e0e0;
                padding: 4px;
            }
            QToolBar QToolButton {
                padding: 6px 12px;
                border: 1px solid transparent;
                border-radius: 3px;
            }
            QToolBar QToolButton:hover {
                background-color: #e0e0e0;
                border: 1px solid #c0c0c0;
            }
        """)
        
        self.setup_ui()
        self.load_routines()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(8)
        
        # 标签页
        self.tab_widget = QTabWidget()
        
        # 存储过程标签
        proc_tab = QWidget()
        self.setup_routine_tab(proc_tab, 'PROCEDURE')
        self.tab_widget.addTab(proc_tab, "存储过程")
        
        # 函数标签
        func_tab = QWidget()
        self.setup_routine_tab(func_tab, 'FUNCTION')
        self.tab_widget.addTab(func_tab, "函数")
        
        layout.addWidget(self.tab_widget)
        
        # 底部按钮
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(self.accept)
        button_layout.addWidget(close_btn)
        
        layout.addLayout(button_layout)
    
    def setup_routine_tab(self, tab, routine_type):
        """设置单个标签页"""
        self.routine_type = routine_type
        
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # 工具栏
        toolbar = QToolBar()
        
        refresh_action = QAction("刷新", self)
        refresh_action.triggered.connect(self.load_routines)
        toolbar.addAction(refresh_action)
        
        toolbar.addSeparator()
        
        open_action = QAction("编辑", self)
        open_action.triggered.connect(lambda: self.edit_routine(routine_type))
        toolbar.addAction(open_action)
        
        create_action = QAction(f"新建{'存储过程' if routine_type == 'PROCEDURE' else '函数'}", self)
        create_action.triggered.connect(lambda: self.create_routine(routine_type))
        toolbar.addAction(create_action)
        
        toolbar.addSeparator()
        
        drop_action = QAction("删除", self)
        drop_action.triggered.connect(lambda: self.drop_routine(routine_type))
        toolbar.addAction(drop_action)
        
        layout.addWidget(toolbar)
        
        # 搜索栏
        search_layout = QHBoxLayout()
        search_layout.addWidget(QLabel("搜索:"))
        search_input = QLineEdit()
        search_input.setPlaceholderText("输入名称搜索...")
        search_input.textChanged.connect(lambda t: self.filter_routines(t, routine_type))
        search_layout.addWidget(search_input, 1)
        search_layout.addWidget(QLabel(f"共 0 个"))
        layout.addLayout(search_layout)
        
        # 列表
        table = QTableWidget()
        table.setColumnCount(4)
        table.setHorizontalHeaderLabels(["名称", "参数", "返回类型", "创建时间"])
        table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        table.setAlternatingRowColors(True)
        table.horizontalHeader().setStretchLastSection(True)
        table.itemDoubleClicked.connect(lambda: self.edit_routine(routine_type))
        table.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        
        setattr(self, f'table_{routine_type}', table)
        layout.addWidget(table)
    
    def load_routines(self):
        """加载存储过程和函数列表"""
        self.load_procedures()
        self.load_functions()
    
    def load_procedures(self):
        """加载存储过程列表"""
        if not hasattr(self, 'table_PROCEDURE'):
            return
        
        self.table_PROCEDURE.setRowCount(0)
        
        try:
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    cursor.execute("""
                        SELECT 
                            ROUTINE_NAME,
                            ROUTINE_DEFINITION,
                            CREATED,
                            SQL_MODE
                        FROM INFORMATION_SCHEMA.ROUTINES
                        WHERE ROUTINE_SCHEMA = %s AND ROUTINE_TYPE = 'PROCEDURE'
                        ORDER BY ROUTINE_NAME
                    """, (self.main_window.current_db,))
                    routines = cursor.fetchall()
                elif self.main_window.current_db_type == 'PostgreSQL':
                    cursor.execute("""
                        SELECT 
                            p.proname as routine_name,
                            pg_get_functiondef(p.oid) as routine_definition,
                            p.prosrc as params
                        FROM pg_proc p
                        JOIN pg_namespace n ON p.pronamespace = n.oid
                        WHERE n.nspname = 'public'
                        AND p.prokind = 'p'
                        ORDER BY p.proname
                    """)
                    routines = cursor.fetchall()
                elif self.main_window.current_db_type == 'SQL Server':
                    cursor.execute("""
                        SELECT 
                            s.name + '.' + p.name as routine_name,
                            p.create_date,
                            m.definition
                        FROM sys.procedures p
                        INNER JOIN sys.sql_modules m ON p.object_id = m.object_id
                        INNER JOIN sys.schemas s ON p.schema_id = s.schema_id
                        ORDER BY s.name, p.name
                    """)
                    routines = cursor.fetchall()
                else:
                    routines = []
            
            for row, routine in enumerate(routines):
                self.table_PROCEDURE.insertRow(row)
                
                if isinstance(routine, dict):
                    name = routine.get('ROUTINE_NAME', '')
                    definition = routine.get('ROUTINE_DEFINITION', '')
                    created = routine.get('CREATED', '')
                else:
                    name = str(routine[0]) if len(routine) > 0 else ''
                    definition = str(routine[1]) if len(routine) > 1 else ''
                    created = str(routine[2]) if len(routine) > 2 else ''
                
                self.table_PROCEDURE.setItem(row, 0, QTableWidgetItem(name))
                self.table_PROCEDURE.setItem(row, 1, QTableWidgetItem(""))
                self.table_PROCEDURE.setItem(row, 2, QTableWidgetItem(""))
                self.table_PROCEDURE.setItem(row, 3, QTableWidgetItem(str(created)))
        
        except Exception as e:
            self.logger.log('ERROR', f"加载存储过程失败: {str(e)}")
    
    def load_functions(self):
        """加载函数列表"""
        if not hasattr(self, 'table_FUNCTION'):
            return
        
        self.table_FUNCTION.setRowCount(0)
        
        try:
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    cursor.execute("""
                        SELECT 
                            ROUTINE_NAME,
                            ROUTINE_DEFINITION,
                            CREATED,
                            DATA_TYPE
                        FROM INFORMATION_SCHEMA.ROUTINES
                        WHERE ROUTINE_SCHEMA = %s AND ROUTINE_TYPE = 'FUNCTION'
                        ORDER BY ROUTINE_NAME
                    """, (self.main_window.current_db,))
                    routines = cursor.fetchall()
                elif self.main_window.current_db_type == 'PostgreSQL':
                    cursor.execute("""
                        SELECT 
                            p.proname as routine_name,
                            pg_get_functiondef(p.oid) as routine_definition,
                            pg_get_function_result(p.oid) as return_type
                        FROM pg_proc p
                        JOIN pg_namespace n ON p.pronamespace = n.oid
                        WHERE n.nspname = 'public'
                        AND p.prokind = 'f'
                        ORDER BY p.proname
                    """)
                    routines = cursor.fetchall()
                else:
                    routines = []
            
            for row, routine in enumerate(routines):
                self.table_FUNCTION.insertRow(row)
                
                if isinstance(routine, dict):
                    name = routine.get('ROUTINE_NAME', '')
                    return_type = routine.get('DATA_TYPE', '')
                    created = routine.get('CREATED', '')
                else:
                    name = str(routine[0]) if len(routine) > 0 else ''
                    return_type = str(routine[2]) if len(routine) > 2 else ''
                    created = str(routine[1]) if len(routine) > 1 else ''
                
                self.table_FUNCTION.setItem(row, 0, QTableWidgetItem(name))
                self.table_FUNCTION.setItem(row, 1, QTableWidgetItem(""))
                self.table_FUNCTION.setItem(row, 2, QTableWidgetItem(return_type))
                self.table_FUNCTION.setItem(row, 3, QTableWidgetItem(str(created)))
        
        except Exception as e:
            self.logger.log('ERROR', f"加载函数失败: {str(e)}")
    
    def filter_routines(self, text, routine_type):
        """筛选列表"""
        table = getattr(self, f'table_{routine_type}')
        if not text:
            for row in range(table.rowCount()):
                table.setRowHidden(row, False)
            return
        
        text_lower = text.lower()
        for row in range(table.rowCount()):
            name_item = table.item(row, 0)
            if name_item:
                table.setRowHidden(row, text_lower not in name_item.text().lower())
    
    def get_selected_routine(self, routine_type):
        """获取选中的项"""
        table = getattr(self, f'table_{routine_type}')
        row = table.currentRow()
        if row >= 0:
            name_item = table.item(row, 0)
            if name_item:
                return name_item.text()
        return None
    
    def create_routine(self, routine_type):
        """创建存储过程/函数"""
        designer = RoutineDesigner(self.main_window, routine_type=routine_type)
        if designer.exec():
            self.load_routines()
    
    def edit_routine(self, routine_type):
        """编辑存储过程/函数"""
        routine_name = self.get_selected_routine(routine_type)
        if not routine_name:
            QMessageBox.warning(self, "提示", f"请先选择一个{'存储过程' if routine_type == 'PROCEDURE' else '函数'}")
            return
        
        designer = RoutineDesigner(self.main_window, routine_name, routine_type)
        if designer.exec():
            self.load_routines()
    
    def drop_routine(self, routine_type):
        """删除存储过程/函数"""
        routine_name = self.get_selected_routine(routine_type)
        if not routine_name:
            QMessageBox.warning(self, "提示", f"请先选择一个{'存储过程' if routine_type == 'PROCEDURE' else '函数'}")
            return
        
        if QMessageBox.question(self, "删除确认", 
                              f"确定要删除{'存储过程' if routine_type == 'PROCEDURE' else '函数'} '{routine_name}' 吗？\n此操作不可恢复！",
                              QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) != QMessageBox.StandardButton.Yes:
            return
        
        try:
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                if routine_type == 'PROCEDURE':
                    cursor.execute(f"DROP PROCEDURE IF EXISTS `{routine_name}`")
                else:
                    cursor.execute(f"DROP FUNCTION IF EXISTS `{routine_name}`")
                self.main_window.db_connection.commit()
            
            QMessageBox.information(self, "删除成功", f"{'存储过程' if routine_type == 'PROCEDURE' else '函数'} '{routine_name}' 已删除")
            self.logger.log('INFO', f"删除{routine_type}: {routine_name}")
            self.load_routines()
            
        except Exception as e:
            QMessageBox.critical(self, "删除失败", f"删除时出错:\n{str(e)}")
            self.logger.log('ERROR', f"删除{routine_type}失败: {str(e)}")


class RoutineDesigner(QDialog):
    """存储过程/函数设计器"""
    
    def __init__(self, main_window, routine_name=None, routine_type='PROCEDURE'):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        self.routine_name = routine_name
        self.routine_type = routine_type
        
        self.setWindowTitle(f"编辑{'存储过程' if routine_type == 'PROCEDURE' else '函数'}: {routine_name}" 
                          if routine_name else f"新建{'存储过程' if routine_type == 'PROCEDURE' else '函数'}")
        self.setGeometry(150, 100, 1000, 750)
        self.setMinimumSize(800, 550)
        self.setStyleSheet("""
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QTextEdit, QPlainTextEdit {
                border: 1px solid #d0d0d0;
                background-color: #ffffff;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 12px;
            }
            QPushButton {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
                border-radius: 3px;
                padding: 6px 16px;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
            }
            QPushButton#primary {
                background-color: #1a73e8;
                color: white;
                border: none;
            }
            QPushButton#primary:hover {
                background-color: #1557b0;
            }
            QLabel {
                font-size: 12px;
                color: #333333;
            }
            QGroupBox {
                font-weight: 600;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                margin-top: 8px;
                padding-top: 8px;
            }
        """)
        
        self.setup_ui()
        if routine_name:
            self.load_routine_definition()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)
        
        # 基本信息
        info_group = QWidget()
        info_layout = QHBoxLayout(info_group)
        info_layout.setContentsMargins(0, 0, 0, 0)
        
        info_layout.addWidget(QLabel("名称:"))
        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("输入名称...")
        info_layout.addWidget(self.name_input, 1)
        
        if self.routine_type == 'FUNCTION':
            info_layout.addWidget(QLabel("返回类型:"))
            self.return_type = QComboBox()
            self.return_type.setEditable(True)
            self.return_type.addItems(['INT', 'VARCHAR', 'TEXT', 'DATE', 'DATETIME', 'DECIMAL', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'BLOB'])
            self.return_type.setMinimumWidth(120)
            info_layout.addWidget(self.return_type)
        
        layout.addWidget(info_group)
        
        # 参数
        param_group = QWidget()
        param_layout = QHBoxLayout(param_group)
        param_layout.setContentsMargins(0, 0, 0, 0)
        
        param_layout.addWidget(QLabel("参数:"))
        self.param_input = QLineEdit()
        self.param_input.setPlaceholderText("例如: IN id INT, IN name VARCHAR(100)")
        param_layout.addWidget(self.param_input, 1)
        
        layout.addWidget(param_group)
        
        # 过程体
        body_label = QLabel(f"{'存储过程' if self.routine_type == 'PROCEDURE' else '函数'}体:")
        layout.addWidget(body_label)
        
        self.body_editor = QTextEdit()
        self.body_editor.setPlaceholderText(f"""输入{'存储过程' if self.routine_type == 'PROCEDURE' else '函数'}定义，例如:

DELIMITER //

CREATE {'PROCEDURE' if self.routine_type == 'PROCEDURE' else 'FUNCTION'} `{self.routine_name or 'proc_name'}`
({'参数定义'})
{'BEGIN' if self.routine_type == 'PROCEDURE' else 'RETURNS datatype\nBEGIN'}
    -- 你的代码
END //

DELIMITER ;""")
        layout.addWidget(self.body_editor, 1)
        
        # 帮助信息
        help_label = QLabel("提示: MySQL存储过程/函数需要使用DELIMITER语句定义。")
        help_label.setStyleSheet("color: #666666; font-size: 11px;")
        layout.addWidget(help_label)
        
        # 按钮
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        
        test_btn = QPushButton("测试语法")
        test_btn.clicked.connect(self.test_syntax)
        button_layout.addWidget(test_btn)
        
        save_btn = QPushButton("保存")
        save_btn.setObjectName("primary")
        save_btn.clicked.connect(self.save_routine)
        button_layout.addWidget(save_btn)
        
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)
        
        layout.addLayout(button_layout)
    
    def load_routine_definition(self):
        """加载定义"""
        try:
            self.name_input.setText(self.routine_name)
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    cursor.execute("""
                        SELECT ROUTINE_DEFINITION, ROUTINE_TYPE, DATA_TYPE, PARAMETER_LIST
                        FROM INFORMATION_SCHEMA.ROUTINES
                        WHERE ROUTINE_SCHEMA = %s AND ROUTINE_NAME = %s
                    """, (self.main_window.current_db, self.routine_name))
                    result = cursor.fetchone()
                    if result:
                        definition = result[0]
                        self.param_input.setText(str(result[3]) if result[3] else "")
                        if self.routine_type == 'FUNCTION' and result[2]:
                            self.return_type.setCurrentText(result[2])
                        
                        # 构建完整定义
                        full_def = f"""DELIMITER //

CREATE {self.routine_type} `{self.routine_name}`({str(result[3]) if result[3] else ''})
{'' if self.routine_type == 'PROCEDURE' else 'RETURNS ' + str(result[2])}
AS
{definition}

-- 执行示例
-- CALL `{self.routine_name}`();

DELIMITER ;"""
                        self.body_editor.setPlainText(full_def)
            
        except Exception as e:
            QMessageBox.critical(self, "加载失败", f"加载定义时出错:\n{str(e)}")
            self.logger.log('ERROR', f"加载存储过程定义失败: {str(e)}")
    
    def test_syntax(self):
        """测试语法"""
        sql = self.body_editor.toPlainText()
        if not sql:
            QMessageBox.warning(self, "提示", "请输入SQL语句")
            return
        
        try:
            self.main_window.table_operations._ensure_database_context()
            
            # 尝试解析SQL（不实际执行）
            with self.main_window.db_connection.cursor() as cursor:
                # 使用EXPLAIN验证语法
                cursor.execute(f"EXPLAIN {sql}")
            
            QMessageBox.information(self, "语法检查", "语法检查通过！")
            
        except Exception as e:
            QMessageBox.critical(self, "语法错误", f"SQL语法有误:\n{str(e)}")
    
    def save_routine(self):
        """保存"""
        routine_name = self.name_input.text().strip()
        body = self.body_editor.toPlainText().strip()
        
        if not routine_name:
            QMessageBox.warning(self, "提示", "请输入名称")
            return
        
        if not body:
            QMessageBox.warning(self, "提示", "请输入定义")
            return
        
        try:
            self.main_window.table_operations._ensure_database_context()
            
            # 提取DELIMITER之间的SQL
            import re
            
            # 处理DELIMITER
            delimiter_match = re.search(r'DELIMITER\s+(\S+)', body)
            delimiter = delimiter_match.group(1) if delimiter_match else ';'
            
            # 提取CREATE语句
            sql_statements = []
            for match in re.finditer(r'CREATE\s+(?:PROCEDURE|FUNCTION)\s+.*?(?=' + delimiter + r'|$)', body, re.DOTALL | re.IGNORECASE):
                sql_statements.append(match.group(0).strip())
            
            if not sql_statements:
                sql_statements = [body]
            
            with self.main_window.db_connection.cursor() as cursor:
                for sql in sql_statements:
                    if sql.strip():
                        cursor.execute(sql)
                self.main_window.db_connection.commit()
            
            QMessageBox.information(self, "保存成功", f"{'存储过程' if self.routine_type == 'PROCEDURE' else '函数'} '{routine_name}' 保存成功")
            self.logger.log('INFO', f"保存{self.routine_type}: {routine_name}")
            self.accept()
            
        except Exception as e:
            QMessageBox.critical(self, "保存失败", f"保存时出错:\n{str(e)}")
            self.logger.log('ERROR', f"保存{self.routine_type}失败: {str(e)}")
