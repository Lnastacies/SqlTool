#!/usr/bin/env python3
"""
主应用窗口
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
    QGridLayout, QFrame, QGroupBox, QCheckBox, QToolBar, QTableWidget, QTableWidgetItem, QListWidget,
    QListWidgetItem, QInputDialog
)
from PyQt6.QtCore import Qt, QSize, QTimer, QSettings, QRunnable, QThreadPool, pyqtSignal, QObject
from PyQt6.QtGui import QAction, QIcon, QColor, QFont, QIntValidator, QTextCursor

from core.connection_pool import ConnectionPool
from core.database_operations import DatabaseOperations
from ui.components.sql_editor import SQLTextEdit
from ui.components.table_operations import TableOperations
from ui.components.query_tab import QueryTab
from ui.components.database_objects import DatabaseObjectsManager
from ui.components.sql_operations import SQLOperations
from ui.components.data_import_export import DataImportExport
from core.connection_management import ConnectionManager
from ui.components.left_panel import LeftPanel
from ui.components.right_panel import RightPanel
from ui.components.menu_toolbar import MenuToolbarManager
from ui.components.event_handler import EventHandler
from ui.connection_dialog import ConnectionDialog
from utils.logger import OperationLogger

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
        self.dark_mode = False
        # 初始化连接池
        self.connection_pool = ConnectionPool(max_connections=5)

        # 初始化连接管理器
        self.connection_manager = ConnectionManager()
        # 初始化事件处理器
        self.event_handler = EventHandler(self)
        # 初始化左侧面板
        self.left_panel = LeftPanel(self)
        # 初始化右侧面板
        self.right_panel = RightPanel(self)
        # 初始化菜单工具栏管理器
        self.menu_toolbar_manager = MenuToolbarManager(self)
        # 初始化数据库操作对象
        self.database_operations = None
        # 初始化表操作对象
        self.table_operations = TableOperations(self)
        # 初始化数据库对象管理器
        self.database_objects_manager = DatabaseObjectsManager(self)
        # 初始化SQL操作对象
        self.sql_operations = SQLOperations(self)
        # 初始化数据导入导出对象
        self.data_import_export = DataImportExport(self)
        
        # 加载保存的连接
        self.connection_manager.load_connections()
        # 将连接信息复制到实例变量中，以便其他组件使用
        self.saved_connections = self.connection_manager.saved_connections
        self.connection_groups = self.connection_manager.connection_groups

        # 创建主布局
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.main_layout = QVBoxLayout(self.central_widget)

        # 创建菜单栏
        self.menu_toolbar_manager.create_menu_bar()

        # 创建工具栏
        self.menu_toolbar_manager.create_toolbar()

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



    def create_left_panel(self):
        """创建左侧面板"""
        # 添加左侧面板到主分割器
        self.main_splitter.addWidget(self.left_panel)

        # 加载连接到树
        self.left_panel.load_connections_to_tree()

    def create_right_panel(self):
        """创建右侧面板"""
        # 添加右侧面板到主分割器
        self.main_splitter.addWidget(self.right_panel)

        # 添加默认标签页
        self.right_panel.add_new_query_tab()

    def create_status_bar(self):
        """创建状态栏"""
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)

        # 设置状态栏样式
        self.status_bar.setStyleSheet("""
            QStatusBar {
                background-color: #f0f0f0;
                border-top: 1px solid #d0d0d0;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
                padding: 4px 12px;
                min-height: 30px;
            }
            QStatusBar QLabel {
                margin-right: 20px;
                color: #333;
                padding: 2px 0;
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
        self.left_panel.load_connections_to_tree(show_only_current)

    def save_connections(self):
        """保存连接"""
        try:
            # 先更新connection_manager中的连接信息
            self.connection_manager.saved_connections = self.saved_connections
            self.connection_manager.connection_groups = self.connection_groups
            # 使用connection_manager保存连接
            self.connection_manager.save_connections()
        except Exception as e:
            self.logger.log('ERROR', f"保存连接失败: {e}")

    def update_query_tab_info(self):
        """更新所有查询标签页的连接信息和数据库信息"""
        for i in range(self.right_panel.tabs.count()):
            tab_widget = self.right_panel.tabs.widget(i)
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

    def update_all_tab_combos(self):
        """更新所有标签页的连接和数据库下拉框"""
        self.logger.log('INFO', f"开始更新所有标签页的下拉框，标签页数量: {self.right_panel.tabs.count()}")
        for i in range(self.right_panel.tabs.count()):
            self.logger.log('INFO', f"处理标签页 {i+1}")
            tab_widget = self.right_panel.tabs.widget(i)
            if not tab_widget:
                self.logger.log('INFO', f"标签页 {i+1} 不存在，跳过")
                continue

            # 检查是否是QueryTab组件
            if hasattr(tab_widget, 'update_combos'):
                # 调用QueryTab的update_combos方法
                tab_widget.update_combos()
                self.logger.log('INFO', f"标签页 {i+1} 是QueryTab，已调用update_combos")
            else:
                # 对于旧的标签页，保持原有逻辑
                # 查找顶部工具栏中的下拉框
                for widget in tab_widget.findChildren(QWidget):
                    # 检查是否是顶部工具栏
                    if widget.children() and isinstance(widget.children()[0], QHBoxLayout):
                        # 查找连接和数据库下拉框
                        conn_combo = None
                        db_combo = None
                        combos = widget.findChildren(QComboBox)
                        self.logger.log('INFO', f"找到 {len(combos)} 个下拉框")
                        if len(combos) >= 2:
                            conn_combo = combos[0]
                            db_combo = combos[1]
                            self.logger.log('INFO', "找到连接和数据库下拉框")

                        # 更新连接下拉框
                        if conn_combo:
                            # 保存当前选中的连接
                            current_conn = conn_combo.currentText()
                            self.logger.log('INFO', f"当前连接下拉框选中: {current_conn}")
                            # 清空并重新加载连接
                            conn_combo.clear()
                            conn_combo.addItem("未连接")
                            for conn_name in self.saved_connections.keys():
                                conn_combo.addItem(conn_name)
                            # 恢复选中状态
                            if hasattr(self, 'current_connection') and self.current_connection:
                                self.logger.log('INFO', f"尝试设置连接下拉框为: {self.current_connection}")
                                index = conn_combo.findText(self.current_connection)
                                if index >= 0:
                                    # 暂时断开信号连接，防止触发on_connection_changed
                                    conn_combo.blockSignals(True)
                                    conn_combo.setCurrentIndex(index)
                                    conn_combo.blockSignals(False)
                                    self.logger.log('INFO', f"连接下拉框设置成功，索引: {index}")
                                else:
                                    self.logger.log('INFO', f"连接 {self.current_connection} 未找到")

                        # 更新数据库下拉框
                        if db_combo:
                            # 设置下拉框宽度
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
                            # 清空并重新加载数据库
                            db_combo.clear()
                            db_combo.addItem("未选择")
                            if hasattr(self, 'db_connection') and self.db_connection:
                                try:
                                    with self.db_connection.cursor() as cursor:
                                        if self.current_db_type == 'MySQL':
                                            cursor.execute("SHOW DATABASES")
                                            databases = cursor.fetchall()
                                            self.logger.log('INFO', f"获取到 {len(databases)} 个数据库")
                                            for db in databases:
                                                db_name = db['Database'] if isinstance(db, dict) else db[0]
                                                db_combo.addItem(db_name)
                                                self.logger.log('INFO', f"添加数据库: {db_name}")
                                        elif self.current_db_type == 'PostgreSQL':
                                            cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
                                            databases = cursor.fetchall()
                                            for db in databases:
                                                db_name = db[0]
                                                db_combo.addItem(db_name)
                                        elif self.current_db_type == 'SQL Server':
                                            cursor.execute("SELECT name FROM sys.databases")
                                            databases = cursor.fetchall()
                                            for db in databases:
                                                db_name = db[0]
                                                db_combo.addItem(db_name)
                                    # 设置当前数据库
                                    if hasattr(self, 'current_db') and self.current_db:
                                        self.logger.log('INFO', f"当前数据库: {self.current_db}")
                                        # 确保数据库名称完全匹配
                                        index = -1
                                        for j in range(db_combo.count()):
                                            item_text = db_combo.itemText(j)
                                            self.logger.log('INFO', f"下拉框项 {j}: {item_text}")
                                            if item_text == self.current_db:
                                                index = j
                                                break
                                        if index >= 0:
                                            # 暂时断开信号连接，防止触发on_database_changed
                                            db_combo.blockSignals(True)
                                            db_combo.setCurrentIndex(index)
                                            db_combo.blockSignals(False)
                                            self.logger.log('INFO', f"数据库下拉框设置成功，索引: {index}")
                                        else:
                                            self.logger.log('INFO', f"数据库 {self.current_db} 未找到")
                                            # 如果找不到，尝试获取当前实际使用的数据库
                                            try:
                                                with self.db_connection.cursor() as cursor:
                                                    cursor.execute("SELECT DATABASE()")
                                                    current_db = cursor.fetchone()
                                                    if current_db:
                                                        current_db_name = current_db['DATABASE()'] if isinstance(current_db, dict) else current_db[0]
                                                        if current_db_name:
                                                            self.logger.log('INFO', f"获取到实际使用的数据库: {current_db_name}")
                                                            index = db_combo.findText(current_db_name)
                                                            if index >= 0:
                                                                # 暂时断开信号连接，防止触发on_database_changed
                                                                db_combo.blockSignals(True)
                                                                db_combo.setCurrentIndex(index)
                                                                db_combo.blockSignals(False)
                                                                self.current_db = current_db_name
                                                                self.logger.log('INFO', f"使用实际数据库设置下拉框，索引: {index}")
                                            except Exception as e:
                                                self.logger.log('ERROR', f"获取当前数据库失败: {str(e)}")
                                    else:
                                        self.logger.log('INFO', "当前数据库未设置")
                                        # 尝试获取当前实际使用的数据库
                                        try:
                                            with self.db_connection.cursor() as cursor:
                                                cursor.execute("SELECT DATABASE()")
                                                current_db = cursor.fetchone()
                                                if current_db:
                                                    current_db_name = current_db['DATABASE()'] if isinstance(current_db, dict) else current_db[0]
                                                    if current_db_name:
                                                        index = db_combo.findText(current_db_name)
                                                        if index >= 0:
                                                            db_combo.setCurrentIndex(index)
                                                            self.current_db = current_db_name
                                        except Exception as e:
                                            self.logger.log('ERROR', f"获取当前数据库失败: {str(e)}")
                                except Exception as e:
                                    self.logger.log('ERROR', f"加载数据库列表失败: {str(e)}")
                        break
        self.logger.log('INFO', "更新所有标签页的下拉框完成")

    def add_new_query_tab(self):
        """添加新的查询标签页"""
        # 使用右侧面板的方法添加新标签页
        self.right_panel.add_new_query_tab()

    def update_all_sql_editors_completion(self, tables, columns):
        """更新所有SQL编辑器的补全列表"""
        for i in range(self.right_panel.tabs.count()):
            tab_widget = self.right_panel.tabs.widget(i)
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
            self.left_panel.object_tree.clear()

            # 添加连接节点
            conn_item = QTreeWidgetItem(self.left_panel.object_tree, [self.current_connection])
            conn_item.setData(0, Qt.ItemDataRole.UserRole, ('connection', self.current_connection))

            # 使用数据库对象管理器加载对象
            self.database_objects_manager.load_database_objects(conn_item)

            # 展开节点
            conn_item.setExpanded(True)

        except Exception as e:
            self.logger.log('ERROR', f"加载数据库对象失败: {str(e)}")

    def closeEvent(self, event):
        """关闭事件"""
        # 释放所有数据库连接
        if hasattr(self, 'connection_pool'):
            self.connection_pool.close_all_connections()
            self.logger.log('INFO', "关闭所有数据库连接")
        event.accept()


    def on_object_context_menu(self, pos):
        """对象上下文菜单"""
        # 获取当前选中的项
        item = self.left_panel.object_tree.itemAt(pos)
        if not item:
            return

        data = item.data(0, Qt.ItemDataRole.UserRole)
        if not data:
            return

        item_type, item_name = data
        menu = QMenu()

        # 表对象的右键菜单
        if item_type == 'table':
            # 基本操作
            menu.addAction("打开表", lambda: self.event_handler.open_table(item_name))
            menu.addAction("设计表", lambda: self.table_operations.design_table(item_name))
            menu.addAction("新建表", self.event_handler.new_table)
            menu.addSeparator()
            menu.addAction("删除表", lambda: self.event_handler.delete_table(item_name))
            menu.addAction("清空表", lambda: self.event_handler.truncate_table(item_name, False))
            menu.addAction("截断表", lambda: self.event_handler.truncate_table(item_name, True))
            menu.addSeparator()

            # 复制操作
            copy_menu = menu.addMenu("复制表")
            copy_menu.addAction("结构和数据", lambda: self.event_handler.copy_table(item_name, True, True))
            copy_menu.addAction("仅结构", lambda: self.event_handler.copy_table(item_name, True, False))
            copy_menu.addAction("仅数据", lambda: self.event_handler.copy_table(item_name, False, True))

            menu.addSeparator()
            menu.addAction("设置权限", lambda: self.event_handler.show_feature_not_implemented("设置权限"))
            menu.addSeparator()
            menu.addAction("导入向导...", self.event_handler.import_data)
            menu.addAction("导出向导...", self.event_handler.export_data)
            menu.addSeparator()

            # 转储SQL文件
            dump_menu = menu.addMenu("转储 SQL 文件")
            dump_menu.addAction("结构和数据", lambda: self.event_handler.dump_sql(item_name, True, True))
            dump_menu.addAction("仅结构", lambda: self.event_handler.dump_sql(item_name, True, False))
            dump_menu.addAction("仅数据", lambda: self.event_handler.dump_sql(item_name, False, True))

            menu.addSeparator()
            menu.addAction("打印表", lambda: self.event_handler.show_feature_not_implemented("打印表"))
            menu.addSeparator()

            # 维护
            maintenance_menu = menu.addMenu("维护")
            maintenance_menu.addAction("分析表", lambda: self.event_handler.maintain_table(item_name, "ANALYZE"))
            maintenance_menu.addAction("检查表", lambda: self.event_handler.maintain_table(item_name, "CHECK"))
            maintenance_menu.addAction("优化表", lambda: self.event_handler.maintain_table(item_name, "OPTIMIZE"))
            maintenance_menu.addAction("修复表", lambda: self.event_handler.maintain_table(item_name, "REPAIR"))

            menu.addSeparator()
            menu.addAction("逆向表到模型...", lambda: self.event_handler.show_feature_not_implemented("逆向表到模型"))
            menu.addSeparator()

            # 管理组
            group_menu = menu.addMenu("管理组")
            group_menu.addAction("添加到组", lambda: self.event_handler.show_feature_not_implemented("添加到组"))
            group_menu.addAction("从组移除", lambda: self.event_handler.show_feature_not_implemented("从组移除"))

            menu.addSeparator()
            menu.addAction("复制", lambda: self.event_handler.show_feature_not_implemented("复制"))
            menu.addAction("重命名", lambda: self.event_handler.rename_table(item_name))
            menu.addAction("创建打开表快捷方式...", lambda: self.event_handler.show_feature_not_implemented("创建打开表快捷方式"))
            menu.addSeparator()
            menu.addAction("刷新", self.event_handler.refresh_objects)
            menu.addSeparator()
            menu.addAction("对象信息", lambda: self.event_handler.show_table_info(item_name))
        # 其他对象类型的右键菜单
        else:
            menu.addAction("刷新", self.event_handler.refresh_objects)

        menu.exec(self.left_panel.object_tree.mapToGlobal(pos))

    def on_object_clicked(self, item, column):
        """对象点击事件"""
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data:
            item_type, item_name = data
            if item_type in ['tables', 'views', 'procedures', 'functions', 'events', 'queries', 'reports', 'backups']:
                # 显示对象明细
                self.show_object_details(item_type, item_name)

    def on_object_double_clicked(self, item, column):
        """对象双击事件"""
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data:
            item_type, item_name = data
            self.logger.log('INFO', f"双击对象: 类型={item_type}, 名称={item_name}")
            self.logger.log('INFO', f"item_name类型: {type(item_name)}, 值: '{item_name}', 长度: {len(item_name) if isinstance(item_name, str) else 'N/A'}")
            if item_type == 'database':
                # 切换到该数据库
                if not item_name:
                    QMessageBox.warning(self, "切换数据库失败", "数据库名称为空")
                    return
                try:
                    # 验证数据库名称
                    if not isinstance(item_name, str) or not item_name.strip():
                        self.logger.log('ERROR', f"无效的数据库名称: {item_name}")
                        QMessageBox.warning(self, "切换数据库失败", "无效的数据库名称")
                        return

                    # 执行切换数据库操作
                    sql = f"USE {item_name}"
                    self.logger.log('INFO', f"执行SQL: {sql}")
                    with self.db_connection.cursor() as cursor:
                        cursor.execute(sql)
                        self.current_db = item_name
                        self.logger.log('INFO', f"当前数据库已设置为: {self.current_db}")
                        # 更新连接状态
                        self.connection_status.setText(f"已连接: {self.current_connection} ({self.current_db_type}) - 数据库: {item_name}")
                        self.status_info.setText("已切换数据库")
                        self.logger.log('INFO', f"切换到数据库: {item_name} 成功")
                        # 强制刷新界面
                        QApplication.processEvents()
                        # 更新所有标签页的数据库下拉框
                        self.logger.log('INFO', "开始更新所有标签页的下拉框")
                        self.update_all_tab_combos()
                        self.logger.log('INFO', "更新所有标签页的下拉框完成")
                        # 再次强制刷新界面，确保下拉框状态更新
                        QApplication.processEvents()
                        # 重新加载数据库对象
                        self.logger.log('INFO', "开始重新加载数据库对象")
                        self.load_database_objects()
                        self.logger.log('INFO', "重新加载数据库对象完成")
                        # 最后再刷新一次界面
                        QApplication.processEvents()
                except Exception as e:
                    self.logger.log('ERROR', f"切换数据库失败: {str(e)}, 数据库名称: '{item_name}'")
                    QMessageBox.critical(self, "切换数据库失败", f"切换到数据库 {item_name} 时出错: {str(e)}")
            elif item_type == 'table':
                # 打开表
                self.event_handler.open_table(item_name)
            elif item_type == 'view':
                # 打开视图
                self.event_handler.show_feature_not_implemented("打开视图")
            elif item_type == 'procedure':
                # 打开存储过程
                self.event_handler.show_feature_not_implemented("打开存储过程")
            elif item_type == 'function':
                # 打开函数
                self.event_handler.show_feature_not_implemented("打开函数")

    def show_object_details(self, object_type, database_name):
        """显示对象明细"""
        # 获取对象列表
        objects = []
        try:
            # 使用DatabaseOperations类获取对象列表
            if hasattr(self, 'database_operations') and self.database_operations:
                objects = self.database_operations.get_objects_by_type(object_type, database_name)
            else:
                # 如果database_operations未初始化，创建一个实例
                self.database_operations = DatabaseOperations(self.db_connection, self.current_db_type)
                objects = self.database_operations.get_objects_by_type(object_type, database_name)
        except Exception as e:
            self.logger.log('ERROR', f"加载对象列表失败: {str(e)}")
            objects = [f"加载失败: {str(e)}"]
        
        # 使用右侧面板的方法更新对象标签页
        self.right_panel.update_object_tab(object_type, database_name, objects)

    def _get_object_type_name(self, object_type):
        """获取对象类型的中文名称"""
        type_names = {
            'tables': '表',
            'views': '视图',
            'procedures': '存储过程',
            'functions': '函数',
            'events': '事件',
            'queries': '查询',
            'reports': '报表',
            'backups': '备份'
        }
        return type_names.get(object_type, object_type)

    def _load_objects_to_list(self, object_list, object_type, database_name):
        """加载对象到列表"""
        object_list.clear()

        try:
            # 使用DatabaseOperations类获取对象列表
            if hasattr(self, 'database_operations') and self.database_operations:
                objects = self.database_operations.get_objects_by_type(object_type, database_name)
            else:
                # 如果database_operations未初始化，创建一个实例
                self.database_operations = DatabaseOperations(self.db_connection, self.current_db_type)
                objects = self.database_operations.get_objects_by_type(object_type, database_name)
            
            # 添加对象到列表
            for obj_name in objects:
                if object_type == 'tables':
                    item = QListWidgetItem(obj_name)
                    item.setData(Qt.ItemDataRole.UserRole, ('table', obj_name))
                    object_list.addItem(item)
                elif object_type == 'views':
                    item = QListWidgetItem(obj_name)
                    item.setData(Qt.ItemDataRole.UserRole, ('view', obj_name))
                    object_list.addItem(item)
                elif object_type == 'procedures':
                    item = QListWidgetItem(obj_name)
                    item.setData(Qt.ItemDataRole.UserRole, ('procedure', obj_name))
                    object_list.addItem(item)
                elif object_type == 'functions':
                    item = QListWidgetItem(obj_name)
                    item.setData(Qt.ItemDataRole.UserRole, ('function', obj_name))
                    object_list.addItem(item)
                elif object_type == 'events':
                    item = QListWidgetItem(obj_name)
                    item.setData(Qt.ItemDataRole.UserRole, ('event', obj_name))
                    object_list.addItem(item)
        except Exception as e:
            self.logger.log('ERROR', f"加载对象列表失败: {str(e)}")
            error_item = QListWidgetItem(f"加载失败: {str(e)}")
            object_list.addItem(error_item)