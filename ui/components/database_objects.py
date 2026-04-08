#!/usr/bin/env python3
"""
数据库对象管理模块
"""

from PyQt6.QtWidgets import QTreeWidgetItem
from PyQt6.QtCore import Qt

class DatabaseObjectsManager:
    """
    数据库对象管理器
    """
    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
    
    def load_database_objects(self, connection_item):
        """
        加载数据库对象
        """
        try:
            # 根据数据库类型加载对象
            if self.main_window.current_db_type == 'MySQL':
                self._load_mysql_objects(connection_item)
            elif self.main_window.current_db_type == 'PostgreSQL':
                self._load_postgresql_objects(connection_item)
            elif self.main_window.current_db_type == 'SQLite':
                self._load_sqlite_objects(connection_item)
            elif self.main_window.current_db_type == 'SQL Server':
                self._load_sqlserver_objects(connection_item)
        except Exception as e:
            self.logger.log('ERROR', f"加载数据库对象失败: {str(e)}")
    
    def _load_mysql_objects(self, parent_item):
        """
        加载MySQL数据库对象
        """
        # 加载数据库
        try:
            with self.main_window.db_connection.cursor() as cursor:
                # 首先检查当前数据库
                current_db_name = ''
                try:
                    cursor.execute("SELECT DATABASE()")
                    current_db = cursor.fetchone()
                    if current_db:
                        current_db_name = current_db['DATABASE()'] if isinstance(current_db, dict) else current_db[0]
                except Exception as e:
                    self.logger.log('WARNING', f"获取当前数据库失败: {e}")
                
                # 如果没有当前数据库，尝试使用连接时指定的数据库
                if not current_db_name and self.main_window.current_db and self.main_window.current_db.strip():
                    try:
                        cursor.execute(f"USE {self.main_window.current_db}")
                        current_db_name = self.main_window.current_db
                    except Exception as e:
                        self.logger.log('WARNING', f"切换数据库失败: {e}")
                
                # 如果有当前数据库，直接加载其对象
                if current_db_name and current_db_name.strip():
                    db_item = QTreeWidgetItem(parent_item, [current_db_name])
                    db_item.setData(0, Qt.ItemDataRole.UserRole, ('database', current_db_name))
                    
                    # 加载表
                    try:
                        cursor.execute("SHOW TABLES")
                        tables = cursor.fetchall()
                        
                        tables_item = QTreeWidgetItem(db_item, ['表'])
                        tables_item.setData(0, Qt.ItemDataRole.UserRole, ('tables', current_db_name))
                        
                        for table in tables:
                            table_name = table[f'Tables_in_{current_db_name}'] if isinstance(table, dict) else table[0]
                            table_item = QTreeWidgetItem(tables_item, [table_name])
                            table_item.setData(0, Qt.ItemDataRole.UserRole, ('table', table_name))
                        
                        # 加载视图（使用正确的语法）
                        cursor.execute("SHOW FULL TABLES WHERE Table_type = 'VIEW'")
                        views = cursor.fetchall()
                        
                        if views:
                            views_item = QTreeWidgetItem(db_item, ['视图'])
                            views_item.setData(0, Qt.ItemDataRole.UserRole, ('views', current_db_name))
                            
                            for view in views:
                                view_name = view[f'Tables_in_{current_db_name}'] if isinstance(view, dict) else view[0]
                                view_item = QTreeWidgetItem(views_item, [view_name])
                                view_item.setData(0, Qt.ItemDataRole.UserRole, ('view', view_name))
                        
                        # 加载存储过程
                        cursor.execute("SHOW PROCEDURE STATUS WHERE Db = %s", (current_db_name,))
                        procedures = cursor.fetchall()
                        
                        if procedures:
                            procs_item = QTreeWidgetItem(db_item, ['存储过程'])
                            procs_item.setData(0, Qt.ItemDataRole.UserRole, ('procedures', current_db_name))
                            
                            for proc in procedures:
                                proc_name = proc['Name'] if isinstance(proc, dict) else proc[1]
                                proc_item = QTreeWidgetItem(procs_item, [proc_name])
                                proc_item.setData(0, Qt.ItemDataRole.UserRole, ('procedure', proc_name))
                        
                        # 加载函数
                        cursor.execute("SHOW FUNCTION STATUS WHERE Db = %s", (current_db_name,))
                        functions = cursor.fetchall()
                        
                        if functions:
                            funcs_item = QTreeWidgetItem(db_item, ['函数'])
                            funcs_item.setData(0, Qt.ItemDataRole.UserRole, ('functions', current_db_name))
                            
                            for func in functions:
                                func_name = func['Name'] if isinstance(func, dict) else func[1]
                                func_item = QTreeWidgetItem(funcs_item, [func_name])
                                func_item.setData(0, Qt.ItemDataRole.UserRole, ('function', func_name))
                        
                        # 加载事件
                        cursor.execute("SHOW EVENTS WHERE Db = %s", (current_db_name,))
                        events = cursor.fetchall()
                        
                        if events:
                            events_item = QTreeWidgetItem(db_item, ['事件'])
                            events_item.setData(0, Qt.ItemDataRole.UserRole, ('events', current_db_name))
                            
                            for event in events:
                                event_name = event['Name'] if isinstance(event, dict) else event[1]
                                event_item = QTreeWidgetItem(events_item, [event_name])
                                event_item.setData(0, Qt.ItemDataRole.UserRole, ('event', event_name))
                        
                        # 添加其他对象类型（查询、报表、备份）
                        queries_item = QTreeWidgetItem(db_item, ['查询'])
                        queries_item.setData(0, Qt.ItemDataRole.UserRole, ('queries', current_db_name))
                        
                        reports_item = QTreeWidgetItem(db_item, ['报表'])
                        reports_item.setData(0, Qt.ItemDataRole.UserRole, ('reports', current_db_name))
                        
                        backups_item = QTreeWidgetItem(db_item, ['备份'])
                        backups_item.setData(0, Qt.ItemDataRole.UserRole, ('backups', current_db_name))
                        
                        # 展开节点
                        db_item.setExpanded(True)
                        tables_item.setExpanded(True)
                    except Exception as e:
                        self.logger.log('ERROR', f"加载数据库对象失败: {str(e)}")
                        # 添加错误信息节点
                        error_item = QTreeWidgetItem(db_item, [f"错误: {str(e)}"])
                        error_item.setData(0, Qt.ItemDataRole.UserRole, ('error', current_db_name))
                else:
                    # 没有选择数据库，显示所有数据库
                    try:
                        cursor.execute("SHOW DATABASES")
                        databases = cursor.fetchall()
                        
                        for db in databases:
                            db_name = db['Database'] if isinstance(db, dict) else db[0]
                            if not db_name:
                                continue
                            db_item = QTreeWidgetItem(parent_item, [db_name])
                            db_item.setData(0, Qt.ItemDataRole.UserRole, ('database', db_name))
                        
                        # 展开节点
                        parent_item.setExpanded(True)
                    except Exception as e:
                        self.logger.log('ERROR', f"加载数据库列表失败: {str(e)}")
                        # 添加错误信息节点
                        error_item = QTreeWidgetItem(parent_item, [f"错误: {str(e)}"])
                        error_item.setData(0, Qt.ItemDataRole.UserRole, ('error', 'databases'))
        except Exception as e:
            self.logger.log('ERROR', f"加载MySQL对象失败: {str(e)}")
    
    def _load_postgresql_objects(self, parent_item):
        """
        加载PostgreSQL数据库对象
        """
        try:
            with self.main_window.db_connection.cursor() as cursor:
                # 加载表
                cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
                tables = cursor.fetchall()
                
                tables_item = QTreeWidgetItem(parent_item, ['表'])
                tables_item.setData(0, Qt.ItemDataRole.UserRole, ('tables', 'public'))
                
                for table in tables:
                    table_name = table[0]
                    table_item = QTreeWidgetItem(tables_item, [table_name])
                    table_item.setData(0, Qt.ItemDataRole.UserRole, ('table', table_name))
                
                # 加载视图
                cursor.execute("SELECT table_name FROM information_schema.views WHERE table_schema = 'public'")
                views = cursor.fetchall()
                
                views_item = QTreeWidgetItem(parent_item, ['视图'])
                views_item.setData(0, Qt.ItemDataRole.UserRole, ('views', 'public'))
                
                for view in views:
                    view_name = view[0]
                    view_item = QTreeWidgetItem(views_item, [view_name])
                    view_item.setData(0, Qt.ItemDataRole.UserRole, ('view', view_name))
                
                # 加载函数
                cursor.execute("SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'")
                functions = cursor.fetchall()
                
                funcs_item = QTreeWidgetItem(parent_item, ['函数'])
                funcs_item.setData(0, Qt.ItemDataRole.UserRole, ('functions', 'public'))
                
                for func in functions:
                    func_name = func[0]
                    func_item = QTreeWidgetItem(funcs_item, [func_name])
                    func_item.setData(0, Qt.ItemDataRole.UserRole, ('function', func_name))
                
                # 加载存储过程
                cursor.execute("SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE'")
                procedures = cursor.fetchall()
                
                procs_item = QTreeWidgetItem(parent_item, ['存储过程'])
                procs_item.setData(0, Qt.ItemDataRole.UserRole, ('procedures', 'public'))
                
                for proc in procedures:
                    proc_name = proc[0]
                    proc_item = QTreeWidgetItem(procs_item, [proc_name])
                    proc_item.setData(0, Qt.ItemDataRole.UserRole, ('procedure', proc_name))
                
                # 展开节点
                tables_item.setExpanded(True)
        except Exception as e:
            self.logger.log('ERROR', f"加载PostgreSQL对象失败: {str(e)}")
    
    def _load_sqlite_objects(self, parent_item):
        """
        加载SQLite数据库对象
        """
        try:
            cursor = self.main_window.db_connection.cursor()
            
            # 加载表
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            tables = cursor.fetchall()
            
            tables_item = QTreeWidgetItem(parent_item, ['表'])
            tables_item.setData(0, Qt.ItemDataRole.UserRole, ('tables', 'main'))
            
            for table in tables:
                table_name = table[0]
                table_item = QTreeWidgetItem(tables_item, [table_name])
                table_item.setData(0, Qt.ItemDataRole.UserRole, ('table', table_name))
            
            # 加载视图
            cursor.execute("SELECT name FROM sqlite_master WHERE type='view'")
            views = cursor.fetchall()
            
            views_item = QTreeWidgetItem(parent_item, ['视图'])
            views_item.setData(0, Qt.ItemDataRole.UserRole, ('views', 'main'))
            
            for view in views:
                view_name = view[0]
                view_item = QTreeWidgetItem(views_item, [view_name])
                view_item.setData(0, Qt.ItemDataRole.UserRole, ('view', view_name))
            
            # 展开节点
            tables_item.setExpanded(True)
        except Exception as e:
            self.logger.log('ERROR', f"加载SQLite对象失败: {str(e)}")
    
    def _load_sqlserver_objects(self, parent_item):
        """
        加载SQL Server数据库对象
        """
        try:
            cursor = self.main_window.db_connection.cursor()
            
            # 加载表
            cursor.execute("SELECT name FROM sys.tables")
            tables = cursor.fetchall()
            
            tables_item = QTreeWidgetItem(parent_item, ['表'])
            tables_item.setData(0, Qt.ItemDataRole.UserRole, ('tables', 'dbo'))
            
            for table in tables:
                table_name = table[0]
                table_item = QTreeWidgetItem(tables_item, [table_name])
                table_item.setData(0, Qt.ItemDataRole.UserRole, ('table', table_name))
            
            # 加载视图
            cursor.execute("SELECT name FROM sys.views")
            views = cursor.fetchall()
            
            views_item = QTreeWidgetItem(parent_item, ['视图'])
            views_item.setData(0, Qt.ItemDataRole.UserRole, ('views', 'dbo'))
            
            for view in views:
                view_name = view[0]
                view_item = QTreeWidgetItem(views_item, [view_name])
                view_item.setData(0, Qt.ItemDataRole.UserRole, ('view', view_name))
            
            # 加载存储过程
            cursor.execute("SELECT name FROM sys.procedures")
            procedures = cursor.fetchall()
            
            procs_item = QTreeWidgetItem(parent_item, ['存储过程'])
            procs_item.setData(0, Qt.ItemDataRole.UserRole, ('procedures', 'dbo'))
            
            for proc in procedures:
                proc_name = proc[0]
                proc_item = QTreeWidgetItem(procs_item, [proc_name])
                proc_item.setData(0, Qt.ItemDataRole.UserRole, ('procedure', proc_name))
            
            # 展开节点
            tables_item.setExpanded(True)
        except Exception as e:
            self.logger.log('ERROR', f"加载SQL Server对象失败: {str(e)}")
