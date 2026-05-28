#!/usr/bin/env python3
"""
数据库比较工具
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QLabel, QComboBox, QMessageBox, QTextEdit,
    QGroupBox, QCheckBox, QProgressBar, QTabWidget, QWidget
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QColor


class DatabaseComparator(QDialog):
    """数据库比较工具"""
    
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        
        self.setWindowTitle("数据库比较")
        self.setGeometry(150, 100, 1000, 700)
        self.setMinimumSize(800, 500)
        self.setStyleSheet("""
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QTableWidget {
                border: 1px solid #d0d0d0;
                background-color: #ffffff;
                font-size: 12px;
            }
            QTableWidget::item {
                padding: 6px;
            }
            QPushButton {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
                border-radius: 3px;
                padding: 8px 20px;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
            }
            QPushButton#primary {
                background-color: #1a73e8;
                color: white;
                border: none;
            }
            QGroupBox {
                font-weight: 600;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                padding: 10px;
            }
        """)
        
        self.setup_ui()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(16, 16, 16, 16)
        
        # 连接选择
        conn_layout = QHBoxLayout()
        
        source_layout = QVBoxLayout()
        source_layout.addWidget(QLabel("源数据库:"))
        self.source_combo = QComboBox()
        source_layout.addWidget(self.source_combo)
        conn_layout.addLayout(source_layout, 1)
        
        compare_btn = QPushButton("⇄ 比较")
        compare_btn.setObjectName("primary")
        compare_btn.clicked.connect(self.compare)
        conn_layout.addWidget(compare_btn)
        
        target_layout = QVBoxLayout()
        target_layout.addWidget(QLabel("目标数据库:"))
        self.target_combo = QComboBox()
        target_layout.addWidget(self.target_combo)
        conn_layout.addWidget(target_layout, 1)
        
        layout.addLayout(conn_layout)
        
        # 比较选项
        options_group = QGroupBox("比较选项")
        options_layout = QHBoxLayout(options_group)
        
        self.compare_tables = QCheckBox("表结构")
        self.compare_tables.setChecked(True)
        options_layout.addWidget(self.compare_tables)
        
        self.compare_views = QCheckBox("视图")
        self.compare_views.setChecked(True)
        options_layout.addWidget(self.compare_views)
        
        self.compare_routines = QCheckBox("存储过程/函数")
        options_layout.addWidget(self.compare_routines)
        
        self.compare_triggers = QCheckBox("触发器")
        options_layout.addWidget(self.compare_triggers)
        
        options_layout.addStretch()
        layout.addWidget(options_group)
        
        # 结果标签页
        self.tabs = QTabWidget()
        
        # 仅在源存在
        self.source_only_tab = QWidget()
        self.setup_result_table(self.source_only_tab, "仅在源数据库中存在")
        self.tabs.addTab(self.source_only_tab, "仅在源中存在")
        
        # 仅在目标存在
        self.target_only_tab = QWidget()
        self.setup_result_table(self.target_only_tab, "仅在目标数据库中存在")
        self.tabs.addTab(self.target_only_tab, "仅在目标中存在")
        
        # 结构不同
        self.different_tab = QWidget()
        self.setup_result_table(self.different_tab, "结构不同")
        self.tabs.addTab(self.different_tab, "结构不同")
        
        # 完全相同
        self.same_tab = QWidget()
        self.setup_result_table(self.same_tab, "完全相同")
        self.tabs.addTab(self.same_tab, "完全相同")
        
        layout.addWidget(self.tabs, 1)
        
        # SQL预览
        preview_group = QGroupBox("生成同步SQL")
        preview_layout = QVBoxLayout(preview_group)
        
        self.sql_preview = QTextEdit()
        self.sql_preview.setReadOnly(True)
        self.sql_preview.setMaximumHeight(120)
        self.sql_preview.setPlaceholderText("生成的SQL将显示在这里...")
        preview_layout.addWidget(self.sql_preview)
        
        layout.addWidget(preview_group)
        
        # 按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        generate_btn = QPushButton("生成同步SQL")
        generate_btn.clicked.connect(self.generate_sync_sql)
        btn_layout.addWidget(generate_btn)
        
        execute_btn = QPushButton("执行到目标")
        execute_btn.setObjectName("primary")
        execute_btn.clicked.connect(self.execute_sync)
        btn_layout.addWidget(execute_btn)
        
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(self.accept)
        btn_layout.addWidget(close_btn)
        
        layout.addLayout(btn_layout)
    
    def setup_result_table(self, tab, title):
        """设置结果表格"""
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(0, 0, 0, 0)
        
        table = QTableWidget()
        table.setColumnCount(3)
        table.setHorizontalHeaderLabels(["对象名称", "类型", "差异详情"])
        table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        table.setAlternatingRowColors(True)
        table.horizontalHeader().setStretchLastSection(True)
        layout.addWidget(table)
    
    def compare(self):
        """执行比较"""
        QMessageBox.information(self, "提示", "数据库比较功能需要连接到两个数据库")
    
    def generate_sync_sql(self):
        """生成同步SQL"""
        self.sql_preview.setPlainText("-- 生成同步SQL\n-- 待实现")
    
    def execute_sync(self):
        """执行同步"""
        QMessageBox.information(self, "提示", "执行同步功能待实现")


class MockDataGenerator(QDialog):
    """模拟数据生成器"""
    
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        
        self.setWindowTitle("生成模拟数据")
        self.setGeometry(200, 150, 600, 500)
        self.setStyleSheet("""
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QLineEdit, QSpinBox {
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 6px;
            }
            QPushButton {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
                border-radius: 3px;
                padding: 8px 20px;
            }
            QPushButton#primary {
                background-color: #1a73e8;
                color: white;
                border: none;
            }
            QGroupBox {
                font-weight: 600;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                padding: 10px;
            }
        """)
        
        self.setup_ui()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(16, 16, 16, 16)
        
        # 表选择
        table_layout = QHBoxLayout()
        table_layout.addWidget(QLabel("目标表:"))
        self.table_combo = QComboBox()
        table_layout.addWidget(self.table_combo, 1)
        layout.addLayout(table_layout)
        
        # 生成数量
        count_layout = QHBoxLayout()
        count_layout.addWidget(QLabel("生成行数:"))
        self.count_input = QSpinBox()
        self.count_input.setRange(1, 10000)
        self.count_input.setValue(100)
        count_layout.addWidget(self.count_input)
        count_layout.addStretch()
        layout.addLayout(count_layout)
        
        # 数据类型配置
        config_group = QGroupBox("字段配置")
        config_layout = QVBoxLayout(config_group)
        
        config_layout.addWidget(QLabel("为每个字段选择生成规则:"))
        
        # 占位符配置
        config_layout.addWidget(QLabel("支持的数据类型:"))
        config_layout.addWidget(QLabel("• integer: 随机整数"))
        config_layout.addWidget(QLabel("• varchar: 随机字符串"))
        config_layout.addWidget(QLabel("• email: 随机邮箱"))
        config_layout.addWidget(QLabel("• name: 随机姓名"))
        config_layout.addWidget(QLabel("• phone: 随机电话号码"))
        config_layout.addWidget(QLabel("• date: 随机日期"))
        config_layout.addWidget(QLabel("• uuid: UUID"))
        
        layout.addWidget(config_group, 1)
        
        # 按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        preview_btn = QPushButton("预览SQL")
        preview_btn.clicked.connect(self.preview_sql)
        btn_layout.addWidget(preview_btn)
        
        generate_btn = QPushButton("生成并插入")
        generate_btn.setObjectName("primary")
        generate_btn.clicked.connect(self.generate_data)
        btn_layout.addWidget(generate_btn)
        
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)
        
        layout.addLayout(btn_layout)
    
    def preview_sql(self):
        """预览生成的SQL"""
        QMessageBox.information(self, "提示", "预览功能待实现")
    
    def generate_data(self):
        """生成数据"""
        QMessageBox.information(self, "提示", "数据生成功能待实现")


class SQLFormatter:
    """SQL格式化工具"""
    
    @staticmethod
    def format_sql(sql, style='default'):
        """格式化SQL语句
        
        Args:
            sql: 原始SQL语句
            style: 格式化风格 (default, compact, pretty)
            
        Returns:
            格式化后的SQL
        """
        import re
        
        if not sql:
            return sql
        
        # 关键字列表
        keywords = [
            'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT', 'RIGHT', 
            'INNER', 'OUTER', 'ON', 'IN', 'NOT', 'IS', 'NULL', 'AS',
            'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
            'CREATE', 'TABLE', 'INDEX', 'DROP', 'ALTER', 'ADD',
            'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
            'UNION', 'ALL', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
            'EXISTS', 'BETWEEN', 'LIKE', 'INNER', 'CROSS', 'NATURAL'
        ]
        
        # 转为大写关键字
        result = sql
        for keyword in keywords:
            pattern = r'\b' + keyword + r'\b'
            result = re.sub(pattern, keyword, result, flags=re.IGNORECASE)
        
        if style == 'pretty':
            # 换行和缩进
            indent = '    '
            level = 0
            
            # SELECT语句
            if re.match(r'SELECT', result, re.IGNORECASE):
                select_match = re.match(r'SELECT\s+(.*?)\s+FROM', result, re.IGNORECASE | re.DOTALL)
                if select_match:
                    columns = select_match.group(1)
                    if ',' in columns:
                        new_columns = ',\n' + indent + indent.join(columns.split(','))
                        result = re.sub(
                            r'SELECT\s+.*?\s+FROM',
                            'SELECT\n' + indent + new_columns + '\nFROM',
                            result,
                            flags=re.IGNORECASE | re.DOTALL
                        )
                
                # WHERE子句
                if ' WHERE ' in result.upper():
                    result = re.sub(
                        r' WHERE ',
                        '\nWHERE ',
                        result,
                        flags=re.IGNORECASE
                    )
                
                # JOIN
                for join_type in ['LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'JOIN', 'LEFT OUTER JOIN']:
                    result = re.sub(
                        r'\s+' + join_type + r'\s+',
                        '\n' + join_type + ' ',
                        result,
                        flags=re.IGNORECASE
                    )
                
                # ON
                result = re.sub(
                    r'\s+ON\s+',
                    '\n' + indent + 'ON ',
                    result,
                    flags=re.IGNORECASE
                )
                
                # AND/OR
                result = re.sub(
                    r'\s+(AND|OR)\s+',
                    '\n' + indent + r'\1 ',
                    result,
                    flags=re.IGNORECASE
                )
                
                # ORDER BY
                result = re.sub(
                    r'\s+ORDER\s+BY\s+',
                    '\nORDER BY ',
                    result,
                    flags=re.IGNORECASE
                )
                
                # GROUP BY
                result = re.sub(
                    r'\s+GROUP\s+BY\s+',
                    '\nGROUP BY ',
                    result,
                    flags=re.IGNORECASE
                )
                
                # HAVING
                result = re.sub(
                    r'\s+HAVING\s+',
                    '\nHAVING ',
                    result,
                    flags=re.IGNORECASE
                )
                
                # LIMIT
                result = re.sub(
                    r'\s+LIMIT\s+',
                    '\nLIMIT ',
                    result,
                    flags=re.IGNORECASE
                )
        
        return result.strip()
    
    @staticmethod
    def minify_sql(sql):
        """压缩SQL（去除多余空格）"""
        import re
        
        if not sql:
            return sql
        
        # 去除多余空格
        result = re.sub(r'\s+', ' ', sql)
        result = re.sub(r'\s*,\s*', ', ', result)
        result = re.sub(r'\s*\(\s*', '(', result)
        result = re.sub(r'\s*\)\s*', ')', result)
        
        return result.strip()
    
    @staticmethod
    def validate_sql(sql):
        """验证SQL语法（简单检查）"""
        import re
        
        if not sql:
            return False, "SQL语句为空"
        
        # 检查基本语法
        sql_upper = sql.upper().strip()
        
        valid_statements = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'SHOW', 'DESCRIBE', 'EXPLAIN']
        
        for stmt in valid_statements:
            if re.match(r'^' + stmt, sql_upper):
                return True, "SQL语法检查通过"
        
        return False, "未识别的SQL语句类型"


class ConnectionTester:
    """连接测试工具"""
    
    @staticmethod
    def test_connection(config, timeout=5):
        """测试数据库连接
        
        Args:
            config: 连接配置字典
            timeout: 超时时间（秒）
            
        Returns:
            (success, message)
        """
        import socket
        import time
        
        start_time = time.time()
        
        try:
            db_type = config.get('type', 'MySQL').lower()
            
            # 主机可达性测试
            host = config.get('host', 'localhost')
            port = config.get('port', 3306)
            
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            
            result = sock.connect_ex((host, port))
            sock.close()
            
            elapsed = time.time() - start_time
            
            if result != 0:
                return False, f"无法连接到 {host}:{port}，主机不可达或端口未开放"
            
            # 尝试建立数据库连接
            if db_type in ('mysql', 'mariadb'):
                import mysql.connector
                conn = mysql.connector.connect(
                    host=config.get('host'),
                    port=config.get('port', 3306),
                    user=config.get('username'),
                    password=config.get('password'),
                    database=config.get('database'),
                    connect_timeout=timeout
                )
                version = conn.get_server_info()
                conn.close()
                return True, f"连接成功! MySQL版本: {version} (耗时: {elapsed:.2f}s)"
            
            elif db_type == 'postgresql':
                import psycopg2
                conn = psycopg2.connect(
                    host=config.get('host'),
                    port=config.get('port', 5432),
                    user=config.get('username'),
                    password=config.get('password'),
                    dbname=config.get('database'),
                    connect_timeout=timeout
                )
                version = conn.server_version
                conn.close()
                return True, f"连接成功! PostgreSQL版本: {version} (耗时: {elapsed:.2f}s)"
            
            elif db_type == 'sqlserver':
                import pyodbc
                conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={host},{port};DATABASE={config.get('database')};UID={config.get('username')};PWD={config.get('password')}"
                conn = pyodbc.connect(conn_str, timeout=timeout)
                version = conn.getinfo(pyodbc.SQL_DBMS_VER)
                conn.close()
                return True, f"连接成功! SQL Server版本: {version} (耗时: {elapsed:.2f}s)"
            
            else:
                return False, f"不支持的数据库类型: {db_type}"
        
        except ImportError as e:
            return False, f"缺少数据库驱动: {str(e)}"
        
        except Exception as e:
            return False, f"连接失败: {str(e)} (耗时: {time.time() - start_time:.2f}s)"
