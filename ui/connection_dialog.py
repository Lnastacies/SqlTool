#!/usr/bin/env python3
"""
数据库连接对话框
"""

from PyQt6.QtWidgets import QDialog, QGridLayout, QLabel, QLineEdit, QComboBox, QPushButton, QGroupBox, QSpinBox, QMessageBox, QTabWidget, QVBoxLayout, QWidget

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
        self.setGeometry(300, 200, 600, 450)
        
        self.connection_data = connection_data or {}
        self.result = None
        self.parent = parent
        
        # 设置样式
        self.setStyleSheet("""
            QDialog {
                background-color: #FFFFFF;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                font-size: 12px;
            }
            QLabel {
                color: #333333;
                font-size: 12px;
                min-width: 100px;
            }
            QLineEdit {
                border: 1px solid #E0E0E0;
                border-radius: 2px;
                padding: 6px;
                font-size: 12px;
                min-width: 200px;
            }
            QLineEdit:focus {
                border-color: #007ACC;
            }
            QComboBox {
                border: 1px solid #E0E0E0;
                border-radius: 2px;
                padding: 6px;
                font-size: 12px;
                min-width: 200px;
            }
            QComboBox:focus {
                border-color: #007ACC;
            }
            QSpinBox {
                border: 1px solid #E0E0E0;
                border-radius: 2px;
                padding: 6px;
                font-size: 12px;
                min-width: 100px;
            }
            QSpinBox:focus {
                border-color: #007ACC;
            }
            QGroupBox {
                border: 1px solid #E0E0E0;
                border-radius: 2px;
                margin-top: 8px;
                font-size: 12px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 8px;
                top: -6px;
                padding: 0 4px;
                background-color: #FFFFFF;
                color: #333333;
                font-size: 12px;
            }
            QTabWidget::pane {
                border: 1px solid #E0E0E0;
                background-color: #FFFFFF;
            }
            QTabBar::tab {
                padding: 8px 16px;
                font-size: 12px;
                background-color: #F8F9FA;
                border: 1px solid #E0E0E0;
                border-bottom: none;
                margin-right: 2px;
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
            }
            QTabBar::tab:selected {
                background-color: #FFFFFF;
                border-top: 2px solid #007ACC;
            }
            QPushButton {
                background-color: #F8F9FA;
                border: 1px solid #E0E0E0;
                border-radius: 2px;
                padding: 6px 12px;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #E3F2FD;
                border-color: #007ACC;
            }
            QPushButton:pressed {
                background-color: #007ACC;
                color: #FFFFFF;
            }
        """)
        
        # 创建布局
        main_layout = QVBoxLayout()
        self.setLayout(main_layout)
        
        # 标签页
        tab_widget = QTabWidget()
        
        # 常规标签页
        general_tab = QWidget()
        general_layout = QVBoxLayout(general_tab)
        
        # 基本信息组
        basic_group = QGroupBox("基本信息")
        basic_layout = QGridLayout()
        basic_group.setLayout(basic_layout)
        
        # 连接名称
        basic_layout.addWidget(QLabel("连接名称:"), 0, 0, 1, 1)
        self.name_edit = QLineEdit(self.connection_data.get('name', ''))
        self.name_edit.setPlaceholderText("请输入连接名称")
        basic_layout.addWidget(self.name_edit, 0, 1, 1, 2)
        
        # 连接类型
        basic_layout.addWidget(QLabel("连接类型:"), 1, 0, 1, 1)
        self.type_combo = QComboBox()
        self.type_combo.addItems(['MySQL', 'PostgreSQL', 'SQLite', 'SQL Server', 'MariaDB'])
        self.type_combo.setCurrentText(self.connection_data.get('type', 'MySQL'))
        self.type_combo.currentTextChanged.connect(self.on_connection_type_changed)
        basic_layout.addWidget(self.type_combo, 1, 1, 1, 2)
        
        # 主机
        basic_layout.addWidget(QLabel("主机:"), 2, 0, 1, 1)
        self.host_edit = QLineEdit(self.connection_data.get('host', 'localhost'))
        self.host_edit.setPlaceholderText("数据库服务器地址")
        basic_layout.addWidget(self.host_edit, 2, 1, 1, 2)
        
        # 端口
        basic_layout.addWidget(QLabel("端口:"), 3, 0, 1, 1)
        self.port_spin = QSpinBox()
        self.port_spin.setRange(1, 65535)
        self.port_spin.setValue(int(self.connection_data.get('port', 3306)))
        basic_layout.addWidget(self.port_spin, 3, 1, 1, 2)
        
        # 用户名
        basic_layout.addWidget(QLabel("用户名:"), 4, 0, 1, 1)
        self.username_edit = QLineEdit(self.connection_data.get('username', 'root'))
        self.username_edit.setPlaceholderText("数据库用户名")
        basic_layout.addWidget(self.username_edit, 4, 1, 1, 2)
        
        # 密码
        basic_layout.addWidget(QLabel("密码:"), 5, 0, 1, 1)
        password = self.connection_data.get('password', '')
        print(f"ConnectionDialog: password from connection_data: '{password}'")
        self.password_edit = QLineEdit(password)
        self.password_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self.password_edit.setPlaceholderText("数据库密码")
        basic_layout.addWidget(self.password_edit, 5, 1, 1, 2)
        
        # 数据库
        basic_layout.addWidget(QLabel("数据库:"), 6, 0, 1, 1)
        self.database_edit = QLineEdit(self.connection_data.get('database', ''))
        self.database_edit.setPlaceholderText("数据库名称")
        basic_layout.addWidget(self.database_edit, 6, 1, 1, 2)
        
        # 分组
        basic_layout.addWidget(QLabel("分组:"), 7, 0, 1, 1)
        self.group_combo = QComboBox()
        self.group_combo.addItem("无")  # 默认选项
        
        # 添加现有的连接组
        if self.parent and hasattr(self.parent, 'connection_groups'):
            for group_name in self.parent.connection_groups:
                self.group_combo.addItem(group_name)
        
        # 检查当前连接是否在某个组中
        current_group = "无"
        if self.parent and hasattr(self.parent, 'connection_groups') and self.connection_data.get('name'):
            conn_name = self.connection_data['name']
            for group_name, connections in self.parent.connection_groups.items():
                if conn_name in connections:
                    current_group = group_name
                    break
        
        # 设置当前分组
        if current_group in [self.group_combo.itemText(i) for i in range(self.group_combo.count())]:
            self.group_combo.setCurrentText(current_group)
        basic_layout.addWidget(self.group_combo, 7, 1, 1, 2)
        
        general_layout.addWidget(basic_group)
        tab_widget.addTab(general_tab, "常规")
        
        # 高级选项标签页
        advanced_tab = QWidget()
        advanced_layout = QVBoxLayout(advanced_tab)
        
        # 高级选项组
        advanced_group = QGroupBox("高级选项")
        advanced_group_layout = QGridLayout()
        advanced_group.setLayout(advanced_group_layout)
        
        # 连接超时
        advanced_group_layout.addWidget(QLabel("连接超时:"), 0, 0, 1, 1)
        self.timeout_spin = QSpinBox()
        self.timeout_spin.setRange(1, 300)
        self.timeout_spin.setValue(int(self.connection_data.get('timeout', 30)))
        advanced_group_layout.addWidget(self.timeout_spin, 0, 1, 1, 1)
        advanced_group_layout.addWidget(QLabel("秒"), 0, 2, 1, 1)
        
        # 字符集
        advanced_group_layout.addWidget(QLabel("字符集:"), 1, 0, 1, 1)
        self.charset_combo = QComboBox()
        self.charset_combo.addItems(['utf8', 'utf8mb4', 'gbk', 'latin1'])
        self.charset_combo.setCurrentText(self.connection_data.get('charset', 'utf8'))
        advanced_group_layout.addWidget(self.charset_combo, 1, 1, 1, 2)
        
        advanced_layout.addWidget(advanced_group)
        tab_widget.addTab(advanced_tab, "高级")
        
        # SSL选项标签页
        ssl_tab = QWidget()
        ssl_layout = QVBoxLayout(ssl_tab)
        
        # SSL选项组
        ssl_group = QGroupBox("SSL选项")
        ssl_group_layout = QGridLayout()
        ssl_group.setLayout(ssl_group_layout)
        
        # 启用SSL
        self.ssl_check = QComboBox()
        self.ssl_check.addItems(['禁用', '启用', '验证服务器'])  # 0: 禁用, 1: 启用, 2: 验证服务器
        self.ssl_check.setCurrentIndex(int(self.connection_data.get('ssl_mode', 0)))
        ssl_group_layout.addWidget(QLabel("SSL模式:"), 0, 0, 1, 1)
        ssl_group_layout.addWidget(self.ssl_check, 0, 1, 1, 2)
        
        # 客户端密钥文件
        ssl_group_layout.addWidget(QLabel("客户端密钥文件:"), 1, 0, 1, 1)
        self.ssl_key_file = QLineEdit(self.connection_data.get('ssl_key', ''))
        self.ssl_key_file.setPlaceholderText("SSL客户端密钥文件路径")
        ssl_group_layout.addWidget(self.ssl_key_file, 1, 1, 1, 2)
        
        # 客户端证书文件
        ssl_group_layout.addWidget(QLabel("客户端证书文件:"), 2, 0, 1, 1)
        self.ssl_cert_file = QLineEdit(self.connection_data.get('ssl_cert', ''))
        self.ssl_cert_file.setPlaceholderText("SSL客户端证书文件路径")
        ssl_group_layout.addWidget(self.ssl_cert_file, 2, 1, 1, 2)
        
        # CA证书文件
        ssl_group_layout.addWidget(QLabel("CA证书文件:"), 3, 0, 1, 1)
        self.ssl_ca_file = QLineEdit(self.connection_data.get('ssl_ca', ''))
        self.ssl_ca_file.setPlaceholderText("SSL CA证书文件路径")
        ssl_group_layout.addWidget(self.ssl_ca_file, 3, 1, 1, 2)
        
        ssl_layout.addWidget(ssl_group)
        tab_widget.addTab(ssl_tab, "SSL")
        
        # SSH隧道选项标签页
        ssh_tab = QWidget()
        ssh_layout = QVBoxLayout(ssh_tab)
        
        # SSH隧道选项组
        ssh_group = QGroupBox("SSH隧道")
        ssh_group_layout = QGridLayout()
        ssh_group.setLayout(ssh_group_layout)
        
        # 启用SSH隧道
        self.ssh_check = QComboBox()
        self.ssh_check.addItems(['禁用', '启用'])
        self.ssh_check.setCurrentIndex(int(self.connection_data.get('ssh_enabled', 0)))
        ssh_group_layout.addWidget(QLabel("SSH隧道:"), 0, 0, 1, 1)
        ssh_group_layout.addWidget(self.ssh_check, 0, 1, 1, 2)
        
        # SSH主机
        ssh_group_layout.addWidget(QLabel("SSH主机:"), 1, 0, 1, 1)
        self.ssh_host = QLineEdit(self.connection_data.get('ssh_host', 'localhost'))
        self.ssh_host.setPlaceholderText("SSH服务器地址")
        ssh_group_layout.addWidget(self.ssh_host, 1, 1, 1, 2)
        
        # SSH端口
        ssh_group_layout.addWidget(QLabel("SSH端口:"), 2, 0, 1, 1)
        self.ssh_port = QSpinBox()
        self.ssh_port.setRange(1, 65535)
        self.ssh_port.setValue(int(self.connection_data.get('ssh_port', 22)))
        ssh_group_layout.addWidget(self.ssh_port, 2, 1, 1, 1)
        
        # SSH用户名
        ssh_group_layout.addWidget(QLabel("SSH用户名:"), 3, 0, 1, 1)
        self.ssh_username = QLineEdit(self.connection_data.get('ssh_username', ''))
        self.ssh_username.setPlaceholderText("SSH用户名")
        ssh_group_layout.addWidget(self.ssh_username, 3, 1, 1, 2)
        
        # SSH密码
        ssh_group_layout.addWidget(QLabel("SSH密码:"), 4, 0, 1, 1)
        self.ssh_password = QLineEdit(self.connection_data.get('ssh_password', ''))
        self.ssh_password.setEchoMode(QLineEdit.EchoMode.Password)
        self.ssh_password.setPlaceholderText("SSH密码")
        ssh_group_layout.addWidget(self.ssh_password, 4, 1, 1, 2)
        
        ssh_layout.addWidget(ssh_group)
        tab_widget.addTab(ssh_tab, "SSH")
        
        main_layout.addWidget(tab_widget)
        
        # 按钮布局
        button_layout = QGridLayout()
        
        # 测试连接按钮
        self.test_btn = QPushButton("测试连接")
        self.test_btn.clicked.connect(self.test_connection)
        button_layout.addWidget(self.test_btn, 0, 0, 1, 1)
        
        # 确定按钮
        self.ok_btn = QPushButton("确定")
        self.ok_btn.clicked.connect(self.accept)
        button_layout.addWidget(self.ok_btn, 0, 1, 1, 1)
        
        # 取消按钮
        self.cancel_btn = QPushButton("取消")
        self.cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(self.cancel_btn, 0, 2, 1, 1)
        
        main_layout.addLayout(button_layout)
        
        # 根据连接类型设置默认端口
        self.on_connection_type_changed(self.type_combo.currentText())
    
    def on_connection_type_changed(self, connection_type):
        """连接类型变化时的处理"""
        # 设置默认端口
        port_mapping = {
            'MySQL': 3306,
            'MariaDB': 3306,
            'PostgreSQL': 5432,
            'SQL Server': 1433,
            'Oracle': 1521,
            'SQLite': 0
        }
        
        default_port = port_mapping.get(connection_type, 3306)
        if default_port > 0:
            # 只有在新建连接时（即connection_data为空）才设置默认端口
            if not self.connection_data:
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
            'database': self.database_edit.text(),
            'timeout': self.timeout_spin.value(),
            'charset': self.charset_combo.currentText(),
            'ssl_mode': self.ssl_check.currentIndex(),
            'ssl_key': self.ssl_key_file.text(),
            'ssl_cert': self.ssl_cert_file.text(),
            'ssl_ca': self.ssl_ca_file.text(),
            'ssh_enabled': self.ssh_check.currentIndex(),
            'ssh_host': self.ssh_host.text(),
            'ssh_port': self.ssh_port.value(),
            'ssh_username': self.ssh_username.text(),
            'ssh_password': self.ssh_password.text()
        }
        
        # 测试连接
        try:
            conn = None
            if (conn_data['type'] == 'MySQL' or conn_data['type'] == 'MariaDB') and pymysql_available:
                # 构建连接参数
                connect_params = {
                    'host': conn_data['host'],
                    'port': conn_data['port'],
                    'user': conn_data['username'],
                    'password': conn_data['password'],
                    'database': conn_data['database'] if conn_data['database'] else None,
                    'connect_timeout': conn_data['timeout'],
                    'charset': conn_data['charset']
                }
                
                # 添加SSL参数
                if conn_data['ssl_mode'] > 0:
                    ssl_params = {}
                    if conn_data['ssl_key']:
                        ssl_params['key'] = conn_data['ssl_key']
                    if conn_data['ssl_cert']:
                        ssl_params['cert'] = conn_data['ssl_cert']
                    if conn_data['ssl_ca']:
                        ssl_params['ca'] = conn_data['ssl_ca']
                    if ssl_params:
                        connect_params['ssl'] = ssl_params
                
                conn = pymysql.connect(**connect_params)
            elif conn_data['type'] == 'PostgreSQL' and psycopg2_available:
                # 构建连接参数
                connect_params = {
                    'host': conn_data['host'],
                    'port': conn_data['port'],
                    'user': conn_data['username'],
                    'password': conn_data['password'],
                    'dbname': conn_data['database'] if conn_data['database'] else 'postgres',
                    'connect_timeout': conn_data['timeout']
                }
                
                # 添加SSL参数
                if conn_data['ssl_mode'] > 0:
                    sslmode = 'require' if conn_data['ssl_mode'] == 1 else 'verify-ca'
                    connect_params['sslmode'] = sslmode
                    if conn_data['ssl_ca']:
                        connect_params['sslrootcert'] = conn_data['ssl_ca']
                    if conn_data['ssl_cert']:
                        connect_params['sslcert'] = conn_data['ssl_cert']
                    if conn_data['ssl_key']:
                        connect_params['sslkey'] = conn_data['ssl_key']
                
                conn = psycopg2.connect(**connect_params)
            elif conn_data['type'] == 'SQLite' and sqlite3_available:
                conn = sqlite3.connect(conn_data['database'] if conn_data['database'] else ':memory:')
            elif conn_data['type'] == 'SQL Server' and pyodbc_available:
                conn_str = f"DRIVER={{SQL Server}};SERVER={conn_data['host']},{conn_data['port']};DATABASE={conn_data['database'] if conn_data['database'] else 'master'};UID={conn_data['username']};PWD={conn_data['password']}"
                conn = pyodbc.connect(conn_str, timeout=conn_data['timeout'])
            
            if conn:
                conn.close()
                QMessageBox.information(self, "测试连接", "连接测试成功！")
            else:
                QMessageBox.warning(self, "测试连接", f"未支持的数据库类型或驱动未安装: {conn_data['type']}")
        except Exception as e:
            QMessageBox.critical(self, "测试连接", f"连接失败: {str(e)}")
    
    def accept(self):
        """接受"""
        password = self.password_edit.text()
        print(f"ConnectionDialog accept: password from QLineEdit: '{password}'")
        self.result = {
            'name': self.name_edit.text(),
            'type': self.type_combo.currentText(),
            'host': self.host_edit.text(),
            'port': self.port_spin.value(),
            'username': self.username_edit.text(),
            'password': password,
            'database': self.database_edit.text(),
            'timeout': self.timeout_spin.value(),
            'charset': self.charset_combo.currentText(),
            'ssl_mode': self.ssl_check.currentIndex(),
            'ssl_key': self.ssl_key_file.text(),
            'ssl_cert': self.ssl_cert_file.text(),
            'ssl_ca': self.ssl_ca_file.text(),
            'ssh_enabled': self.ssh_check.currentIndex(),
            'ssh_host': self.ssh_host.text(),
            'ssh_port': self.ssh_port.value(),
            'ssh_username': self.ssh_username.text(),
            'ssh_password': self.ssh_password.text(),
            'group': self.group_combo.currentText()
        }
        print(f"ConnectionDialog accept: result['password']: '{self.result['password']}'")
        super().accept()