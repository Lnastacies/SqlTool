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
                    new_group = new_conn_data.get('group', '无')
                    
                    # 从所有组中移除旧连接
                    for group_name, connections in self.main_window.connection_groups.items():
                        if conn_name in connections:
                            connections.remove(conn_name)
                    
                    # 如果连接名称改变，需要更新字典键
                    if new_conn_data['name'] != conn_name:
                        del self.main_window.saved_connections[conn_name]
                    
                    # 将连接添加到新的分组
                    if new_group != '无':
                        if new_group not in self.main_window.connection_groups:
                            self.main_window.connection_groups[new_group] = []
                        if new_conn_data['name'] not in self.main_window.connection_groups[new_group]:
                            self.main_window.connection_groups[new_group].append(new_conn_data['name'])
                    
                    self.main_window.saved_connections[new_conn_data['name']] = new_conn_data
                    self.main_window.load_connections_to_tree()
                    self.main_window.save_connections()
                    self.logger.log('INFO', f"编辑连接: {new_conn_data['name']}, 分组: {new_group}")
    
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
    
    def show_settings(self):
        """显示选项设置"""
        self.show_feature_not_implemented("选项设置")
    
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
        """连接上下文菜单（合并了对象浏览功能）"""
        from PyQt6.QtWidgets import QMenu

        item = self.main_window.left_panel.connection_tree.itemAt(pos)
        if not item:
            menu = QMenu()
            menu.addAction("新建连接", self.new_connection)
            menu.addAction("新建连接组", self.new_connection_group)
            menu.addSeparator()
            menu.addAction("刷新", self.refresh_objects)
            menu.exec(self.main_window.left_panel.connection_tree.mapToGlobal(pos))
            return

        data = item.data(0, Qt.ItemDataRole.UserRole)
        if not data:
            return

        item_type, item_name = data
        menu = QMenu()

        if item_type == 'connection':
            menu.addAction("连接", lambda: self.connect_to_database(item_name))
            menu.addAction("关闭连接", lambda: self.close_connection(item_name))
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
            menu.addAction("新建连接", self.new_connection)
            menu.addAction("重命名组", self.rename_connection_group)
            menu.addAction("删除组", self.delete_connection_group)
            menu.addSeparator()
            menu.addAction("刷新", self.refresh_objects)
        elif item_type == 'table':
            menu.addAction("打开表", lambda: self.open_table(item_name))
            menu.addAction("设计表", lambda: self.main_window.table_operations.design_table(item_name))
            menu.addAction("新建表", self.new_table)
            menu.addSeparator()
            menu.addAction("删除表", lambda: self.delete_table(item_name))
            menu.addAction("清空表", lambda: self.truncate_table(item_name, False))
            menu.addAction("截断表", lambda: self.truncate_table(item_name, True))
            menu.addSeparator()
            copy_menu = menu.addMenu("复制表")
            copy_menu.addAction("结构和数据", lambda: self.copy_table(item_name, True, True))
            copy_menu.addAction("仅结构", lambda: self.copy_table(item_name, True, False))
            copy_menu.addAction("仅数据", lambda: self.copy_table(item_name, False, True))
            menu.addSeparator()
            export_menu = menu.addMenu("导出")
            export_menu.addAction("SQL文件", lambda: self.dump_sql(item_name, True, True))
            export_menu.addAction("仅结构", lambda: self.dump_sql(item_name, True, False))
            export_menu.addAction("仅数据", lambda: self.dump_sql(item_name, False, True))
            menu.addSeparator()
            maintenance_menu = menu.addMenu("维护")
            maintenance_menu.addAction("分析表", lambda: self.maintain_table(item_name, "ANALYZE"))
            maintenance_menu.addAction("检查表", lambda: self.maintain_table(item_name, "CHECK"))
            maintenance_menu.addAction("优化表", lambda: self.maintain_table(item_name, "OPTIMIZE"))
            maintenance_menu.addAction("修复表", lambda: self.maintain_table(item_name, "REPAIR"))
            menu.addSeparator()
            menu.addAction("逆向表到模型...", lambda: self.show_feature_not_implemented("逆向表到模型"))
            menu.addSeparator()
            group_menu = menu.addMenu("管理组")
            group_menu.addAction("添加到组", lambda: self.show_feature_not_implemented("添加到组"))
            group_menu.addAction("从组移除", lambda: self.show_feature_not_implemented("从组移除"))
            menu.addSeparator()
            menu.addAction("复制", lambda: self.show_feature_not_implemented("复制"))
            menu.addAction("重命名", lambda: self.rename_table(item_name))
            menu.addAction("创建打开表快捷方式...", lambda: self.show_feature_not_implemented("创建打开表快捷方式"))
            menu.addSeparator()
            menu.addAction("刷新", self.refresh_objects)
            menu.addSeparator()
            menu.addAction("对象信息", lambda: self.show_table_info(item_name))
        elif item_type == 'view':
            menu.addAction("打开视图", lambda: self.show_feature_not_implemented("打开视图"))
            menu.addAction("设计视图", lambda: self.show_feature_not_implemented("设计视图"))
            menu.addSeparator()
            menu.addAction("删除视图", lambda: self.show_feature_not_implemented("删除视图"))
            menu.addSeparator()
            menu.addAction("重命名", lambda: self.show_feature_not_implemented("重命名视图"))
            menu.addSeparator()
            menu.addAction("刷新", self.refresh_objects)
            menu.addSeparator()
            menu.addAction("对象信息", lambda: self.show_feature_not_implemented("显示视图信息"))
        elif item_type == 'function':
            menu.addAction("编辑函数", lambda: self.show_feature_not_implemented("编辑函数"))
            menu.addSeparator()
            menu.addAction("删除函数", lambda: self.show_feature_not_implemented("删除函数"))
            menu.addSeparator()
            menu.addAction("重命名", lambda: self.show_feature_not_implemented("重命名函数"))
            menu.addSeparator()
            menu.addAction("刷新", self.refresh_objects)
        elif item_type == 'procedure':
            menu.addAction("编辑存储过程", lambda: self.show_feature_not_implemented("编辑存储过程"))
            menu.addSeparator()
            menu.addAction("删除存储过程", lambda: self.show_feature_not_implemented("删除存储过程"))
            menu.addSeparator()
            menu.addAction("重命名", lambda: self.show_feature_not_implemented("重命名存储过程"))
            menu.addSeparator()
            menu.addAction("刷新", self.refresh_objects)
        elif item_type == 'event':
            menu.addAction("编辑事件", lambda: self.show_feature_not_implemented("编辑事件"))
            menu.addSeparator()
            menu.addAction("删除事件", lambda: self.show_feature_not_implemented("删除事件"))
            menu.addSeparator()
            menu.addAction("重命名", lambda: self.show_feature_not_implemented("重命名事件"))
            menu.addSeparator()
            menu.addAction("刷新", self.refresh_objects)
        elif item_type == 'database':
            menu.addAction("打开数据库", lambda: self.show_feature_not_implemented("打开数据库"))
            menu.addAction("新建查询", self.new_query)
            menu.addSeparator()
            menu.addAction("刷新", self.refresh_objects)
        elif item_type == 'tables':
            menu.addAction("新建表", self.new_table)
            menu.addSeparator()
            menu.addAction("刷新", self.refresh_objects)
        else:
            menu.addAction("刷新", self.refresh_objects)

        menu.exec(self.main_window.left_panel.connection_tree.mapToGlobal(pos))
    
    def on_connection_double_clicked(self, item, column):
        """连接双击事件（合并了对象浏览功能）"""
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if not data:
            return

        item_type, item_name = data

        if item_type == 'connection':
            conn_name = item_name
            self.connect_to_database(conn_name)
            
            conn_item = None
            parent_item = None
            
            for i in range(self.main_window.left_panel.connection_tree.topLevelItemCount()):
                top_item = self.main_window.left_panel.connection_tree.topLevelItem(i)
                top_item_data = top_item.data(0, Qt.ItemDataRole.UserRole)
                
                if top_item_data and len(top_item_data) >= 2:
                    if top_item_data[0] == 'connection' and top_item_data[1] == conn_name:
                        conn_item = top_item
                        parent_item = top_item.parent()
                        break
                    elif top_item_data[0] == 'group':
                        for j in range(top_item.childCount()):
                            child_item = top_item.child(j)
                            child_data = child_item.data(0, Qt.ItemDataRole.UserRole)
                            if child_data and len(child_data) >= 2 and child_data[0] == 'connection' and child_data[1] == conn_name:
                                conn_item = child_item
                                parent_item = top_item
                                break
                    if conn_item:
                        break
            
            if parent_item:
                parent_item.setExpanded(True)
            if conn_item:
                conn_item.setExpanded(True)
            
            self.main_window.update_all_tab_combos()
        elif item_type == 'database':
            db_name = item_name
            if not db_name:
                QMessageBox.warning(self.main_window, "切换数据库失败", "数据库名称为空")
                return
            try:
                with self.main_window.db_connection.cursor() as cursor:
                    cursor.execute(f"USE `{db_name}`")
                
                self.main_window.current_db = db_name
                
                self.main_window.connection_status.setText(f"已连接: {self.main_window.current_connection} ({self.main_window.current_db_type}) - 数据库: {db_name}")
                self.main_window.status_info.setText("已切换数据库")
                self.logger.log('INFO', f"切换到数据库: {db_name}")
                
                if item.childCount() == 0:
                    self.main_window.left_panel.load_database_objects(item, db_name)
                
                from PyQt6.QtCore import QTimer
                def check_and_expand():
                    if item.childCount() > 0:
                        item.setExpanded(True)
                QTimer.singleShot(100, check_and_expand)
                
                self.main_window.update_all_tab_combos()
                
                if self.main_window.current_db and self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    try:
                        with self.main_window.db_connection.cursor() as cursor:
                            cursor.execute(f"USE `{self.main_window.current_db}`")
                    except Exception:
                        pass
            except Exception as e:
                QMessageBox.critical(self.main_window, "切换数据库失败", f"切换到数据库 {db_name} 时出错: {str(e)}")
                self.logger.log('ERROR', f"切换数据库失败: {str(e)}")
        elif item_type == 'table':
            db_item = item.parent()
            if db_item:
                db_item = db_item.parent()
                if db_item:
                    db_data = db_item.data(0, Qt.ItemDataRole.UserRole)
                    if db_data and len(db_data) >= 2 and db_data[0] == 'database':
                        db_name = db_data[1]
                        if db_name and db_name != self.main_window.current_db:
                            try:
                                with self.main_window.db_connection.cursor() as cursor:
                                    cursor.execute(f"USE `{db_name}`")
                                self.main_window.current_db = db_name
                                self.main_window.update_all_tab_combos()
                            except Exception as e:
                                self.logger.log('WARNING', f"切换数据库失败: {e}")
            self.open_table(item_name)
        elif item_type == 'view':
            self.show_feature_not_implemented("打开视图")
        elif item_type == 'procedure':
            self.show_feature_not_implemented("打开存储过程")
        elif item_type == 'function':
            self.show_feature_not_implemented("打开函数")
        elif item_type == 'event':
            self.show_feature_not_implemented("打开事件")
        else:
            if item.childCount() > 0:
                item.setExpanded(not item.isExpanded())

    def on_connection_item_clicked(self, item, column):
        """连接树单项点击事件（用于显示对象信息）"""
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if not data:
            return

        item_type, item_name = data

        if item_type in ['tables', 'views', 'procedures', 'functions', 'events', 'queries', 'reports', 'backups']:
            self.main_window.show_object_details(item_type, item_name)
        elif item_type == 'table':
            # 确保数据库上下文正确
            self.main_window.table_operations._ensure_database_context()

            object_info = {
                'created': '',
                'updated': '',
                'fields': [],
                'indexes': [],
                'foreign_keys': [],
                'ddl': ''
            }
            try:
                if hasattr(self.main_window, 'database_operations') and self.main_window.database_operations:
                    table_info = self.main_window.database_operations.get_table_info(item_name)
                    object_info.update(table_info)
                else:
                    from core.database_operations import DatabaseOperations
                    self.main_window.database_operations = DatabaseOperations(self.main_window.db_connection, self.main_window.current_db_type)
                    table_info = self.main_window.database_operations.get_table_info(item_name)
                    object_info.update(table_info)
            except Exception as e:
                self.logger.log('ERROR', f"加载表信息失败: {str(e)}")
            self.main_window.info_panel.update_info('表', item_name, object_info)
    
    def close_connection(self, conn_name):
        """关闭数据库连接"""
        if self.main_window.current_connection == conn_name:
            try:
                if hasattr(self.main_window, 'db_connection') and self.main_window.db_connection:
                    self.main_window.db_connection.close()
                    self.main_window.db_connection = None
                
                self.main_window.current_connection = ''
                self.main_window.current_db_type = ''
                self.main_window.current_db = ''
                self.main_window.connection_status.setText("未连接")
                self.main_window.status_info.setText("已断开连接")
                self.logger.log('INFO', f"关闭连接: {conn_name}")
                
                self.main_window.left_panel.load_connections_to_tree(show_only_current=False)
                self.main_window.update_all_tab_combos()
            except Exception as e:
                QMessageBox.critical(self.main_window, "关闭连接失败", f"关闭连接时出错: {str(e)}")
                self.logger.log('ERROR', f"关闭连接失败: {str(e)}")
        else:
            QMessageBox.warning(self.main_window, "关闭连接失败", "只能关闭当前连接")

    def connect_to_database(self, conn_name):
        """连接到数据库"""
        conn_data = self.main_window.saved_connections.get(conn_name)
        if conn_data:
            try:
                # 从连接池获取连接
                self.main_window.db_connection = self.main_window.connection_pool.get_connection(conn_name, conn_data)

                if not self.main_window.db_connection:
                    QMessageBox.warning(self.main_window, "连接失败", f"连接数据库失败: 可能是数据库服务未启动或连接信息错误")
                    return

                # 连接成功
                self.main_window.current_connection = conn_name
                self.main_window.current_db_type = conn_data['type']
                self.main_window.current_db = conn_data['database'] if conn_data['database'] else ''
                self.main_window.connection_status.setText(f"已连接: {conn_name} ({conn_data['type']})")
                self.main_window.status_info.setText("已连接")
                self.logger.log('INFO', f"连接到数据库: {conn_name}")

                self.main_window.load_connections_to_tree(show_only_current=False)

                # 恢复数据库上下文（因为 load_connections_to_tree 会改变当前数据库）
                if self.main_window.current_db and self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    try:
                        with self.main_window.db_connection.cursor() as cursor:
                            cursor.execute(f"USE `{self.main_window.current_db}`")
                    except Exception:
                        pass

                self.main_window.update_query_tab_info()

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
    

    
    def show_help(self):
        """显示帮助"""
        QMessageBox.information(self.main_window, "使用帮助", "使用帮助功能开发中...")
    
    def about(self):
        """关于"""
        from ui.components.about_dialog import AboutDialog
        dialog = AboutDialog(self.main_window)
        dialog.exec()
    
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
        from ui.components.er_diagram import ERDiagram
        diagram = ERDiagram(self.main_window)
        diagram.exec()
    
    def transfer_data(self):
        """数据传输"""
        from ui.components.data_transfer import DataTransfer
        transfer = DataTransfer(self.main_window)
        transfer.exec()
    
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
        from ui.components.backup_restore import BackupRestore
        backup_restore = BackupRestore(self.main_window)
        backup_restore.tab_widget.setCurrentIndex(0)  # 切换到备份标签页
        backup_restore.exec()
    
    def restore_database(self):
        """还原数据库"""
        from ui.components.backup_restore import BackupRestore
        backup_restore = BackupRestore(self.main_window)
        backup_restore.tab_widget.setCurrentIndex(1)  # 切换到恢复标签页
        backup_restore.exec()
    
    def sync_data(self):
        """数据同步"""
        self.main_window.logger.log('INFO', "===== sync_data 方法被调用 =====")
        from ui.components.database_sync import DatabaseSync
        self.main_window.logger.log('INFO', "创建 DatabaseSync 对话框")
        sync = DatabaseSync(self.main_window)
        self.main_window.logger.log('INFO', "DatabaseSync 对话框已创建，准备显示")
        sync.exec()
        self.main_window.logger.log('INFO', "DatabaseSync 对话框已关闭")
    
    def sync_structure(self):
        """结构同步"""
        from ui.components.structure_sync import StructureSync
        sync = StructureSync(self.main_window)
        sync.exec()
    
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
    
    
