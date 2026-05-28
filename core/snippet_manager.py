#!/usr/bin/env python3
"""
代码片段管理器
"""

import json
import os
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QLabel, QLineEdit, QTextEdit, QComboBox, QMessageBox,
    QMenu, QToolBar, QHeaderView, QAbstractItemView, QCompleter, QInputDialog
)
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QAction, QCursor, QFont


class SnippetManager:
    """代码片段管理器（全局单例）"""
    
    _instance = None
    _snippets = {}
    _categories = ['常用', 'DDL', 'DML', '查询优化', '备份', '自定义']
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load_snippets()
        return cls._instance
    
    def _load_snippets(self):
        """加载代码片段"""
        self._snippets = {
            '常用': [
                {
                    'name': '分页查询',
                    'sql': 'SELECT * FROM table_name\nORDER BY id DESC\nLIMIT {limit} OFFSET {offset}',
                    'description': '通用的分页查询模板'
                },
                {
                    'name': '新增记录',
                    'sql': "INSERT INTO table_name (column1, column2)\nVALUES ('value1', 'value2')",
                    'description': '插入单条记录'
                },
                {
                    'name': '批量新增',
                    'sql': "INSERT INTO table_name (column1, column2)\nVALUES \n  ('value1', 'value2'),\n  ('value3', 'value4')",
                    'description': '批量插入多条记录'
                },
                {
                    'name': '更新记录',
                    'sql': "UPDATE table_name\nSET column1 = 'new_value'\nWHERE id = {id}",
                    'description': '更新指定记录'
                },
                {
                    'name': '删除记录',
                    'sql': "DELETE FROM table_name\nWHERE id = {id}",
                    'description': '删除指定记录'
                },
                {
                    'name': '表结构查询',
                    'sql': "DESCRIBE table_name",
                    'description': '查看表结构（MySQL）'
                },
            ],
            'DDL': [
                {
                    'name': '创建表',
                    'sql': "CREATE TABLE table_name (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  INDEX idx_name (name)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
                    'description': '创建新表模板'
                },
                {
                    'name': '添加字段',
                    'sql': "ALTER TABLE table_name\nADD COLUMN column_name VARCHAR(100) AFTER existing_column",
                    'description': '添加新字段'
                },
                {
                    'name': '修改字段',
                    'sql': "ALTER TABLE table_name\nMODIFY COLUMN column_name VARCHAR(200)",
                    'description': '修改字段定义'
                },
                {
                    'name': '添加索引',
                    'sql': "CREATE INDEX idx_column ON table_name(column_name)",
                    'description': '创建索引'
                },
                {
                    'name': '添加外键',
                    'sql': "ALTER TABLE child_table\nADD CONSTRAINT fk_parent\nFOREIGN KEY (parent_id) REFERENCES parent_table(id)\nON DELETE CASCADE",
                    'description': '添加外键约束'
                },
            ],
            'DML': [
                {
                    'name': 'ON DUPLICATE KEY',
                    'sql': "INSERT INTO table_name (id, name)\nVALUES (1, 'name1'), (2, 'name2')\nON DUPLICATE KEY UPDATE name = VALUES(name)",
                    'description': '插入或更新（MySQL）'
                },
                {
                    'name': 'REPLACE INTO',
                    'sql': "REPLACE INTO table_name (id, name)\nVALUES (1, 'name')",
                    'description': '替换插入（删除旧记录后插入新记录）'
                },
                {
                    'name': 'UPSERT (PostgreSQL)',
                    'sql': "INSERT INTO table_name (id, name)\nVALUES (1, 'name')\nON CONFLICT (id) DO UPDATE SET\n  name = EXCLUDED.name",
                    'description': '插入或更新（PostgreSQL）'
                },
                {
                    'name': '批量更新',
                    'sql': "UPDATE table_name\nSET column1 = CASE id\n  WHEN 1 THEN 'value1'\n  WHEN 2 THEN 'value2'\nEND\nWHERE id IN (1, 2)",
                    'description': '使用CASE进行批量更新'
                },
            ],
            '查询优化': [
                {
                    'name': 'EXPLAIN分析',
                    'sql': "EXPLAIN SELECT * FROM table_name WHERE condition",
                    'description': '分析查询执行计划'
                },
                {
                    'name': '慢查询分析',
                    'sql': "SELECT * FROM information_schema.processlist\nWHERE command != 'Sleep' AND time > 5\nORDER BY time DESC",
                    'description': '查看长时间运行的查询'
                },
                {
                    'name': '表分析',
                    'sql': "ANALYZE TABLE table_name",
                    'description': '更新表统计信息'
                },
                {
                    'name': '强制使用索引',
                    'sql': "SELECT * FROM table_name FORCE INDEX (idx_name)\nWHERE condition",
                    'description': '强制使用指定索引'
                },
            ],
            '备份': [
                {
                    'name': '备份表结构',
                    'sql': "CREATE TABLE backup_table AS SELECT * FROM original_table WHERE 1=0",
                    'description': '仅复制表结构'
                },
                {
                    'name': '备份表数据',
                    'sql': "CREATE TABLE backup_table AS SELECT * FROM original_table",
                    'description': '复制表和数据'
                },
                {
                    'name': '恢复数据',
                    'sql': "INSERT INTO target_table SELECT * FROM backup_table",
                    'description': '从备份表恢复数据'
                },
            ],
        }
        
        self._load_from_file()
    
    def _load_from_file(self):
        """从文件加载自定义片段"""
        if os.path.exists('snippets.json'):
            try:
                with open('snippets.json', 'r', encoding='utf-8') as f:
                    custom = json.load(f)
                    if '自定义' not in self._snippets:
                        self._snippets['自定义'] = []
                    self._snippets['自定义'].extend(custom)
            except Exception:
                pass
    
    def _save_to_file(self):
        """保存自定义片段到文件"""
        custom_snippets = self._snippets.get('自定义', [])
        try:
            with open('snippets.json', 'w', encoding='utf-8') as f:
                json.dump(custom_snippets, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    
    def get_categories(self):
        """获取分类列表"""
        return list(self._snippets.keys())
    
    def get_snippets(self, category=None):
        """获取代码片段"""
        if category:
            return self._snippets.get(category, [])
        return self._snippets
    
    def get_snippet(self, category, name):
        """获取指定片段"""
        snippets = self._snippets.get(category, [])
        for snippet in snippets:
            if snippet['name'] == name:
                return snippet
        return None
    
    def add_snippet(self, category, name, sql, description=''):
        """添加代码片段"""
        if category not in self._snippets:
            self._snippets[category] = []
        
        self._snippets[category].append({
            'name': name,
            'sql': sql,
            'description': description
        })
        
        if category == '自定义':
            self._save_to_file()
    
    def update_snippet(self, category, old_name, name, sql, description=''):
        """更新代码片段"""
        snippets = self._snippets.get(category, [])
        for snippet in snippets:
            if snippet['name'] == old_name:
                snippet['name'] = name
                snippet['sql'] = sql
                snippet['description'] = description
                break
        
        if category == '自定义':
            self._save_to_file()
    
    def delete_snippet(self, category, name):
        """删除代码片段"""
        snippets = self._snippets.get(category, [])
        self._snippets[category] = [s for s in snippets if s['name'] != name]
        
        if category == '自定义':
            self._save_to_file()
    
    def add_category(self, name):
        """添加分类"""
        if name not in self._snippets:
            self._snippets[name] = []


class SnippetDialog(QDialog):
    """代码片段对话框"""
    
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.snippet_manager = SnippetManager()
        self.selected_sql = ""
        
        self.setWindowTitle("代码片段")
        self.setGeometry(200, 100, 800, 550)
        self.setMinimumSize(600, 400)
        self.setStyleSheet("""
            QDialog {
                background-color: #FFFFFF;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QTableWidget {
                border: 1px solid #E0E0E0;
                background-color: #FFFFFF;
                font-size: 12px;
            }
            QTableWidget::item {
                padding: 6px 8px;
            }
            QTableWidget::item:selected {
                background-color: #E3F2FD;
            }
            QTextEdit {
                border: 1px solid #E0E0E0;
                background-color: #FAFAFA;
                font-family: 'Consolas', monospace;
                font-size: 12px;
            }
            QPushButton {
                background-color: #F0F0F0;
                border: 1px solid #D0D0D0;
                border-radius: 3px;
                padding: 6px 16px;
            }
            QPushButton:hover {
                background-color: #E0E0E0;
            }
            QPushButton#primary {
                background-color: #1A73E8;
                color: white;
                border: none;
            }
            QPushButton#primary:hover {
                background-color: #1557B0;
            }
            QLabel {
                font-size: 12px;
                color: #666666;
            }
            QComboBox {
                border: 1px solid #D0D0D0;
                border-radius: 3px;
                padding: 6px;
            }
        """)
        
        self.setup_ui()
        self.load_snippets()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(10)
        layout.setContentsMargins(12, 12, 12, 12)
        
        # 分类和搜索
        top_layout = QHBoxLayout()
        
        top_layout.addWidget(QLabel("分类:"))
        self.category_combo = QComboBox()
        self.category_combo.addItems(self.snippet_manager.get_categories())
        self.category_combo.currentTextChanged.connect(self.on_category_changed)
        top_layout.addWidget(self.category_combo)
        
        top_layout.addWidget(QLabel("搜索:"))
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("输入名称搜索...")
        self.search_input.textChanged.connect(self.filter_snippets)
        top_layout.addWidget(self.search_input, 1)
        
        # 添加按钮
        add_btn = QPushButton("+ 添加")
        add_btn.clicked.connect(self.add_snippet)
        top_layout.addWidget(add_btn)
        
        layout.addLayout(top_layout)
        
        # 主内容区域
        content_layout = QHBoxLayout()
        
        # 片段列表
        list_layout = QVBoxLayout()
        self.snippet_table = QTableWidget()
        self.snippet_table.setColumnCount(2)
        self.snippet_table.setHorizontalHeaderLabels(["名称", "描述"])
        self.snippet_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.snippet_table.setAlternatingRowColors(True)
        self.snippet_table.horizontalHeader().setStretchLastSection(True)
        self.snippet_table.itemClicked.connect(self.on_snippet_selected)
        self.snippet_table.itemDoubleClicked.connect(self.on_insert)
        self.snippet_table.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.snippet_table.customContextMenuRequested.connect(self.show_context_menu)
        list_layout.addWidget(self.snippet_table)
        
        content_layout.addLayout(list_layout, 1)
        
        # SQL预览
        preview_layout = QVBoxLayout()
        preview_layout.addWidget(QLabel("SQL内容:"))
        self.sql_preview = QTextEdit()
        self.sql_preview.setReadOnly(True)
        preview_layout.addWidget(self.sql_preview, 1)
        
        content_layout.addLayout(preview_layout, 2)
        
        layout.addLayout(content_layout, 1)
        
        # 底部按钮
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        
        edit_btn = QPushButton("编辑")
        edit_btn.clicked.connect(self.edit_snippet)
        button_layout.addWidget(edit_btn)
        
        insert_btn = QPushButton("插入到编辑器")
        insert_btn.setObjectName("primary")
        insert_btn.clicked.connect(self.on_insert)
        button_layout.addWidget(insert_btn)
        
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(self.accept)
        button_layout.addWidget(close_btn)
        
        layout.addLayout(button_layout)
    
    def load_snippets(self, category=None):
        """加载代码片段"""
        category = category or self.category_combo.currentText()
        snippets = self.snippet_manager.get_snippets(category)
        
        self.snippet_table.setRowCount(len(snippets))
        for row, snippet in enumerate(snippets):
            self.snippet_table.setItem(row, 0, QTableWidgetItem(snippet['name']))
            self.snippet_table.setItem(row, 1, QTableWidgetItem(snippet.get('description', '')))
    
    def on_category_changed(self, category):
        """分类变化"""
        self.load_snippets(category)
    
    def filter_snippets(self, text):
        """筛选片段"""
        if not text:
            self.load_snippets()
            return
        
        text_lower = text.lower()
        category = self.category_combo.currentText()
        snippets = self.snippet_manager.get_snippets(category)
        
        filtered = [s for s in snippets if text_lower in s['name'].lower()]
        self.snippet_table.setRowCount(len(filtered))
        for row, snippet in enumerate(filtered):
            self.snippet_table.setItem(row, 0, QTableWidgetItem(snippet['name']))
            self.snippet_table.setItem(row, 1, QTableWidgetItem(snippet.get('description', '')))
    
    def on_snippet_selected(self, item):
        """选中片段"""
        row = item.row()
        sql_item = self.snippet_table.item(row, 0)
        if sql_item:
            category = self.category_combo.currentText()
            name = sql_item.text()
            snippet = self.snippet_manager.get_snippet(category, name)
            if snippet:
                self.sql_preview.setPlainText(snippet['sql'])
    
    def on_insert(self):
        """插入到编辑器"""
        current_item = self.snippet_table.currentItem()
        if current_item:
            row = current_item.row()
            name_item = self.snippet_table.item(row, 0)
            if name_item:
                category = self.category_combo.currentText()
                snippet = self.snippet_manager.get_snippet(category, name_item.text())
                if snippet:
                    self.selected_sql = snippet['sql']
                    self.accept()
    
    def add_snippet(self):
        """添加片段"""
        editor = SnippetEditorDialog(self, self.snippet_manager.get_categories())
        if editor.exec():
            data = editor.get_data()
            self.snippet_manager.add_snippet(data['category'], data['name'], 
                                            data['sql'], data['description'])
            self.load_snippets()
    
    def edit_snippet(self):
        """编辑片段"""
        row = self.snippet_table.currentRow()
        if row < 0:
            QMessageBox.warning(self, "提示", "请先选择一个代码片段")
            return
        
        name_item = self.snippet_table.item(row, 0)
        if name_item:
            category = self.category_combo.currentText()
            snippet = self.snippet_manager.get_snippet(category, name_item.text())
            if snippet:
                editor = SnippetEditorDialog(self, self.snippet_manager.get_categories(), snippet)
                if editor.exec():
                    data = editor.get_data()
                    self.snippet_manager.update_snippet(category, snippet['name'],
                                                       data['name'], data['sql'], data['description'])
                    self.load_snippets()
    
    def show_context_menu(self, pos):
        """右键菜单"""
        menu = QMenu()
        menu.addAction("插入", self.on_insert)
        menu.addAction("编辑", self.edit_snippet)
        menu.addAction("删除", self.delete_snippet)
        menu.exec(QCursor.pos())
    
    def delete_snippet(self):
        """删除片段"""
        row = self.snippet_table.currentRow()
        if row < 0:
            QMessageBox.warning(self, "提示", "请先选择一个代码片段")
            return
        
        name_item = self.snippet_table.item(row, 0)
        if name_item:
            category = self.category_combo.currentText()
            name = name_item.text()
            
            if QMessageBox.question(self, "删除确认", 
                                  f"确定要删除代码片段 '{name}' 吗？",
                                  QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) != QMessageBox.StandardButton.Yes:
                return
            
            self.snippet_manager.delete_snippet(category, name)
            self.load_snippets()


class SnippetEditorDialog(QDialog):
    """代码片段编辑器"""
    
    def __init__(self, parent=None, categories=None, snippet=None):
        super().__init__(parent)
        self.parent = parent
        self.snippet = snippet
        self.categories = categories or ['常用', 'DDL', 'DML', '查询优化', '备份', '自定义']
        
        self.setWindowTitle("编辑代码片段" if snippet else "添加代码片段")
        self.setGeometry(300, 200, 600, 450)
        self.setMinimumSize(500, 350)
        self.setStyleSheet("""
            QDialog {
                background-color: #FFFFFF;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QTextEdit, QLineEdit {
                border: 1px solid #D0D0D0;
                border-radius: 3px;
                padding: 6px;
            }
            QTextEdit {
                font-family: 'Consolas', monospace;
            }
            QPushButton {
                background-color: #F0F0F0;
                border: 1px solid #D0D0D0;
                border-radius: 3px;
                padding: 6px 20px;
            }
            QPushButton:hover {
                background-color: #E0E0E0;
            }
            QPushButton#primary {
                background-color: #1A73E8;
                color: white;
                border: none;
            }
            QPushButton#primary:hover {
                background-color: #1557B0;
            }
        """)
        
        self.setup_ui()
        if snippet:
            self.set_data(snippet)
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(16, 16, 16, 16)
        
        # 名称
        name_layout = QHBoxLayout()
        name_layout.addWidget(QLabel("名称:"))
        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("输入片段名称...")
        name_layout.addWidget(self.name_input, 1)
        layout.addLayout(name_layout)
        
        # 分类
        cat_layout = QHBoxLayout()
        cat_layout.addWidget(QLabel("分类:"))
        self.category_combo = QComboBox()
        self.category_combo.addItems(self.categories)
        cat_layout.addWidget(self.category_combo, 1)
        layout.addLayout(cat_layout)
        
        # 描述
        desc_layout = QHBoxLayout()
        desc_layout.addWidget(QLabel("描述:"))
        self.desc_input = QLineEdit()
        self.desc_input.setPlaceholderText("输入片段描述...")
        desc_layout.addWidget(self.desc_input, 1)
        layout.addLayout(desc_layout)
        
        # SQL
        layout.addWidget(QLabel("SQL语句:"))
        self.sql_editor = QTextEdit()
        self.sql_editor.setPlaceholderText("输入SQL语句...")
        layout.addWidget(self.sql_editor, 1)
        
        # 按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        save_btn = QPushButton("保存")
        save_btn.setObjectName("primary")
        save_btn.clicked.connect(self.accept)
        btn_layout.addWidget(save_btn)
        
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)
        
        layout.addLayout(btn_layout)
    
    def set_data(self, snippet):
        """设置数据"""
        self.name_input.setText(snippet['name'])
        self.desc_input.setText(snippet.get('description', ''))
        self.sql_editor.setPlainText(snippet['sql'])
    
    def get_data(self):
        """获取数据"""
        return {
            'name': self.name_input.text().strip(),
            'category': self.category_combo.currentText(),
            'description': self.desc_input.text().strip(),
            'sql': self.sql_editor.toPlainText()
        }


class SnippetCompleter:
    """代码片段自动补全"""
    
    def __init__(self, main_window):
        self.main_window = main_window
        self.snippet_manager = SnippetManager()
    
    def get_completions(self, prefix):
        """获取补全建议"""
        prefix_lower = prefix.lower()
        results = []
        
        for category, snippets in self.snippet_manager.get_snippets().items():
            for snippet in snippets:
                if prefix_lower in snippet['name'].lower():
                    results.append({
                        'name': snippet['name'],
                        'sql': snippet['sql'],
                        'display': f"{snippet['name']} ({category})"
                    })
        
        return results
