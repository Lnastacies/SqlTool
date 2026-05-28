#!/usr/bin/env python3
"""
应用状态管理器模块
"""

class ApplicationStateManager:
    """应用状态管理器，统一管理应用的全局状态"""
    
    def __init__(self):
        # 连接状态
        self.current_connection = None
        self.current_db = None
        self.current_db_type = None
        self.db_connection = None
        
        # 连接配置
        self.saved_connections = {}
        self.connection_groups = {}
        
        # UI状态
        self.dark_mode = False
        self.theme = 'light'
        
        # 状态变更监听器
        self._state_listeners = []
    
    def add_state_listener(self, listener):
        """添加状态变更监听器"""
        self._state_listeners.append(listener)
    
    def remove_state_listener(self, listener):
        """移除状态变更监听器"""
        if listener in self._state_listeners:
            self._state_listeners.remove(listener)
    
    def notify_state_change(self, state_type, **kwargs):
        """通知状态变更"""
        for listener in self._state_listeners:
            try:
                listener.on_state_changed(state_type, **kwargs)
            except Exception as e:
                pass
    
    def set_connection(self, conn_name, db_connection, db_type):
        """设置当前连接"""
        self.current_connection = conn_name
        self.db_connection = db_connection
        self.current_db_type = db_type
        self.notify_state_change('connection', connection=conn_name, db_type=db_type)
    
    def clear_connection(self):
        """清除当前连接"""
        self.current_connection = None
        self.db_connection = None
        self.current_db_type = None
        self.current_db = None
        self.notify_state_change('connection', connection=None)
    
    def set_database(self, db_name):
        """设置当前数据库"""
        self.current_db = db_name
        self.notify_state_change('database', database=db_name)
    
    def set_theme(self, theme):
        """设置主题"""
        self.theme = theme
        self.dark_mode = (theme == 'dark')
        self.notify_state_change('theme', theme=theme)
    
    def load_connections(self, connections, groups=None):
        """加载保存的连接"""
        self.saved_connections = connections or {}
        self.connection_groups = groups or {}
        self.notify_state_change('connections_loaded')
    
    def add_connection(self, conn_name, conn_data):
        """添加连接"""
        self.saved_connections[conn_name] = conn_data
        self.notify_state_change('connection_added', name=conn_name, data=conn_data)
    
    def remove_connection(self, conn_name):
        """移除连接"""
        if conn_name in self.saved_connections:
            del self.saved_connections[conn_name]
            # 从连接组中移除
            for group_connections in self.connection_groups.values():
                if conn_name in group_connections:
                    group_connections.remove(conn_name)
            self.notify_state_change('connection_removed', name=conn_name)
    
    def update_connection(self, old_name, new_data):
        """更新连接"""
        if old_name in self.saved_connections:
            del self.saved_connections[old_name]
            new_name = new_data['name']
            self.saved_connections[new_name] = new_data
            
            # 更新连接组中的名称
            for group_name, connections in self.connection_groups.items():
                if old_name in connections:
                    connections.remove(old_name)
                    if new_name not in connections:
                        connections.append(new_name)
            
            self.notify_state_change('connection_updated', old_name=old_name, new_data=new_data)
    
    def add_connection_group(self, group_name):
        """添加连接组"""
        if group_name not in self.connection_groups:
            self.connection_groups[group_name] = []
            self.notify_state_change('group_added', name=group_name)
    
    def remove_connection_group(self, group_name):
        """移除连接组"""
        if group_name in self.connection_groups:
            del self.connection_groups[group_name]
            self.notify_state_change('group_removed', name=group_name)
    
    def rename_connection_group(self, old_name, new_name):
        """重命名连接组"""
        if old_name in self.connection_groups and new_name not in self.connection_groups:
            self.connection_groups[new_name] = self.connection_groups.pop(old_name)
            self.notify_state_change('group_renamed', old_name=old_name, new_name=new_name)
    
    def add_connection_to_group(self, conn_name, group_name):
        """将连接添加到组"""
        if group_name in self.connection_groups:
            if conn_name not in self.connection_groups[group_name]:
                self.connection_groups[group_name].append(conn_name)
                self.notify_state_change('connection_moved', conn_name=conn_name, group=group_name)
    
    def remove_connection_from_group(self, conn_name, group_name):
        """从组中移除连接"""
        if group_name in self.connection_groups:
            if conn_name in self.connection_groups[group_name]:
                self.connection_groups[group_name].remove(conn_name)
                self.notify_state_change('connection_moved', conn_name=conn_name, group=None)