#!/usr/bin/env python3
"""
连接管理模块
"""

import json
import os
from PyQt6.QtWidgets import QTreeWidgetItem, QMessageBox, QInputDialog
from PyQt6.QtCore import Qt
from ui.connection_dialog import ConnectionDialog

class ConnectionManager:
    """
    连接管理类
    """
    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
    
    def load_connections(self):
        """
        加载保存的连接
        """
        conn_file = "connections.json"
        if os.path.exists(conn_file):
            try:
                with open(conn_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.main_window.saved_connections = data.get('connections', {})
                    self.main_window.connection_groups = data.get('groups', {})
            except Exception as e:
                self.logger.log('ERROR', f"加载连接失败: {e}")
        else:
            # 示例连接
            self.main_window.saved_connections = {
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
    
    def save_connections(self):
        """
        保存连接
        """
        conn_file = "connections.json"
        try:
            data = {
                'connections': self.main_window.saved_connections,
                'groups': self.main_window.connection_groups
            }
            with open(conn_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self.logger.log('INFO', f"保存了 {len(self.main_window.saved_connections)} 个连接")
        except Exception as e:
            self.logger.log('ERROR', f"保存连接失败: {e}")
    
    def load_connections_to_tree(self, show_only_current=False):
        """
        加载连接到树
        """
        self.main_window.connection_tree.clear()
        
        # 添加连接组
        for group_name, connections in self.main_window.connection_groups.items():
            # 过滤连接
            filtered_connections = []
            for conn_name in connections:
                if not show_only_current or conn_name == self.main_window.current_connection:
                    filtered_connections.append(conn_name)
            
            if filtered_connections:
                group_item = QTreeWidgetItem(self.main_window.connection_tree, [group_name])
                group_item.setData(0, Qt.ItemDataRole.UserRole, ('group', group_name))
                
                for conn_name in filtered_connections:
                    if conn_name in self.main_window.saved_connections:
                        conn_item = QTreeWidgetItem(group_item, [conn_name])
                        conn_item.setData(0, Qt.ItemDataRole.UserRole, ('connection', conn_name))
                        
                        # 如果是当前连接，加载数据库对象
                        if conn_name == self.main_window.current_connection and hasattr(self.main_window, 'db_connection') and self.main_window.db_connection:
                            self._load_databases_to_connection_tree(conn_item)
        
        # 添加未分组的连接
        for conn_name, conn_data in self.main_window.saved_connections.items():
            # 检查是否已在组中
            in_group = False
            for group_name, connections in self.main_window.connection_groups.items():
                if conn_name in connections:
                    in_group = True
                    break
            
            if not in_group and (not show_only_current or conn_name == self.main_window.current_connection):
                conn_item = QTreeWidgetItem(self.main_window.connection_tree, [conn_name])
                conn_item.setData(0, Qt.ItemDataRole.UserRole, ('connection', conn_name))
                
                # 如果是当前连接，加载数据库对象
                if conn_name == self.main_window.current_connection and hasattr(self.main_window, 'db_connection') and self.main_window.db_connection:
                    self._load_databases_to_connection_tree(conn_item)
        
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
        
        expand_all_items(self.main_window.connection_tree)
    
    def _load_databases_to_connection_tree(self, conn_item):
        """
        加载数据库到连接树
        """
        if not hasattr(self.main_window, 'db_connection') or not self.main_window.db_connection:
            return
        
        try:
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type == 'MySQL':
                    # 显示所有数据库
                    cursor.execute("SHOW DATABASES")
                    databases = cursor.fetchall()
                    
                    for db in databases:
                        db_name = db['Database'] if isinstance(db, dict) else db[0]
                        if not db_name:
                            continue
                        db_item = QTreeWidgetItem(conn_item, [db_name])
                        db_item.setData(0, Qt.ItemDataRole.UserRole, ('database', db_name))
                        
                        # 如果是当前数据库，加载表
                        if db_name == self.main_window.current_db:
                            try:
                                cursor.execute(f"USE {db_name}")
                                cursor.execute("SHOW TABLES")
                                tables = cursor.fetchall()
                                
                                tables_item = QTreeWidgetItem(db_item, ['表'])
                                tables_item.setData(0, Qt.ItemDataRole.UserRole, ('tables', db_name))
                                
                                for table in tables:
                                    table_name = table[f'Tables_in_{db_name}'] if isinstance(table, dict) else table[0]
                                    table_item = QTreeWidgetItem(tables_item, [table_name])
                                    table_item.setData(0, Qt.ItemDataRole.UserRole, ('table', table_name))
                                
                                # 展开表节点
                                tables_item.setExpanded(True)
                            except Exception as e:
                                self.logger.log('WARNING', f"加载表失败: {e}")
                elif self.main_window.current_db_type == 'PostgreSQL':
                    # PostgreSQL显示所有数据库
                    cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
                    databases = cursor.fetchall()
                    
                    for db in databases:
                        db_name = db[0]
                        db_item = QTreeWidgetItem(conn_item, [db_name])
                        db_item.setData(0, Qt.ItemDataRole.UserRole, ('database', db_name))
                elif self.main_window.current_db_type == 'SQL Server':
                    # SQL Server显示所有数据库
                    cursor.execute("SELECT name FROM sys.databases")
                    databases = cursor.fetchall()
                    
                    for db in databases:
                        db_name = db[0]
                        db_item = QTreeWidgetItem(conn_item, [db_name])
                        db_item.setData(0, Qt.ItemDataRole.UserRole, ('database', db_name))
        except Exception as e:
            self.logger.log('ERROR', f"加载数据库到连接树失败: {str(e)}")
    
    def new_connection(self):
        """
        新建连接
        """
        dialog = ConnectionDialog(self.main_window)
        if dialog.exec():
            conn_data = dialog.result
            self.main_window.saved_connections[conn_data['name']] = conn_data
            self.load_connections_to_tree()
            self.save_connections()
            self.logger.log('INFO', f"新建连接: {conn_data['name']}")
    
    def edit_connection(self):
        """
        编辑连接
        """
        # 获取当前选中的连接
        selected_items = self.main_window.connection_tree.selectedItems()
        if not selected_items:
            QMessageBox.warning(self.main_window, "编辑连接", "请先选择一个连接")
            return
        
        item = selected_items[0]
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if data and data[0] == 'connection':
            conn_name = data[1]
            conn_data = self.main_window.saved_connections.get(conn_name)
            if conn_data:
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
                    self.load_connections_to_tree()
                    self.save_connections()
                    self.logger.log('INFO', f"编辑连接: {new_conn_data['name']}")
    
    def delete_connection(self):
        """
        删除连接
        """
        # 获取当前选中的连接
        selected_items = self.main_window.connection_tree.selectedItems()
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
                self.load_connections_to_tree()
                self.save_connections()
                self.logger.log('INFO', f"删除连接: {conn_name}")
    
    def new_connection_group(self):
        """
        新建连接组
        """
        group_name, ok = QInputDialog.getText(self.main_window, "新建连接组", "请输入连接组名称:")
        if ok and group_name:
            if group_name not in self.main_window.connection_groups:
                self.main_window.connection_groups[group_name] = []
                self.load_connections_to_tree()
                self.save_connections()
                self.logger.log('INFO', f"新建连接组: {group_name}")
    
    def connect_to_database(self, conn_name):
        """
        连接到数据库
        """
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
                
                # 获取表名和列名用于自动补全
                from core.database_operations import get_database_objects_for_completion
                tables, columns = get_database_objects_for_completion(self.main_window.db_connection, self.main_window.current_db_type, self.main_window.current_db)
                
                # 更新所有SQL编辑器的补全列表
                self.main_window.update_all_sql_editors_completion(tables, columns)
                
                # 显示所有连接，保持连接列表完整
                self.load_connections_to_tree(show_only_current=False)
                
                # 切换到对象标签页
                self.main_window.left_tab_widget.setCurrentIndex(1)
                
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