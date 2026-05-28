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
        self.tabs.setMovable(True)  # 支持拖拽排序
        self.tabs.setStyleSheet("""
            QTabWidget {
                background-color: #F8F9FA;
            }
            QTabWidget::pane {
                background-color: #ffffff;
                border: 1px solid #E0E0E0;
            }
            QTabBar::tab {
                padding: 8px 16px;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                background-color: #F8F9FA;
                border: none;
                border-bottom: 2px solid transparent;
                margin-right: 2px;
                height: 32px;
            }
            QTabBar::tab:selected {
                background-color: #ffffff;
                border-bottom: 2px solid #007ACC;
                font-weight: normal;
            }
            QTabBar::tab:hover {
                background-color: #E3F2FD;
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
    
    def update_all_tab_combos(self):
        """
        更新所有标签页的连接和数据库下拉框
        """
        from PyQt6.QtWidgets import QComboBox, QHBoxLayout, QWidget
        
        state = self.main_window.state_manager
        
        if state.current_db and state.current_db_type in ('MySQL', 'MariaDB') and state.db_connection:
            try:
                with state.db_connection.cursor() as cursor:
                    cursor.execute(f"USE `{state.current_db}`")
            except Exception as e:
                self.logger.log('WARNING', f"更新下拉框前切换数据库失败: {str(e)}")
        
        self.logger.log('INFO', f"开始更新所有标签页的下拉框，标签页数量: {self.tabs.count()}")
        for i in range(self.tabs.count()):
            self.logger.log('INFO', f"处理标签页 {i+1}")
            tab_widget = self.tabs.widget(i)
            if not tab_widget:
                self.logger.log('INFO', f"标签页 {i+1} 不存在，跳过")
                continue

            if hasattr(tab_widget, 'update_combos'):
                tab_widget.update_combos()
                self.logger.log('INFO', f"标签页 {i+1} 是QueryTab，已调用update_combos")
            else:
                for widget in tab_widget.findChildren(QWidget):
                    if widget.children() and isinstance(widget.children()[0], QHBoxLayout):
                        conn_combo = None
                        db_combo = None
                        combos = widget.findChildren(QComboBox)
                        self.logger.log('INFO', f"找到 {len(combos)} 个下拉框")
                        if len(combos) >= 2:
                            conn_combo = combos[0]
                            db_combo = combos[1]
                            self.logger.log('INFO', "找到连接和数据库下拉框")

                        if conn_combo:
                            current_conn = conn_combo.currentText()
                            self.logger.log('INFO', f"当前连接下拉框选中: {current_conn}")
                            conn_combo.clear()
                            conn_combo.addItem("未连接")
                            for conn_name in state.saved_connections.keys():
                                conn_combo.addItem(conn_name)
                            if state.current_connection:
                                self.logger.log('INFO', f"尝试设置连接下拉框为: {state.current_connection}")
                                index = conn_combo.findText(state.current_connection)
                                if index >= 0:
                                    conn_combo.blockSignals(True)
                                    conn_combo.setCurrentIndex(index)
                                    conn_combo.blockSignals(False)
                                    self.logger.log('INFO', f"连接下拉框设置成功，索引: {index}")
                                else:
                                    self.logger.log('INFO', f"连接 {state.current_connection} 未找到")

                        if db_combo:
                            db_combo.setMinimumWidth(150)
                            db_combo.setStyleSheet("""
                                QComboBox {
                                    padding: 2px 4px;
                                    font-size: 10px;
                                    font-family: Arial;
                                    background-color: #ffffff;
                                    border: 1px solid #d0d0d0;
                                    border-radius: 2px;
                                    min-width: 150px;
                                }
                                QComboBox QAbstractItemView {
                                    min-width: 200px;
                                }
                            """)
                            db_combo.clear()
                            db_combo.addItem("未选择")
                            if state.db_connection:
                                try:
                                    with state.db_connection.cursor() as cursor:
                                        if state.current_db_type == 'MySQL':
                                            cursor.execute("SHOW DATABASES")
                                            databases = cursor.fetchall()
                                            self.logger.log('INFO', f"获取到 {len(databases)} 个数据库")
                                            for db in databases:
                                                db_name = db['Database'] if isinstance(db, dict) else db[0]
                                                db_combo.addItem(db_name)
                                                self.logger.log('INFO', f"添加数据库: {db_name}")
                                        elif state.current_db_type == 'PostgreSQL':
                                            cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
                                            databases = cursor.fetchall()
                                            for db in databases:
                                                db_name = db[0]
                                                db_combo.addItem(db_name)
                                        elif state.current_db_type == 'SQL Server':
                                            cursor.execute("SELECT name FROM sys.databases")
                                            databases = cursor.fetchall()
                                            for db in databases:
                                                db_name = db[0]
                                                db_combo.addItem(db_name)
                                    if state.current_db:
                                        self.logger.log('INFO', f"当前数据库: {state.current_db}")
                                        index = -1
                                        for j in range(db_combo.count()):
                                            item_text = db_combo.itemText(j)
                                            self.logger.log('INFO', f"下拉框项 {j}: {item_text}")
                                            if item_text == state.current_db:
                                                index = j
                                                break
                                        if index >= 0:
                                            db_combo.blockSignals(True)
                                            db_combo.setCurrentIndex(index)
                                            db_combo.blockSignals(False)
                                            self.logger.log('INFO', f"数据库下拉框设置成功，索引: {index}")
                                        else:
                                            self.logger.log('INFO', f"数据库 {state.current_db} 未找到")
                                            try:
                                                with state.db_connection.cursor() as cursor:
                                                    cursor.execute("SELECT DATABASE()")
                                                    current_db = cursor.fetchone()
                                                    if current_db:
                                                        current_db_name = current_db['DATABASE()'] if isinstance(current_db, dict) else current_db[0]
                                                        if current_db_name:
                                                            self.logger.log('INFO', f"获取到实际使用的数据库: {current_db_name}")
                                                            index = db_combo.findText(current_db_name)
                                                            if index >= 0:
                                                                db_combo.blockSignals(True)
                                                                db_combo.setCurrentIndex(index)
                                                                db_combo.blockSignals(False)
                                                                state.set_database(current_db_name)
                                                                self.logger.log('INFO', f"使用实际数据库设置下拉框，索引: {index}")
                                            except Exception as e:
                                                self.logger.log('ERROR', f"获取当前数据库失败: {str(e)}")
                                    else:
                                        self.logger.log('INFO', "当前数据库未设置")
                                        try:
                                            with state.db_connection.cursor() as cursor:
                                                cursor.execute("SELECT DATABASE()")
                                                current_db = cursor.fetchone()
                                                if current_db:
                                                    current_db_name = current_db['DATABASE()'] if isinstance(current_db, dict) else current_db[0]
                                                    if current_db_name:
                                                        index = db_combo.findText(current_db_name)
                                                        if index >= 0:
                                                            db_combo.setCurrentIndex(index)
                                                            state.set_database(current_db_name)
                                        except Exception as e:
                                            self.logger.log('ERROR', f"获取当前数据库失败: {str(e)}")
                                except Exception as e:
                                    self.logger.log('ERROR', f"加载数据库列表失败: {str(e)}")
                        break
        self.logger.log('INFO', "更新所有标签页的下拉框完成")
