#!/usr/bin/env python3
"""
查询历史记录管理器
"""

import json
import os
from datetime import datetime
from PyQt6.QtWidgets import QDialog, QVBoxLayout, QHBoxLayout, QListWidget, QListWidgetItem, QPushButton, QTextEdit, QLabel, QLineEdit, QWidget, QAbstractItemView
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QFont, QColor, QCursor

class QueryHistoryManager:
    """查询历史记录管理器"""
    def __init__(self, main_window):
        self.main_window = main_window
        self.max_history = 500
        self.history_file = "query_history.json"
        self.history = []
        self.load_history()
    
    def load_history(self):
        """加载历史记录"""
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    self.history = json.load(f)
            except Exception:
                self.history = []
    
    def save_history(self):
        """保存历史记录"""
        try:
            with open(self.history_file, 'w', encoding='utf-8') as f:
                json.dump(self.history, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    
    def add_query(self, sql, connection_name="", database="", execution_time=0, row_count=0, success=True, error_message=""):
        """添加查询到历史记录"""
        entry = {
            'id': len(self.history) + 1,
            'sql': sql.strip(),
            'connection': connection_name,
            'database': database,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'execution_time': execution_time,
            'row_count': row_count,
            'success': success,
            'error': error_message
        }
        
        # 检查是否与上一条记录完全相同，避免重复
        if self.history and self.history[0].get('sql') == entry['sql']:
            return
        
        # 添加到历史列表开头
        self.history.insert(0, entry)
        
        # 限制历史记录数量
        if len(self.history) > self.max_history:
            self.history = self.history[:self.max_history]
        
        self.save_history()
    
    def get_history(self, filter_text=""):
        """获取历史记录（可筛选）"""
        if not filter_text:
            return self.history
        
        filter_lower = filter_text.lower()
        return [h for h in self.history if filter_lower in h['sql'].lower()]
    
    def clear_history(self):
        """清空历史记录"""
        self.history = []
        self.save_history()
    
    def delete_entry(self, entry_id):
        """删除指定的历史记录"""
        self.history = [h for h in self.history if h['id'] != entry_id]
        self.save_history()


class QueryHistoryDialog(QDialog):
    """查询历史记录对话框"""
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.history_manager = main_window.history_manager
        self.selected_sql = ""
        
        self.setWindowTitle("查询历史")
        self.setGeometry(200, 100, 900, 600)
        self.setStyleSheet("""
            QDialog {
                background-color: #FFFFFF;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QListWidget {
                border: 1px solid #E0E0E0;
                background-color: #FFFFFF;
                font-size: 12px;
            }
            QListWidget::item {
                padding: 8px;
                border-bottom: 1px solid #F0F0F0;
            }
            QListWidget::item:selected {
                background-color: #E3F2FD;
            }
            QListWidget::item:hover {
                background-color: #F5F5F5;
            }
            QTextEdit {
                border: 1px solid #E0E0E0;
                background-color: #FAFAFA;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 11px;
            }
            QPushButton {
                background-color: #F0F0F0;
                border: 1px solid #D0D0D0;
                border-radius: 3px;
                padding: 6px 16px;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #E0E0E0;
            }
            QPushButton:pressed {
                background-color: #D0D0D0;
            }
            QLabel {
                font-size: 12px;
                color: #666666;
            }
        """)
        
        self.setup_ui()
        self.load_history()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(8)
        layout.setContentsMargins(12, 12, 12, 12)
        
        # 顶部搜索栏
        search_layout = QHBoxLayout()
        search_label = QLabel("搜索:")
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("输入关键字搜索历史记录...")
        self.search_input.textChanged.connect(self.on_search_changed)
        search_layout.addWidget(search_label)
        search_layout.addWidget(self.search_input, 1)
        
        # 清空按钮
        clear_btn = QPushButton("清空历史")
        clear_btn.clicked.connect(self.on_clear_history)
        search_layout.addWidget(clear_btn)
        
        layout.addLayout(search_layout)
        
        # 主内容区域
        content_layout = QHBoxLayout()
        
        # 历史列表
        list_layout = QVBoxLayout()
        self.history_list = QListWidget()
        self.history_list.setAlternatingRowColors(True)
        self.history_list.itemClicked.connect(self.on_history_item_clicked)
        self.history_list.itemDoubleClicked.connect(self.on_history_item_double_clicked)
        list_layout.addWidget(QLabel("历史记录 (双击插入到编辑器)"))
        list_layout.addWidget(self.history_list)
        
        content_layout.addLayout(list_layout, 1)
        
        # SQL预览区域
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
        
        copy_btn = QPushButton("复制SQL")
        copy_btn.clicked.connect(self.on_copy_sql)
        button_layout.addWidget(copy_btn)
        
        insert_btn = QPushButton("插入到编辑器")
        insert_btn.clicked.connect(self.on_insert_to_editor)
        button_layout.addWidget(insert_btn)
        
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(self.accept)
        button_layout.addWidget(close_btn)
        
        layout.addLayout(button_layout)
    
    def load_history(self):
        """加载历史记录到列表"""
        self.history_list.clear()
        history = self.history_manager.get_history(self.search_input.text())
        
        for entry in history:
            # 构建显示文本
            time_str = entry['timestamp']
            conn_str = f"[{entry['connection']}]" if entry['connection'] else ""
            db_str = f"({entry['database']})" if entry['database'] else ""
            
            # 截取SQL前80个字符
            sql_preview = entry['sql'][:80].replace('\n', ' ')
            if len(entry['sql']) > 80:
                sql_preview += "..."
            
            status_icon = "✓" if entry['success'] else "✗"
            display_text = f"{status_icon} {time_str} {conn_str} {db_str}\n    {sql_preview}"
            
            item = QListWidgetItem(display_text)
            item.setData(Qt.ItemDataRole.UserRole, entry)
            
            # 设置颜色区分成功和失败
            if not entry['success']:
                item.setForeground(QColor('#E74C3C'))
            
            self.history_list.addItem(item)
    
    def on_search_changed(self, text):
        """搜索框内容变化"""
        self.load_history()
    
    def on_history_item_clicked(self, item):
        """点击历史项"""
        entry = item.data(Qt.ItemDataRole.UserRole)
        if entry:
            self.sql_preview.setPlainText(entry['sql'])
    
    def on_history_item_double_clicked(self, item):
        """双击历史项 - 直接插入到编辑器"""
        entry = item.data(Qt.ItemDataRole.UserRole)
        if entry:
            self.selected_sql = entry['sql']
            self.accept()
    
    def on_copy_sql(self):
        """复制SQL到剪贴板"""
        if self.sql_preview.toPlainText():
            from PyQt6.QtWidgets import QApplication
            clipboard = QApplication.clipboard()
            clipboard.setText(self.sql_preview.toPlainText())
    
    def on_insert_to_editor(self):
        """插入到编辑器"""
        current_item = self.history_list.currentItem()
        if current_item:
            self.on_history_item_double_clicked(current_item)
    
    def on_clear_history(self):
        """清空历史"""
        from PyQt6.QtWidgets import QMessageBox
        if QMessageBox.question(self, "清空历史", "确定要清空所有查询历史吗？",
                               QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes:
            self.history_manager.clear_history()
            self.load_history()


class QueryHistoryPanel(QWidget):
    """查询历史面板（集成在主界面右侧）"""
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.history_manager = main_window.history_manager
        self.setup_ui()
    
    def setup_ui(self):
        """设置UI"""
        self.setStyleSheet("""
            QWidget {
                background-color: #FFFFFF;
            }
            QLabel {
                font-size: 11px;
                color: #666666;
                padding: 4px;
            }
            QListWidget {
                border: 1px solid #E0E0E0;
                background-color: #FFFFFF;
                font-size: 11px;
            }
            QListWidget::item {
                padding: 6px;
                border-bottom: 1px solid #F5F5F5;
            }
            QListWidget::item:hover {
                background-color: #F5F5F5;
            }
        """)
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)
        layout.setSpacing(4)
        
        # 标题栏
        title_layout = QHBoxLayout()
        title_label = QLabel("📜 查询历史")
        title_label.setStyleSheet("font-size: 12px; font-weight: bold; color: #333333; padding: 4px;")
        title_layout.addWidget(title_label)
        
        clear_btn = QPushButton("清空")
        clear_btn.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                border: none;
                color: #007ACC;
                font-size: 11px;
                padding: 2px 8px;
            }
            QPushButton:hover {
                text-decoration: underline;
            }
        """)
        clear_btn.clicked.connect(self.on_clear_history)
        title_layout.addWidget(clear_btn)
        
        layout.addLayout(title_layout)
        
        # 历史列表
        self.history_list = QListWidget()
        self.history_list.setAlternatingRowColors(True)
        self.history_list.itemDoubleClicked.connect(self.on_item_double_clicked)
        layout.addWidget(self.history_list, 1)
        
        # 底部按钮
        btn_layout = QHBoxLayout()
        refresh_btn = QPushButton("刷新")
        refresh_btn.clicked.connect(self.load_history)
        btn_layout.addWidget(refresh_btn)
        
        more_btn = QPushButton("更多...")
        more_btn.clicked.connect(self.show_full_history)
        btn_layout.addWidget(more_btn)
        
        layout.addLayout(btn_layout)
    
    def load_history(self):
        """加载历史记录"""
        self.history_list.clear()
        history = self.history_manager.get_history()[:50]  # 只显示最近50条
        
        for entry in history:
            # 简化显示
            time_str = entry['timestamp'].split(' ')[1] if ' ' in entry['timestamp'] else entry['timestamp']
            sql_preview = entry['sql'][:60].replace('\n', ' ')
            if len(entry['sql']) > 60:
                sql_preview += "..."
            
            status_icon = "✓" if entry['success'] else "✗"
            display_text = f"{status_icon} {time_str} | {sql_preview}"
            
            item = QListWidgetItem(display_text)
            item.setData(Qt.ItemDataRole.UserRole, entry)
            
            if not entry['success']:
                item.setForeground(QColor('#E74C3C'))
            
            self.history_list.addItem(item)
    
    def add_query(self, sql, success=True):
        """添加新查询到历史（由外部调用）"""
        self.history_manager.add_query(
            sql=sql,
            connection_name=getattr(self.main_window, 'current_connection', ''),
            database=getattr(self.main_window, 'current_db', ''),
            success=success
        )
        self.load_history()
    
    def on_item_double_clicked(self, item):
        """双击历史项"""
        entry = item.data(Qt.ItemDataRole.UserRole)
        if entry:
            # 将SQL插入到当前编辑器
            current_tab = self.main_window.right_panel.tabs.currentWidget()
            if current_tab and hasattr(current_tab, 'sql_editor'):
                current_tab.sql_editor.setPlainText(entry['sql'])
    
    def on_clear_history(self):
        """清空历史"""
        from PyQt6.QtWidgets import QMessageBox
        if QMessageBox.question(self, "清空历史", "确定要清空所有查询历史吗？",
                               QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes:
            self.history_manager.clear_history()
            self.load_history()
    
    def show_full_history(self):
        """显示完整历史对话框"""
        dialog = QueryHistoryDialog(self.main_window)
        if dialog.exec():
            # 用户选择了一条记录
            if dialog.selected_sql:
                current_tab = self.main_window.right_panel.tabs.currentWidget()
                if current_tab and hasattr(current_tab, 'sql_editor'):
                    current_tab.sql_editor.setPlainText(dialog.selected_sql)
