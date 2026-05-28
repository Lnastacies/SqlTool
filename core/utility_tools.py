#!/usr/bin/env python3
"""
实用工具集
"""

import hashlib
import base64
import json
import re
from datetime import datetime
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QWidget, QPushButton,
    QLabel, QLineEdit, QTextEdit, QComboBox, QTabWidget,
    QCheckBox, QSpinBox, QGroupBox, QMessageBox, QInputDialog
)
from PyQt6.QtCore import Qt


class UtilityToolsDialog(QDialog):
    """实用工具对话框"""
    
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        
        self.setWindowTitle("实用工具")
        self.setGeometry(150, 100, 800, 600)
        self.setMinimumSize(700, 500)
        self.setStyleSheet("""
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QLineEdit, QTextEdit {
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 8px;
                background-color: #ffffff;
            }
            QLineEdit:focus, QTextEdit:focus {
                border: 1px solid #1a73e8;
            }
            QComboBox {
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 6px 12px;
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
        
        # 标签页
        self.tabs = QTabWidget()
        
        # JSON工具
        json_tab = self.create_json_tab()
        self.tabs.addTab(json_tab, "JSON工具")
        
        # 编码转换
        encoding_tab = self.create_encoding_tab()
        self.tabs.addTab(encoding_tab, "编码转换")
        
        # UUID工具
        uuid_tab = self.create_uuid_tab()
        self.tabs.addTab(uuid_tab, "UUID工具")
        
        # SQL工具
        sql_tab = self.create_sql_tools_tab()
        self.tabs.addTab(sql_tab, "SQL工具")
        
        # 时间工具
        datetime_tab = self.create_datetime_tab()
        self.tabs.addTab(datetime_tab, "时间工具")
        
        # 正则表达式
        regex_tab = self.create_regex_tab()
        self.tabs.addTab(regex_tab, "正则表达式")
        
        layout.addWidget(self.tabs)
        
        # 底部按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(self.accept)
        btn_layout.addWidget(close_btn)
        
        layout.addLayout(btn_layout)
    
    def create_json_tab(self):
        """JSON工具标签页"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setSpacing(10)
        
        # 格式化和压缩选项
        options_layout = QHBoxLayout()
        self.json_format_check = QCheckBox("格式化输出")
        self.json_format_check.setChecked(True)
        options_layout.addWidget(self.json_format_check)
        
        self.json_minify_check = QCheckBox("压缩输出")
        options_layout.addWidget(self.json_minify_check)
        options_layout.addStretch()
        
        layout.addLayout(options_layout)
        
        # 输入
        input_label = QLabel("输入:")
        layout.addWidget(input_label)
        
        input_widget = QTextEdit()
        input_widget.setPlaceholderText("输入JSON字符串...")
        layout.addWidget(input_widget, 1)
        
        # 按钮
        btn_layout = QHBoxLayout()
        format_btn = QPushButton("格式化/验证")
        format_btn.setObjectName("primary")
        format_btn.clicked.connect(lambda: self.format_json(input_widget))
        btn_layout.addWidget(format_btn)
        
        minify_btn = QPushButton("压缩")
        minify_btn.clicked.connect(lambda: self.minify_json(input_widget))
        btn_layout.addWidget(minify_btn)
        
        btn_layout.addStretch()
        layout.addLayout(btn_layout)
        
        # 输出
        output_label = QLabel("输出:")
        layout.addWidget(output_label)
        
        output_widget = QTextEdit()
        output_widget.setReadOnly(True)
        output_widget.setPlaceholderText("输出结果...")
        layout.addWidget(output_widget, 1)
        
        # 保存结果引用
        self.json_output = output_widget
        
        return tab
    
    def format_json(self, input_widget):
        """格式化JSON"""
        try:
            text = input_widget.toPlainText()
            if not text:
                self.json_output.setPlainText("请输入JSON字符串")
                return
            
            data = json.loads(text)
            formatted = json.dumps(data, ensure_ascii=False, indent=2)
            self.json_output.setPlainText(formatted)
            
        except json.JSONDecodeError as e:
            self.json_output.setPlainText(f"JSON格式错误:\n{str(e)}")
        except Exception as e:
            self.json_output.setPlainText(f"错误:\n{str(e)}")
    
    def minify_json(self, input_widget):
        """压缩JSON"""
        try:
            text = input_widget.toPlainText()
            if not text:
                self.json_output.setPlainText("请输入JSON字符串")
                return
            
            data = json.loads(text)
            minified = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
            self.json_output.setPlainText(minified)
            
        except json.JSONDecodeError as e:
            self.json_output.setPlainText(f"JSON格式错误:\n{str(e)}")
        except Exception as e:
            self.json_output.setPlainText(f"错误:\n{str(e)}")
    
    def create_encoding_tab(self):
        """编码转换标签页"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setSpacing(10)
        
        # 编码类型选择
        type_layout = QHBoxLayout()
        type_layout.addWidget(QLabel("转换类型:"))
        
        type_combo = QComboBox()
        type_combo.addItems([
            "文本 -> Base64",
            "Base64 -> 文本",
            "文本 -> MD5",
            "文本 -> SHA1",
            "文本 -> SHA256",
            "URL编码",
            "URL解码",
            "HTML实体编码",
            "HTML实体解码",
        ])
        type_layout.addWidget(type_combo, 1)
        layout.addLayout(type_layout)
        
        # 输入
        layout.addWidget(QLabel("输入:"))
        input_widget = QTextEdit()
        input_widget.setPlaceholderText("输入要转换的文本...")
        layout.addWidget(input_widget, 1)
        
        # 按钮
        convert_btn = QPushButton("转换")
        convert_btn.setObjectName("primary")
        convert_btn.clicked.connect(lambda: self.convert_encoding(input_widget, type_combo))
        layout.addWidget(convert_btn)
        
        # 输出
        layout.addWidget(QLabel("输出:"))
        output_widget = QTextEdit()
        output_widget.setReadOnly(True)
        output_widget.setPlaceholderText("转换结果...")
        layout.addWidget(output_widget, 1)
        
        # 保存引用
        self.encoding_output = output_widget
        
        return tab
    
    def convert_encoding(self, input_widget, type_combo):
        """执行编码转换"""
        text = input_widget.toPlainText()
        if not text:
            self.encoding_output.setPlainText("请输入文本")
            return
        
        try:
            conversion_type = type_combo.currentText()
            
            if "Base64" in conversion_type:
                if "->" in conversion_type:
                    # 文本转Base64
                    encoded = base64.b64encode(text.encode('utf-8')).decode('ascii')
                    self.encoding_output.setPlainText(encoded)
                else:
                    # Base64转文本
                    decoded = base64.b64decode(text.encode('ascii')).decode('utf-8')
                    self.encoding_output.setPlainText(decoded)
            
            elif "MD5" in conversion_type:
                md5_hash = hashlib.md5(text.encode('utf-8')).hexdigest()
                self.encoding_output.setPlainText(md5_hash)
            
            elif "SHA1" in conversion_type:
                sha1_hash = hashlib.sha1(text.encode('utf-8')).hexdigest()
                self.encoding_output.setPlainText(sha1_hash)
            
            elif "SHA256" in conversion_type:
                sha256_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()
                self.encoding_output.setPlainText(sha256_hash)
            
            elif "URL" in conversion_type:
                from urllib.parse import quote, unquote
                if "编码" in conversion_type:
                    self.encoding_output.setPlainText(quote(text))
                else:
                    self.encoding_output.setPlainText(unquote(text))
            
            elif "HTML" in conversion_type:
                import html
                if "编码" in conversion_type:
                    self.encoding_output.setPlainText(html.escape(text))
                else:
                    self.encoding_output.setPlainText(html.unescape(text))
        
        except Exception as e:
            self.encoding_output.setPlainText(f"转换错误:\n{str(e)}")
    
    def create_uuid_tab(self):
        """UUID工具标签页"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setSpacing(10)
        
        # 生成按钮
        gen_layout = QHBoxLayout()
        gen_layout.addWidget(QLabel("生成UUID:"))
        gen_layout.addStretch()
        
        gen_btn = QPushButton("生成新UUID")
        gen_btn.setObjectName("primary")
        gen_btn.clicked.connect(lambda: self.generate_uuid())
        gen_layout.addWidget(gen_btn)
        
        layout.addLayout(gen_layout)
        
        # UUID显示
        self.uuid_display = QLineEdit()
        self.uuid_display.setReadOnly(True)
        self.uuid_display.setPlaceholderText("点击按钮生成UUID...")
        layout.addWidget(self.uuid_display)
        
        # 批量生成
        batch_layout = QHBoxLayout()
        batch_layout.addWidget(QLabel("批量生成数量:"))
        batch_spin = QSpinBox()
        batch_spin.setRange(1, 100)
        batch_spin.setValue(10)
        batch_layout.addWidget(batch_spin)
        
        batch_btn = QPushButton("批量生成")
        batch_btn.clicked.connect(lambda: self.batch_generate_uuid(batch_spin.value()))
        batch_layout.addWidget(batch_btn)
        batch_layout.addStretch()
        
        layout.addLayout(batch_layout)
        
        # 批量结果
        layout.addWidget(QLabel("批量结果:"))
        uuid_list = QTextEdit()
        uuid_list.setReadOnly(True)
        uuid_list.setPlaceholderText("批量生成的UUID列表...")
        layout.addWidget(uuid_list, 1)
        self.uuid_list = uuid_list
        
        return tab
    
    def generate_uuid(self):
        """生成单个UUID"""
        import uuid
        new_uuid = str(uuid.uuid4())
        self.uuid_display.setText(new_uuid)
    
    def batch_generate_uuid(self, count):
        """批量生成UUID"""
        import uuid
        uuids = [str(uuid.uuid4()) for _ in range(count)]
        self.uuid_list.setPlainText('\n'.join(uuids))
    
    def create_sql_tools_tab(self):
        """SQL工具标签页"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setSpacing(10)
        
        # SQL转义
        escape_group = QGroupBox("SQL注入防护 - 转义")
        escape_layout = QVBoxLayout(escape_group)
        
        escape_input = QTextEdit()
        escape_input.setPlaceholderText("输入要转义的字符串...")
        escape_layout.addWidget(escape_input, 1)
        
        escape_btn = QPushButton("转义SQL特殊字符")
        escape_btn.setObjectName("primary")
        escape_layout.addWidget(escape_btn)
        
        escape_output = QTextEdit()
        escape_output.setReadOnly(True)
        escape_output.setPlaceholderText("转义结果...")
        escape_layout.addWidget(escape_output, 1)
        
        escape_btn.clicked.connect(lambda: self.escape_sql_string(escape_input, escape_output))
        
        layout.addWidget(escape_group, 1)
        
        return tab
    
    def escape_sql_string(self, input_widget, output_widget):
        """转义SQL字符串"""
        text = input_widget.toPlainText()
        if not text:
            output_widget.setPlainText("请输入字符串")
            return
        
        # 基本SQL转义
        escaped = text.replace("'", "''").replace("\\", "\\\\")
        output_widget.setPlainText(escaped)
    
    def create_datetime_tab(self):
        """时间工具标签页"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setSpacing(10)
        
        # 时间戳转换
        timestamp_group = QGroupBox("时间戳转换")
        timestamp_layout = QVBoxLayout(timestamp_group)
        
        ts_input_layout = QHBoxLayout()
        ts_input_layout.addWidget(QLabel("时间戳/日期:"))
        ts_input = QLineEdit()
        ts_input.setPlaceholderText("输入时间戳或日期字符串...")
        ts_input_layout.addWidget(ts_input, 1)
        timestamp_layout.addLayout(ts_input_layout)
        
        ts_btn_layout = QHBoxLayout()
        to_timestamp_btn = QPushButton("转时间戳")
        to_timestamp_btn.clicked.connect(lambda: self.to_timestamp(ts_input))
        ts_btn_layout.addWidget(to_timestamp_btn)
        
        from_timestamp_btn = QPushButton("从时间戳转日期")
        from_timestamp_btn.clicked.connect(lambda: self.from_timestamp(ts_input))
        ts_btn_layout.addWidget(from_timestamp_btn)
        
        current_btn = QPushButton("当前时间")
        current_btn.clicked.connect(self.insert_current_datetime)
        ts_btn_layout.addWidget(current_btn)
        ts_btn_layout.addStretch()
        
        timestamp_layout.addLayout(ts_btn_layout)
        
        ts_output = QTextEdit()
        ts_output.setReadOnly(True)
        ts_output.setMaximumHeight(80)
        ts_output.setPlaceholderText("转换结果...")
        timestamp_layout.addWidget(ts_output)
        self.datetime_output = ts_output
        
        layout.addWidget(timestamp_group)
        
        # 常用时间格式
        format_group = QGroupBox("常用时间格式")
        format_layout = QVBoxLayout(format_group)
        
        now = datetime.now()
        formats = [
            ("完整日期时间", now.strftime("%Y-%m-%d %H:%M:%S")),
            ("日期", now.strftime("%Y-%m-%d")),
            ("时间", now.strftime("%H:%M:%S")),
            ("ISO格式", now.isoformat()),
            ("Unix时间戳", str(int(now.timestamp()))),
        ]
        
        for name, value in formats:
            format_layout.addWidget(QLabel(f"{name}: {value}"))
        
        layout.addWidget(format_group)
        
        return tab
    
    def to_timestamp(self, input_widget):
        """日期转时间戳"""
        try:
            text = input_widget.text().strip()
            if not text:
                self.datetime_output.setPlainText("请输入日期字符串")
                return
            
            dt = datetime.strptime(text, "%Y-%m-%d %H:%M:%S")
            timestamp = int(dt.timestamp())
            self.datetime_output.setPlainText(f"时间戳: {timestamp}")
            
        except ValueError:
            self.datetime_output.setPlainText("日期格式错误，请使用 YYYY-MM-DD HH:MM:SS")
        except Exception as e:
            self.datetime_output.setPlainText(f"错误: {str(e)}")
    
    def from_timestamp(self, input_widget):
        """时间戳转日期"""
        try:
            text = input_widget.text().strip()
            if not text:
                self.datetime_output.setPlainText("请输入时间戳")
                return
            
            timestamp = int(text)
            dt = datetime.fromtimestamp(timestamp)
            self.datetime_output.setPlainText(f"日期时间: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
            
        except ValueError:
            self.datetime_output.setPlainText("时间戳格式错误")
        except Exception as e:
            self.datetime_output.setPlainText(f"错误: {str(e)}")
    
    def insert_current_datetime(self):
        """插入当前时间"""
        now = datetime.now()
        self.datetime_output.setPlainText(f"当前时间: {now.strftime('%Y-%m-%d %H:%M:%S')}\n时间戳: {int(now.timestamp())}")
    
    def create_regex_tab(self):
        """正则表达式标签页"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setSpacing(10)
        
        # 正则表达式
        regex_layout = QHBoxLayout()
        regex_layout.addWidget(QLabel("正则表达式:"))
        regex_input = QLineEdit()
        regex_input.setPlaceholderText("输入正则表达式...")
        regex_layout.addWidget(regex_input, 1)
        layout.addLayout(regex_layout)
        
        # 选项
        options_layout = QHBoxLayout()
        self.regex_case_check = QCheckBox("忽略大小写")
        options_layout.addWidget(self.regex_case_check)
        
        self.regex_multiline_check = QCheckBox("多行模式")
        options_layout.addWidget(self.regex_multiline_check)
        options_layout.addStretch()
        layout.addLayout(options_layout)
        
        # 测试文本
        layout.addWidget(QLabel("测试文本:"))
        test_input = QTextEdit()
        test_input.setPlaceholderText("输入要测试的文本...")
        layout.addWidget(test_input, 1)
        
        # 按钮
        test_btn = QPushButton("测试匹配")
        test_btn.setObjectName("primary")
        test_btn.clicked.connect(lambda: self.test_regex(regex_input, test_input))
        layout.addWidget(test_btn)
        
        # 结果
        layout.addWidget(QLabel("匹配结果:"))
        regex_output = QTextEdit()
        regex_output.setReadOnly(True)
        regex_output.setPlaceholderText("匹配结果...")
        layout.addWidget(regex_output, 1)
        self.regex_output = regex_output
        
        return tab
    
    def test_regex(self, regex_input, test_input):
        """测试正则表达式"""
        try:
            pattern = regex_input.text()
            text = test_input.toPlainText()
            
            if not pattern or not text:
                self.regex_output.setPlainText("请输入正则表达式和测试文本")
                return
            
            flags = re.IGNORECASE if self.regex_case_check.isChecked() else 0
            
            if self.regex_multiline_check.isChecked():
                flags |= re.MULTILINE
            
            regex = re.compile(pattern, flags)
            matches = regex.findall(text)
            
            if matches:
                result = f"找到 {len(matches)} 个匹配:\n\n"
                for i, match in enumerate(matches, 1):
                    result += f"{i}. {match}\n"
                
                # 显示分组
                for match_obj in regex.finditer(text):
                    if match_obj.groups():
                        result += f"\n分组: {match_obj.groups()}"
                
                self.regex_output.setPlainText(result)
            else:
                self.regex_output.setPlainText("没有找到匹配")
        
        except re.error as e:
            self.regex_output.setPlainText(f"正则表达式错误:\n{str(e)}")
        except Exception as e:
            self.regex_output.setPlainText(f"错误:\n{str(e)}")


class PasswordGenerator:
    """密码生成器"""
    
    @staticmethod
    def generate(length=16, use_uppercase=True, use_lowercase=True, 
                use_digits=True, use_special=True):
        """生成随机密码
        
        Args:
            length: 密码长度
            use_uppercase: 是否包含大写字母
            use_lowercase: 是否包含小写字母
            use_digits: 是否包含数字
            use_special: 是否包含特殊字符
            
        Returns:
            生成的密码字符串
        """
        import random
        import string
        
        chars = ""
        if use_uppercase:
            chars += string.ascii_uppercase
        if use_lowercase:
            chars += string.ascii_lowercase
        if use_digits:
            chars += string.digits
        if use_special:
            chars += "!@#$%^&*()_+-=[]{}|;:,.<>?"
        
        if not chars:
            chars = string.ascii_letters + string.digits
        
        password = ''.join(random.choice(chars) for _ in range(length))
        
        # 确保包含所有要求的字符类型
        required_chars = []
        if use_uppercase:
            required_chars.append(random.choice(string.ascii_uppercase))
        if use_lowercase:
            required_chars.append(random.choice(string.ascii_lowercase))
        if use_digits:
            required_chars.append(random.choice(string.digits))
        if use_special:
            required_chars.append(random.choice("!@#$%^&*()_+-=[]{}|;:,.<>?"))
        
        # 替换密码中的字符确保包含所有类型
        password_list = list(password)
        for char in required_chars:
            if char not in password_list:
                idx = random.randint(0, len(password_list) - 1)
                password_list[idx] = char
        
        random.shuffle(password_list)
        return ''.join(password_list)
