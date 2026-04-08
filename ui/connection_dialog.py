#!/usr/bin/env python3
"""
数据库连接对话框
"""

from PyQt6.QtWidgets import QDialog, QGridLayout, QLabel, QLineEdit, QComboBox, QPushButton, QGroupBox, QSpinBox, QMessageBox

# 尝试导入数据库驱动
try:
    import pymysql
    pymysql_available = True
except ImportError:
    pymysql_available = False

try:
    import psycopg2
    psycopg2_available = True
except ImportError:
    psycopg2_available = False

try:
    import pyodbc
    pyodbc_available = True
except ImportError:
    pyodbc_available = False

try:
    import sqlite3
    sqlite3_available = True
except ImportError:
    sqlite3_available = False

class ConnectionDialog(QDialog):
    """新建连接对话框"""
    def __init__(self, parent=None, connection_data=None):
        super(ConnectionDialog, self).__init__(parent)
        self.setWindowTitle("编辑连接" if connection_data else "新建连接")
        self.setGeometry(300, 200, 500, 450)
        
        self.connection_data = connection_data or {}
        self.result = None
        
        # 创建布局
        layout = QGridLayout()
        self.setLayout(layout)
        
        # 连接名称
        layout.addWidget(QLabel("连接名称:"), 0, 0, 1, 1)
        self.name_edit = QLineEdit(self.connection_data.get('name', ''))
        self.name_edit.setPlaceholderText("请输入连接名称")
        layout.addWidget(self.name_edit, 0, 1, 1, 2)
        
        # 连接类型
        layout.addWidget(QLabel("连接类型:"), 1, 0, 1, 1)
        self.type_combo = QComboBox()
        self.type_combo.addItems(['MySQL', 'PostgreSQL', 'SQLite', 'SQL Server', 'Oracle'])
        self.type_combo.setCurrentText(self.connection_data.get('type', 'MySQL'))
        self.type_combo.currentTextChanged.connect(self.on_connection_type_changed)
        layout.addWidget(self.type_combo, 1, 1, 1, 2)
        
        # 主机
        layout.addWidget(QLabel("主机:"), 2, 0, 1, 1)
        self.host_edit = QLineEdit(self.connection_data.get('host', 'localhost'))
        self.host_edit.setPlaceholderText("数据库服务器地址")
        layout.addWidget(self.host_edit, 2, 1, 1, 2)
        
        # 端口
        layout.addWidget(QLabel("端口:"), 3, 0, 1, 1)
        self.port_spin = QSpinBox()
        self.port_spin.setRange(1, 65535)
        self.port_spin.setValue(int(self.connection_data.get('port', 3306)))
        layout.addWidget(self.port_spin, 3, 1, 1, 2)
        
        # 用户名
        layout.addWidget(QLabel("用户名:"), 4, 0, 1, 1)
        self.username_edit = QLineEdit(self.connection_data.get('username', 'root'))
        self.username_edit.setPlaceholderText("数据库用户名")
        layout.addWidget(self.username_edit, 4, 1, 1, 2)
        
        # 密码
        layout.addWidget(QLabel("密码:"), 5, 0, 1, 1)
        self.password_edit = QLineEdit(self.connection_data.get('password', ''))
        self.password_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self.password_edit.setPlaceholderText("数据库密码")
        layout.addWidget(self.password_edit, 5, 1, 1, 2)
        
        # 数据库
        layout.addWidget(QLabel("数据库:"), 6, 0, 1, 1)
        self.database_edit = QLineEdit(self.connection_data.get('database', ''))
        self.database_edit.setPlaceholderText("数据库名称")
        layout.addWidget(self.database_edit, 6, 1, 1, 2)
        
        # 高级选项
        advanced_group = QGroupBox("高级选项")
        advanced_layout = QGridLayout()
        advanced_group.setLayout(advanced_layout)
        
        # 连接超时
        advanced_layout.addWidget(QLabel("连接超时:"), 0, 0, 1, 1)
        self.timeout_spin = QSpinBox()
        self.timeout_spin.setRange(1, 300)
        self.timeout_spin.setValue(int(self.connection_data.get('timeout', 30)))
        advanced_layout.addWidget(self.timeout_spin, 0, 1, 1, 1)
        advanced_layout.addWidget(QLabel("秒"), 0, 2, 1, 1)
        
        # 字符集
        advanced_layout.addWidget(QLabel("字符集:"), 1, 0, 1, 1)
        self.charset_combo = QComboBox()
        self.charset_combo.addItems(['utf8', 'utf8mb4', 'gbk', 'latin1'])
        self.charset_combo.setCurrentText(self.connection_data.get('charset', 'utf8'))
        advanced_layout.addWidget(self.charset_combo, 1, 1, 1, 2)
        
        layout.addWidget(advanced_group, 7, 0, 1, 3)
        
        # 测试连接按钮
        self.test_btn = QPushButton("测试连接")
        self.test_btn.clicked.connect(self.test_connection)
        layout.addWidget(self.test_btn, 8, 0, 1, 1)
        
        # 确定按钮
        self.ok_btn = QPushButton("确定")
        self.ok_btn.clicked.connect(self.accept)
        layout.addWidget(self.ok_btn, 8, 1, 1, 1)
        
        # 取消按钮
        self.cancel_btn = QPushButton("取消")
        self.cancel_btn.clicked.connect(self.reject)
        layout.addWidget(self.cancel_btn, 8, 2, 1, 1)
        
        # 根据连接类型设置默认端口
        self.on_connection_type_changed(self.type_combo.currentText())
    
    def on_connection_type_changed(self, connection_type):
        """连接类型变化时的处理"""
        # 设置默认端口
        port_mapping = {
            'MySQL': 3306,
            'PostgreSQL': 5432,
            'SQL Server': 1433,
            'Oracle': 1521,
            'SQLite': 0
        }
        
        default_port = port_mapping.get(connection_type, 3306)
        if default_port > 0:
            self.port_spin.setValue(default_port)
        
        # 对于SQLite，隐藏一些不需要的选项
        if connection_type == 'SQLite':
            self.host_edit.setEnabled(False)
            self.port_spin.setEnabled(False)
            self.username_edit.setEnabled(False)
            self.password_edit.setEnabled(False)
        else:
            self.host_edit.setEnabled(True)
            self.port_spin.setEnabled(True)
            self.username_edit.setEnabled(True)
            self.password_edit.setEnabled(True)
    
    def test_connection(self):
        """测试连接"""
        # 获取连接信息
        conn_data = {
            'name': self.name_edit.text(),
            'type': self.type_combo.currentText(),
            'host': self.host_edit.text(),
            'port': self.port_spin.value(),
            'username': self.username_edit.text(),
            'password': self.password_edit.text(),
            'database': self.database_edit.text()
        }
        
        # 测试连接
        try:
            conn = None
            if conn_data['type'] == 'MySQL' and pymysql_available:
                conn = pymysql.connect(
                    host=conn_data['host'],
                    port=conn_data['port'],
                    user=conn_data['username'],
                    password=conn_data['password'],
                    database=conn_data['database'] if conn_data['database'] else None,
                    connect_timeout=5
                )
            elif conn_data['type'] == 'PostgreSQL' and psycopg2_available:
                conn = psycopg2.connect(
                    host=conn_data['host'],
                    port=conn_data['port'],
                    user=conn_data['username'],
                    password=conn_data['password'],
                    dbname=conn_data['database'] if conn_data['database'] else 'postgres',
                    connect_timeout=5
                )
            elif conn_data['type'] == 'SQLite' and sqlite3_available:
                conn = sqlite3.connect(conn_data['database'] if conn_data['database'] else ':memory:')
            elif conn_data['type'] == 'SQL Server' and pyodbc_available:
                conn_str = f"DRIVER={{SQL Server}};SERVER={conn_data['host']},{conn_data['port']};DATABASE={conn_data['database'] if conn_data['database'] else 'master'};UID={conn_data['username']};PWD={conn_data['password']}"
                conn = pyodbc.connect(conn_str, timeout=5)
            
            if conn:
                conn.close()
                QMessageBox.information(self, "测试连接", "连接测试成功！")
            else:
                QMessageBox.warning(self, "测试连接", f"未支持的数据库类型或驱动未安装: {conn_data['type']}")
        except Exception as e:
            QMessageBox.critical(self, "测试连接", f"连接失败: {str(e)}")
    
    def accept(self):
        """接受"""
        self.result = {
            'name': self.name_edit.text(),
            'type': self.type_combo.currentText(),
            'host': self.host_edit.text(),
            'port': self.port_spin.value(),
            'username': self.username_edit.text(),
            'password': self.password_edit.text(),
            'database': self.database_edit.text()
        }
        super().accept()