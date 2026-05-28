#!/usr/bin/env python3
"""
SQL编辑器快捷键管理器
"""

from PyQt6.QtWidgets import QMessageBox
from PyQt6.QtCore import Qt, QObject, QEvent
from PyQt6.QtGui import QKeySequence, QShortcut

class SQLEditorShortcutManager:
    """SQL编辑器快捷键管理器"""
    
    # 快捷键定义
    DEFAULT_SHORTCUTS = {
        # 执行相关
        'execute': ('Ctrl+Return', '执行SQL'),
        'execute_selected': ('Ctrl+Shift+Return', '执行选中SQL'),
        'stop_execution': ('Ctrl+.', '停止执行'),
        
        # 编辑相关
        'comment': ('Ctrl+/', '注释/取消注释'),
        'duplicate_line': ('Ctrl+D', '复制行'),
        'delete_line': ('Ctrl+Shift+K', '删除行'),
        'indent': ('Ctrl+I', '增加缩进'),
        'dedent': ('Ctrl+Shift+I', '减少缩进'),
        'uppercase': ('Ctrl+Shift+X', '转换为大写'),
        'lowercase': ('Ctrl+Shift+Y', '转换为小写'),
        
        # 导航相关
        'find': ('Ctrl+F', '查找'),
        'replace': ('Ctrl+H', '替换'),
        'find_next': ('F3', '查找下一个'),
        'find_previous': ('Shift+F3', '查找上一个'),
        'go_to_line': ('Ctrl+G', '转到行'),
        'go_to_matching_bracket': ('Ctrl+M', '转到匹配括号'),
        
        # 文件相关
        'new_query': ('Ctrl+T', '新建查询'),
        'open_file': ('Ctrl+O', '打开文件'),
        'save_file': ('Ctrl+S', '保存文件'),
        'save_file_as': ('Ctrl+Shift+S', '另存为'),
        'close_tab': ('Ctrl+W', '关闭标签'),
        
        # SQL格式化
        'format_sql': ('Ctrl+Shift+F', '格式化SQL'),
        
        # 历史记录
        'show_history': ('Ctrl+Shift+H', '显示查询历史'),
        
        # 书签
        'toggle_bookmark': ('Ctrl+F2', '切换书签'),
        'next_bookmark': ('F2', '下一个书签'),
        'previous_bookmark': ('Shift+F2', '上一个书签'),
        'clear_bookmarks': ('Ctrl+Shift+F2', '清除所有书签'),
    }
    
    def __init__(self, main_window):
        self.main_window = main_window
        self.shortcuts = {}
        self.custom_shortcuts = {}
        self.bookmarks = {}
        self.load_custom_shortcuts()
        self.setup_shortcuts()
    
    def load_custom_shortcuts(self):
        """加载自定义快捷键配置"""
        import json
        import os
        config_file = "shortcuts_config.json"
        
        if os.path.exists(config_file):
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    self.custom_shortcuts = json.load(f)
            except Exception:
                self.custom_shortcuts = {}
    
    def save_custom_shortcuts(self):
        """保存自定义快捷键配置"""
        import json
        config_file = "shortcuts_config.json"
        
        try:
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(self.custom_shortcuts, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    
    def get_shortcut(self, action):
        """获取快捷键配置"""
        if action in self.custom_shortcuts:
            return self.custom_shortcuts[action]
        return self.DEFAULT_SHORTCUTS.get(action, ('', ''))
    
    def setup_shortcuts(self):
        """设置快捷键"""
        # 遍历默认快捷键创建QShortcut
        for action, (shortcut_str, description) in self.DEFAULT_SHORTCUTS.items():
            if action in self.custom_shortcuts:
                shortcut_str = self.custom_shortcuts[action]
            
            if shortcut_str:
                try:
                    shortcut = QShortcut(QKeySequence(shortcut_str), self.main_window)
                    shortcut.setContext(Qt.ShortcutContext.WidgetWithChildrenShortcut)
                    shortcut.activated.connect(lambda a=action: self.handle_shortcut(a))
                    self.shortcuts[action] = shortcut
                except Exception:
                    pass
    
    def handle_shortcut(self, action):
        """处理快捷键触发"""
        handler_map = {
            'execute': self._execute_sql,
            'execute_selected': self._execute_selected_sql,
            'comment': self._toggle_comment,
            'duplicate_line': self._duplicate_line,
            'delete_line': self._delete_line,
            'indent': self._indent,
            'dedent': self._dedent,
            'uppercase': self._uppercase,
            'lowercase': self._lowercase,
            'find': self._find,
            'replace': self._replace,
            'format_sql': self._format_sql,
            'show_history': self._show_history,
            'new_query': self._new_query,
            'open_file': self._open_file,
            'save_file': self._save_file,
            'save_file_as': self._save_file_as,
            'close_tab': self._close_tab,
            'toggle_bookmark': self._toggle_bookmark,
            'next_bookmark': self._next_bookmark,
            'previous_bookmark': self._previous_bookmark,
            'clear_bookmarks': self._clear_bookmarks,
        }
        
        handler = handler_map.get(action)
        if handler:
            try:
                handler()
            except Exception as e:
                pass
    
    def _get_sql_editor(self):
        """获取当前SQL编辑器"""
        current_tab = self.main_window.right_panel.tabs.currentWidget()
        if not current_tab:
            return None
        
        if hasattr(current_tab, 'sql_editor'):
            return current_tab.sql_editor
        return None
    
    def _execute_sql(self):
        """执行SQL"""
        if hasattr(self.main_window, 'sql_operations'):
            self.main_window.sql_operations.execute_sql()
    
    def _execute_selected_sql(self):
        """执行选中的SQL"""
        self._execute_sql()
    
    def _toggle_comment(self):
        """切换注释"""
        editor = self._get_sql_editor()
        if editor and hasattr(editor, 'toggle_comment'):
            editor.toggle_comment()
    
    def _duplicate_line(self):
        """复制行"""
        editor = self._get_sql_editor()
        if editor and hasattr(editor, 'duplicate_line'):
            editor.duplicate_line()
    
    def _delete_line(self):
        """删除行"""
        editor = self._get_sql_editor()
        if editor and hasattr(editor, 'delete_line'):
            editor.delete_line()
    
    def _indent(self):
        """增加缩进"""
        editor = self._get_sql_editor()
        if editor and hasattr(editor, 'indent_increase'):
            editor.indent_increase()
    
    def _dedent(self):
        """减少缩进"""
        editor = self._get_sql_editor()
        if editor and hasattr(editor, 'indent_decrease'):
            editor.indent_decrease()
    
    def _uppercase(self):
        """转换为大写"""
        editor = self._get_sql_editor()
        if editor and hasattr(editor, 'convert_to_uppercase'):
            editor.convert_to_uppercase()
    
    def _lowercase(self):
        """转换为小写"""
        editor = self._get_sql_editor()
        if editor and hasattr(editor, 'convert_to_lowercase'):
            editor.convert_to_lowercase()
    
    def _find(self):
        """查找"""
        if hasattr(self.main_window, 'sql_operations'):
            self.main_window.sql_operations.find_sql()
    
    def _replace(self):
        """替换"""
        if hasattr(self.main_window, 'sql_operations'):
            self.main_window.sql_operations.replace_sql()
    
    def _format_sql(self):
        """格式化SQL"""
        if hasattr(self.main_window, 'sql_operations'):
            self.main_window.sql_operations.format_sql()
    
    def _show_history(self):
        """显示查询历史"""
        if hasattr(self.main_window, 'history_manager'):
            from core.query_history import QueryHistoryDialog
            dialog = QueryHistoryDialog(self.main_window)
            if dialog.exec():
                if dialog.selected_sql:
                    editor = self._get_sql_editor()
                    if editor:
                        editor.setPlainText(dialog.selected_sql)
    
    def _new_query(self):
        """新建查询"""
        self.main_window.add_new_query_tab()
    
    def _open_file(self):
        """打开文件"""
        if hasattr(self.main_window.event_handler, 'open_sql_file'):
            self.main_window.event_handler.open_sql_file()
    
    def _save_file(self):
        """保存文件"""
        if hasattr(self.main_window.event_handler, 'save_sql_file'):
            self.main_window.event_handler.save_sql_file()
    
    def _save_file_as(self):
        """另存为"""
        self._save_file()
    
    def _close_tab(self):
        """关闭标签"""
        current_index = self.main_window.right_panel.tabs.currentIndex()
        if current_index >= 0:
            self.main_window.right_panel.tabs.removeTab(current_index)
    
    def _toggle_bookmark(self):
        """切换书签"""
        editor = self._get_sql_editor()
        if editor and hasattr(editor, 'lineNumber'):
            line = editor.lineNumber()
            tab = self.main_window.right_panel.tabs.currentIndex()
            
            if tab not in self.bookmarks:
                self.bookmarks[tab] = []
            
            if line in self.bookmarks[tab]:
                self.bookmarks[tab].remove(line)
            else:
                self.bookmarks[tab].append(line)
                self.bookmarks[tab].sort()
    
    def _next_bookmark(self):
        """下一个书签"""
        editor = self._get_sql_editor()
        if editor and hasattr(editor, 'lineNumber'):
            line = editor.lineNumber()
            tab = self.main_window.right_panel.tabs.currentIndex()
            
            if tab in self.bookmarks and self.bookmarks[tab]:
                for bookmark_line in self.bookmarks[tab]:
                    if bookmark_line > line:
                        if hasattr(editor, 'setCursorPosition'):
                            editor.setCursorPosition(bookmark_line, 0)
                        return
    
    def _previous_bookmark(self):
        """上一个书签"""
        editor = self._get_sql_editor()
        if editor and hasattr(editor, 'lineNumber'):
            line = editor.lineNumber()
            tab = self.main_window.right_panel.tabs.currentIndex()
            
            if tab in self.bookmarks and self.bookmarks[tab]:
                for bookmark_line in reversed(self.bookmarks[tab]):
                    if bookmark_line < line:
                        if hasattr(editor, 'setCursorPosition'):
                            editor.setCursorPosition(bookmark_line, 0)
                        return
    
    def _clear_bookmarks(self):
        """清除所有书签"""
        tab = self.main_window.right_panel.tabs.currentIndex()
        if tab in self.bookmarks:
            self.bookmarks[tab] = []
    
    def get_shortcuts_help_text(self):
        """获取快捷键帮助文本"""
        lines = ["快捷键帮助:", ""]
        
        categories = {
            '执行操作': ['execute', 'execute_selected', 'stop_execution'],
            '编辑操作': ['comment', 'duplicate_line', 'delete_line', 'indent', 'dedent', 'uppercase', 'lowercase'],
            '导航操作': ['find', 'replace', 'find_next', 'find_previous', 'go_to_line', 'go_to_matching_bracket'],
            '文件操作': ['new_query', 'open_file', 'save_file', 'save_file_as', 'close_tab'],
            '其他': ['format_sql', 'show_history', 'toggle_bookmark', 'next_bookmark', 'previous_bookmark', 'clear_bookmarks'],
        }
        
        for category, actions in categories.items():
            lines.append(f"【{category}】")
            for action in actions:
                if action in self.DEFAULT_SHORTCUTS:
                    shortcut_str, description = self.get_shortcut(action)
                    if shortcut_str:
                        lines.append(f"  {shortcut_str:20s} - {description}")
            lines.append("")
        
        return "\n".join(lines)
