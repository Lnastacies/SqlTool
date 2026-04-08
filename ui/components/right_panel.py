#!/usr/bin/env python3
"""
右侧面板模块
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QTabWidget
)
from utils.common_utils import UITools

class RightPanel(QWidget):
    """
    右侧面板类，包含查询标签页
    """
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.logger = main_window.logger
        
        self.setup_ui()
    
    def setup_ui(self):
        """
        设置右侧面板UI
        """
        # 主布局
        main_layout = QVBoxLayout(self)
        self.setStyleSheet("QWidget { background-color: #f5f5f5; }")

        # 标签页
        self.tabs = QTabWidget()
        self.tabs.setTabsClosable(True)
        self.tabs.tabCloseRequested.connect(self.main_window.event_handler.close_tab)
        self.tabs.setStyleSheet("""
            QTabWidget {
                background-color: #f5f5f5;
            }
            QTabWidget::pane {
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
            }
            QTabBar::tab {
                padding: 8px 16px;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: #f0f0f0;
                border: 1px solid #d0d0d0;
                border-bottom: none;
                margin-right: 2px;
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
            }
            QTabBar::tab:selected {
                background-color: #ffffff;
                border-bottom: 1px solid #ffffff;
                font-weight: bold;
            }
            QTabBar::tab:hover {
                background-color: #e8e8e8;
            }
            QTabBar::close-button {
                image: url(:/icons/close.png);
                subcontrol-position: right;
                subcontrol-origin: padding;
                width: 16px;
                height: 16px;
                margin-left: 8px;
            }
            QTabBar::close-button:hover {
                image: url(:/icons/close_hover.png);
            }
        """)
        main_layout.addWidget(self.tabs)
        
        # 添加对象标签页
        self.add_object_tab()
    
    def add_object_tab(self):
        """
        添加对象标签页
        """
        from PyQt6.QtWidgets import QWidget, QVBoxLayout, QListWidget, QHBoxLayout, QPushButton, QLineEdit, QLabel
        
        # 创建对象标签页
        object_tab = QWidget()
        object_layout = QVBoxLayout(object_tab)
        
        # 子工具栏
        toolbar_layout = QHBoxLayout()
        
        # 操作按钮
        open_table_btn = QPushButton("打开表")
        open_table_btn.setStyleSheet("""
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
            }
        """)
        toolbar_layout.addWidget(open_table_btn)
        
        design_table_btn = QPushButton("设计表")
        design_table_btn.setStyleSheet("""
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
            }
        """)
        toolbar_layout.addWidget(design_table_btn)
        
        new_table_btn = QPushButton("新建表")
        new_table_btn.setStyleSheet("""
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
            }
        """)
        toolbar_layout.addWidget(new_table_btn)
        
        delete_table_btn = QPushButton("删除表")
        delete_table_btn.setStyleSheet("""
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
            }
        """)
        toolbar_layout.addWidget(delete_table_btn)
        
        import_btn = QPushButton("导入向导")
        import_btn.setStyleSheet("""
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
            }
        """)
        toolbar_layout.addWidget(import_btn)
        
        export_btn = QPushButton("导出向导")
        export_btn.setStyleSheet("""
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
            }
        """)
        toolbar_layout.addWidget(export_btn)
        
        # 搜索框
        search_label = QLabel("搜索:")
        search_label.setStyleSheet("font-size: 10px; font-family: Arial;")
        toolbar_layout.addWidget(search_label)
        
        search_edit = QLineEdit()
        search_edit.setStyleSheet("""
            QLineEdit {
                padding: 2px 4px;
                font-size: 10px;
                font-family: Arial;
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 2px;
                width: 150px;
            }
        """)
        toolbar_layout.addWidget(search_edit)
        
        # 右对齐
        toolbar_layout.addStretch()
        
        object_layout.addLayout(toolbar_layout)
        
        # 对象列表
        self.object_list = QListWidget()
        self.object_list.setStyleSheet("""
            QListWidget {
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                font-size: 10px;
                font-family: Arial;
            }
            QListWidget::item {
                padding: 2px 8px;
                height: 18px;
            }
            QListWidget::item:hover {
                background-color: #f0f0f0;
            }
            QListWidget::item:selected {
                background-color: #e0e0e0;
                color: #000000;
            }
        """)
        object_layout.addWidget(self.object_list)
        
        # 添加标签页
        tab_index = self.tabs.addTab(object_tab, "对象")
        self.tabs.setCurrentIndex(tab_index)
    
    def update_object_tab(self, object_type, object_name, objects):
        """
        更新对象标签页内容
        """
        # 清空列表
        self.object_list.clear()
        
        # 添加对象
        for obj in objects:
            self.object_list.addItem(obj)
        
        # 激活对象标签页
        for i in range(self.tabs.count()):
            if self.tabs.tabText(i) == "对象":
                self.tabs.setCurrentIndex(i)
                break
    
    def add_new_query_tab(self):
        """
        添加新的查询标签页
        """
        from .query_tab import QueryTab
        
        # 创建新的查询标签页
        query_tab = QueryTab(self.main_window)

        # 添加标签页
        tab_index = self.tabs.addTab(query_tab, f"查询 {self.tabs.count() + 1}")
        self.tabs.setCurrentIndex(tab_index)
        
        return query_tab
