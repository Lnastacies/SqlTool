from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QTextEdit, 
                             QPushButton, QSplitter, QLabel, QGroupBox, 
                             QScrollArea, QFrame)
from PyQt6.QtCore import Qt, pyqtSignal

class SqlPreviewDialog(QDialog):
    """SQL预览对话框"""
    
    execute_sql = pyqtSignal()
    
    def __init__(self, sql_statements, parent=None):
        super().__init__(parent)
        self._sql_statements = sql_statements
        self._init_ui()
    
    def _init_ui(self):
        self.setWindowTitle("SQL语句预览")
        self.setMinimumSize(1000, 600)
        self.resize(1200, 700)
        
        main_layout = QVBoxLayout()
        main_layout.setContentsMargins(12, 12, 12, 12)
        main_layout.setSpacing(12)
        
        # 统计信息
        stats_group = QGroupBox("操作统计")
        stats_layout = QHBoxLayout()
        
        total_sql = sum(len(stmts) for stmts in self._sql_statements.values())
        stats_layout.addWidget(QLabel(f"<b>表数量:</b> {len(self._sql_statements)}"))
        stats_layout.addWidget(QLabel(f"<b>SQL语句总数:</b> {total_sql}"))
        
        stats_group.setLayout(stats_layout)
        main_layout.addWidget(stats_group)
        
        # SQL内容区域
        splitter = QSplitter(Qt.Orientation.Vertical)
        
        # 表格列表
        table_list = QFrame()
        table_list_layout = QVBoxLayout(table_list)
        table_list_layout.setContentsMargins(0, 0, 0, 0)
        
        self._table_buttons = []
        for table_name, stmts in self._sql_statements.items():
            btn = QPushButton(f"{table_name} ({len(stmts)} 条)")
            btn.setStyleSheet("text-align: left; padding: 6px 12px;")
            btn.clicked.connect(lambda checked, tn=table_name: self._show_table_sql(tn))
            self._table_buttons.append((table_name, btn))
            table_list_layout.addWidget(btn)
        
        scroll_area = QScrollArea()
        scroll_area.setWidget(table_list)
        scroll_area.setWidgetResizable(True)
        scroll_area.setMaximumHeight(200)
        splitter.addWidget(scroll_area)
        
        # SQL编辑器
        self._sql_editor = QTextEdit()
        self._sql_editor.setReadOnly(True)
        self._sql_editor.setStyleSheet("""
            QTextEdit {
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                font-size: 12px;
                background-color: #1e1e1e;
                color: #d4d4d4;
                border: 1px solid #3c3c3c;
                border-radius: 4px;
            }
        """)
        
        # 添加行号
        self._sql_editor.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)
        splitter.addWidget(self._sql_editor)
        
        splitter.setSizes([200, 400])
        main_layout.addWidget(splitter)
        
        # 按钮区域
        btn_layout = QHBoxLayout()
        btn_layout.setAlignment(Qt.AlignmentFlag.AlignRight)
        btn_layout.setSpacing(12)
        
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        
        execute_btn = QPushButton("执行")
        execute_btn.setStyleSheet("""
            QPushButton {
                background-color: #0078d7;
                color: white;
                border: none;
                padding: 8px 24px;
                border-radius: 4px;
            }
            QPushButton:hover {
                background-color: #005a9e;
            }
        """)
        execute_btn.clicked.connect(self._on_execute)
        
        btn_layout.addWidget(cancel_btn)
        btn_layout.addWidget(execute_btn)
        main_layout.addLayout(btn_layout)
        
        self.setLayout(main_layout)
        
        # 默认显示第一个表的SQL
        if self._sql_statements:
            first_table = next(iter(self._sql_statements.keys()))
            self._show_table_sql(first_table)
    
    def _show_table_sql(self, table_name):
        """显示指定表的SQL语句"""
        stmts = self._sql_statements.get(table_name, [])
        sql_text = "\n\n".join(stmts)
        self._sql_editor.setPlainText(sql_text)
    
    def _on_execute(self):
        """执行SQL"""
        self.execute_sql.emit()
        self.accept()
    
    def get_sql_statements(self):
        """获取所有SQL语句"""
        return self._sql_statements