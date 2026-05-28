#!/usr/bin/env python3
"""
右键菜单系统
"""

from PyQt6.QtWidgets import QMenu, QMessageBox
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QCursor, QAction


class ContextMenuManager:
    """上下文菜单管理器"""
    
    def __init__(self, main_window):
        self.main_window = main_window
    
    def get_connection_tree_menu(self, item_type, item_data=None):
        """获取连接树右键菜单
        
        Args:
            item_type: 项目类型 (connection, database, table, view, procedure, function, trigger)
            item_data: 项目数据
            
        Returns:
            QMenu: 上下文菜单
        """
        menu = QMenu()
        
        if item_type == 'connection':
            self._build_connection_menu(menu, item_data)
        elif item_type == 'database':
            self._build_database_menu(menu, item_data)
        elif item_type == 'table':
            self._build_table_menu(menu, item_data)
        elif item_type == 'view':
            self._build_view_menu(menu, item_data)
        elif item_type == 'procedure' or item_type == 'function':
            self._build_routine_menu(menu, item_data)
        elif item_type == 'trigger':
            self._build_trigger_menu(menu, item_data)
        
        return menu
    
    def _build_connection_menu(self, menu, conn_data):
        """构建连接右键菜单"""
        open_action = QAction("打开连接", menu)
        open_action.triggered.connect(lambda: self.main_window.connect_to_database(conn_data))
        menu.addAction(open_action)
        
        edit_action = QAction("编辑连接", menu)
        edit_action.triggered.connect(lambda: self.main_window.connection_manager.edit_connection(conn_data))
        menu.addAction(edit_action)
        
        menu.addSeparator()
        
        copy_action = QAction("复制连接", menu)
        copy_action.triggered.connect(lambda: self.main_window.event_handler.copy_connection(conn_data))
        menu.addAction(copy_action)
        
        delete_action = QAction("删除连接", menu)
        delete_action.triggered.connect(lambda: self.main_window.event_handler.delete_connection(conn_data))
        menu.addAction(delete_action)
        
        menu.addSeparator()
        
        if conn_data.get('ssh_enabled'):
            reconnect_action = QAction("重新连接", menu)
            reconnect_action.triggered.connect(lambda: self.main_window.connect_to_database(conn_data))
            menu.addAction(reconnect_action)
    
    def _build_database_menu(self, menu, db_name):
        """构建数据库右键菜单"""
        refresh_action = QAction("刷新", menu)
        refresh_action.triggered.connect(lambda: self.main_window.left_panel.load_connections_to_tree())
        menu.addAction(refresh_action)
        
        menu.addSeparator()
        
        new_table_action = QAction("新建表", menu)
        new_table_action.triggered.connect(self.main_window.table_operations.new_table)
        menu.addAction(new_table_action)
        
        new_view_action = QAction("新建视图", menu)
        new_view_action.triggered.connect(self.main_window.show_view_manager)
        menu.addAction(new_view_action)
        
        menu.addSeparator()
        
        backup_action = QAction("备份数据库", menu)
        backup_action.triggered.connect(lambda: self.main_window.event_handler.backup_database())
        menu.addAction(backup_action)
        
        menu.addSeparator()
        
        # 子菜单 - 新建存储过程/函数
        routine_menu = QMenu("新建存储过程/函数", menu)
        menu.addMenu(routine_menu)
        
        new_proc_action = QAction("新建存储过程", routine_menu)
        new_proc_action.triggered.connect(self.main_window.show_routine_manager)
        routine_menu.addAction(new_proc_action)
        
        new_func_action = QAction("新建函数", routine_menu)
        new_func_action.triggered.connect(self.main_window.show_routine_manager)
        routine_menu.addAction(new_func_action)
        
        new_trigger_action = QAction("新建触发器", routine_menu)
        new_trigger_action.triggered.connect(self.main_window.show_trigger_manager)
        routine_menu.addAction(new_trigger_action)
        
        menu.addSeparator()
        
        er_diagram_action = QAction("生成ER图", menu)
        er_diagram_action.triggered.connect(self.main_window.show_er_diagram)
        menu.addAction(er_diagram_action)
    
    def _build_table_menu(self, menu, table_name):
        """构建表右键菜单"""
        # 数据操作
        open_action = QAction("打开表", menu)
        open_action.triggered.connect(lambda: self.main_window.table_operations.open_table(table_name))
        menu.addAction(open_action)
        
        select_action = QAction("SELECT * 查询", menu)
        select_action.triggered.connect(lambda: self._generate_select(table_name))
        menu.addAction(select_action)
        
        menu.addSeparator()
        
        # 结构操作
        design_action = QAction("设计表", menu)
        design_action.triggered.connect(lambda: self.main_window.table_operations.design_table(table_name))
        menu.addAction(design_action)
        
        menu.addSeparator()
        
        # 维护操作
        maintain_menu = QMenu("表维护", menu)
        menu.addMenu(maintain_menu)
        
        analyze_action = QAction("分析表", maintain_menu)
        analyze_action.triggered.connect(lambda: self._maintain_table(table_name, 'ANALYZE'))
        maintain_menu.addAction(analyze_action)
        
        check_action = QAction("检查表", maintain_menu)
        check_action.triggered.connect(lambda: self._maintain_table(table_name, 'CHECK'))
        maintain_menu.addAction(check_action)
        
        optimize_action = QAction("优化表", maintain_menu)
        optimize_action.triggered.connect(lambda: self._maintain_table(table_name, 'OPTIMIZE'))
        maintain_menu.addAction(optimize_action)
        
        repair_action = QAction("修复表", maintain_menu)
        repair_action.triggered.connect(lambda: self._maintain_table(table_name, 'REPAIR'))
        maintain_menu.addAction(repair_action)
        
        menu.addSeparator()
        
        # 复制相关
        copy_menu = QMenu("复制", menu)
        menu.addMenu(copy_menu)
        
        copy_structure_action = QAction("仅复制结构", copy_menu)
        copy_structure_action.triggered.connect(lambda: self.main_window.table_operations.copy_table(table_name, True, False))
        copy_menu.addAction(copy_structure_action)
        
        copy_data_action = QAction("复制结构和数据", copy_menu)
        copy_data_action.triggered.connect(lambda: self.main_window.table_operations.copy_table(table_name, True, True))
        copy_menu.addAction(copy_data_action)
        
        menu.addSeparator()
        
        # 清空/删除
        truncate_action = QAction("清空表数据", menu)
        truncate_action.triggered.connect(lambda: self.main_window.table_operations.truncate_table(table_name, False))
        menu.addAction(truncate_action)
        
        drop_action = QAction("删除表", menu)
        drop_action.triggered.connect(lambda: self.main_window.table_operations.delete_table(table_name))
        menu.addAction(drop_action)
        
        menu.addSeparator()
        
        # SQL生成
        sql_menu = QMenu("生成SQL", menu)
        menu.addMenu(sql_menu)
        
        create_sql_action = QAction("CREATE TABLE", sql_menu)
        create_sql_action.triggered.connect(lambda: self._generate_create_sql(table_name))
        sql_menu.addAction(create_sql_action)
        
        insert_sql_action = QAction("INSERT语句", sql_menu)
        insert_sql_action.triggered.connect(lambda: self._generate_insert_sql(table_name))
        sql_menu.addAction(insert_sql_action)
        
        update_sql_action = QAction("UPDATE语句", sql_menu)
        update_sql_action.triggered.connect(lambda: self._generate_update_sql(table_name))
        sql_menu.addAction(update_sql_action)
    
    def _build_view_menu(self, menu, view_name):
        """构建视图右键菜单"""
        open_action = QAction("打开视图", menu)
        open_action.triggered.connect(lambda: self._open_view(view_name))
        menu.addAction(open_action)
        
        menu.addSeparator()
        
        design_action = QAction("编辑视图", menu)
        design_action.triggered.connect(lambda: self._design_view(view_name))
        menu.addAction(design_action)
        
        menu.addSeparator()
        
        drop_action = QAction("删除视图", menu)
        drop_action.triggered.connect(lambda: self._drop_view(view_name))
        menu.addAction(drop_action)
    
    def _build_routine_menu(self, menu, routine_name):
        """构建存储过程/函数右键菜单"""
        edit_action = QAction("编辑", menu)
        edit_action.triggered.connect(lambda: self._edit_routine(routine_name))
        menu.addAction(edit_action)
        
        execute_action = QAction("执行", menu)
        execute_action.triggered.connect(lambda: self._execute_routine(routine_name))
        menu.addAction(execute_action)
        
        menu.addSeparator()
        
        drop_action = QAction("删除", menu)
        drop_action.triggered.connect(lambda: self._drop_routine(routine_name))
        menu.addAction(drop_action)
    
    def _build_trigger_menu(self, menu, trigger_name):
        """构建触发器右键菜单"""
        edit_action = QAction("编辑", menu)
        edit_action.triggered.connect(lambda: self._edit_trigger(trigger_name))
        menu.addAction(edit_action)
        
        menu.addSeparator()
        
        drop_action = QAction("删除", menu)
        drop_action.triggered.connect(lambda: self._drop_trigger(trigger_name))
        menu.addAction(drop_action)
    
    # 辅助方法
    def _generate_select(self, table_name):
        """生成SELECT语句"""
        sql = f"SELECT * FROM `{table_name}` LIMIT 1000;"
        self.main_window.add_new_query_tab()
        current_tab = self.main_window.right_panel.tabs.currentWidget()
        if current_tab and hasattr(current_tab, 'sql_editor'):
            current_tab.sql_editor.setPlainText(sql)
    
    def _generate_create_sql(self, table_name):
        """生成CREATE TABLE语句"""
        QMessageBox.information(self.main_window, "提示", f"生成 {table_name} 的CREATE TABLE语句")
    
    def _generate_insert_sql(self, table_name):
        """生成INSERT语句"""
        QMessageBox.information(self.main_window, "提示", f"生成 {table_name} 的INSERT语句")
    
    def _generate_update_sql(self, table_name):
        """生成UPDATE语句"""
        QMessageBox.information(self.main_window, "提示", f"生成 {table_name} 的UPDATE语句")
    
    def _maintain_table(self, table_name, operation):
        """执行表维护操作"""
        try:
            with self.main_window.db_connection.cursor() as cursor:
                cursor.execute(f"{operation} TABLE `{table_name}`")
            QMessageBox.information(self.main_window, "成功", f"表 {table_name} {operation}成功")
        except Exception as e:
            QMessageBox.critical(self.main_window, "失败", f"执行失败:\n{str(e)}")
    
    def _execute_routine(self, routine_name):
        """执行存储过程/函数"""
        QMessageBox.information(self.main_window, "提示", f"执行 {routine_name}")
    
    def _open_view(self, view_name):
        """打开视图"""
        try:
            from ui.components.view_manager import ViewManager
            manager = ViewManager(self.main_window)
            # 加载视图并打开
            self.main_window.add_new_query_tab()
            current_tab = self.main_window.right_panel.tabs.currentWidget()
            if current_tab and hasattr(current_tab, 'sql_editor'):
                sql = f"SELECT * FROM `{view_name}` LIMIT 1000;"
                current_tab.sql_editor.setPlainText(sql)
                self.main_window.sql_operations.execute_sql()
        except Exception as e:
            QMessageBox.critical(self.main_window, "错误", f"打开视图失败:\n{str(e)}")
    
    def _design_view(self, view_name):
        """设计视图"""
        try:
            from ui.components.view_manager import ViewDesigner
            designer = ViewDesigner(self.main_window, view_name)
            designer.exec()
        except Exception as e:
            QMessageBox.critical(self.main_window, "错误", f"设计视图失败:\n{str(e)}")
    
    def _drop_view(self, view_name):
        """删除视图"""
        try:
            if QMessageBox.question(self.main_window, "删除确认",
                                f"确定要删除视图 '{view_name}' 吗？",
                                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) != QMessageBox.StandardButton.Yes:
                return
            
            with self.main_window.db_connection.cursor() as cursor:
                cursor.execute(f"DROP VIEW `{view_name}`")
                self.main_window.db_connection.commit()
            
            QMessageBox.information(self.main_window, "成功", f"视图 '{view_name}' 已删除")
            self.main_window.left_panel.load_connections_to_tree()
        except Exception as e:
            QMessageBox.critical(self.main_window, "错误", f"删除视图失败:\n{str(e)}")
    
    def _edit_routine(self, routine_name):
        """编辑存储过程/函数"""
        self.main_window.show_routine_manager()
    
    def _drop_routine(self, routine_name):
        """删除存储过程/函数"""
        self.main_window.show_routine_manager()
    
    def _edit_trigger(self, trigger_name):
        """编辑触发器"""
        self.main_window.show_trigger_manager()
    
    def _drop_trigger(self, trigger_name):
        """删除触发器"""
        self.main_window.show_trigger_manager()
    
    def show_menu(self, menu):
        """显示菜单"""
        menu.exec(QCursor.pos())


class StatusBarEnhancer:
    """状态栏增强组件"""
    
    def __init__(self, main_window):
        self.main_window = main_window
        self.widgets = {}
    
    def create_status_widgets(self, parent_layout):
        """创建状态栏组件"""
        from PyQt6.QtWidgets import QWidget, QHBoxLayout, QLabel
        from PyQt6.QtCore import Qt
        
        # 创建状态栏容器
        status_widget = QWidget()
        status_widget.setStyleSheet("""
            QWidget {
                background-color: #f0f0f0;
                border-top: 1px solid #d0d0d0;
                padding: 2px 8px;
            }
            QLabel {
                font-size: 11px;
                color: #666666;
                padding: 0 8px;
            }
        """)
        
        layout = QHBoxLayout(status_widget)
        layout.setContentsMargins(4, 2, 4, 2)
        layout.setSpacing(0)
        
        # 连接状态
        self.widgets['connection'] = QLabel("未连接")
        layout.addWidget(self.widgets['connection'])
        
        # 分隔符
        layout.addWidget(self._create_separator())
        
        # 数据库信息
        self.widgets['database'] = QLabel("数据库: -")
        layout.addWidget(self.widgets['database'])
        
        # 分隔符
        layout.addWidget(self._create_separator())
        
        # 执行时间
        self.widgets['execution_time'] = QLabel("执行时间: -")
        layout.addWidget(self.widgets['execution_time'])
        
        # 分隔符
        layout.addWidget(self._create_separator())
        
        # 记录数
        self.widgets['record_count'] = QLabel("记录数: -")
        layout.addWidget(self.widgets['record_count'])
        
        # 分隔符
        layout.addWidget(self._create_separator())
        
        # 内存使用
        self.widgets['memory'] = QLabel("内存: -")
        layout.addWidget(self.widgets['memory'])
        
        # 分隔符
        layout.addWidget(self._create_separator())
        
        # 当前时间
        self.widgets['time'] = QLabel("")
        layout.addWidget(self.widgets['time'])
        
        # 可变组件
        layout.addStretch()
        
        parent_layout.addWidget(status_widget)
        
        return status_widget
    
    def _create_separator(self):
        """创建分隔符"""
        from PyQt6.QtWidgets import QFrame
        separator = QFrame()
        separator.setFrameShape(QFrame.Shape.VLine)
        separator.setFrameShadow(QFrame.Shadow.Sunken)
        separator.setStyleSheet("border: none; border-left: 1px solid #d0d0d0; margin: 2px 4px;")
        return separator
    
    def update_connection_status(self, connected, conn_name=""):
        """更新连接状态"""
        if connected:
            self.widgets['connection'].setText(f"✓ 已连接: {conn_name}")
            self.widgets['connection'].setStyleSheet("font-size: 11px; color: #28a745; padding: 0 8px;")
        else:
            self.widgets['connection'].setText("○ 未连接")
            self.widgets['connection'].setStyleSheet("font-size: 11px; color: #6c757d; padding: 0 8px;")
    
    def update_database(self, db_name, db_type=""):
        """更新数据库信息"""
        type_str = f" ({db_type})" if db_type else ""
        self.widgets['database'].setText(f"数据库: {db_name}{type_str}")
    
    def update_execution_time(self, time_str):
        """更新执行时间"""
        self.widgets['execution_time'].setText(f"执行时间: {time_str}")
    
    def update_record_count(self, count):
        """更新记录数"""
        if isinstance(count, int):
            self.widgets['record_count'].setText(f"记录数: {count:,}")
        else:
            self.widgets['record_count'].setText(f"记录数: {count}")
    
    def update_memory(self):
        """更新内存使用"""
        import psutil
        import os
        process = psutil.Process(os.getpid())
        mem_info = process.memory_info()
        mem_mb = mem_info.rss / 1024 / 1024
        self.widgets['memory'].setText(f"内存: {mem_mb:.1f} MB")
    
    def update_time(self):
        """更新时间显示"""
        from datetime import datetime
        self.widgets['time'].setText(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    
    def clear_status(self):
        """清除状态"""
        self.widgets['execution_time'].setText("执行时间: -")
        self.widgets['record_count'].setText("记录数: -")
