#!/usr/bin/env python3
"""
事件处理器模块
"""

from PyQt6.QtWidgets import QMessageBox, QInputDialog
from PyQt6.QtCore import Qt
from core.database_operations import DatabaseOperations

class EventHandler:
    """
    事件处理器类，集中管理所有事件处理逻辑
    """
    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
    
    def new_connection(self):
        """新建连接"""
        from ui.connection_dialog import ConnectionDialog
        dialog = ConnectionDialog(self.main_window)
        if dialog.exec():
            conn_data = dialog.result
            self.main_window.saved_connections[conn_data['name']] = conn_data
            self.main_window.load_connections_to_tree()
            self.main_window.save_connections()
            self.logger.log('INFO', f"新建连接: {conn_data['name']}")
    
    def edit_connection(self):
        """编辑连接"""
        # 获取当前选中的连接
        selected_items = self.main_window.left_panel.connection_tree.selectedItems()
        if not selected_items:
            QMessageBox.warning(self.main_window, "编辑连接", "请先选择一个连接")
            return

        item = selected_items[0]
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and data[0] == 'connection':
            conn_name = data[1]
            conn_data = self.main_window.saved_connections.get(conn_name)
            if conn_data:
                from ui.connection_dialog import ConnectionDialog
                dialog = ConnectionDialog(self.main_window, conn_data)
                if dialog.exec():
                    new_conn_data = dialog.result
                    # 如果连接名称改变，需要更新字典键
                    if new_conn_data['name'] != conn_name:
                        del self.main_window.saved_connections[conn_name]
                        # 同时从连接组中移除旧名称
                        for group_name, connections in self.main_window.connection_groups.items():
                            if conn_name in connections:
                                connections.remove(conn_name)
                                connections.append(new_conn_data['name'])
                    self.main_window.saved_connections[new_conn_data['name']] = new_conn_data
                    self.main_window.load_connections_to_tree()
                    self.main_window.save_connections()
                    self.logger.log('INFO', f"编辑连接: {new_conn_data['name']}")
    
    def delete_connection(self):
        """删除连接"""
        # 获取当前选中的连接
        selected_items = self.main_window.left_panel.connection_tree.selectedItems()
        if not selected_items:
            QMessageBox.warning(self.main_window, "删除连接", "请先选择一个连接")
            return

        item = selected_items[0]
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and data[0] == 'connection':
            conn_name = data[1]
            if QMessageBox.question(self.main_window, "删除连接", f"确定要删除连接 '{conn_name}' 吗？", 
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes:
                # 从连接组中移除
                for group_name, connections in self.main_window.connection_groups.items():
                    if conn_name in connections:
                        connections.remove(conn_name)
                # 从保存的连接中删除
                if conn_name in self.main_window.saved_connections:
                    del self.main_window.saved_connections[conn_name]
                self.main_window.load_connections_to_tree()
                self.main_window.save_connections()
                self.logger.log('INFO', f"删除连接: {conn_name}")
    
    def show_feature_not_implemented(self, feature_name):
        """显示功能未实现的提示"""
        QMessageBox.information(self.main_window, feature_name, f"{feature_name}功能开发中...")
        self.logger.log('INFO', f"用户尝试使用未实现的功能: {feature_name}")
    
    def new_connection_group(self):
        """新建连接组"""
        group_name, ok = QInputDialog.getText(self.main_window, "新建连接组", "请输入连接组名称:")
        if ok and group_name:
            if group_name not in self.main_window.connection_groups:
                self.main_window.connection_groups[group_name] = []
                self.main_window.load_connections_to_tree()
                self.main_window.save_connections()
                self.logger.log('INFO', f"新建连接组: {group_name}")
    
    def rename_connection_group(self):
        """重命名连接组"""
        # 获取当前选中的连接组
        selected_items = self.main_window.left_panel.connection_tree.selectedItems()
        if not selected_items:
            QMessageBox.warning(self.main_window, "重命名连接组", "请先选择一个连接组")
            return

        item = selected_items[0]
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and data[0] == 'group':
            old_group_name = data[1]
            new_group_name, ok = QInputDialog.getText(self.main_window, "重命名连接组", "请输入新的连接组名称:", text=old_group_name)
            if ok and new_group_name:
                if new_group_name != old_group_name:
                    if new_group_name not in self.main_window.connection_groups:
                        # 重命名连接组
                        self.main_window.connection_groups[new_group_name] = self.main_window.connection_groups.pop(old_group_name)
                        self.main_window.load_connections_to_tree()
                        self.main_window.save_connections()
                        self.logger.log('INFO', f"重命名连接组: {old_group_name} -> {new_group_name}")
                    else:
                        QMessageBox.warning(self.main_window, "重命名连接组", "连接组名称已存在")
    
    def delete_connection_group(self):
        """删除连接组"""
        # 获取当前选中的连接组
        selected_items = self.main_window.left_panel.connection_tree.selectedItems()
        if not selected_items:
            QMessageBox.warning(self.main_window, "删除连接组", "请先选择一个连接组")
            return

        item = selected_items[0]
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and data[0] == 'group':
            group_name = data[1]
            if QMessageBox.question(self.main_window, "删除连接组", f"确定要删除连接组 '{group_name}' 吗？", 
                                   QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes:
                # 删除连接组
                if group_name in self.main_window.connection_groups:
                    del self.main_window.connection_groups[group_name]
                    self.main_window.load_connections_to_tree()
                    self.main_window.save_connections()
                    self.logger.log('INFO', f"删除连接组: {group_name}")
    
    def rename_connection(self):
        """重命名连接"""
        # 获取当前选中的连接
        selected_items = self.main_window.left_panel.connection_tree.selectedItems()
        if not selected_items:
            QMessageBox.warning(self.main_window, "重命名连接", "请先选择一个连接")
            return

        item = selected_items[0]
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and data[0] == 'connection':
            old_conn_name = data[1]
            new_conn_name, ok = QInputDialog.getText(self.main_window, "重命名连接", "请输入新的连接名称:", text=old_conn_name)
            if ok and new_conn_name:
                if new_conn_name != old_conn_name:
                    if new_conn_name not in self.main_window.saved_connections:
                        # 重命名连接
                        conn_data = self.main_window.saved_connections.pop(old_conn_name)
                        self.main_window.saved_connections[new_conn_name] = conn_data
                        # 更新连接组中的名称
                        for group_name, connections in self.main_window.connection_groups.items():
                            if old_conn_name in connections:
                                connections.remove(old_conn_name)
                                connections.append(new_conn_name)
                        self.main_window.load_connections_to_tree()
                        self.main_window.save_connections()
                        self.logger.log('INFO', f"重命名连接: {old_conn_name} -> {new_conn_name}")
                    else:
                        QMessageBox.warning(self.main_window, "重命名连接", "连接名称已存在")
    
    def copy_connection(self):
        """复制连接"""
        # 获取当前选中的连接
        selected_items = self.main_window.left_panel.connection_tree.selectedItems()
        if not selected_items:
            QMessageBox.warning(self.main_window, "复制连接", "请先选择一个连接")
            return

        item = selected_items[0]
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and data[0] == 'connection':
            conn_name = data[1]
            conn_data = self.main_window.saved_connections.get(conn_name)
            if conn_data:
                # 创建新的连接名称
                new_conn_name = f"{conn_name} (副本)"
                # 确保名称唯一
                counter = 1
                while new_conn_name in self.main_window.saved_connections:
                    new_conn_name = f"{conn_name} (副本 {counter})"
                    counter += 1
                # 复制连接
                new_conn_data = conn_data.copy()
                new_conn_data['name'] = new_conn_name
                self.main_window.saved_connections[new_conn_name] = new_conn_data
                self.main_window.load_connections_to_tree()
                self.main_window.save_connections()
                self.logger.log('INFO', f"复制连接: {conn_name} -> {new_conn_name}")
    
    def new_query(self):
        """新建查询"""
        self.main_window.add_new_query_tab()
        self.logger.log('INFO', "新建查询标签页")
    
    def execute_sql(self):
        """执行SQL"""
        self.main_window.sql_operations.execute_sql()
    
    def refresh_objects(self):
        """刷新对象"""
        self.logger.log('INFO', "尝试刷新对象")
        # 实现刷新对象功能
        QMessageBox.information(self.main_window, "刷新", "刷新功能开发中...")
    
    def on_connection_context_menu(self, pos):
        """连接上下文菜单"""
        from PyQt6.QtWidgets import QMenu
        menu = QMenu()
        
        # 获取当前选中的项
        selected_items = self.main_window.left_panel.connection_tree.selectedItems()
        
        if selected_items:
            item = selected_items[0]
            data = item.data(0, Qt.ItemDataRole.UserRole)
            
            if data:
                item_type, item_name = data
                
                if item_type == 'connection':
                    # 连接相关操作
                    menu.addAction("连接", lambda: self.connect_to_database(item_name))
                    menu.addAction("编辑连接", self.edit_connection)
                    menu.addAction("删除连接", self.delete_connection)
                    menu.addSeparator()
                    menu.addAction("新建查询", self.new_query)
                    menu.addSeparator()
                    menu.addAction("复制连接", self.copy_connection)
                    menu.addAction("重命名连接", self.rename_connection)
                    menu.addSeparator()
                    menu.addAction("刷新", self.refresh_objects)
                elif item_type == 'group':
                    # 连接组相关操作
                    menu.addAction("新建连接", self.new_connection)
                    menu.addAction("重命名组", self.rename_connection_group)
                    menu.addAction("删除组", self.delete_connection_group)
                    menu.addSeparator()
                    menu.addAction("刷新", self.refresh_objects)
                else:
                    # 数据库相关操作
                    menu.addAction("打开数据库", lambda: self.show_feature_not_implemented("打开数据库"))
                    menu.addAction("新建查询", self.new_query)
                    menu.addSeparator()
                    menu.addAction("刷新", self.refresh_objects)
        else:
            # 通用操作
            menu.addAction("新建连接", self.new_connection)
            menu.addAction("新建连接组", self.new_connection_group)
            menu.addSeparator()
            menu.addAction("刷新", self.refresh_objects)
        
        menu.exec(self.main_window.left_panel.connection_tree.mapToGlobal(pos))
    
    def on_connection_double_clicked(self, item, column):
        """连接双击事件"""
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and data[0] == 'connection':
            conn_name = data[1]
            self.connect_to_database(conn_name)
            # 更新所有标签页的连接和数据库下拉框
            self.main_window.update_all_tab_combos()
        elif data and data[0] == 'database':
            db_name = data[1]
            if not db_name:
                QMessageBox.warning(self.main_window, "切换数据库失败", "数据库名称为空")
                return
            try:
                with self.main_window.db_connection.cursor() as cursor:
                    cursor.execute(f"USE {db_name}")
                    self.main_window.current_db = db_name
                    # 重新加载数据库对象
                    self.main_window.load_database_objects()
                    # 更新连接状态
                    self.main_window.connection_status.setText(f"已连接: {self.main_window.current_connection} ({self.main_window.current_db_type}) - 数据库: {db_name}")
                    self.main_window.status_info.setText("已切换数据库")
                    self.logger.log('INFO', f"切换到数据库: {db_name}")
                    # 更新所有标签页的数据库下拉框
                    self.main_window.update_all_tab_combos()
            except Exception as e:
                QMessageBox.critical(self.main_window, "切换数据库失败", f"切换到数据库 {db_name} 时出错: {str(e)}")
                self.logger.log('ERROR', f"切换数据库失败: {str(e)}")
    
    def connect_to_database(self, conn_name):
        """连接到数据库"""
        conn_data = self.main_window.saved_connections.get(conn_name)
        if conn_data:
            try:
                # 从连接池获取连接
                self.main_window.db_connection = self.main_window.connection_pool.get_connection(conn_name, conn_data)

                if not self.main_window.db_connection:
                    QMessageBox.warning(self.main_window, "连接失败", f"未支持的数据库类型或驱动未安装: {conn_data['type']}")
                    return

                # 连接成功
                self.main_window.current_connection = conn_name
                self.main_window.current_db_type = conn_data['type']
                self.main_window.current_db = conn_data['database'] if conn_data['database'] else ''
                self.main_window.connection_status.setText(f"已连接: {conn_name} ({conn_data['type']})")
                self.main_window.status_info.setText("已连接")
                self.logger.log('INFO', f"连接到数据库: {conn_name}")

                # 加载实际的数据库对象
                self.main_window.load_database_objects()

                # 初始化数据库操作对象
                self.main_window.database_operations = DatabaseOperations(self.main_window.db_connection, self.main_window.current_db_type)
                # 获取表名和列名用于自动补全
                tables, columns = self.main_window.database_operations.get_database_objects(self.main_window.current_db)

                # 更新所有SQL编辑器的补全列表
                self.main_window.update_all_sql_editors_completion(tables, columns)

                # 显示所有连接，保持连接列表完整
                self.main_window.load_connections_to_tree(show_only_current=False)

                # 切换到对象标签页
                self.main_window.left_panel.tab_widget.setCurrentIndex(1)

                # 更新查询标签页的连接信息
                self.main_window.update_query_tab_info()

                # 更新所有标签页的下拉框
                self.main_window.update_all_tab_combos()

                # 强制刷新界面
                from PyQt6.QtWidgets import QApplication
                QApplication.processEvents()
            except Exception as e:
                QMessageBox.critical(self.main_window, "连接失败", f"连接数据库时出错: {str(e)}")
                self.logger.log('ERROR', f"连接数据库失败: {str(e)}")
    
    def close_tab(self, index):
        """关闭标签页"""
        tab_text = self.main_window.right_panel.tabs.tabText(index)
        self.main_window.right_panel.tabs.removeTab(index)
        self.logger.log('INFO', f"关闭标签页: {tab_text}")
    
    def toggle_dark_mode(self):
        """切换深色模式"""
        # 切换深色模式
        is_dark = hasattr(self.main_window, 'dark_mode') and self.main_window.dark_mode

        if is_dark:
            # 切换到浅色模式
            self._set_light_mode()
        else:
            # 切换到深色模式
            self._set_dark_mode()

        self.logger.log('INFO', f"切换到{'深色' if not is_dark else '浅色'}模式")
    
    def _set_light_mode(self):
        """设置浅色模式"""
        # 重置主窗口样式
        self.main_window.setStyleSheet('')
        self.main_window.dark_mode = False
        
        # 重置左侧面板样式
        if hasattr(self.main_window, 'left_panel'):
            self.main_window.left_panel.setStyleSheet("QWidget { background-color: #f5f5f5; border-right: 1px solid #d0d0d0; }")
            
            # 重置标签页样式
            self.main_window.left_panel.tab_widget.setStyleSheet("""
                QTabWidget::pane {
                    border: 1px solid #d0d0d0;
                    background-color: #ffffff;
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
            """)
            
            # 重置树控件样式
            self.main_window.left_panel.connection_tree.setStyleSheet("""
                QTreeWidget {
                    background-color: #ffffff;
                    border: none;
                    font-family: 'Microsoft YaHei', Arial;
                    font-size: 11px;
                }
                QTreeWidget::item {
                    padding: 3px 0;
                    height: 22px;
                }
                QTreeWidget::item:hover {
                    background-color: #f0f0f0;
                }
                QTreeWidget::item:selected {
                    background-color: #e3f2fd;
                    color: #1976d2;
                }
            """)
            
            self.main_window.left_panel.object_tree.setStyleSheet("""
                QTreeWidget {
                    background-color: #ffffff;
                    border: none;
                    font-family: 'Microsoft YaHei', Arial;
                    font-size: 11px;
                }
                QTreeWidget::item {
                    padding: 3px 0;
                    height: 22px;
                }
                QTreeWidget::item:hover {
                    background-color: #f0f0f0;
                }
                QTreeWidget::item:selected {
                    background-color: #e3f2fd;
                    color: #1976d2;
                }
                QTreeWidget::branch:closed:has-children {
                    image: url(:/icons/closed_folder.png);
                }
                QTreeWidget::branch:open:has-children {
                    image: url(:/icons/open_folder.png);
                }
            """)
        
        # 重置右侧面板样式
        if hasattr(self.main_window, 'right_panel'):
            self.main_window.right_panel.setStyleSheet("QWidget { background-color: #f5f5f5; }")
            
            # 重置标签页样式
            self.main_window.right_panel.tabs.setStyleSheet("""
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
        
        # 重置查询标签页样式
        for i in range(self.main_window.right_panel.tabs.count()):
            tab_widget = self.main_window.right_panel.tabs.widget(i)
            if hasattr(tab_widget, 'sql_editor'):
                # 重置SQL编辑器样式
                tab_widget.sql_editor.setStyleSheet("""
                    QTextEdit {
                        background-color: #ffffff;
                        border: 1px solid #d0d0d0;
                        font-family: 'Consolas', 'Courier New', monospace;
                        font-size: 11px;
                        padding: 0 8px 0 0;
                        line-height: 1.4;
                    }
                """)
                
                # 重置结果表格样式
                tab_widget.result_table.setStyleSheet("""
                    QTableWidget {
                        background-color: #ffffff;
                        border: 1px solid #d0d0d0;
                        font-size: 11px;
                        font-family: 'Microsoft YaHei', Arial;
                    }
                    QTableWidget::header {
                        background-color: #f0f0f0;
                        border-bottom: 1px solid #d0d0d0;
                        padding: 4px;
                        font-size: 11px;
                        font-family: 'Microsoft YaHei', Arial;
                        font-weight: bold;
                    }
                    QTableWidget::item {
                        padding: 4px 8px;
                        height: 24px;
                    }
                    QTableWidget::item:selected {
                        background-color: #e3f2fd;
                        color: #1976d2;
                    }
                """)
        
        # 重置状态栏样式
        if hasattr(self.main_window, 'status_bar'):
            self.main_window.status_bar.setStyleSheet("""
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
        
        # 重置菜单栏样式
        menu_bar = self.main_window.menuBar()
        menu_bar.setStyleSheet("""
            QMenuBar {
                background-color: #f0f0f0;
                border-bottom: 1px solid #d0d0d0;
                padding: 4px 0;
            }
            QMenuBar::item {
                padding: 6px 12px;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: transparent;
            }
            QMenuBar::item:hover {
                background-color: #e8e8e8;
                border-radius: 4px;
            }
            QMenuBar::item:selected {
                background-color: #e3f2fd;
                color: #1976d2;
                border-radius: 4px;
            }
            QMenu {
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
            }
            QMenu::item {
                padding: 6px 24px;
            }
            QMenu::item:hover {
                background-color: #e3f2fd;
                color: #1976d2;
            }
            QMenu::separator {
                height: 1px;
                background-color: #d0d0d0;
                margin: 4px 0;
            }
        """)
        
        # 重置工具栏样式
        if hasattr(self.main_window, 'main_toolbar'):
            self.main_window.main_toolbar.setStyleSheet("""
                QToolBar {
                    background-color: #f8f8f8;
                    border: 1px solid #e0e0e0;
                    padding: 2px;
                    spacing: 1px;
                }
                QToolButton {
                    padding: 4px 6px;
                    font-size: 10px;
                    font-family: 'Microsoft YaHei', Arial;
                    border: 1px solid transparent;
                    border-radius: 2px;
                    background-color: transparent;
                    margin: 0 1px;
                }
                QToolButton:hover {
                    background-color: #e8e8e8;
                    border: 1px solid #d0d0d0;
                }
                QToolButton:pressed {
                    background-color: #d0d0d0;
                    border: 1px solid #b0b0b0;
                }
                QToolButton:checked {
                    background-color: #e3f2fd;
                    border: 1px solid #1976d2;
                    color: #1976d2;
                }
            """)
        
        self.main_window.status_info.setText("已切换到浅色模式")
    
    def _set_dark_mode(self):
        """设置深色模式"""
        # 设置主窗口样式
        self.main_window.dark_mode = True
        
        # 设置左侧面板样式
        if hasattr(self.main_window, 'left_panel'):
            self.main_window.left_panel.setStyleSheet("QWidget { background-color: #252526; border-right: 1px solid #3e3e42; }")
            
            # 设置标签页样式
            self.main_window.left_panel.tab_widget.setStyleSheet("""
                QTabWidget::pane {
                    border: 1px solid #3e3e42;
                    background-color: #1e1e1e;
                }
                QTabBar::tab {
                    padding: 8px 16px;
                    font-size: 11px;
                    font-family: 'Microsoft YaHei', Arial;
                    background-color: #2d2d30;
                    color: #d4d4d4;
                    border: 1px solid #3e3e42;
                    border-bottom: none;
                    margin-right: 2px;
                    border-top-left-radius: 4px;
                    border-top-right-radius: 4px;
                }
                QTabBar::tab:selected {
                    background-color: #1e1e1e;
                    color: #ffffff;
                    border-bottom: 1px solid #1e1e1e;
                    font-weight: bold;
                }
                QTabBar::tab:hover {
                    background-color: #3e3e42;
                }
            """)
            
            # 设置树控件样式
            self.main_window.left_panel.connection_tree.setStyleSheet("""
                QTreeWidget {
                    background-color: #1e1e1e;
                    border: none;
                    font-family: 'Microsoft YaHei', Arial;
                    font-size: 11px;
                    color: #d4d4d4;
                }
                QTreeWidget::item {
                    padding: 3px 0;
                    height: 22px;
                }
                QTreeWidget::item:hover {
                    background-color: #2d2d30;
                }
                QTreeWidget::item:selected {
                    background-color: #094771;
                    color: #ffffff;
                }
            """)
            
            self.main_window.left_panel.object_tree.setStyleSheet("""
                QTreeWidget {
                    background-color: #1e1e1e;
                    border: none;
                    font-family: 'Microsoft YaHei', Arial;
                    font-size: 11px;
                    color: #d4d4d4;
                }
                QTreeWidget::item {
                    padding: 3px 0;
                    height: 22px;
                }
                QTreeWidget::item:hover {
                    background-color: #2d2d30;
                }
                QTreeWidget::item:selected {
                    background-color: #094771;
                    color: #ffffff;
                }
            """)
        
        # 设置右侧面板样式
        if hasattr(self.main_window, 'right_panel'):
            self.main_window.right_panel.setStyleSheet("QWidget { background-color: #252526; }")
            
            # 设置标签页样式
            self.main_window.right_panel.tabs.setStyleSheet("""
                QTabWidget {
                    background-color: #252526;
                }
                QTabWidget::pane {
                    background-color: #1e1e1e;
                    border: 1px solid #3e3e42;
                }
                QTabBar::tab {
                    padding: 8px 16px;
                    font-size: 11px;
                    font-family: 'Microsoft YaHei', Arial;
                    background-color: #2d2d30;
                    color: #d4d4d4;
                    border: 1px solid #3e3e42;
                    border-bottom: none;
                    margin-right: 2px;
                    border-top-left-radius: 4px;
                    border-top-right-radius: 4px;
                }
                QTabBar::tab:selected {
                    background-color: #1e1e1e;
                    color: #ffffff;
                    border-bottom: 1px solid #1e1e1e;
                    font-weight: bold;
                }
                QTabBar::tab:hover {
                    background-color: #3e3e42;
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
        
        # 设置查询标签页样式
        for i in range(self.main_window.right_panel.tabs.count()):
            tab_widget = self.main_window.right_panel.tabs.widget(i)
            if hasattr(tab_widget, 'sql_editor'):
                # 设置SQL编辑器样式
                tab_widget.sql_editor.setStyleSheet("""
                    QTextEdit {
                        background-color: #1e1e1e;
                        border: 1px solid #3e3e42;
                        font-family: 'Consolas', 'Courier New', monospace;
                        font-size: 11px;
                        color: #d4d4d4;
                        padding: 0 8px 0 35px;
                        line-height: 1.4;
                    }
                """)
                
                # 设置结果表格样式
                tab_widget.result_table.setStyleSheet("""
                    QTableWidget {
                        background-color: #1e1e1e;
                        border: 1px solid #3e3e42;
                        font-size: 11px;
                        font-family: 'Microsoft YaHei', Arial;
                        color: #d4d4d4;
                    }
                    QTableWidget::header {
                        background-color: #2d2d30;
                        border-bottom: 1px solid #3e3e42;
                        padding: 4px;
                        font-size: 11px;
                        font-family: 'Microsoft YaHei', Arial;
                        font-weight: bold;
                        color: #d4d4d4;
                    }
                    QTableWidget::item {
                        padding: 4px 8px;
                        height: 24px;
                    }
                    QTableWidget::item:selected {
                        background-color: #094771;
                        color: #ffffff;
                    }
                """)
                
                # 设置顶部工具栏样式
                for widget in tab_widget.children():
                    if hasattr(widget, 'setStyleSheet'):
                        widget.setStyleSheet("""
                            QWidget {
                                background-color: #2d2d30;
                                border-bottom: 1px solid #3e3e42;
                                padding: 4px 8px;
                            }
                            QPushButton {
                                padding: 4px 8px;
                                font-size: 11px;
                                font-family: 'Microsoft YaHei', Arial;
                                background-color: #1e1e1e;
                                color: #d4d4d4;
                                border: 1px solid #3e3e42;
                                border-radius: 4px;
                            }
                            QPushButton:hover {
                                background-color: #2d2d30;
                                border: 1px solid #4e4e52;
                            }
                            QPushButton:pressed {
                                background-color: #3e3e42;
                                border: 1px solid #5e5e62;
                            }
                            QComboBox {
                                padding: 4px 8px;
                                font-size: 11px;
                                font-family: 'Microsoft YaHei', Arial;
                                background-color: #1e1e1e;
                                color: #d4d4d4;
                                border: 1px solid #3e3e42;
                                border-radius: 4px;
                            }
                            QComboBox QAbstractItemView {
                                font-size: 11px;
                                font-family: 'Microsoft YaHei', Arial;
                                background-color: #1e1e1e;
                                color: #d4d4d4;
                                border: 1px solid #3e3e42;
                            }
                        """)
        
        # 设置状态栏样式
        if hasattr(self.main_window, 'status_bar'):
            self.main_window.status_bar.setStyleSheet("""
                QStatusBar {
                    background-color: #252526;
                    border-top: 1px solid #3e3e42;
                    font-size: 11px;
                    font-family: 'Microsoft YaHei', Arial;
                    padding: 4px 12px;
                    min-height: 30px;
                    color: #d4d4d4;
                }
                QStatusBar QLabel {
                    margin-right: 20px;
                    color: #d4d4d4;
                    padding: 2px 0;
                }
            """)
        
        # 设置菜单栏样式
        menu_bar = self.main_window.menuBar()
        menu_bar.setStyleSheet("""
            QMenuBar {
                background-color: #252526;
                border-bottom: 1px solid #3e3e42;
                padding: 4px 0;
                color: #d4d4d4;
            }
            QMenuBar::item {
                padding: 6px 12px;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: transparent;
                color: #d4d4d4;
            }
            QMenuBar::item:hover {
                background-color: #3e3e42;
                border-radius: 4px;
            }
            QMenuBar::item:selected {
                background-color: #094771;
                color: #ffffff;
                border-radius: 4px;
            }
            QMenu {
                background-color: #252526;
                border: 1px solid #3e3e42;
                border-radius: 4px;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
                color: #d4d4d4;
            }
            QMenu::item {
                padding: 6px 24px;
                color: #d4d4d4;
            }
            QMenu::item:hover {
                background-color: #094771;
                color: #ffffff;
            }
            QMenu::separator {
                height: 1px;
                background-color: #3e3e42;
                margin: 4px 0;
            }
        """)
        
        # 设置工具栏样式
        if hasattr(self.main_window, 'main_toolbar'):
            self.main_window.main_toolbar.setStyleSheet("""
                QToolBar {
                    background-color: #252526;
                    border: 1px solid #3e3e42;
                    padding: 2px;
                    spacing: 1px;
                }
                QToolButton {
                    padding: 4px 6px;
                    font-size: 10px;
                    font-family: 'Microsoft YaHei', Arial;
                    border: 1px solid transparent;
                    border-radius: 2px;
                    background-color: #1e1e1e;
                    color: #d4d4d4;
                    margin: 0 1px;
                }
                QToolButton:hover {
                    background-color: #2d2d30;
                    border: 1px solid #3e3e42;
                }
                QToolButton:pressed {
                    background-color: #3e3e42;
                    border: 1px solid #4e4e52;
                }
                QToolButton:checked {
                    background-color: #094771;
                    border: 1px solid #1976d2;
                    color: #ffffff;
                }
            """)
        
        self.main_window.status_info.setText("已切换到深色模式")
    
    def show_help(self):
        """显示帮助"""
        QMessageBox.information(self.main_window, "使用帮助", "使用帮助功能开发中...")
    
    def about(self):
        """关于"""
        QMessageBox.information(self.main_window, "关于", "Navicat Style SQLTool v1.0\n\n基于PyQt6开发的数据库管理工具")
    
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
        self.main_window.sql_operations.find_sql()
    
    def replace_sql(self):
        """替换SQL"""
        self.main_window.sql_operations.replace_sql()
    
    def open_sql_file(self):
        """打开SQL文件"""
        # 打开文件选择对话框
        from PyQt6.QtWidgets import QFileDialog
        file_path, _ = QFileDialog.getOpenFileName(
            self.main_window, "打开SQL文件", "", "SQL文件 (*.sql);;所有文件 (*.*)")

        if not file_path:
            return

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                sql_content = f.read()

            # 创建新的查询标签页
            self.main_window.add_new_query_tab()

            # 获取当前标签页的SQL编辑器
            current_tab = self.main_window.right_panel.tabs.currentWidget()
            if current_tab:
                # 检查是否是QueryTab组件
                if hasattr(current_tab, 'sql_editor'):
                    # 从QueryTab组件中获取
                    current_tab.sql_editor.setPlainText(sql_content)
                    self.logger.log('INFO', "从QueryTab组件中获取SQL编辑器并设置内容")
                else:
                    # 对于旧的标签页，保持原有逻辑
                    from ui.components.sql_editor import SQLTextEdit
                    for widget in current_tab.findChildren(SQLTextEdit):
                        widget.setPlainText(sql_content)
                        break

            self.main_window.status_info.setText(f"成功打开SQL文件: {file_path}")
            self.logger.log('INFO', f"打开SQL文件: {file_path}")
        except Exception as e:
            QMessageBox.critical(self.main_window, "打开SQL文件", f"打开SQL文件失败: {str(e)}")
            self.logger.log('ERROR', f"打开SQL文件失败: {str(e)}")
    
    def save_sql_file(self):
        """保存SQL文件"""
        # 获取当前标签页的SQL编辑器
        current_tab = self.main_window.right_panel.tabs.currentWidget()
        if not current_tab:
            return

        sql_editor = None

        # 检查是否是QueryTab组件
        if hasattr(current_tab, 'sql_editor'):
            # 从QueryTab组件中获取
            sql_editor = current_tab.sql_editor
            self.logger.log('INFO', "从QueryTab组件中获取SQL编辑器")
        else:
            # 对于旧的标签页，保持原有逻辑
            from ui.components.sql_editor import SQLTextEdit
            for widget in current_tab.findChildren(SQLTextEdit):
                sql_editor = widget
                break

        if not sql_editor:
            return

        # 打开文件保存对话框
        from PyQt6.QtWidgets import QFileDialog
        file_path, _ = QFileDialog.getSaveFileName(
            self.main_window, "保存SQL文件", "", "SQL文件 (*.sql);;所有文件 (*.*)")

        if not file_path:
            return

        try:
            sql_content = sql_editor.toPlainText()
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(sql_content)

            self.main_window.status_info.setText(f"成功保存SQL文件: {file_path}")
            self.logger.log('INFO', f"保存SQL文件: {file_path}")
        except Exception as e:
            QMessageBox.critical(self.main_window, "保存SQL文件", f"保存SQL文件失败: {str(e)}")
            self.logger.log('ERROR', f"保存SQL文件失败: {str(e)}")
    
    def import_data(self):
        """导入数据"""
        self.main_window.data_import_export.import_data()
    
    def export_data(self):
        """导出数据"""
        self.main_window.data_import_export.export_data()
    
    def commit_transaction(self):
        """提交事务"""
        if hasattr(self.main_window, 'db_connection'):
            try:
                self.main_window.db_connection.commit()
                QMessageBox.information(self.main_window, "提交事务", "事务提交成功")
                self.main_window.status_info.setText("事务提交成功")
                self.logger.log('INFO', "事务提交成功")
            except Exception as e:
                QMessageBox.critical(self.main_window, "提交事务", f"事务提交失败: {str(e)}")
                self.logger.log('ERROR', f"事务提交失败: {str(e)}")
        else:
            QMessageBox.warning(self.main_window, "提交事务", "请先连接到数据库")
    
    def rollback_transaction(self):
        """回滚事务"""
        if hasattr(self.main_window, 'db_connection'):
            try:
                self.main_window.db_connection.rollback()
                QMessageBox.information(self.main_window, "回滚事务", "事务回滚成功")
                self.main_window.status_info.setText("事务回滚成功")
                self.logger.log('INFO', "事务回滚成功")
            except Exception as e:
                QMessageBox.critical(self.main_window, "回滚事务", f"事务回滚失败: {str(e)}")
                self.logger.log('ERROR', f"事务回滚失败: {str(e)}")
        else:
            QMessageBox.warning(self.main_window, "回滚事务", "请先连接到数据库")
    
    def format_sql(self):
        """SQL格式化"""
        self.main_window.sql_operations.format_sql()
    
    def explain_sql(self):
        """执行计划"""
        self.main_window.sql_operations.explain_sql()
    
    def generate_er_diagram(self):
        """生成ER图表"""
        self.show_feature_not_implemented("ER图表")
    
    def transfer_data(self):
        """数据传输"""
        self.show_feature_not_implemented("数据传输")
    
    def scheduled_tasks(self):
        """计划任务"""
        self.show_feature_not_implemented("计划任务")
    
    def create_database(self):
        """新建数据库"""
        self.show_feature_not_implemented("新建数据库")
    
    def drop_database(self):
        """删除数据库"""
        self.show_feature_not_implemented("删除数据库")
    
    def backup_database(self):
        """备份数据库"""
        self.show_feature_not_implemented("备份数据库")
    
    def restore_database(self):
        """还原数据库"""
        self.show_feature_not_implemented("还原数据库")
    
    def sync_data(self):
        """数据同步"""
        self.show_feature_not_implemented("数据同步")
    
    def sync_structure(self):
        """结构同步"""
        self.show_feature_not_implemented("结构同步")
    
    def toggle_object_browser(self):
        """显示/隐藏对象浏览器"""
        self.show_feature_not_implemented("显示/隐藏对象浏览器")
    
    def toggle_status_bar(self):
        """显示/隐藏状态栏"""
        self.show_feature_not_implemented("显示/隐藏状态栏")
    
    def open_table(self, table_name):
        """打开表"""
        self.main_window.table_operations.open_table(table_name)
    
    def new_table(self):
        """新建表"""
        self.main_window.table_operations.new_table()
    
    def delete_table(self, table_name):
        """删除表"""
        self.main_window.table_operations.delete_table(table_name)
    
    def truncate_table(self, table_name, is_truncate):
        """清空表或截断表"""
        self.main_window.table_operations.truncate_table(table_name, is_truncate)
    
    def copy_table(self, table_name, copy_structure, copy_data):
        """复制表"""
        self.main_window.table_operations.copy_table(table_name, copy_structure, copy_data)
    
    def dump_sql(self, table_name, dump_structure, dump_data):
        """转储SQL文件"""
        self.main_window.table_operations.dump_sql(table_name, dump_structure, dump_data)
    
    def maintain_table(self, table_name, operation):
        """维护表"""
        self.main_window.table_operations.maintain_table(table_name, operation)
    
    def rename_table(self, table_name):
        """重命名表"""
        self.main_window.table_operations.rename_table(table_name)
    
    def show_table_info(self, table_name):
        """显示表信息"""
        self.main_window.table_operations.show_table_info(table_name)
