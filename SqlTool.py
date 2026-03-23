#!/usr/bin/env python3
"""
Navicat风格的数据库管理工具
"""

import sys
import json
import os
import time
from datetime import datetime
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QTabWidget,
    QTextEdit, QPushButton, QLabel, QTreeWidget, QTreeWidgetItem, QComboBox,
    QSplitter, QMessageBox, QFileDialog, QStatusBar, QMenu, QDialog, QLineEdit,
    QGridLayout, QFrame, QGroupBox, QCheckBox, QToolBar,
    QTableWidget, QCompleter,
    QTableWidgetItem, QListWidget, QListWidgetItem, QInputDialog, QSpinBox
)
from PyQt6.QtCore import Qt, QSize, QTimer, QSettings, QStringListModel
from PyQt6.QtGui import QAction, QIcon, QColor, QFont, QTextCharFormat, QIntValidator, QSyntaxHighlighter, QFontMetrics, QTextDocument, QTextCursor, QTextOption

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

class ConnectionPool:
    """数据库连接池管理"""
    def __init__(self, max_connections=5):
        self.max_connections = max_connections
        self.connections = {}
        self.connection_count = {}
    
    def get_connection(self, conn_name, conn_data):
        """获取数据库连接"""
        # 检查连接是否已存在
        if conn_name in self.connections and self.connections[conn_name] is not None:
            return self.connections[conn_name]
        
        # 检查连接数是否超过限制
        if conn_name in self.connection_count and self.connection_count[conn_name] >= self.max_connections:
            raise Exception(f"连接池已满，最大连接数: {self.max_connections}")
        
        # 创建新连接
        conn = None
        if conn_data['type'] == 'MySQL' and pymysql_available:
            conn = pymysql.connect(
                host=conn_data['host'],
                port=conn_data['port'],
                user=conn_data['username'],
                password=conn_data['password'],
                database=conn_data['database'] if conn_data['database'] else None,
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=False
            )
        elif conn_data['type'] == 'PostgreSQL' and psycopg2_available:
            conn = psycopg2.connect(
                host=conn_data['host'],
                port=conn_data['port'],
                user=conn_data['username'],
                password=conn_data['password'],
                dbname=conn_data['database'] if conn_data['database'] else 'postgres'
            )
        elif conn_data['type'] == 'SQLite' and sqlite3_available:
            conn = sqlite3.connect(conn_data['database'] if conn_data['database'] else ':memory:')
        elif conn_data['type'] == 'SQL Server' and pyodbc_available:
            conn_str = f"DRIVER={{SQL Server}};SERVER={conn_data['host']},{conn_data['port']};DATABASE={conn_data['database'] if conn_data['database'] else 'master'};UID={conn_data['username']};PWD={conn_data['password']}"
            conn = pyodbc.connect(conn_str)
        
        if conn:
            # 存储连接
            self.connections[conn_name] = conn
            # 更新连接计数
            if conn_name not in self.connection_count:
                self.connection_count[conn_name] = 0
            self.connection_count[conn_name] += 1
        
        return conn
    
    def release_connection(self, conn_name):
        """释放数据库连接"""
        if conn_name in self.connections and self.connections[conn_name] is not None:
            try:
                self.connections[conn_name].close()
            except Exception as e:
                print(f"关闭连接失败: {e}")
            finally:
                self.connections[conn_name] = None
                if conn_name in self.connection_count:
                    self.connection_count[conn_name] = max(0, self.connection_count[conn_name] - 1)
    
    def close_all_connections(self):
        """关闭所有连接"""
        for conn_name in list(self.connections.keys()):
            self.release_connection(conn_name)

class OperationLogger:
    """操作日志记录器"""
    def __init__(self, log_file='operation_log.txt'):
        self.log_file = log_file
        self.enabled = True
        # 确保日志目录存在
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir)
        
    def log(self, operation_type, message, details='', exception=None):
        """记录操作日志"""
        if not self.enabled:
            return
        
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_entry = f"[{timestamp}] [{operation_type}] {message}"
        if details:
            log_entry += f"\n{details}"
        if exception:
            log_entry += f"\n异常信息: {str(exception)}"
        
        print(log_entry)
        
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(log_entry + '\n')
        except Exception as e:
            print(f"日志记录失败: {e}")
    
    def info(self, message, details=''):
        """记录信息日志"""
        self.log('INFO', message, details)
    
    def warning(self, message, details=''):
        """记录警告日志"""
        self.log('WARNING', message, details)
    
    def error(self, message, details='', exception=None):
        """记录错误日志"""
        self.log('ERROR', message, details, exception)
    
    def debug(self, message, details=''):
        """记录调试日志"""
        self.log('DEBUG', message, details)

class SQLSyntaxHighlighter(QSyntaxHighlighter):
    """SQL语法高亮"""
    def __init__(self, parent=None):
        super(SQLSyntaxHighlighter, self).__init__(parent)
        
        # 关键字格式
        keyword_format = QTextCharFormat()
        keyword_format.setForeground(QColor('#0000FF'))
        keyword_format.setFontWeight(QFont.Weight.Bold)
        
        # 函数格式
        function_format = QTextCharFormat()
        function_format.setForeground(QColor('#800080'))
        function_format.setFontWeight(QFont.Weight.Bold)
        
        # 字符串格式
        string_format = QTextCharFormat()
        string_format.setForeground(QColor('#008000'))
        
        # 注释格式
        comment_format = QTextCharFormat()
        comment_format.setForeground(QColor('#808080'))
        
        # 规则
        self.highlighting_rules = [
            # 关键字
            (r'\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|ORDER|BY|HAVING|LIMIT|OFFSET|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|RENAME|INDEX|VIEW|PROCEDURE|FUNCTION|TRIGGER|TABLE)\b', keyword_format),
            # 函数
            (r'\b(COUNT|SUM|AVG|MAX|MIN|CONCAT|SUBSTRING|LENGTH|DATE|TIME|NOW|CURRENT_TIMESTAMP)\b', function_format),
            # 字符串
            (r"'[^']*'", string_format),
            (r'"[^"]*"', string_format),
            # 注释
            (r'--[^\\n]*', comment_format),
            (r'/\*[\s\S]*?\*/', comment_format),
        ]
    
    def highlightBlock(self, text):
        """高亮文本块"""
        for pattern, format in self.highlighting_rules:
            import re
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                start, end = match.span()
                self.setFormat(start, end - start, format)

class SQLCompleter(QCompleter):
    """SQL自动补全"""
    def __init__(self, parent=None):
        super(SQLCompleter, self).__init__(parent)
        
        # 初始化补全列表
        self.update_completion_list()
        
        self.setCompletionMode(QCompleter.CompletionMode.PopupCompletion)
        self.setFilterMode(Qt.MatchFlag.MatchContains)
        self.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        
    def update_completion_list(self, tables=None, columns=None):
        """更新补全列表"""
        # SQL关键字
        sql_keywords = [
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
            'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'UPDATE',
            'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME', 'INDEX',
            'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'TABLE'
        ]
        
        # 函数
        functions = [
            'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'CONCAT', 'SUBSTRING',
            'LENGTH', 'DATE', 'TIME', 'NOW', 'CURRENT_TIMESTAMP'
        ]
        
        # 构建补全列表
        completion_list = sql_keywords + functions
        
        # 添加表名
        if tables:
            completion_list.extend(tables)
        
        # 添加列名
        if columns:
            completion_list.extend(columns)
        
        # 使用字符串列表作为模型
        self.setModel(QStringListModel(completion_list))
        
    def showPopup(self):
        """显示补全弹窗"""
        super().showPopup()
        # 调整弹窗宽度
        popup = self.popup()
        if popup:
            # 设置最小宽度
            popup.setMinimumWidth(300)
            # 调整列宽以适应内容
            popup.setColumnWidth(0, 300)

class SQLTextEdit(QTextEdit):
    """SQL文本编辑器"""
    def __init__(self, parent=None):
        super(SQLTextEdit, self).__init__(parent)
        
        # 设置字体
        font = QFont('Consolas', 10)
        self.setFont(font)
        
        # 设置换行模式
        self.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)
        
        # 设置制表符宽度
        metrics = QFontMetrics(font)
        tab_width = metrics.horizontalAdvance(' ' * 4)
        if tab_width > 0:
            self.setTabStopDistance(tab_width)
        
        # 启用代码折叠
        self.setDocument(QTextDocument(self))
        self.document().setIndentWidth(4)
        
        # 添加语法高亮
        self.highlighter = SQLSyntaxHighlighter(self.document())
        
        # 添加自动补全
        self.completer = SQLCompleter(self)
        self.completer.setWidget(self)
        
        # 启用代码折叠
        self.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)
        self.setWordWrapMode(QTextOption.WrapMode.NoWrap)
        
        # 信号连接
        self.textChanged.connect(self.on_text_changed)
        self.cursorPositionChanged.connect(self.on_cursor_position_changed)
    
    def update_completion(self, tables=None, columns=None):
        """更新补全列表"""
        if self.completer:
            self.completer.update_completion_list(tables, columns)
    
    def on_text_changed(self):
        """文本变化时的处理"""
        # 触发自动补全
        self.trigger_completion()
    
    def on_cursor_position_changed(self):
        """光标位置变化时的处理"""
        # 显示光标位置信息
        cursor = self.textCursor()
        line = cursor.blockNumber() + 1
        column = cursor.columnNumber() + 1
        if hasattr(self, 'parent') and hasattr(self.parent(), 'status_bar'):
            self.parent().status_bar.showMessage(f"行: {line}, 列: {column}")
    
    def keyPressEvent(self, event):
        """键盘事件处理"""
        # 检查是否是补全相关的按键
        if event.key() == Qt.Key.Key_Tab:
            # 检查是否有活动的补全
            if self.completer and self.completer.popup().isVisible():
                # 选择当前补全项
                self.completer.popup().hide()
                completion = self.completer.currentCompletion()
                if completion:
                    # 替换当前单词
                    cursor = self.textCursor()
                    cursor.select(QTextCursor.SelectionType.WordUnderCursor)
                    cursor.removeSelectedText()
                    cursor.insertText(completion)
                event.accept()
            else:
                # 插入4个空格而不是制表符
                self.insertPlainText('    ')
                event.accept()
        elif event.key() == Qt.Key.Key_Return or event.key() == Qt.Key.Key_Enter:
            # 检查是否有活动的补全
            if self.completer and self.completer.popup().isVisible():
                # 选择当前补全项
                self.completer.popup().hide()
                completion = self.completer.currentCompletion()
                if completion:
                    # 替换当前单词
                    cursor = self.textCursor()
                    cursor.select(QTextCursor.SelectionType.WordUnderCursor)
                    cursor.removeSelectedText()
                    cursor.insertText(completion)
                event.accept()
            else:
                # 自动缩进
                cursor = self.textCursor()
                block = cursor.block()
                text = block.text()
                
                # 计算缩进
                indent = 0
                for char in text:
                    if char == ' ': indent += 1
                    elif char == '\t': indent += 4
                    else: break
                
                # 检查是否需要增加缩进
                if text.strip().endswith('{') or text.strip().endswith('(') or text.strip().endswith('['):
                    indent += 4
                
                # 插入换行和缩进
                self.insertPlainText('\n' + ' ' * indent)
                event.accept()
        elif event.key() == Qt.Key.Key_BraceRight or event.key() == Qt.Key.Key_ParenRight or event.key() == Qt.Key.Key_BracketRight:
            # 自动匹配右括号
            cursor = self.textCursor()
            block = cursor.block()
            text = block.text()
            
            # 计算缩进
            indent = 0
            for char in text:
                if char == ' ': indent += 1
                elif char == '\t': indent += 4
                else: break
            
            # 插入右括号
            self.insertPlainText(event.text())
            
            # 检查是否需要减少缩进
            if indent >= 4 and (event.key() == Qt.Key.Key_BraceRight or event.key() == Qt.Key.Key_ParenRight or event.key() == Qt.Key.Key_BracketRight):
                # 减少缩进
                self.insertPlainText('\n' + ' ' * (indent - 4))
                # 移动光标到正确位置
                cursor = self.textCursor()
                cursor.movePosition(QTextCursor.MoveOperation.Left, QTextCursor.MoveMode.MoveAnchor, indent - 4)
                self.setTextCursor(cursor)
            event.accept()
        else:
            # 先处理按键事件
            super().keyPressEvent(event)
            # 然后触发自动补全
            self.trigger_completion()
    
    def trigger_completion(self):
        """触发自动补全"""
        # 获取当前光标位置
        cursor = self.textCursor()
        
        # 确定当前单词的范围
        start = cursor.position()
        # 向左查找单词的开始
        while start > 0:
            # 获取前一个字符
            char = self.document().characterAt(start - 1)
            if not char.isalnum() and char != '_':
                break
            start -= 1
        
        # 获取当前单词
        cursor.setPosition(start)
        cursor.setPosition(cursor.position(), QTextCursor.MoveMode.KeepAnchor)
        current_word = cursor.selectedText()
        
        # 如果没有选择到文本，尝试使用 WordUnderCursor
        if not current_word:
            cursor.select(QTextCursor.SelectionType.WordUnderCursor)
            current_word = cursor.selectedText()
        
        # 如果有输入内容，触发自动补全
        if current_word and current_word.isalnum():
            # 设置补全器的前缀
            self.completer.setCompletionPrefix(current_word)
            # 触发补全
            rect = self.cursorRect()
            # 调整补全弹窗的位置和大小
            rect.setWidth(300)  # 设置固定宽度
            self.completer.complete(rect)
        else:
            # 如果当前单词为空或不是字母数字，隐藏补全弹窗
            if self.completer and self.completer.popup().isVisible():
                self.completer.popup().hide()

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

class NavicatStyleSQLTool(QMainWindow):
    """Navicat风格的数据库管理工具"""
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Navicat Style - 数据库管理工具")
        self.setGeometry(100, 100, 1400, 900)
        
        # 初始化变量
        self.current_connection = None
        self.current_db = None
        self.current_db_type = None
        self.saved_connections = {}
        self.logger = OperationLogger()
        self.connection_groups = {}
        # 初始化连接池
        self.connection_pool = ConnectionPool(max_connections=5)
        
        # 加载保存的连接
        self.load_connections()
        
        # 创建主布局
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.main_layout = QVBoxLayout(self.central_widget)
        
        # 创建菜单栏
        self.create_menu_bar()
        
        # 创建工具栏
        self.create_toolbar()
        
        # 创建主分割器
        self.main_splitter = QSplitter(Qt.Orientation.Horizontal)
        self.main_layout.addWidget(self.main_splitter)
        
        # 创建左侧面板（连接管理器 + 对象浏览器）
        self.create_left_panel()
        
        # 创建右侧面板（标签页 + 状态栏）
        self.create_right_panel()
        
        # 设置分割器比例
        self.main_splitter.setSizes([200, 1200])
        
        # 创建状态栏
        self.create_status_bar()
        
        print("Navicat Style SQLTool初始化完成")
    
    def create_menu_bar(self):
        """创建菜单栏"""
        menu_bar = self.menuBar()
        
        # 文件菜单
        file_menu = menu_bar.addMenu("文件")
        file_menu.addAction("新建连接", self.new_connection)
        file_menu.addAction("编辑连接", self.edit_connection)
        file_menu.addAction("删除连接", self.delete_connection)
        file_menu.addSeparator()
        file_menu.addAction("新建查询", self.new_query)
        file_menu.addAction("打开SQL文件", self.open_sql_file)
        file_menu.addAction("保存SQL文件", self.save_sql_file)
        file_menu.addSeparator()
        file_menu.addAction("导入数据", self.import_data)
        file_menu.addAction("导出数据", self.export_data)
        file_menu.addSeparator()
        file_menu.addAction("退出", self.close)
        
        # 编辑菜单
        edit_menu = menu_bar.addMenu("编辑")
        edit_menu.addAction("复制", lambda: self.copy_sql())
        edit_menu.addAction("粘贴", lambda: self.paste_sql())
        edit_menu.addAction("剪切", lambda: self.cut_sql())
        edit_menu.addSeparator()
        edit_menu.addAction("全选", lambda: self.select_all_sql())
        edit_menu.addAction("查找", self.find_sql)
        edit_menu.addAction("替换", self.replace_sql)
        
        # 数据库菜单
        db_menu = menu_bar.addMenu("数据库")
        db_menu.addAction("新建数据库", self.create_database)
        db_menu.addAction("删除数据库", self.drop_database)
        db_menu.addSeparator()
        db_menu.addAction("备份数据库", self.backup_database)
        db_menu.addAction("还原数据库", self.restore_database)
        db_menu.addSeparator()
        db_menu.addAction("数据同步", self.sync_data)
        db_menu.addAction("结构同步", self.sync_structure)
        
        # 工具菜单
        tool_menu = menu_bar.addMenu("工具")
        tool_menu.addAction("SQL格式化", self.format_sql)
        tool_menu.addAction("执行计划", self.explain_sql)
        tool_menu.addSeparator()
        tool_menu.addAction("ER图表", self.generate_er_diagram)
        tool_menu.addAction("数据传输", self.transfer_data)
        tool_menu.addSeparator()
        tool_menu.addAction("计划任务", self.scheduled_tasks)
        
        # 视图菜单
        view_menu = menu_bar.addMenu("视图")
        view_menu.addAction("刷新", self.refresh_objects)
        view_menu.addSeparator()
        view_menu.addAction("显示/隐藏对象浏览器", self.toggle_object_browser)
        view_menu.addAction("显示/隐藏状态栏", self.toggle_status_bar)
        view_menu.addSeparator()
        view_menu.addAction("深色模式", self.toggle_dark_mode)
        
        # 帮助菜单
        help_menu = menu_bar.addMenu("帮助")
        help_menu.addAction("使用帮助", self.show_help)
        help_menu.addAction("关于", self.about)
    
    def create_toolbar(self):
        """创建工具栏"""
        # 主工具栏
        self.main_toolbar = self.addToolBar("主工具栏")
        self.main_toolbar.setIconSize(QSize(16, 16))
        self.main_toolbar.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextBesideIcon)
        
        # 设置工具栏样式 - 完全匹配Navicat
        self.main_toolbar.setStyleSheet("""
            QToolBar {
                background-color: #f0f0f0;
                border: 1px solid #d0d0d0;
                padding: 3px;
                spacing: 1px;
            }
            QToolButton {
                padding: 5px 10px;
                font-size: 10px;
                font-family: Arial;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
                background-color: #ffffff;
            }
            QToolButton:hover {
                background-color: #e8e8e8;
                border: 1px solid #c0c0c0;
            }
            QToolButton:pressed {
                background-color: #d0d0d0;
                border: 1px solid #b0b0b0;
            }
        """)
        
        # 创建图标
        def create_icon(text):
            """创建简单图标"""
            from PyQt6.QtGui import QPixmap, QPainter
            pixmap = QPixmap(16, 16)
            pixmap.fill(Qt.GlobalColor.transparent)
            painter = QPainter(pixmap)
            painter.drawText(2, 12, text[0])
            painter.end()
            return QIcon(pixmap)
        
        # 按钮排列 - 完全按照Navicat的顺序
        # 新建连接
        self.new_conn_action = QAction(create_icon("新建"), "新建连接", self)
        self.new_conn_action.setToolTip("新建数据库连接")
        self.new_conn_action.triggered.connect(self.new_connection)
        self.main_toolbar.addAction(self.new_conn_action)
        
        # 新建查询
        self.new_query_action = QAction(create_icon("查询"), "新建查询", self)
        self.new_query_action.setToolTip("新建SQL查询")
        self.new_query_action.triggered.connect(self.new_query)
        self.main_toolbar.addAction(self.new_query_action)
        
        # 打开表
        self.open_table_action = QAction(create_icon("打开"), "打开表", self)
        self.open_table_action.setToolTip("打开表")
        self.open_table_action.triggered.connect(lambda: self.show_feature_not_implemented("打开表"))
        self.main_toolbar.addAction(self.open_table_action)
        
        # 设计表
        self.design_table_action = QAction(create_icon("设计"), "设计表", self)
        self.design_table_action.setToolTip("设计表")
        self.design_table_action.triggered.connect(lambda: self.show_feature_not_implemented("设计表"))
        self.main_toolbar.addAction(self.design_table_action)
        
        # 数据传输
        self.transfer_action = QAction(create_icon("传输"), "数据传输", self)
        self.transfer_action.setToolTip("数据传输")
        self.transfer_action.triggered.connect(self.transfer_data)
        self.main_toolbar.addAction(self.transfer_action)
        
        # 导入向导
        self.import_wizard_action = QAction(create_icon("导入"), "导入向导", self)
        self.import_wizard_action.setToolTip("导入向导")
        self.import_wizard_action.triggered.connect(self.import_data)
        self.main_toolbar.addAction(self.import_wizard_action)
        
        # 导出向导
        self.export_wizard_action = QAction(create_icon("导出"), "导出向导", self)
        self.export_wizard_action.setToolTip("导出向导")
        self.export_wizard_action.triggered.connect(self.export_data)
        self.main_toolbar.addAction(self.export_wizard_action)
        
        # 自动运行
        self.auto_run_action = QAction(create_icon("自动"), "自动运行", self)
        self.auto_run_action.setToolTip("自动运行")
        self.auto_run_action.triggered.connect(lambda: self.show_feature_not_implemented("自动运行"))
        self.main_toolbar.addAction(self.auto_run_action)
        
        # 模型
        self.model_action = QAction(create_icon("模型"), "模型", self)
        self.model_action.setToolTip("数据库模型")
        self.model_action.triggered.connect(self.generate_er_diagram)
        self.main_toolbar.addAction(self.model_action)
        
        # 添加分隔符
        self.main_toolbar.addSeparator()
        
        # 执行按钮
        self.execute_action = QAction(create_icon("执行"), "执行", self)
        self.execute_action.setToolTip("执行SQL")
        self.execute_action.triggered.connect(self.execute_sql)
        self.main_toolbar.addAction(self.execute_action)
        
        # 提交按钮
        self.commit_action = QAction(create_icon("提交"), "提交", self)
        self.commit_action.setToolTip("提交事务")
        self.commit_action.triggered.connect(self.commit_transaction)
        self.main_toolbar.addAction(self.commit_action)
        
        # 回滚按钮
        self.rollback_action = QAction(create_icon("回滚"), "回滚", self)
        self.rollback_action.setToolTip("回滚事务")
        self.rollback_action.triggered.connect(self.rollback_transaction)
        self.main_toolbar.addAction(self.rollback_action)
    
    def create_left_panel(self):
        """创建左侧面板"""
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_panel.setStyleSheet("QWidget { background-color: #ffffff; border-right: 1px solid #d0d0d0; }")
        
        # 添加标签页
        self.left_tab_widget = QTabWidget()
        self.left_tab_widget.setTabPosition(QTabWidget.TabPosition.North)
        self.left_tab_widget.setMinimumWidth(200)
        self.left_tab_widget.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #d0d0d0;
                background-color: #ffffff;
            }
            QTabBar::tab {
                padding: 6px 12px;
                font-size: 10px;
                font-family: Arial;
                background-color: #f8f8f8;
                border: 1px solid #d0d0d0;
                border-bottom: none;
                margin-right: 2px;
            }
            QTabBar::tab:selected {
                background-color: #ffffff;
                border-bottom: 1px solid #ffffff;
            }
            QTabBar::tab:hover {
                background-color: #e8e8e8;
            }
        """)
        
        # 连接标签页
        conn_tab = QWidget()
        conn_layout = QVBoxLayout(conn_tab)
        conn_layout.setContentsMargins(0, 0, 0, 0)
        
        # 连接树
        self.connection_tree = QTreeWidget()
        self.connection_tree.setHeaderLabel("")
        self.connection_tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.connection_tree.customContextMenuRequested.connect(self.on_connection_context_menu)
        self.connection_tree.itemDoubleClicked.connect(self.on_connection_double_clicked)
        self.connection_tree.setIndentation(15)
        self.connection_tree.setStyleSheet("""
            QTreeWidget {
                background-color: #ffffff;
                border: none;
                font-size: 10px;
                font-family: Arial;
            }
            QTreeWidget::item {
                padding: 2px 0;
                height: 18px;
            }
            QTreeWidget::item:selected {
                background-color: #e0e0e0;
                color: #000000;
            }
            QTreeWidget::item:hover {
                background-color: #f0f0f0;
            }
        """)
        conn_layout.addWidget(self.connection_tree)
        
        # 添加按钮
        conn_buttons = QHBoxLayout()
        conn_buttons.setContentsMargins(5, 5, 5, 5)
        conn_layout.addLayout(conn_buttons)
        
        self.add_conn_btn = QPushButton("+ 新建连接")
        self.add_conn_btn.clicked.connect(self.new_connection)
        self.add_conn_btn.setStyleSheet("""
            QPushButton {
                padding: 4px 8px;
                font-size: 10px;
                font-family: Arial;
                background-color: #f0f0f0;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #d0d0d0;
                border: 1px solid #b0b0b0;
            }
        """)
        conn_buttons.addWidget(self.add_conn_btn)
        
        self.add_group_btn = QPushButton("+ 新建组")
        self.add_group_btn.clicked.connect(self.new_connection_group)
        self.add_group_btn.setStyleSheet("""
            QPushButton {
                padding: 4px 8px;
                font-size: 10px;
                font-family: Arial;
                background-color: #f0f0f0;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #d0d0d0;
                border: 1px solid #b0b0b0;
            }
        """)
        conn_buttons.addWidget(self.add_group_btn)
        
        self.left_tab_widget.addTab(conn_tab, "连接")
        
        # 对象标签页
        obj_tab = QWidget()
        obj_layout = QVBoxLayout(obj_tab)
        obj_layout.setContentsMargins(0, 0, 0, 0)
        
        # 对象树
        self.object_tree = QTreeWidget()
        self.object_tree.setHeaderLabel("")
        self.object_tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        # 确保信号正确连接
        # 只连接信号，不尝试断开未连接的信号
        self.object_tree.customContextMenuRequested.connect(self.on_object_context_menu)
        self.object_tree.itemDoubleClicked.connect(self.on_object_double_clicked)
        self.object_tree.setIndentation(15)
        self.object_tree.setStyleSheet("""
            QTreeWidget {
                background-color: #ffffff;
                border: none;
                font-size: 10px;
                font-family: Arial;
            }
            QTreeWidget::item {
                padding: 2px 0;
                height: 18px;
            }
            QTreeWidget::item:selected {
                background-color: #e0e0e0;
                color: #000000;
            }
            QTreeWidget::item:hover {
                background-color: #f0f0f0;
            }
        """)
        obj_layout.addWidget(self.object_tree)
        
        self.left_tab_widget.addTab(obj_tab, "对象")
        
        left_layout.addWidget(self.left_tab_widget)
        
        self.main_splitter.addWidget(left_panel)
        
        # 加载连接到树
        self.load_connections_to_tree()
    

    
    def update_object_browser(self, connection_name):
        """更新对象浏览器"""
        self.object_tree.clear()
        
        if not connection_name:
            return
        
        # 模拟数据库对象结构
        conn_item = QTreeWidgetItem(self.object_tree, [connection_name])
        conn_item.setData(0, Qt.ItemDataRole.UserRole, ('connection', connection_name))
        
        # 数据库节点
        db_item = QTreeWidgetItem(conn_item, ['数据库'])
        db_item.setData(0, Qt.ItemDataRole.UserRole, ('database', 'test_db'))
        
        # 表节点
        tables_item = QTreeWidgetItem(db_item, ['表'])
        tables_item.setData(0, Qt.ItemDataRole.UserRole, ('tables', 'test_db'))
        
        # 示例表
        table1_item = QTreeWidgetItem(tables_item, ['users'])
        table1_item.setData(0, Qt.ItemDataRole.UserRole, ('table', 'users'))
        
        table2_item = QTreeWidgetItem(tables_item, ['products'])
        table2_item.setData(0, Qt.ItemDataRole.UserRole, ('table', 'products'))
        
        table3_item = QTreeWidgetItem(tables_item, ['orders'])
        table3_item.setData(0, Qt.ItemDataRole.UserRole, ('table', 'orders'))
        
        table4_item = QTreeWidgetItem(tables_item, ['categories'])
        table4_item.setData(0, Qt.ItemDataRole.UserRole, ('table', 'categories'))
        
        # 视图节点
        views_item = QTreeWidgetItem(db_item, ['视图'])
        views_item.setData(0, Qt.ItemDataRole.UserRole, ('views', 'test_db'))
        
        view1_item = QTreeWidgetItem(views_item, ['v_user_info'])
        view1_item.setData(0, Qt.ItemDataRole.UserRole, ('view', 'v_user_info'))
        
        # 存储过程节点
        procs_item = QTreeWidgetItem(db_item, ['存储过程'])
        procs_item.setData(0, Qt.ItemDataRole.UserRole, ('procedures', 'test_db'))
        
        proc1_item = QTreeWidgetItem(procs_item, ['sp_get_user'])
        proc1_item.setData(0, Qt.ItemDataRole.UserRole, ('procedure', 'sp_get_user'))
        
        # 函数节点
        funcs_item = QTreeWidgetItem(db_item, ['函数'])
        funcs_item.setData(0, Qt.ItemDataRole.UserRole, ('functions', 'test_db'))
        
        func1_item = QTreeWidgetItem(funcs_item, ['fn_calculate_price'])
        func1_item.setData(0, Qt.ItemDataRole.UserRole, ('function', 'fn_calculate_price'))
        
        # 触发器节点
        triggers_item = QTreeWidgetItem(db_item, ['触发器'])
        triggers_item.setData(0, Qt.ItemDataRole.UserRole, ('triggers', 'test_db'))
        
        trigger1_item = QTreeWidgetItem(triggers_item, ['trg_user_insert'])
        trigger1_item.setData(0, Qt.ItemDataRole.UserRole, ('trigger', 'trg_user_insert'))
        
        # 索引节点
        indexes_item = QTreeWidgetItem(db_item, ['索引'])
        indexes_item.setData(0, Qt.ItemDataRole.UserRole, ('indexes', 'test_db'))
        
        # 序列节点（PostgreSQL）
        sequences_item = QTreeWidgetItem(db_item, ['序列'])
        sequences_item.setData(0, Qt.ItemDataRole.UserRole, ('sequences', 'test_db'))
        
        # 同义词节点
        synonyms_item = QTreeWidgetItem(db_item, ['同义词'])
        synonyms_item.setData(0, Qt.ItemDataRole.UserRole, ('synonyms', 'test_db'))
        
        # 类型节点
        types_item = QTreeWidgetItem(db_item, ['类型'])
        types_item.setData(0, Qt.ItemDataRole.UserRole, ('types', 'test_db'))
        
        # 展开节点
        conn_item.setExpanded(True)
        db_item.setExpanded(True)
        tables_item.setExpanded(True)
        views_item.setExpanded(True)
        procs_item.setExpanded(True)
    
    def create_right_panel(self):
        """创建右侧面板"""
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_panel.setStyleSheet("QWidget { background-color: #f8f8f8; }")
        
        # 标签页
        self.tabs = QTabWidget()
        self.tabs.setTabsClosable(True)
        self.tabs.tabCloseRequested.connect(self.close_tab)
        self.tabs.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #d0d0d0;
                background-color: #ffffff;
            }
            QTabBar::tab {
                padding: 6px 12px;
                font-size: 10px;
                font-family: Arial;
                background-color: #f0f0f0;
                border: 1px solid #d0d0d0;
                border-bottom: none;
                margin-right: 2px;
            }
            QTabBar::tab:selected {
                background-color: #ffffff;
                border-bottom: 1px solid #ffffff;
            }
            QTabBar::tab:hover {
                background-color: #e8e8e8;
            }
            QTabBar::close-button {
                image: url(:/close.png);
                subcontrol-position: right;
                subcontrol-origin: margin;
                width: 12px;
                height: 12px;
                margin: 0 4px 0 4px;
            }
            QTabBar::close-button:hover {
                background-color: #e0e0e0;
                border-radius: 6px;
            }
        """)
        right_layout.addWidget(self.tabs)
        
        # 添加默认标签页
        self.add_new_query_tab()
        
        self.main_splitter.addWidget(right_panel)
    
    def create_status_bar(self):
        """创建状态栏"""
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        
        # 设置状态栏样式
        self.status_bar.setStyleSheet("""
            QStatusBar {
                background-color: #f0f0f0;
                border-top: 1px solid #d0d0d0;
                font-size: 10px;
                font-family: Arial;
                padding: 2px 10px;
            }
            QStatusBar QLabel {
                margin-right: 15px;
                color: #333;
            }
        """)
        
        # 连接状态
        self.connection_status = QLabel("未连接")
        self.status_bar.addWidget(self.connection_status)
        
        # 执行时间
        self.execution_time = QLabel("")
        self.status_bar.addWidget(self.execution_time)
        
        # 记录数
        self.record_count = QLabel("")
        self.status_bar.addWidget(self.record_count)
        
        # 右下角信息
        self.status_info = QLabel("就绪")
        self.status_bar.addPermanentWidget(self.status_info)
    
    def load_connections(self):
        """加载保存的连接"""
        conn_file = "connections.json"
        if os.path.exists(conn_file):
            try:
                with open(conn_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.saved_connections = data.get('connections', {})
                    self.connection_groups = data.get('groups', {})
            except Exception as e:
                self.logger.log('ERROR', f"加载连接失败: {e}")
        else:
            # 示例连接
            self.saved_connections = {
                'Local MySQL': {
                    'type': 'MySQL',
                    'host': 'localhost',
                    'port': 3306,
                    'username': 'root',
                    'password': '',
                    'database': ''
                },
                'Local PostgreSQL': {
                    'type': 'PostgreSQL',
                    'host': 'localhost',
                    'port': 5432,
                    'username': 'postgres',
                    'password': '',
                    'database': ''
                }
            }
    
    def load_connections_to_tree(self, show_only_current=False):
        """加载连接到树"""
        self.connection_tree.clear()
        
        # 添加连接组
        for group_name, connections in self.connection_groups.items():
            # 过滤连接
            filtered_connections = []
            for conn_name in connections:
                if not show_only_current or conn_name == self.current_connection:
                    filtered_connections.append(conn_name)
            
            if filtered_connections:
                group_item = QTreeWidgetItem(self.connection_tree, [group_name])
                group_item.setData(0, Qt.ItemDataRole.UserRole, ('group', group_name))
                
                for conn_name in filtered_connections:
                    if conn_name in self.saved_connections:
                        conn_item = QTreeWidgetItem(group_item, [conn_name])
                        conn_item.setData(0, Qt.ItemDataRole.UserRole, ('connection', conn_name))
        
        # 添加未分组的连接
        for conn_name, conn_data in self.saved_connections.items():
            # 检查是否已在组中
            in_group = False
            for group_name, connections in self.connection_groups.items():
                if conn_name in connections:
                    in_group = True
                    break
            
            if not in_group and (not show_only_current or conn_name == self.current_connection):
                conn_item = QTreeWidgetItem(self.connection_tree, [conn_name])
                conn_item.setData(0, Qt.ItemDataRole.UserRole, ('connection', conn_name))
        
        # 展开所有节点
        def expand_all_items(tree):
            for i in range(tree.topLevelItemCount()):
                item = tree.topLevelItem(i)
                item.setExpanded(True)
                expand_all_children(item)
        
        def expand_all_children(item):
            for i in range(item.childCount()):
                child = item.child(i)
                child.setExpanded(True)
                expand_all_children(child)
        
        expand_all_items(self.connection_tree)
    
    def save_connections(self):
        """保存连接"""
        conn_file = "connections.json"
        try:
            data = {
                'connections': self.saved_connections,
                'groups': self.connection_groups
            }
            with open(conn_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self.logger.log('INFO', f"保存了 {len(self.saved_connections)} 个连接")
        except Exception as e:
            self.logger.log('ERROR', f"保存连接失败: {e}")
    
    def update_query_tab_info(self):
        """更新所有查询标签页的连接信息和数据库信息"""
        for i in range(self.tabs.count()):
            tab_widget = self.tabs.widget(i)
            if not tab_widget:
                continue
            
            # 查找连接信息栏
            for widget in tab_widget.findChildren(QWidget):
                # 检查是否是连接信息栏
                if widget.children() and isinstance(widget.children()[0], QHBoxLayout):
                    # 查找连接标签和数据库标签
                    for child in widget.findChildren(QLabel):
                        text = child.text()
                        if text.startswith("连接:"):
                            if hasattr(self, 'current_connection') and self.current_connection:
                                child.setText(f"连接: {self.current_connection}")
                            else:
                                child.setText("连接: 未连接")
                        elif text.startswith("数据库:"):
                            if hasattr(self, 'current_db') and self.current_db:
                                child.setText(f"数据库: {self.current_db}")
                            else:
                                child.setText("数据库: 未选择")
                    break
    
    def add_new_query_tab(self):
        """添加新的查询标签页"""
        tab_widget = QWidget()
        tab_layout = QVBoxLayout(tab_widget)
        tab_layout.setContentsMargins(0, 0, 0, 0)
        
        # 创建连接信息标签栏 - 完全匹配Navicat
        conn_info_bar = QWidget()
        conn_info_bar.setStyleSheet("""
            QWidget {
                background-color: #f0f0f0;
                border-bottom: 1px solid #d0d0d0;
                padding: 4px 12px;
            }
        """)
        conn_info_layout = QHBoxLayout(conn_info_bar)
        conn_info_layout.setContentsMargins(0, 0, 0, 0)
        conn_info_layout.setSpacing(12)
        
        # 连接信息
        conn_label = QLabel()
        if hasattr(self, 'current_connection') and self.current_connection:
            conn_label.setText(f"连接: {self.current_connection}")
        else:
            conn_label.setText("连接: 未连接")
        conn_label.setStyleSheet("""
            QLabel {
                font-size: 10px;
                color: #333;
                font-family: Arial;
                padding: 3px 0;
            }
        """)
        conn_info_layout.addWidget(conn_label)
        
        # 数据库信息
        db_label = QLabel()
        if hasattr(self, 'current_db') and self.current_db:
            db_label.setText(f"数据库: {self.current_db}")
        else:
            db_label.setText("数据库: 未选择")
        db_label.setStyleSheet("""
            QLabel {
                font-size: 10px;
                color: #333;
                font-family: Arial;
                padding: 3px 0;
            }
        """)
        conn_info_layout.addWidget(db_label)
        
        # 执行按钮
        exec_btn = QPushButton("执行")
        exec_btn.setStyleSheet("""
            QPushButton {
                padding: 3px 10px;
                font-size: 10px;
                font-family: Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #e8e8e8;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #d0d0d0;
                border: 1px solid #b0b0b0;
            }
        """)
        exec_btn.clicked.connect(self.execute_sql)
        conn_info_layout.addWidget(exec_btn)
        
        # 提交按钮
        commit_btn = QPushButton("提交")
        commit_btn.setStyleSheet("""
            QPushButton {
                padding: 3px 10px;
                font-size: 10px;
                font-family: Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #e8e8e8;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #d0d0d0;
                border: 1px solid #b0b0b0;
            }
        """)
        commit_btn.clicked.connect(self.commit_transaction)
        conn_info_layout.addWidget(commit_btn)
        
        # 回滚按钮
        rollback_btn = QPushButton("回滚")
        rollback_btn.setStyleSheet("""
            QPushButton {
                padding: 3px 10px;
                font-size: 10px;
                font-family: Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
            }
            QPushButton:hover {
                background-color: #e8e8e8;
                border: 1px solid #c0c0c0;
            }
            QPushButton:pressed {
                background-color: #d0d0d0;
                border: 1px solid #b0b0b0;
            }
        """)
        rollback_btn.clicked.connect(self.rollback_transaction)
        conn_info_layout.addWidget(rollback_btn)
        
        conn_info_layout.addStretch()
        
        tab_layout.addWidget(conn_info_bar)
        
        # 创建主分隔器（SQL编辑器和结果区域之间）
        main_splitter = QSplitter(Qt.Orientation.Vertical)
        # 启用分隔条拖动
        main_splitter.setHandleWidth(4)
        main_splitter.setStyleSheet("""
            QSplitter::handle {
                background-color: #d0d0d0;
            }
            QSplitter::handle:hover {
                background-color: #b0b0b0;
            }
        """)
        
        # 创建SQL编辑器
        sql_editor = SQLTextEdit()
        sql_editor.setStyleSheet("""
            QTextEdit {
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                font-family: Consolas;
                font-size: 10px;
                padding: 4px;
            }
        """)
        main_splitter.addWidget(sql_editor)
        
        # 创建结果区域
        result_widget = QWidget()
        result_layout = QVBoxLayout(result_widget)
        result_layout.setContentsMargins(0, 0, 0, 0)
        
        # 查询结果表格
        result_table = QTableWidget()
        result_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        result_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        result_table.setShowGrid(True)
        result_table.setGridStyle(Qt.PenStyle.DotLine)
        result_table.setStyleSheet("""
            QTableWidget {
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                font-size: 10px;
                font-family: Arial;
            }
            QTableWidget::header {
                background-color: #f0f0f0;
                border-bottom: 1px solid #d0d0d0;
                padding: 3px;
                font-size: 10px;
                font-family: Arial;
            }
            QTableWidget::item {
                padding: 3px 6px;
            }
            QTableWidget::item:selected {
                background-color: #e0e0e0;
                color: #000000;
            }
        """)
        # 将结果表格添加到布局，设置为可伸缩
        result_layout.addWidget(result_table, 1)  # 1表示占用剩余空间
        
        # 消息输出 - 调整为一行展示，放在结果集数据的底部
        message_output = QTextEdit()
        message_output.setReadOnly(True)
        message_output.setMaximumHeight(30)  # 调整为单行高度
        message_output.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)  # 禁止自动换行
        message_output.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)  # 隐藏水平滚动条
        message_output.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)  # 隐藏垂直滚动条
        message_output.setStyleSheet("""
            QTextEdit {
                font-family: Consolas;
                font-size: 10px;
                background-color: #f8f8f8;
                border: 1px solid #d0d0d0;
                border-top: none;
                padding: 3px 6px;
            }
        """)
        # 将消息输出添加到布局，设置为不可伸缩
        result_layout.addWidget(message_output, 0)  # 0表示不占用额外空间
        
        main_splitter.addWidget(result_widget)
        tab_layout.addWidget(main_splitter)
        
        # 设置分割器比例
        main_splitter.setSizes([300, 200])
        
        # 添加标签页
        tab_index = self.tabs.addTab(tab_widget, f"查询 {self.tabs.count() + 1}")
        self.tabs.setCurrentIndex(tab_index)
    
    # 事件处理方法
    def new_connection(self):
        """新建连接"""
        dialog = ConnectionDialog(self)
        if dialog.exec():
            conn_data = dialog.result
            self.saved_connections[conn_data['name']] = conn_data
            self.load_connections_to_tree()
            self.save_connections()
            self.logger.log('INFO', f"新建连接: {conn_data['name']}")
    
    def edit_connection(self):
        """编辑连接"""
        # 获取当前选中的连接
        selected_items = self.connection_tree.selectedItems()
        if not selected_items:
            QMessageBox.warning(self, "编辑连接", "请先选择一个连接")
            return
        
        item = selected_items[0]
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and data[0] == 'connection':
            conn_name = data[1]
            conn_data = self.saved_connections.get(conn_name)
            if conn_data:
                dialog = ConnectionDialog(self, conn_data)
                if dialog.exec():
                    new_conn_data = dialog.result
                    # 如果连接名称改变，需要更新字典键
                    if new_conn_data['name'] != conn_name:
                        del self.saved_connections[conn_name]
                        # 同时从连接组中移除旧名称
                        for group_name, connections in self.connection_groups.items():
                            if conn_name in connections:
                                connections.remove(conn_name)
                                connections.append(new_conn_data['name'])
                    self.saved_connections[new_conn_data['name']] = new_conn_data
                    self.load_connections_to_tree()
                    self.save_connections()
                    self.logger.log('INFO', f"编辑连接: {new_conn_data['name']}")
    
    def delete_connection(self):
        """删除连接"""
        # 获取当前选中的连接
        selected_items = self.connection_tree.selectedItems()
        if not selected_items:
            QMessageBox.warning(self, "删除连接", "请先选择一个连接")
            return
        
        item = selected_items[0]
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and data[0] == 'connection':
            conn_name = data[1]
            if QMessageBox.question(self, "删除连接", f"确定要删除连接 '{conn_name}' 吗？", 
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes:
                # 从连接组中移除
                for group_name, connections in self.connection_groups.items():
                    if conn_name in connections:
                        connections.remove(conn_name)
                # 从保存的连接中删除
                if conn_name in self.saved_connections:
                    del self.saved_connections[conn_name]
                self.load_connections_to_tree()
                self.save_connections()
                self.logger.log('INFO', f"删除连接: {conn_name}")
    
    def show_feature_not_implemented(self, feature_name):
        """显示功能未实现的提示"""
        QMessageBox.information(self, feature_name, f"{feature_name}功能开发中...")
        self.logger.log('INFO', f"用户尝试使用未实现的功能: {feature_name}")
    
    def new_connection_group(self):
        """新建连接组"""
        group_name, ok = QInputDialog.getText(self, "新建连接组", "请输入连接组名称:")
        if ok and group_name:
            if group_name not in self.connection_groups:
                self.connection_groups[group_name] = []
                self.load_connections_to_tree()
                self.save_connections()
                self.logger.log('INFO', f"新建连接组: {group_name}")
    
    def new_query(self):
        """新建查询"""
        self.add_new_query_tab()
        self.logger.log('INFO', "新建查询标签页")
    
    def execute_sql(self):
        """执行SQL"""
        try:
            current_tab = self.tabs.currentWidget()
            if not current_tab:
                QMessageBox.warning(self, "执行SQL", "没有打开的查询标签页")
                self.logger.warning("尝试执行SQL但没有打开的查询标签页")
                return
            
            # 获取SQL编辑器
            sql_editor = None
            result_table = None
            message_output = None
            
            # 遍历子部件找到SQL编辑器和结果区域
            # 使用递归查找所有子部件
            for widget in current_tab.findChildren(QWidget):
                if isinstance(widget, SQLTextEdit):
                    sql_editor = widget
                elif isinstance(widget, QTableWidget):
                    result_table = widget
                elif isinstance(widget, QTextEdit) and not isinstance(widget, SQLTextEdit):
                    # 确保只选择普通QTextEdit作为消息输出，排除SQLTextEdit
                    message_output = widget
            
            # 如果没有找到，尝试遍历分割器中的部件
            if not result_table or not message_output:
                for widget in current_tab.findChildren(QSplitter):
                    for splitter_widget in widget.findChildren(QWidget):
                        if isinstance(splitter_widget, QTableWidget):
                            result_table = splitter_widget
                        elif isinstance(splitter_widget, QTextEdit) and not isinstance(splitter_widget, SQLTextEdit):
                            message_output = splitter_widget
            
            if not sql_editor:
                QMessageBox.warning(self, "执行SQL", "无法找到SQL编辑器")
                self.logger.warning("尝试执行SQL但无法找到SQL编辑器")
                return
            
            # 检查是否有选中的文本
            cursor = sql_editor.textCursor()
            if cursor.hasSelection():
                # 执行选中的文本
                sql = cursor.selectedText()
            else:
                # 执行整个编辑器的内容
                sql = sql_editor.toPlainText()
            
            if not sql.strip():
                QMessageBox.warning(self, "执行SQL", "请输入SQL语句")
                self.logger.warning("尝试执行SQL但SQL语句为空")
                return
            
            # 检查是否已连接数据库
            if not hasattr(self, 'db_connection'):
                QMessageBox.warning(self, "执行SQL", "请先连接到数据库")
                self.logger.warning("尝试执行SQL但未连接到数据库")
                return
            
            # 显示执行中的提示
            if message_output:
                message_output.setPlainText("SQL执行中...")
            
            # 记录SQL执行开始
            self.logger.info(f"开始执行SQL语句: {sql[:100]}...")
            
            # 导入必要的模块
            from PyQt6.QtCore import QRunnable, QThreadPool, pyqtSignal, QObject
            
            # 定义信号类
            class WorkerSignals(QObject):
                finished = pyqtSignal(dict)
                error = pyqtSignal(str)
            
            # 定义工作线程
            class SQLWorker(QRunnable):
                def __init__(self, sql, db_connection, db_type, parent):
                    super().__init__()
                    self.sql = sql
                    self.db_connection = db_connection
                    self.db_type = db_type
                    self.parent = parent
                    self.signals = WorkerSignals()
                
                def run(self):
                    start_time = time.time()
                    try:
                        results = None
                        affected_rows = 0
                        
                        # 执行SQL
                        if self.db_type == 'MySQL' or self.db_type == 'PostgreSQL':
                            with self.db_connection.cursor() as cursor:
                                cursor.execute(self.sql)
                                
                                # 检查是否是查询语句
                                if self.sql.strip().upper().startswith('SELECT') or self.sql.strip().upper().startswith('SHOW'):
                                    # 获取结果
                                    results = cursor.fetchall()
                                else:
                                    # 非查询语句，获取影响行数
                                    affected_rows = cursor.rowcount
                                    if self.db_type == 'MySQL':
                                        self.db_connection.commit()
                        
                        elif self.db_type == 'SQLite':
                            cursor = self.db_connection.cursor()
                            cursor.execute(self.sql)
                            
                            # 检查是否是查询语句
                            if self.sql.strip().upper().startswith('SELECT'):
                                # 获取结果
                                results = cursor.fetchall()
                            else:
                                # 非查询语句，获取影响行数
                                affected_rows = cursor.rowcount
                                self.db_connection.commit()
                        
                        elif self.db_type == 'SQL Server':
                            cursor = self.db_connection.cursor()
                            cursor.execute(self.sql)
                            
                            # 检查是否是查询语句
                            if self.sql.strip().upper().startswith('SELECT') or self.sql.strip().upper().startswith('SHOW'):
                                # 获取结果
                                results = cursor.fetchall()
                            else:
                                # 非查询语句，获取影响行数
                                affected_rows = cursor.rowcount
                                self.db_connection.commit()
                        
                        execution_time = time.time() - start_time
                        
                        # 发送结果
                        self.signals.finished.emit({
                            'results': results,
                            'affected_rows': affected_rows,
                            'execution_time': execution_time
                        })
                        
                    except Exception as e:
                        self.signals.error.emit(str(e))
            
            # 创建工作线程
            worker = SQLWorker(sql, self.db_connection, self.current_db_type, self)
            
            # 连接信号
            def on_finished(result):
                try:
                    # 清空结果
                    if result_table:
                        result_table.setRowCount(0)
                        result_table.setColumnCount(0)
                    
                    # 处理结果
                    results = result['results']
                    affected_rows = result['affected_rows']
                    execution_time = result['execution_time']
                    
                    if results and result_table:
                        try:
                            # 设置列
                            if self.current_db_type == 'MySQL' or self.current_db_type == 'PostgreSQL':
                                columns = list(results[0].keys()) if isinstance(results[0], dict) else [f'列{i+1}' for i in range(len(results[0]))]
                            elif self.current_db_type == 'SQL Server':
                                # 尝试获取列名，如果失败则使用默认列名
                                try:
                                    # 注意：这里无法直接访问cursor，因为它在工作线程中
                                    columns = [f'列{i+1}' for i in range(len(results[0]))]
                                except:
                                    columns = [f'列{i+1}' for i in range(len(results[0]))]
                            else:
                                columns = [f'列{i+1}' for i in range(len(results[0]))]
                            
                            result_table.setColumnCount(len(columns))
                            result_table.setHorizontalHeaderLabels(columns)
                            
                            # 添加数据
                            result_table.setRowCount(len(results))
                            for row_idx, row_data in enumerate(results):
                                row_values = list(row_data.values()) if isinstance(row_data, dict) else row_data
                                for col_idx, value in enumerate(row_values):
                                    item = QTableWidgetItem(str(value))
                                    result_table.setItem(row_idx, col_idx, item)
                            
                            # 调整列宽
                            result_table.resizeColumnsToContents()
                        except Exception as e:
                            self.logger.error("处理查询结果时出错", exception=e)
                            if message_output:
                                message_output.setPlainText(f"SQL执行成功但处理结果时出错: {e}")
                    
                    # 显示执行信息
                    if message_output:
                        message_output.setPlainText(f"SQL执行成功 | 执行时间: {execution_time:.4f} 秒 | 影响行数: {affected_rows if affected_rows else len(results) if results else 0}")
                    
                    # 更新状态栏
                    self.execution_time.setText(f"执行时间: {execution_time:.4f} 秒")
                    if results:
                        self.record_count.setText(f"记录数: {len(results)}")
                    else:
                        self.record_count.setText(f"影响行数: {affected_rows}")
                    self.status_info.setText("SQL执行成功")
                    
                    self.logger.info(f"执行SQL语句成功，执行时间: {execution_time:.4f} 秒，影响行数: {affected_rows if affected_rows else len(results) if results else 0}")
                except Exception as e:
                    self.logger.error("处理SQL执行结果时出错", exception=e)
                    if message_output:
                        message_output.setPlainText(f"处理SQL执行结果时出错: {e}")
                    self.status_info.setText("处理结果失败")
            
            def on_error(error):
                # 显示错误信息
                if message_output:
                    message_output.setPlainText(f"SQL执行失败 | 错误信息: {error}")
                
                # 更新状态栏
                self.status_info.setText("SQL执行失败")
                
                QMessageBox.critical(self, "执行SQL", f"执行SQL语句时出错: {error}")
                self.logger.error(f"执行SQL语句失败: {error}")
            
            worker.signals.finished.connect(on_finished)
            worker.signals.error.connect(on_error)
            
            # 启动工作线程
            QThreadPool.globalInstance().start(worker)
        except Exception as e:
            self.logger.error("执行SQL时出错", exception=e)
            QMessageBox.critical(self, "执行SQL", f"执行SQL时出错: {str(e)}")
            self.status_info.setText("执行SQL失败")
    
    def refresh_objects(self):
        """刷新对象"""
        self.logger.log('INFO', "尝试刷新对象")
        # 实现刷新对象功能
        QMessageBox.information(self, "刷新", "刷新功能开发中...")
    
    def on_connection_context_menu(self, pos):
        """连接上下文菜单"""
        menu = QMenu()
        menu.addAction("新建连接", self.new_connection)
        menu.addAction("编辑连接", self.edit_connection)
        menu.addAction("删除连接", self.delete_connection)
        menu.addAction("新建连接组", self.new_connection_group)
        menu.addAction("刷新", self.refresh_objects)
        menu.exec(self.connection_tree.mapToGlobal(pos))
    
    def on_connection_double_clicked(self, item, column):
        """连接双击事件"""
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and data[0] == 'connection':
            conn_name = data[1]
            self.connect_to_database(conn_name)
    
    def connect_to_database(self, conn_name):
        """连接到数据库"""
        conn_data = self.saved_connections.get(conn_name)
        if conn_data:
            try:
                # 从连接池获取连接
                self.db_connection = self.connection_pool.get_connection(conn_name, conn_data)
                
                if not self.db_connection:
                    QMessageBox.warning(self, "连接失败", f"未支持的数据库类型或驱动未安装: {conn_data['type']}")
                    return
                
                # 连接成功
                self.current_connection = conn_name
                self.current_db_type = conn_data['type']
                self.current_db = conn_data['database'] if conn_data['database'] else ''
                self.connection_status.setText(f"已连接: {conn_name} ({conn_data['type']})")
                self.status_info.setText("已连接")
                self.logger.log('INFO', f"连接到数据库: {conn_name}")
                
                # 加载实际的数据库对象
                self.load_database_objects()
                
                # 获取表名和列名用于自动补全
                tables, columns = self.get_database_objects_for_completion()
                
                # 更新所有SQL编辑器的补全列表
                self.update_all_sql_editors_completion(tables, columns)
                
                # 显示所有连接，保持连接列表完整
                self.load_connections_to_tree(show_only_current=False)
                
                # 切换到对象标签页
                self.left_tab_widget.setCurrentIndex(1)
                
                # 更新查询标签页的连接信息
                self.update_query_tab_info()
                
                # 强制刷新界面
                QApplication.processEvents()
            except Exception as e:
                QMessageBox.critical(self, "连接失败", f"连接数据库时出错: {str(e)}")
                self.logger.log('ERROR', f"连接数据库失败: {str(e)}")
    
    def get_database_objects_for_completion(self):
        """获取数据库对象用于自动补全"""
        tables = []
        columns = []
        
        if not hasattr(self, 'db_connection'):
            return tables, columns
        
        try:
            if self.current_db_type == 'MySQL':
                with self.db_connection.cursor() as cursor:
                    # 获取表名
                    cursor.execute("SHOW TABLES")
                    table_results = cursor.fetchall()
                    for table in table_results:
                        if isinstance(table, dict):
                            table_name = list(table.values())[0]
                        else:
                            table_name = table[0]
                        tables.append(table_name)
                        
                        # 获取列名
                        cursor.execute(f"DESCRIBE {table_name}")
                        column_results = cursor.fetchall()
                        for column in column_results:
                            if isinstance(column, dict):
                                column_name = column['Field']
                            else:
                                column_name = column[0]
                            columns.append(f"{table_name}.{column_name}")
            
            elif self.current_db_type == 'PostgreSQL':
                with self.db_connection.cursor() as cursor:
                    # 获取表名
                    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
                    table_results = cursor.fetchall()
                    for table in table_results:
                        table_name = table[0]
                        tables.append(table_name)
                        
                        # 获取列名
                        cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '{table_name}'")
                        column_results = cursor.fetchall()
                        for column in column_results:
                            column_name = column[0]
                            columns.append(f"{table_name}.{column_name}")
            
            elif self.current_db_type == 'SQLite':
                cursor = self.db_connection.cursor()
                # 获取表名
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                table_results = cursor.fetchall()
                for table in table_results:
                    table_name = table[0]
                    tables.append(table_name)
                    
                    # 获取列名
                    cursor.execute(f"PRAGMA table_info({table_name})")
                    column_results = cursor.fetchall()
                    for column in column_results:
                        column_name = column[1]
                        columns.append(f"{table_name}.{column_name}")
            
            elif self.current_db_type == 'SQL Server':
                cursor = self.db_connection.cursor()
                # 获取表名
                cursor.execute("SELECT name FROM sys.tables")
                table_results = cursor.fetchall()
                for table in table_results:
                    table_name = table[0]
                    tables.append(table_name)
                    
                    # 获取列名
                    cursor.execute(f"SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('{table_name}')")
                    column_results = cursor.fetchall()
                    for column in column_results:
                        column_name = column[0]
                        columns.append(f"{table_name}.{column_name}")
        
        except Exception as e:
            self.logger.log('ERROR', f"获取数据库对象失败: {e}")
        
        return tables, columns
    
    def update_all_sql_editors_completion(self, tables, columns):
        """更新所有SQL编辑器的补全列表"""
        for i in range(self.tabs.count()):
            tab_widget = self.tabs.widget(i)
            if tab_widget:
                for widget in tab_widget.findChildren(QWidget):
                    if isinstance(widget, SQLTextEdit):
                        widget.update_completion(tables, columns)
    
    def load_database_objects(self):
        """加载数据库对象"""
        if not hasattr(self, 'db_connection'):
            return
        
        try:
            # 清空对象树
            self.object_tree.clear()
            
            # 添加连接节点
            conn_item = QTreeWidgetItem(self.object_tree, [self.current_connection])
            conn_item.setData(0, Qt.ItemDataRole.UserRole, ('connection', self.current_connection))
            
            # 根据数据库类型加载对象
            if self.current_db_type == 'MySQL':
                self._load_mysql_objects(conn_item)
            elif self.current_db_type == 'PostgreSQL':
                self._load_postgresql_objects(conn_item)
            elif self.current_db_type == 'SQLite':
                self._load_sqlite_objects(conn_item)
            elif self.current_db_type == 'SQL Server':
                self._load_sqlserver_objects(conn_item)
            
            # 展开节点
            conn_item.setExpanded(True)
            
        except Exception as e:
            self.logger.log('ERROR', f"加载数据库对象失败: {str(e)}")
    
    def _load_mysql_objects(self, parent_item):
        """加载MySQL数据库对象"""
        # 加载数据库
        try:
            with self.db_connection.cursor() as cursor:
                # 首先检查当前数据库
                cursor.execute("SELECT DATABASE()")
                current_db = cursor.fetchone()
                current_db_name = current_db['DATABASE()'] if isinstance(current_db, dict) else current_db[0]
                
                # 如果有当前数据库，直接加载其对象
                if current_db_name:
                    db_item = QTreeWidgetItem(parent_item, [current_db_name])
                    db_item.setData(0, Qt.ItemDataRole.UserRole, ('database', current_db_name))
                    
                    # 加载表
                    cursor.execute("SHOW TABLES")
                    tables = cursor.fetchall()
                    
                    tables_item = QTreeWidgetItem(db_item, ['表'])
                    tables_item.setData(0, Qt.ItemDataRole.UserRole, ('tables', current_db_name))
                    
                    for table in tables:
                        table_name = table[f'Tables_in_{current_db_name}'] if isinstance(table, dict) else table[0]
                        table_item = QTreeWidgetItem(tables_item, [table_name])
                        table_item.setData(0, Qt.ItemDataRole.UserRole, ('table', table_name))
                        
                        # 加载表的列信息
                        cursor.execute(f"DESCRIBE {table_name}")
                        columns = cursor.fetchall()
                        
                        columns_item = QTreeWidgetItem(table_item, ['列'])
                        columns_item.setData(0, Qt.ItemDataRole.UserRole, ('columns', table_name))
                        
                        for col in columns:
                            col_name = col['Field'] if isinstance(col, dict) else col[0]
                            col_type = col['Type'] if isinstance(col, dict) else col[1]
                            col_item = QTreeWidgetItem(columns_item, [f"{col_name} ({col_type})"])
                            col_item.setData(0, Qt.ItemDataRole.UserRole, ('column', f"{table_name}.{col_name}"))
                    
                    # 加载视图（使用正确的语法）
                    cursor.execute("SHOW FULL TABLES WHERE Table_type = 'VIEW'")
                    views = cursor.fetchall()
                    
                    if views:
                        views_item = QTreeWidgetItem(db_item, ['视图'])
                        views_item.setData(0, Qt.ItemDataRole.UserRole, ('views', current_db_name))
                        
                        for view in views:
                            view_name = view[f'Tables_in_{current_db_name}'] if isinstance(view, dict) else view[0]
                            view_item = QTreeWidgetItem(views_item, [view_name])
                            view_item.setData(0, Qt.ItemDataRole.UserRole, ('view', view_name))
                    
                    # 加载存储过程
                    cursor.execute("SHOW PROCEDURE STATUS WHERE Db = %s", (current_db_name,))
                    procedures = cursor.fetchall()
                    
                    if procedures:
                        procs_item = QTreeWidgetItem(db_item, ['存储过程'])
                        procs_item.setData(0, Qt.ItemDataRole.UserRole, ('procedures', current_db_name))
                        
                        for proc in procedures:
                            proc_name = proc['Name'] if isinstance(proc, dict) else proc[1]
                            proc_item = QTreeWidgetItem(procs_item, [proc_name])
                            proc_item.setData(0, Qt.ItemDataRole.UserRole, ('procedure', proc_name))
                    
                    # 展开节点
                    db_item.setExpanded(True)
                    tables_item.setExpanded(True)
                else:
                    # 没有选择数据库，显示所有数据库
                    cursor.execute("SHOW DATABASES")
                    databases = cursor.fetchall()
                    
                    for db in databases:
                        db_name = db['Database'] if isinstance(db, dict) else db[0]
                        db_item = QTreeWidgetItem(parent_item, [db_name])
                        db_item.setData(0, Qt.ItemDataRole.UserRole, ('database', db_name))
                    
                    # 展开节点
                    parent_item.setExpanded(True)
        except Exception as e:
            self.logger.log('ERROR', f"加载MySQL对象失败: {str(e)}")
            # 显示错误信息
            QMessageBox.warning(self, "加载对象失败", f"加载MySQL对象时出错: {str(e)}")
    
    def _load_postgresql_objects(self, parent_item):
        """加载PostgreSQL数据库对象"""
        try:
            with self.db_connection.cursor() as cursor:
                # 加载表
                cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
                tables = cursor.fetchall()
                
                tables_item = QTreeWidgetItem(parent_item, ['表'])
                tables_item.setData(0, Qt.ItemDataRole.UserRole, ('tables', 'public'))
                
                for table in tables:
                    table_name = table[0]
                    table_item = QTreeWidgetItem(tables_item, [table_name])
                    table_item.setData(0, Qt.ItemDataRole.UserRole, ('table', table_name))
                
                # 加载视图
                cursor.execute("SELECT table_name FROM information_schema.views WHERE table_schema = 'public'")
                views = cursor.fetchall()
                
                views_item = QTreeWidgetItem(parent_item, ['视图'])
                views_item.setData(0, Qt.ItemDataRole.UserRole, ('views', 'public'))
                
                for view in views:
                    view_name = view[0]
                    view_item = QTreeWidgetItem(views_item, [view_name])
                    view_item.setData(0, Qt.ItemDataRole.UserRole, ('view', view_name))
                
                # 加载函数
                cursor.execute("SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'")
                functions = cursor.fetchall()
                
                funcs_item = QTreeWidgetItem(parent_item, ['函数'])
                funcs_item.setData(0, Qt.ItemDataRole.UserRole, ('functions', 'public'))
                
                for func in functions:
                    func_name = func[0]
                    func_item = QTreeWidgetItem(funcs_item, [func_name])
                    func_item.setData(0, Qt.ItemDataRole.UserRole, ('function', func_name))
                
                # 加载存储过程
                cursor.execute("SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE'")
                procedures = cursor.fetchall()
                
                procs_item = QTreeWidgetItem(parent_item, ['存储过程'])
                procs_item.setData(0, Qt.ItemDataRole.UserRole, ('procedures', 'public'))
                
                for proc in procedures:
                    proc_name = proc[0]
                    proc_item = QTreeWidgetItem(procs_item, [proc_name])
                    proc_item.setData(0, Qt.ItemDataRole.UserRole, ('procedure', proc_name))
                
                # 展开节点
                tables_item.setExpanded(True)
        except Exception as e:
            self.logger.log('ERROR', f"加载PostgreSQL对象失败: {str(e)}")
    
    def _load_sqlite_objects(self, parent_item):
        """加载SQLite数据库对象"""
        try:
            cursor = self.db_connection.cursor()
            
            # 加载表
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            tables = cursor.fetchall()
            
            tables_item = QTreeWidgetItem(parent_item, ['表'])
            tables_item.setData(0, Qt.ItemDataRole.UserRole, ('tables', 'main'))
            
            for table in tables:
                table_name = table[0]
                table_item = QTreeWidgetItem(tables_item, [table_name])
                table_item.setData(0, Qt.ItemDataRole.UserRole, ('table', table_name))
            
            # 加载视图
            cursor.execute("SELECT name FROM sqlite_master WHERE type='view'")
            views = cursor.fetchall()
            
            views_item = QTreeWidgetItem(parent_item, ['视图'])
            views_item.setData(0, Qt.ItemDataRole.UserRole, ('views', 'main'))
            
            for view in views:
                view_name = view[0]
                view_item = QTreeWidgetItem(views_item, [view_name])
                view_item.setData(0, Qt.ItemDataRole.UserRole, ('view', view_name))
            
            # 展开节点
            tables_item.setExpanded(True)
        except Exception as e:
            self.logger.log('ERROR', f"加载SQLite对象失败: {str(e)}")
    
    def _load_sqlserver_objects(self, parent_item):
        """加载SQL Server数据库对象"""
        try:
            cursor = self.db_connection.cursor()
            
            # 加载表
            cursor.execute("SELECT name FROM sys.tables")
            tables = cursor.fetchall()
            
            tables_item = QTreeWidgetItem(parent_item, ['表'])
            tables_item.setData(0, Qt.ItemDataRole.UserRole, ('tables', 'dbo'))
            
            for table in tables:
                table_name = table[0]
                table_item = QTreeWidgetItem(tables_item, [table_name])
                table_item.setData(0, Qt.ItemDataRole.UserRole, ('table', table_name))
            
            # 加载视图
            cursor.execute("SELECT name FROM sys.views")
            views = cursor.fetchall()
            
            views_item = QTreeWidgetItem(parent_item, ['视图'])
            views_item.setData(0, Qt.ItemDataRole.UserRole, ('views', 'dbo'))
            
            for view in views:
                view_name = view[0]
                view_item = QTreeWidgetItem(views_item, [view_name])
                view_item.setData(0, Qt.ItemDataRole.UserRole, ('view', view_name))
            
            # 加载存储过程
            cursor.execute("SELECT name FROM sys.procedures")
            procedures = cursor.fetchall()
            
            procs_item = QTreeWidgetItem(parent_item, ['存储过程'])
            procs_item.setData(0, Qt.ItemDataRole.UserRole, ('procedures', 'dbo'))
            
            for proc in procedures:
                proc_name = proc[0]
                proc_item = QTreeWidgetItem(procs_item, [proc_name])
                proc_item.setData(0, Qt.ItemDataRole.UserRole, ('procedure', proc_name))
            
            # 展开节点
            tables_item.setExpanded(True)
        except Exception as e:
            self.logger.log('ERROR', f"加载SQL Server对象失败: {str(e)}")
    
    def new_connection_group(self):
        """新建连接组"""
        name, ok = QInputDialog.getText(self, "新建连接组", "输入组名:")
        if ok and name:
            if name not in self.connection_groups:
                self.connection_groups[name] = []
                self.load_connections_to_tree()
                self.save_connections()
                self.logger.log('INFO', f"新建连接组: {name}")
    
    def close_tab(self, index):
        """关闭标签页"""
        tab_text = self.tabs.tabText(index)
        self.tabs.removeTab(index)
        self.logger.log('INFO', f"关闭标签页: {tab_text}")
    
    def toggle_dark_mode(self):
        """切换深色模式"""
        # 切换深色模式
        is_dark = hasattr(self, 'dark_mode') and self.dark_mode
        
        if is_dark:
            # 切换到浅色模式
            self.setStyleSheet('')
            self.dark_mode = False
            self.status_info.setText("已切换到浅色模式")
        else:
            # 切换到深色模式
            dark_style = ""
            """
            QWidget {
                background-color: #1e1e1e;
                color: #d4d4d4;
            }
            QTreeWidget {
                background-color: #252526;
                color: #d4d4d4;
            }
            QTreeWidget::item {
                padding: 2px;
            }
            QTreeWidget::item:selected {
                background-color: #094771;
            }
            QTabWidget {
                background-color: #1e1e1e;
            }
            QTabBar::tab {
                background-color: #2d2d30;
                color: #d4d4d4;
                padding: 8px 12px;
            }
            QTabBar::tab:selected {
                background-color: #1e1e1e;
                color: #ffffff;
            }
            QTextEdit {
                background-color: #1e1e1e;
                color: #d4d4d4;
                border: 1px solid #3e3e42;
            }
            QTableWidget {
                background-color: #252526;
                color: #d4d4d4;
            }
            QTableWidget::item {
                padding: 4px;
            }
            QTableWidget::item:selected {
                background-color: #094771;
            }
            QPushButton {
                background-color: #2d2d30;
                color: #d4d4d4;
                border: 1px solid #3e3e42;
                padding: 6px 12px;
            }
            QPushButton:hover {
                background-color: #3e3e42;
            }
            QStatusBar {
                background-color: #252526;
                color: #d4d4d4;
            }
            QMenuBar {
                background-color: #252526;
                color: #d4d4d4;
            }
            QMenu {
                background-color: #252526;
                color: #d4d4d4;
            }
            QMenu::item:selected {
                background-color: #094771;
            }
            QToolBar {
                background-color: #252526;
            }
            """
            dark_style = "QWidget { background-color: #1e1e1e; color: #d4d4d4; } QTreeWidget { background-color: #252526; color: #d4d4d4; } QTreeWidget::item { padding: 2px; } QTreeWidget::item:selected { background-color: #094771; } QTabWidget { background-color: #1e1e1e; } QTabBar::tab { background-color: #2d2d30; color: #d4d4d4; padding: 8px 12px; } QTabBar::tab:selected { background-color: #1e1e1e; color: #ffffff; } QTextEdit { background-color: #1e1e1e; color: #d4d4d4; border: 1px solid #3e3e42; } QTableWidget { background-color: #252526; color: #d4d4d4; } QTableWidget::item { padding: 4px; } QTableWidget::item:selected { background-color: #094771; } QPushButton { background-color: #2d2d30; color: #d4d4d4; border: 1px solid #3e3e42; padding: 6px 12px; } QPushButton:hover { background-color: #3e3e42; } QStatusBar { background-color: #252526; color: #d4d4d4; } QMenuBar { background-color: #252526; color: #d4d4d4; } QMenu { background-color: #252526; color: #d4d4d4; } QMenu::item:selected { background-color: #094771; } QToolBar { background-color: #252526; }"
            self.setStyleSheet(dark_style)
            self.dark_mode = True
            self.status_info.setText("已切换到深色模式")
        
        self.logger.log('INFO', f"切换到{'深色' if not is_dark else '浅色'}模式")
    
    def show_help(self):
        """显示帮助"""
        QMessageBox.information(self, "使用帮助", "使用帮助功能开发中...")
    
    def about(self):
        """关于"""
        QMessageBox.information(self, "关于", "Navicat Style SQLTool v1.0\n\n基于PyQt6开发的数据库管理工具")
    
    def closeEvent(self, event):
        """关闭事件"""
        # 释放所有数据库连接
        if hasattr(self, 'connection_pool'):
            self.connection_pool.close_all_connections()
            self.logger.log('INFO', "关闭所有数据库连接")
        event.accept()

    # 占位方法（待实现）
    def copy_sql(self):
        """复制SQL"""
        self.show_feature_not_implemented("复制")
    
    def paste_sql(self):
        """粘贴SQL"""
        self.show_feature_not_implemented("粘贴")
    
    def cut_sql(self):
        """剪切SQL"""
        self.show_feature_not_implemented("剪切")
    
    def select_all_sql(self):
        """全选SQL"""
        self.show_feature_not_implemented("全选")
    
    def find_sql(self):
        """查找SQL"""
        current_tab = self.tabs.currentWidget()
        if not current_tab:
            return
        
        # 获取SQL编辑器
        sql_editor = None
        for widget in current_tab.findChildren(QWidget):
            if isinstance(widget, SQLTextEdit):
                sql_editor = widget
                break
        
        if not sql_editor:
            return
        
        # 打开查找对话框
        find_text, ok = QInputDialog.getText(self, "查找", "请输入要查找的文本:")
        if ok and find_text:
            # 查找文本
            cursor = sql_editor.textCursor()
            cursor.movePosition(QTextCursor.MoveOperation.Start)
            sql_editor.setTextCursor(cursor)
            
            found = False
            while True:
                cursor = sql_editor.document().find(find_text, cursor)
                if cursor.isNull():
                    break
                sql_editor.setTextCursor(cursor)
                found = True
                # 询问是否继续查找
                if QMessageBox.question(self, "查找", "是否继续查找下一个?", 
                                       QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.No:
                    break
            
            if not found:
                QMessageBox.information(self, "查找", f"未找到 '{find_text}'")
    
    def replace_sql(self):
        """替换SQL"""
        current_tab = self.tabs.currentWidget()
        if not current_tab:
            return
        
        # 获取SQL编辑器
        sql_editor = None
        for widget in current_tab.findChildren(QWidget):
            if isinstance(widget, SQLTextEdit):
                sql_editor = widget
                break
        
        if not sql_editor:
            return
        
        # 打开替换对话框
        from PyQt6.QtWidgets import QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton
        
        dialog = QDialog(self)
        dialog.setWindowTitle("替换")
        dialog.setGeometry(300, 200, 400, 150)
        
        layout = QVBoxLayout(dialog)
        
        # 查找文本
        find_layout = QHBoxLayout()
        find_layout.addWidget(QLabel("查找:"))
        find_edit = QLineEdit()
        find_layout.addWidget(find_edit)
        layout.addLayout(find_layout)
        
        # 替换文本
        replace_layout = QHBoxLayout()
        replace_layout.addWidget(QLabel("替换:"))
        replace_edit = QLineEdit()
        replace_layout.addWidget(replace_edit)
        layout.addLayout(replace_layout)
        
        # 按钮
        button_layout = QHBoxLayout()
        replace_btn = QPushButton("替换")
        replace_all_btn = QPushButton("全部替换")
        cancel_btn = QPushButton("取消")
        
        button_layout.addWidget(replace_btn)
        button_layout.addWidget(replace_all_btn)
        button_layout.addWidget(cancel_btn)
        layout.addLayout(button_layout)
        
        # 替换单个
        def replace_single():
            find_text = find_edit.text()
            replace_text = replace_edit.text()
            if not find_text:
                return
            
            cursor = sql_editor.textCursor()
            if cursor.hasSelection():
                selected_text = cursor.selectedText()
                if selected_text == find_text:
                    cursor.insertText(replace_text)
            else:
                # 查找下一个
                cursor = sql_editor.document().find(find_text, cursor)
                if not cursor.isNull():
                    cursor.select(QTextCursor.SelectionType.WordUnderCursor)
                    sql_editor.setTextCursor(cursor)
        
        # 全部替换
        def replace_all():
            find_text = find_edit.text()
            replace_text = replace_edit.text()
            if not find_text:
                return
            
            text = sql_editor.toPlainText()
            new_text = text.replace(find_text, replace_text)
            sql_editor.setPlainText(new_text)
            QMessageBox.information(self, "替换", f"成功替换 {text.count(find_text)} 处")
        
        replace_btn.clicked.connect(replace_single)
        replace_all_btn.clicked.connect(replace_all)
        cancel_btn.clicked.connect(dialog.reject)
        
        dialog.exec()
    
    def open_sql_file(self):
        """打开SQL文件"""
        # 打开文件选择对话框
        file_path, _ = QFileDialog.getOpenFileName(
            self, "打开SQL文件", "", "SQL文件 (*.sql);;所有文件 (*.*)")
        
        if not file_path:
            return
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            # 创建新的查询标签页
            self.add_new_query_tab()
            
            # 获取当前标签页的SQL编辑器
            current_tab = self.tabs.currentWidget()
            if current_tab:
                for widget in current_tab.findChildren(QWidget):
                    if isinstance(widget, SQLTextEdit):
                        widget.setPlainText(sql_content)
                        break
            
            self.status_info.setText(f"成功打开SQL文件: {file_path}")
            self.logger.log('INFO', f"打开SQL文件: {file_path}")
        except Exception as e:
            QMessageBox.critical(self, "打开SQL文件", f"打开SQL文件失败: {str(e)}")
            self.logger.log('ERROR', f"打开SQL文件失败: {str(e)}")
    
    def save_sql_file(self):
        """保存SQL文件"""
        # 获取当前标签页的SQL编辑器
        current_tab = self.tabs.currentWidget()
        if not current_tab:
            return
        
        sql_editor = None
        for widget in current_tab.findChildren(QWidget):
            if isinstance(widget, SQLTextEdit):
                sql_editor = widget
                break
        
        if not sql_editor:
            return
        
        # 打开文件保存对话框
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存SQL文件", "", "SQL文件 (*.sql);;所有文件 (*.*)")
        
        if not file_path:
            return
        
        try:
            sql_content = sql_editor.toPlainText()
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(sql_content)
            
            self.status_info.setText(f"成功保存SQL文件: {file_path}")
            self.logger.log('INFO', f"保存SQL文件: {file_path}")
        except Exception as e:
            QMessageBox.critical(self, "保存SQL文件", f"保存SQL文件失败: {str(e)}")
            self.logger.log('ERROR', f"保存SQL文件失败: {str(e)}")
    
    def import_data(self):
        """导入数据"""
        # 打开文件选择对话框
        file_path, file_type = QFileDialog.getOpenFileName(
            self, "选择导入文件", "", "CSV文件 (*.csv);;SQL文件 (*.sql);;Excel文件 (*.xlsx)")
        
        if not file_path:
            return
        
        # 检查是否已连接数据库
        if not hasattr(self, 'db_connection'):
            QMessageBox.warning(self, "导入数据", "请先连接到数据库")
            return
        
        try:
            if file_type == 'CSV文件 (*.csv)':
                self._import_csv(file_path)
            elif file_type == 'SQL文件 (*.sql)':
                self._import_sql(file_path)
            elif file_type == 'Excel文件 (*.xlsx)':
                self._import_excel(file_path)
            
            self.status_info.setText("数据导入成功")
            self.logger.log('INFO', f"导入数据文件: {file_path}")
            
        except Exception as e:
            QMessageBox.critical(self, "导入数据", f"导入数据失败: {str(e)}")
            self.logger.log('ERROR', f"导入数据失败: {str(e)}")
    
    def _import_csv(self, file_path):
        """导入CSV文件"""
        # 获取目标表名
        table_name, ok = QInputDialog.getText(self, "导入CSV", "请输入目标表名:")
        if not ok or not table_name:
            return
        
        # 读取CSV文件
        import csv
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader)  # 读取表头
            rows = list(reader)  # 读取数据行
        
        if not rows:
            QMessageBox.warning(self, "导入CSV", "CSV文件为空")
            return
        
        # 构建SQL语句
        if self.current_db_type == 'MySQL':
            # 构建列名
            columns = ', '.join(headers)
            # 构建占位符
            placeholders = ', '.join(['%s'] * len(headers))
            # 构建插入语句
            sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
            
            # 执行批量插入
            with self.db_connection.cursor() as cursor:
                cursor.executemany(sql, rows)
                self.db_connection.commit()
            
            QMessageBox.information(self, "导入CSV", f"成功导入 {len(rows)} 条记录到表 {table_name}")
    
    def _import_sql(self, file_path):
        """导入SQL文件"""
        # 读取SQL文件
        with open(file_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        if not sql_content.strip():
            QMessageBox.warning(self, "导入SQL", "SQL文件为空")
            return
        
        # 执行SQL语句
        if self.current_db_type == 'MySQL':
            with self.db_connection.cursor() as cursor:
                # 分割SQL语句
                sql_statements = sql_content.split(';')
                executed = 0
                
                for statement in sql_statements:
                    statement = statement.strip()
                    if statement:
                        cursor.execute(statement)
                        executed += 1
                
                self.db_connection.commit()
            
            QMessageBox.information(self, "导入SQL", f"成功执行 {executed} 条SQL语句")
    
    def _import_excel(self, file_path):
        """导入Excel文件"""
        try:
            import pandas as pd
            # 读取Excel文件
            df = pd.read_excel(file_path)
            
            # 获取目标表名
            table_name, ok = QInputDialog.getText(self, "导入Excel", "请输入目标表名:")
            if not ok or not table_name:
                return
            
            if self.current_db_type == 'MySQL':
                # 构建列名
                columns = ', '.join(df.columns)
                # 构建占位符
                placeholders = ', '.join(['%s'] * len(df.columns))
                # 构建插入语句
                sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
                
                # 执行批量插入
                with self.db_connection.cursor() as cursor:
                    # 转换数据为元组列表
                    data = [tuple(row) for row in df.values]
                    cursor.executemany(sql, data)
                    self.db_connection.commit()
                
                QMessageBox.information(self, "导入Excel", f"成功导入 {len(df)} 条记录到表 {table_name}")
        except ImportError:
            QMessageBox.warning(self, "导入Excel", "需要安装pandas和openpyxl库来导入Excel文件")
        except Exception as e:
            raise e
    
    def export_data(self):
        """导出数据"""
        # 打开文件保存对话框
        file_path, file_type = QFileDialog.getSaveFileName(
            self, "保存导出文件", "", "CSV文件 (*.csv);;SQL文件 (*.sql);;Excel文件 (*.xlsx)")
        
        if not file_path:
            return
        
        # 检查是否已连接数据库
        if not hasattr(self, 'db_connection'):
            QMessageBox.warning(self, "导出数据", "请先连接到数据库")
            return
        
        # 获取要导出的表名
        table_name, ok = QInputDialog.getText(self, "导出数据", "请输入要导出的表名:")
        if not ok or not table_name:
            return
        
        try:
            if file_type == 'CSV文件 (*.csv)':
                self._export_csv(file_path, table_name)
            elif file_type == 'SQL文件 (*.sql)':
                self._export_sql(file_path, table_name)
            elif file_type == 'Excel文件 (*.xlsx)':
                self._export_excel(file_path, table_name)
            
            self.status_info.setText("数据导出成功")
            self.logger.log('INFO', f"导出数据文件: {file_path}")
            
        except Exception as e:
            QMessageBox.critical(self, "导出数据", f"导出数据失败: {str(e)}")
            self.logger.log('ERROR', f"导出数据失败: {str(e)}")
    
    def _export_csv(self, file_path, table_name):
        """导出CSV文件"""
        if self.current_db_type == 'MySQL':
            with self.db_connection.cursor() as cursor:
                # 查询表数据
                cursor.execute(f"SELECT * FROM {table_name}")
                results = cursor.fetchall()
                
                if not results:
                    QMessageBox.warning(self, "导出CSV", f"表 {table_name} 无数据")
                    return
                
                # 获取列名
                columns = list(results[0].keys())
                
                # 写入CSV文件
                import csv
                with open(file_path, 'w', encoding='utf-8', newline='') as f:
                    writer = csv.writer(f)
                    # 写入表头
                    writer.writerow(columns)
                    # 写入数据
                    for row in results:
                        writer.writerow(list(row.values()))
                
                QMessageBox.information(self, "导出CSV", f"成功导出 {len(results)} 条记录到文件 {file_path}")
    
    def _export_sql(self, file_path, table_name):
        """导出SQL文件"""
        if self.current_db_type == 'MySQL':
            with self.db_connection.cursor() as cursor:
                # 查询表结构
                cursor.execute(f"DESCRIBE {table_name}")
                columns = cursor.fetchall()
                
                # 查询表数据
                cursor.execute(f"SELECT * FROM {table_name}")
                results = cursor.fetchall()
                
                # 构建SQL语句
                sql_content = f"-- 导出表 {table_name} 的数据\n\n"
                
                # 构建插入语句
                if results:
                    # 构建列名
                    column_names = [col['Field'] for col in columns]
                    columns_str = ', '.join(column_names)
                    
                    for row in results:
                        # 构建值
                        values = []
                        for col in column_names:
                            value = row[col]
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
                
                QMessageBox.information(self, "导出SQL", f"成功导出 {len(results)} 条记录到文件 {file_path}")
    
    def _export_excel(self, file_path, table_name):
        """导出Excel文件"""
        try:
            import pandas as pd
            
            if self.current_db_type == 'MySQL':
                with self.db_connection.cursor() as cursor:
                    # 查询表数据
                    cursor.execute(f"SELECT * FROM {table_name}")
                    results = cursor.fetchall()
                    
                    if not results:
                        QMessageBox.warning(self, "导出Excel", f"表 {table_name} 无数据")
                        return
                    
                    # 转换为DataFrame
                    df = pd.DataFrame(results)
                    
                    # 写入Excel文件
                    df.to_excel(file_path, index=False)
                    
                    QMessageBox.information(self, "导出Excel", f"成功导出 {len(results)} 条记录到文件 {file_path}")
        except ImportError:
            QMessageBox.warning(self, "导出Excel", "需要安装pandas和openpyxl库来导出Excel文件")
        except Exception as e:
            raise e
    
    def create_database(self):
        """创建数据库"""
        self.logger.log('INFO', "尝试创建数据库")
        self.show_feature_not_implemented("创建数据库")
    
    def drop_database(self):
        """删除数据库"""
        self.logger.log('INFO', "尝试删除数据库")
        self.show_feature_not_implemented("删除数据库")
    
    def backup_database(self):
        """备份数据库"""
        self.logger.log('INFO', "尝试备份数据库")
        self.show_feature_not_implemented("备份数据库")
    
    def restore_database(self):
        """还原数据库"""
        self.logger.log('INFO', "尝试还原数据库")
        self.show_feature_not_implemented("还原数据库")
    
    def sync_data(self):
        """数据同步"""
        self.logger.log('INFO', "尝试数据同步")
        self.show_feature_not_implemented("数据同步")
    
    def sync_structure(self):
        """结构同步"""
        self.logger.log('INFO', "尝试结构同步")
        self.show_feature_not_implemented("结构同步")
    
    def format_sql(self):
        """格式化SQL"""
        current_tab = self.tabs.currentWidget()
        if not current_tab:
            return
        
        # 获取SQL编辑器
        sql_editor = None
        for widget in current_tab.findChildren(QWidget):
            if isinstance(widget, SQLTextEdit):
                sql_editor = widget
                break
        
        if not sql_editor:
            return
        
        sql = sql_editor.toPlainText()
        if not sql.strip():
            QMessageBox.warning(self, "格式化SQL", "请输入SQL语句")
            return
        
        # 格式化SQL
        formatted_sql = self._format_sql(sql)
        
        # 替换原SQL
        sql_editor.setPlainText(formatted_sql)
        self.status_info.setText("SQL格式化成功")
        self.logger.log('INFO', "SQL格式化成功")
    
    def _format_sql(self, sql):
        """格式化SQL语句"""
        # 基本的SQL格式化
        import re
        
        # 去除多余的空白
        sql = re.sub(r'\s+', ' ', sql)
        
        # 关键词大写
        keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME', 'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'TABLE', 'DATABASE', 'USE', 'AS', 'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL', 'TRUE', 'FALSE']
        
        for keyword in keywords:
            sql = re.sub(r'\b' + keyword.lower() + r'\b', keyword, sql, flags=re.IGNORECASE)
        
        # 添加换行
        sql = sql.replace(' SELECT', '\nSELECT')
        sql = sql.replace(' FROM', '\nFROM')
        sql = sql.replace(' WHERE', '\nWHERE')
        sql = sql.replace(' JOIN', '\nJOIN')
        sql = sql.replace(' LEFT', '\nLEFT')
        sql = sql.replace(' RIGHT', '\nRIGHT')
        sql = sql.replace(' INNER', '\nINNER')
        sql = sql.replace(' OUTER', '\nOUTER')
        sql = sql.replace(' GROUP', '\nGROUP')
        sql = sql.replace(' ORDER', '\nORDER')
        sql = sql.replace(' HAVING', '\nHAVING')
        sql = sql.replace(' LIMIT', '\nLIMIT')
        sql = sql.replace(' OFFSET', '\nOFFSET')
        sql = sql.replace(' INSERT', '\nINSERT')
        sql = sql.replace(' UPDATE', '\nUPDATE')
        sql = sql.replace(' DELETE', '\nDELETE')
        sql = sql.replace(' CREATE', '\nCREATE')
        sql = sql.replace(' ALTER', '\nALTER')
        sql = sql.replace(' DROP', '\nDROP')
        sql = sql.replace(' TRUNCATE', '\nTRUNCATE')
        sql = sql.replace(' RENAME', '\nRENAME')
        sql = sql.replace(' INDEX', '\nINDEX')
        sql = sql.replace(' VIEW', '\nVIEW')
        sql = sql.replace(' PROCEDURE', '\nPROCEDURE')
        sql = sql.replace(' FUNCTION', '\nFUNCTION')
        sql = sql.replace(' TRIGGER', '\nTRIGGER')
        sql = sql.replace(' TABLE', '\nTABLE')
        sql = sql.replace(' DATABASE', '\nDATABASE')
        sql = sql.replace(' USE', '\nUSE')
        sql = sql.replace(' AS', '\nAS')
        sql = sql.replace(' ON', '\nON')
        
        # 添加缩进
        lines = sql.split('\n')
        indented_lines = []
        indent_level = 0
        indent_size = 4
        
        for line in lines:
            line = line.strip()
            if not line:
                indented_lines.append('')
                continue
            
            # 减少缩进
            if line.startswith(')') or line.startswith('END') or line.startswith('ELSE'):
                indent_level = max(0, indent_level - 1)
            
            # 添加缩进
            indented_line = ' ' * (indent_level * indent_size) + line
            indented_lines.append(indented_line)
            
            # 增加缩进
            if line.endswith('(') or line.endswith('BEGIN') or line.endswith('CASE'):
                indent_level += 1
        
        return '\n'.join(indented_lines)
    
    def explain_sql(self):
        """执行计划"""
        self.logger.log('INFO', "尝试生成执行计划")
        current_tab = self.tabs.currentWidget()
        if not current_tab:
            self.logger.log('WARNING', "执行计划失败: 没有当前标签页")
            return
        
        # 获取SQL编辑器
        sql_editor = None
        for widget in current_tab.findChildren(QWidget):
            if isinstance(widget, SQLTextEdit):
                sql_editor = widget
                break
        
        if not sql_editor:
            self.logger.log('WARNING', "执行计划失败: 没有找到SQL编辑器")
            return
        
        sql = sql_editor.toPlainText()
        if not sql.strip():
            QMessageBox.warning(self, "执行计划", "请输入SQL语句")
            self.logger.log('WARNING', "执行计划失败: 没有输入SQL语句")
            return
        
        # 检查是否已连接数据库
        if not hasattr(self, 'db_connection'):
            QMessageBox.warning(self, "执行计划", "请先连接到数据库")
            self.logger.log('WARNING', "执行计划失败: 未连接到数据库")
            return
        
        try:
            # 生成执行计划
            self.logger.log('INFO', f"生成执行计划: {sql[:50]}...")
            plan = self._get_execution_plan(sql)
            
            # 创建执行计划标签页
            tab_widget = QWidget()
            tab_layout = QVBoxLayout(tab_widget)
            
            # 创建计划表格
            plan_table = QTableWidget()
            plan_table.setColumnCount(len(plan[0]) if plan else 0)
            if plan:
                plan_table.setHorizontalHeaderLabels(plan[0])
                
                plan_table.setRowCount(len(plan) - 1)
                for row_idx, row_data in enumerate(plan[1:]):
                    for col_idx, value in enumerate(row_data):
                        item = QTableWidgetItem(str(value))
                        plan_table.setItem(row_idx, col_idx, item)
                
                plan_table.resizeColumnsToContents()
            
            tab_layout.addWidget(plan_table)
            
            # 添加标签页
            tab_index = self.tabs.addTab(tab_widget, "执行计划")
            self.tabs.setCurrentIndex(tab_index)
            
            self.status_info.setText("执行计划生成成功")
            self.logger.log('INFO', "执行计划生成成功")
            
        except Exception as e:
            QMessageBox.critical(self, "执行计划", f"生成执行计划失败: {str(e)}")
            self.logger.log('ERROR', f"生成执行计划失败: {str(e)}")
    
    def _get_execution_plan(self, sql):
        """获取SQL执行计划"""
        if self.current_db_type == 'MySQL':
            with self.db_connection.cursor() as cursor:
                # 生成执行计划
                cursor.execute(f"EXPLAIN {sql}")
                results = cursor.fetchall()
                
                if results:
                    # 提取列名
                    columns = list(results[0].keys())
                    plan = [columns]
                    
                    # 提取数据
                    for row in results:
                        plan.append(list(row.values()))
                    
                    return plan
        elif self.current_db_type == 'PostgreSQL':
            with self.db_connection.cursor() as cursor:
                # 生成执行计划
                cursor.execute(f"EXPLAIN {sql}")
                results = cursor.fetchall()
                
                if results:
                    plan = [['执行计划']]
                    for row in results:
                        plan.append([row[0]])
                    return plan
        elif self.current_db_type == 'SQL Server':
            with self.db_connection.cursor() as cursor:
                # 生成执行计划
                cursor.execute(f"EXPLAIN PLAN FOR {sql}")
                results = cursor.fetchall()
                
                if results:
                    plan = [['执行计划']]
                    for row in results:
                        plan.append([row[0]])
                    return plan
        
        # 默认返回空计划
        return [['执行计划'], ['无法生成执行计划']]
    
    def generate_er_diagram(self):
        """生成ER图表"""
        self.logger.log('INFO', "尝试生成ER图表")
        # 检查是否已连接数据库
        if not hasattr(self, 'db_connection'):
            QMessageBox.warning(self, "生成ER图表", "请先连接到数据库")
            self.logger.log('WARNING', "ER图表生成失败: 未连接到数据库")
            return
        
        try:
            # 加载表结构
            self.logger.log('INFO', "加载表结构")
            tables = self._get_tables_structure()
            self.logger.log('INFO', f"成功加载 {len(tables)} 个表结构")
            
            # 创建ER图表标签页
            tab_widget = QWidget()
            tab_layout = QVBoxLayout(tab_widget)
            
            # 创建图表区域
            diagram_widget = QWidget()
            diagram_layout = QVBoxLayout(diagram_widget)
            
            # 创建表结构列表
            tables_list = QListWidget()
            for table_name, columns in tables.items():
                item = QListWidgetItem(table_name)
                item.setData(Qt.ItemDataRole.UserRole, columns)
                tables_list.addItem(item)
            
            # 创建表结构详情
            table_details = QTextEdit()
            table_details.setReadOnly(True)
            
            # 连接信号
            def on_table_selected(item):
                table_name = item.text()
                columns = item.data(Qt.ItemDataRole.UserRole)
                details = f"表: {table_name}\n\n字段:\n"
                for col_name, col_type in columns:
                    details += f"  {col_name}: {col_type}\n"
                table_details.setPlainText(details)
            
            tables_list.itemClicked.connect(on_table_selected)
            
            # 创建分割器
            splitter = QSplitter(Qt.Orientation.Horizontal)
            splitter.addWidget(tables_list)
            splitter.addWidget(table_details)
            splitter.setSizes([300, 500])
            
            diagram_layout.addWidget(splitter)
            tab_layout.addWidget(diagram_widget)
            
            # 添加标签页
            tab_index = self.tabs.addTab(tab_widget, "ER图表")
            self.tabs.setCurrentIndex(tab_index)
            
            self.status_info.setText("ER图表生成成功")
            self.logger.log('INFO', "ER图表生成成功")
            
        except Exception as e:
            QMessageBox.critical(self, "生成ER图表", f"生成ER图表失败: {str(e)}")
            self.logger.log('ERROR', f"生成ER图表失败: {str(e)}")
    
    def _get_tables_structure(self):
        """获取表结构"""
        tables = {}
        
        if self.current_db_type == 'MySQL':
            with self.db_connection.cursor() as cursor:
                # 获取所有表
                cursor.execute("SHOW TABLES")
                table_results = cursor.fetchall()
                
                for table_result in table_results:
                    table_name = list(table_result.values())[0]
                    # 获取表结构
                    cursor.execute(f"DESCRIBE {table_name}")
                    columns = cursor.fetchall()
                    
                    table_columns = []
                    for col in columns:
                        col_name = col['Field']
                        col_type = col['Type']
                        table_columns.append((col_name, col_type))
                    
                    tables[table_name] = table_columns
        elif self.current_db_type == 'PostgreSQL':
            with self.db_connection.cursor() as cursor:
                # 获取所有表
                cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
                table_results = cursor.fetchall()
                
                for table_result in table_results:
                    table_name = table_result[0]
                    # 获取表结构
                    cursor.execute(f"\nSELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}'")
                    columns = cursor.fetchall()
                    
                    table_columns = []
                    for col in columns:
                        col_name = col[0]
                        col_type = col[1]
                        table_columns.append((col_name, col_type))
                    
                    tables[table_name] = table_columns
        elif self.current_db_type == 'SQLite':
            cursor = self.db_connection.cursor()
            # 获取所有表
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            table_results = cursor.fetchall()
            
            for table_result in table_results:
                table_name = table_result[0]
                # 获取表结构
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = cursor.fetchall()
                
                table_columns = []
                for col in columns:
                    col_name = col[1]
                    col_type = col[2]
                    table_columns.append((col_name, col_type))
                
                tables[table_name] = table_columns
        
        return tables
    
    def transfer_data(self):
        """数据传输"""
        self.logger.log('INFO', "尝试数据传输")
        self.show_feature_not_implemented("数据传输")
    
    def scheduled_tasks(self):
        """计划任务"""
        self.logger.log('INFO', "尝试管理计划任务")
        self.show_feature_not_implemented("计划任务")
    
    def toggle_object_browser(self):
        """显示/隐藏对象浏览器"""
        self.logger.log('INFO', "尝试显示/隐藏对象浏览器")
        self.show_feature_not_implemented("显示/隐藏对象浏览器")
    
    def toggle_status_bar(self):
        """显示/隐藏状态栏"""
        self.logger.log('INFO', "尝试显示/隐藏状态栏")
        self.show_feature_not_implemented("显示/隐藏状态栏")
    
    def stop_sql(self):
        """停止SQL执行"""
        self.logger.log('INFO', "尝试停止SQL执行")
        self.show_feature_not_implemented("停止执行")
    
    def on_object_context_menu(self, pos):
        """对象上下文菜单"""
        # 获取当前选中的项
        item = self.object_tree.itemAt(pos)
        if not item:
            return
        
        # 创建上下文菜单
        menu = QMenu()
        
        try:
            data = item.data(0, Qt.ItemDataRole.UserRole)
            if data:
                # 确保 data 是一个元组或列表，且至少有两个元素
                if isinstance(data, (tuple, list)) and len(data) >= 2:
                    obj_type, obj_name = data
                    
                    if obj_type == 'connection':
                        # 连接右键菜单
                        menu.addAction("打开连接", lambda: self.connect_to_database(obj_name))
                        menu.addAction("新建查询", self.new_query)
                        menu.addAction("编辑连接", self.edit_connection)
                        menu.addAction("删除连接", self.delete_connection)
                        menu.addSeparator()
                        menu.addAction("刷新", self.refresh_objects)
                    elif obj_type == 'database':
                        # 数据库实例右键菜单
                        menu.addAction("打开数据库", lambda: self.open_database(obj_name))
                        menu.addAction("新建查询", self.new_query)
                        menu.addAction("新建表", lambda: self.show_feature_not_implemented("新建表"))
                        menu.addAction("新建视图", lambda: self.show_feature_not_implemented("新建视图"))
                        menu.addAction("新建存储过程", lambda: self.show_feature_not_implemented("新建存储过程"))
                        menu.addAction("新建函数", lambda: self.show_feature_not_implemented("新建函数"))
                        menu.addSeparator()
                        menu.addAction("数据传输", self.transfer_data)
                        menu.addAction("导入向导", self.import_data)
                        menu.addAction("导出向导", self.export_data)
                        menu.addSeparator()
                        menu.addAction("备份", lambda: self.show_feature_not_implemented("备份"))
                        menu.addAction("还原", lambda: self.show_feature_not_implemented("还原"))
                        menu.addSeparator()
                        menu.addAction("刷新", self.refresh_objects)
                    elif obj_type == 'table':
                        # 表对象右键菜单
                        menu.addAction("打开表", lambda: self.open_table_data(obj_name))
                        menu.addAction("设计表", lambda: self.design_table(obj_name))
                        menu.addAction("查看表结构", lambda: self.view_table_structure(obj_name))
                        menu.addAction("新建查询", self.new_query)
                        menu.addSeparator()
                        menu.addAction("复制表", lambda: self.show_feature_not_implemented("复制表"))
                        menu.addAction("重命名表", lambda: self.show_feature_not_implemented("重命名表"))
                        menu.addAction("删除表", lambda: self.show_feature_not_implemented("删除表"))
                        menu.addSeparator()
                        menu.addAction("导入数据", self.import_data)
                        menu.addAction("导出数据", self.export_data)
                        menu.addSeparator()
                        menu.addAction("刷新", self.refresh_objects)
                    elif obj_type == 'view':
                        # 视图右键菜单
                        menu.addAction("打开视图", lambda: self.open_view(obj_name))
                        menu.addAction("查看视图结构", lambda: self.view_view_structure(obj_name))
                        menu.addAction("设计视图", lambda: self.show_feature_not_implemented("设计视图"))
                        menu.addSeparator()
                        menu.addAction("重命名视图", lambda: self.show_feature_not_implemented("重命名视图"))
                        menu.addAction("删除视图", lambda: self.show_feature_not_implemented("删除视图"))
                        menu.addSeparator()
                        menu.addAction("刷新", self.refresh_objects)
                    elif obj_type == 'procedure':
                        # 存储过程右键菜单
                        menu.addAction("查看存储过程", lambda: self.view_procedure(obj_name))
                        menu.addAction("编辑存储过程", lambda: self.show_feature_not_implemented("编辑存储过程"))
                        menu.addSeparator()
                        menu.addAction("重命名存储过程", lambda: self.show_feature_not_implemented("重命名存储过程"))
                        menu.addAction("删除存储过程", lambda: self.show_feature_not_implemented("删除存储过程"))
                        menu.addSeparator()
                        menu.addAction("刷新", self.refresh_objects)
                    elif obj_type == 'function':
                        # 函数右键菜单
                        menu.addAction("查看函数", lambda: self.show_feature_not_implemented("查看函数"))
                        menu.addAction("编辑函数", lambda: self.show_feature_not_implemented("编辑函数"))
                        menu.addSeparator()
                        menu.addAction("重命名函数", lambda: self.show_feature_not_implemented("重命名函数"))
                        menu.addAction("删除函数", lambda: self.show_feature_not_implemented("删除函数"))
                        menu.addSeparator()
                        menu.addAction("刷新", self.refresh_objects)
        except Exception as e:
            self.logger.log('ERROR', f"创建对象上下文菜单失败: {e}")
        
        # 显示菜单
        menu.exec(self.object_tree.mapToGlobal(pos))
    
    def open_database(self, db_name):
        """打开数据库"""
        try:
            if not hasattr(self, 'db_connection'):
                QMessageBox.warning(self, "打开数据库", "请先连接到数据库服务器")
                return
            
            # 切换数据库
            if self.current_db_type == 'MySQL':
                with self.db_connection.cursor() as cursor:
                    cursor.execute(f"USE {db_name}")
                    self.db_connection.commit()
            elif self.current_db_type == 'PostgreSQL':
                with self.db_connection.cursor() as cursor:
                    cursor.execute(f"\\c {db_name}")
                    self.db_connection.commit()
            
            self.current_db = db_name
            self.update_query_tab_info()
            self.load_database_objects()
            self.status_info.setText(f"已打开数据库: {db_name}")
            self.logger.log('INFO', f"打开数据库: {db_name}")
        except Exception as e:
            QMessageBox.critical(self, "打开数据库", f"打开数据库失败: {str(e)}")
            self.logger.log('ERROR', f"打开数据库失败: {str(e)}")
    
    def open_table_data(self, table_name):
        """打开表数据"""
        try:
            # 创建新的查询标签页
            self.add_new_query_tab()
            
            # 获取当前标签页的SQL编辑器
            current_tab = self.tabs.currentWidget()
            if not current_tab:
                return
            
            sql_editor = None
            for widget in current_tab.findChildren(QWidget):
                if isinstance(widget, SQLTextEdit):
                    sql_editor = widget
                    break
            
            if not sql_editor:
                return
            
            # 生成查询语句
            sql = f"SELECT * FROM {table_name} LIMIT 1000"
            sql_editor.setPlainText(sql)
            
            # 执行查询
            self.execute_sql()
            
            self.status_info.setText(f"已打开表: {table_name}")
            self.logger.log('INFO', f"打开表数据: {table_name}")
        except Exception as e:
            QMessageBox.critical(self, "打开表数据", f"打开表数据失败: {str(e)}")
            self.logger.log('ERROR', f"打开表数据失败: {str(e)}")
    
    def design_table(self, table_name):
        """设计表"""
        try:
            # 显示表结构
            self.view_table_structure(table_name)
            self.logger.log('INFO', f"设计表: {table_name}")
        except Exception as e:
            QMessageBox.critical(self, "设计表", f"设计表失败: {str(e)}")
            self.logger.log('ERROR', f"设计表失败: {str(e)}")
    
    def view_table_structure(self, table_name):
        """查看表结构"""
        try:
            if not hasattr(self, 'db_connection'):
                QMessageBox.warning(self, "查看表结构", "请先连接到数据库")
                return
            
            # 创建表结构标签页
            tab_widget = QWidget()
            tab_layout = QVBoxLayout(tab_widget)
            
            # 创建表结构表格
            structure_table = QTableWidget()
            
            if self.current_db_type == 'MySQL':
                with self.db_connection.cursor() as cursor:
                    # 查询表结构
                    cursor.execute(f"DESCRIBE {table_name}")
                    results = cursor.fetchall()
                    
                    if results:
                        # 设置列
                        columns = list(results[0].keys())
                        structure_table.setColumnCount(len(columns))
                        structure_table.setHorizontalHeaderLabels(columns)
                        
                        # 添加数据
                        structure_table.setRowCount(len(results))
                        for row_idx, row_data in enumerate(results):
                            for col_idx, value in enumerate(row_data.values()):
                                item = QTableWidgetItem(str(value))
                                structure_table.setItem(row_idx, col_idx, item)
            elif self.current_db_type == 'PostgreSQL':
                with self.db_connection.cursor() as cursor:
                    # 查询表结构
                    cursor.execute(f"\nSELECT column_name, data_type, character_maximum_length, column_default, is_nullable FROM information_schema.columns WHERE table_name = '{table_name}'")
                    results = cursor.fetchall()
                    
                    if results:
                        # 设置列
                        columns = ['column_name', 'data_type', 'character_maximum_length', 'column_default', 'is_nullable']
                        structure_table.setColumnCount(len(columns))
                        structure_table.setHorizontalHeaderLabels(columns)
                        
                        # 添加数据
                        structure_table.setRowCount(len(results))
                        for row_idx, row_data in enumerate(results):
                            for col_idx, value in enumerate(row_data):
                                item = QTableWidgetItem(str(value))
                                structure_table.setItem(row_idx, col_idx, item)
            elif self.current_db_type == 'SQLite':
                cursor = self.db_connection.cursor()
                # 查询表结构
                cursor.execute(f"PRAGMA table_info({table_name})")
                results = cursor.fetchall()
                
                if results:
                    # 设置列
                    columns = ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk']
                    structure_table.setColumnCount(len(columns))
                    structure_table.setHorizontalHeaderLabels(columns)
                    
                    # 添加数据
                    structure_table.setRowCount(len(results))
                    for row_idx, row_data in enumerate(results):
                        for col_idx, value in enumerate(row_data):
                            item = QTableWidgetItem(str(value))
                            structure_table.setItem(row_idx, col_idx, item)
            
            # 调整列宽
            structure_table.resizeColumnsToContents()
            
            tab_layout.addWidget(structure_table)
            
            # 添加标签页
            tab_index = self.tabs.addTab(tab_widget, f"表结构 - {table_name}")
            self.tabs.setCurrentIndex(tab_index)
            
            self.status_info.setText(f"已查看表结构: {table_name}")
            self.logger.log('INFO', f"查看表结构: {table_name}")
        except Exception as e:
            QMessageBox.critical(self, "查看表结构", f"查看表结构失败: {str(e)}")
            self.logger.log('ERROR', f"查看表结构失败: {str(e)}")
    
    def open_view(self, view_name):
        """打开视图"""
        try:
            # 创建新的查询标签页
            self.add_new_query_tab()
            
            # 获取当前标签页的SQL编辑器
            current_tab = self.tabs.currentWidget()
            if not current_tab:
                return
            
            sql_editor = None
            for widget in current_tab.findChildren(QWidget):
                if isinstance(widget, SQLTextEdit):
                    sql_editor = widget
                    break
            
            if not sql_editor:
                return
            
            # 生成查询语句
            sql = f"SELECT * FROM {view_name} LIMIT 1000"
            sql_editor.setPlainText(sql)
            
            # 执行查询
            self.execute_sql()
            
            self.status_info.setText(f"已打开视图: {view_name}")
            self.logger.log('INFO', f"打开视图: {view_name}")
        except Exception as e:
            QMessageBox.critical(self, "打开视图", f"打开视图失败: {str(e)}")
            self.logger.log('ERROR', f"打开视图失败: {str(e)}")
    
    def view_view_structure(self, view_name):
        """查看视图结构"""
        try:
            if not hasattr(self, 'db_connection'):
                QMessageBox.warning(self, "查看视图结构", "请先连接到数据库")
                return
            
            # 创建视图结构标签页
            tab_widget = QWidget()
            tab_layout = QVBoxLayout(tab_widget)
            
            # 创建视图结构表格
            structure_table = QTableWidget()
            
            if self.current_db_type == 'MySQL':
                with self.db_connection.cursor() as cursor:
                    # 查询视图结构
                    cursor.execute(f"SHOW CREATE VIEW {view_name}")
                    results = cursor.fetchall()
                    
                    if results:
                        # 获取视图定义
                        view_definition = results[0]['Create View'] if isinstance(results[0], dict) else results[0][1]
                        
                        # 创建文本编辑器显示视图定义
                        view_edit = QTextEdit()
                        view_edit.setReadOnly(True)
                        view_edit.setPlainText(view_definition)
                        tab_layout.addWidget(view_edit)
            elif self.current_db_type == 'PostgreSQL':
                with self.db_connection.cursor() as cursor:
                    # 查询视图结构
                    cursor.execute(f"\nSELECT definition FROM pg_views WHERE viewname = '{view_name}'")
                    results = cursor.fetchall()
                    
                    if results:
                        # 获取视图定义
                        view_definition = results[0][0]
                        
                        # 创建文本编辑器显示视图定义
                        view_edit = QTextEdit()
                        view_edit.setReadOnly(True)
                        view_edit.setPlainText(view_definition)
                        tab_layout.addWidget(view_edit)
            
            # 添加标签页
            tab_index = self.tabs.addTab(tab_widget, f"视图结构 - {view_name}")
            self.tabs.setCurrentIndex(tab_index)
            
            self.status_info.setText(f"已查看视图结构: {view_name}")
            self.logger.log('INFO', f"查看视图结构: {view_name}")
        except Exception as e:
            QMessageBox.critical(self, "查看视图结构", f"查看视图结构失败: {str(e)}")
            self.logger.log('ERROR', f"查看视图结构失败: {str(e)}")
    
    def view_procedure(self, procedure_name):
        """查看存储过程"""
        try:
            if not hasattr(self, 'db_connection'):
                QMessageBox.warning(self, "查看存储过程", "请先连接到数据库")
                return
            
            # 创建存储过程标签页
            tab_widget = QWidget()
            tab_layout = QVBoxLayout(tab_widget)
            
            if self.current_db_type == 'MySQL':
                with self.db_connection.cursor() as cursor:
                    # 查询存储过程定义
                    cursor.execute(f"SHOW CREATE PROCEDURE {procedure_name}")
                    results = cursor.fetchall()
                    
                    if results:
                        # 获取存储过程定义
                        proc_definition = results[0]['Create Procedure'] if isinstance(results[0], dict) else results[0][2]
                        
                        # 创建文本编辑器显示存储过程定义
                        proc_edit = QTextEdit()
                        proc_edit.setReadOnly(True)
                        proc_edit.setPlainText(proc_definition)
                        tab_layout.addWidget(proc_edit)
            elif self.current_db_type == 'PostgreSQL':
                with self.db_connection.cursor() as cursor:
                    # 查询存储过程定义
                    cursor.execute(f"\nSELECT prosrc FROM pg_proc WHERE proname = '{procedure_name}'")
                    results = cursor.fetchall()
                    
                    if results:
                        # 获取存储过程定义
                        proc_definition = results[0][0]
                        
                        # 创建文本编辑器显示存储过程定义
                        proc_edit = QTextEdit()
                        proc_edit.setReadOnly(True)
                        proc_edit.setPlainText(proc_definition)
                        tab_layout.addWidget(proc_edit)
            
            # 添加标签页
            tab_index = self.tabs.addTab(tab_widget, f"存储过程 - {procedure_name}")
            self.tabs.setCurrentIndex(tab_index)
            
            self.status_info.setText(f"已查看存储过程: {procedure_name}")
            self.logger.log('INFO', f"查看存储过程: {procedure_name}")
        except Exception as e:
            QMessageBox.critical(self, "查看存储过程", f"查看存储过程失败: {str(e)}")
            self.logger.log('ERROR', f"查看存储过程失败: {str(e)}")
    
    def commit_transaction(self):
        """提交事务"""
        try:
            if not hasattr(self, 'db_connection'):
                QMessageBox.warning(self, "提交事务", "请先连接到数据库")
                return
            
            # 提交事务
            self.db_connection.commit()
            
            self.status_info.setText("事务已提交")
            self.logger.log('INFO', "事务已提交")
        except Exception as e:
            QMessageBox.critical(self, "提交事务", f"提交事务失败: {str(e)}")
            self.logger.log('ERROR', f"提交事务失败: {str(e)}")
    
    def rollback_transaction(self):
        """回滚事务"""
        try:
            if not hasattr(self, 'db_connection'):
                QMessageBox.warning(self, "回滚事务", "请先连接到数据库")
                return
            
            # 回滚事务
            self.db_connection.rollback()
            
            self.status_info.setText("事务已回滚")
            self.logger.log('INFO', "事务已回滚")
        except Exception as e:
            QMessageBox.critical(self, "回滚事务", f"回滚事务失败: {str(e)}")
            self.logger.log('ERROR', f"回滚事务失败: {str(e)}")
    
    def on_object_double_clicked(self, item, column):
        """对象双击事件"""
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if not data:
            return
        
        obj_type, obj_name = data
        
        # 根据对象类型执行不同的操作
        if obj_type == 'database':
            self.open_database(obj_name)
        elif obj_type == 'table':
            self.open_table_data(obj_name)
        elif obj_type == 'view':
            self.open_view(obj_name)
        elif obj_type == 'procedure':
            self.view_procedure(obj_name)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = NavicatStyleSQLTool()
    window.show()
    sys.exit(app.exec())
