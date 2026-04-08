#!/usr/bin/env python3
"""
SQL编辑器相关组件
"""

from PyQt6.QtWidgets import QTextEdit, QCompleter, QMenu
from PyQt6.QtCore import Qt, QStringListModel
from PyQt6.QtGui import QTextCharFormat, QColor, QFont, QSyntaxHighlighter, QFontMetrics, QTextDocument, QTextCursor, QTextOption, QPainter

class SQLSyntaxHighlighter(QSyntaxHighlighter):
    """SQL语法高亮"""
    def __init__(self, parent=None):
        super(SQLSyntaxHighlighter, self).__init__(parent)
        
        # 关键字格式
        keyword_format = QTextCharFormat()
        keyword_format.setForeground(QColor('#0000FF'))
        keyword_format.setFontWeight(QFont.Weight.Bold)
        
        # 函数格式
        function_format = QTextCharFormat()
        function_format.setForeground(QColor('#800080'))
        function_format.setFontWeight(QFont.Weight.Bold)
        
        # 字符串格式
        string_format = QTextCharFormat()
        string_format.setForeground(QColor('#008000'))
        
        # 注释格式
        comment_format = QTextCharFormat()
        comment_format.setForeground(QColor('#808080'))
        
        # 数字格式
        number_format = QTextCharFormat()
        number_format.setForeground(QColor('#FF8C00'))
        
        # 操作符格式
        operator_format = QTextCharFormat()
        operator_format.setForeground(QColor('#FF0000'))
        operator_format.setFontWeight(QFont.Weight.Bold)
        
        # 规则
        self.highlighting_rules = [
            # 关键字
            (r'\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|ORDER|BY|HAVING|LIMIT|OFFSET|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|RENAME|INDEX|VIEW|PROCEDURE|FUNCTION|TRIGGER|TABLE|DATABASE|SCHEMA|USE|AS|ON|IN|LIKE|BETWEEN|AND|OR|NOT|IS|NULL|TRUE|FALSE|DEFAULT|PRIMARY|FOREIGN|KEY|REFERENCES|CHECK|UNIQUE|AUTO_INCREMENT|NOT|EXISTS|DISTINCT|TOP|LIMIT|OFFSET|VALUES|SET|REPLACE|IF|ELSE|CASE|WHEN|THEN|END|WHILE|DO|LOOP|REPEAT|UNTIL|DECLARE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|GRANT|REVOKE|DENY|IDENTITY|SEQUENCE|SYNONYM|TYPE|DOMAIN|COLLATION|CHARACTER|SET|COLLATE)\b', keyword_format),
            # 函数
            (r'\b(COUNT|SUM|AVG|MAX|MIN|CONCAT|SUBSTRING|LENGTH|DATE|TIME|NOW|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|CAST|CONVERT|ROUND|FLOOR|CEIL|ABS|MOD|POW|SIN|COS|TAN|ASIN|ACOS|ATAN|LOG|EXP|SQRT|UPPER|LOWER|TRIM|LTRIM|RTRIM|DATE_ADD|DATE_SUB|DATEDIFF|TIMEDIFF|YEAR|MONTH|DAY|HOUR|MINUTE|SECOND|WEEK|QUARTER|DAYOFWEEK|DAYOFYEAR|MONTHNAME|DAYNAME|ISNULL|IFNULL|NULLIF|COALESCE|CASE|WHEN|THEN|END)\b', function_format),
            # 字符串
            (r"'[^']*'", string_format),
            (r'"[^"]*"', string_format),
            # 注释
            (r'--[^\n]*', comment_format),
            (r'/\*[\s\S]*?\*/', comment_format),
            # 数字
            (r'\b\d+(\.\d+)?\b', number_format),
            # 操作符
            (r'(=|!=|<>|<|>|<=|>=|\+|-|\*|/|%|\^|&|\||~|!|\(|\)|\[|\]|\{|\}|,|;|:|\.)', operator_format),
        ]
    
    def highlightBlock(self, text):
        """高亮文本块"""
        for pattern, format in self.highlighting_rules:
            import re
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                start, end = match.span()
                self.setFormat(start, end - start, format)

class SQLCompleter(QCompleter):
    """SQL自动补全"""
    def __init__(self, parent=None):
        super(SQLCompleter, self).__init__(parent)
        
        # 初始化补全列表
        self.update_completion_list()
        
        self.setCompletionMode(QCompleter.CompletionMode.PopupCompletion)
        self.setFilterMode(Qt.MatchFlag.MatchContains)
        self.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        
    def update_completion_list(self, tables=None, columns=None):
        """更新补全列表"""
        # SQL关键字
        sql_keywords = [
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
            'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'UPDATE',
            'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME', 'INDEX',
            'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'TABLE', 'DATABASE', 'SCHEMA',
            'USE', 'AS', 'ON', 'IN', 'LIKE', 'BETWEEN', 'AND', 'OR', 'NOT', 'IS', 'NULL',
            'TRUE', 'FALSE', 'DEFAULT', 'PRIMARY', 'FOREIGN', 'KEY', 'REFERENCES', 'CHECK',
            'UNIQUE', 'AUTO_INCREMENT', 'EXISTS', 'DISTINCT', 'TOP', 'VALUES', 'SET', 'REPLACE',
            'IF', 'ELSE', 'CASE', 'WHEN', 'THEN', 'END', 'WHILE', 'DO', 'LOOP', 'REPEAT', 'UNTIL',
            'DECLARE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'GRANT', 'REVOKE', 'DENY'
        ]
        
        # 函数
        functions = [
            'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'CONCAT', 'SUBSTRING', 'LENGTH',
            'DATE', 'TIME', 'NOW', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME',
            'CAST', 'CONVERT', 'ROUND', 'FLOOR', 'CEIL', 'ABS', 'MOD', 'POW',
            'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'LOG', 'EXP', 'SQRT',
            'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'DATE_ADD', 'DATE_SUB',
            'DATEDIFF', 'TIMEDIFF', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND',
            'WEEK', 'QUARTER', 'DAYOFWEEK', 'DAYOFYEAR', 'MONTHNAME', 'DAYNAME',
            'ISNULL', 'IFNULL', 'NULLIF', 'COALESCE'
        ]
        
        # 构建补全列表
        completion_list = sql_keywords + functions
        
        # 添加表名
        if tables:
            completion_list.extend(tables)
        
        # 添加列名
        if columns:
            completion_list.extend(columns)
        
        # 使用字符串列表作为模型
        self.setModel(QStringListModel(completion_list))
        
    def showPopup(self):
        """显示补全弹窗"""
        super().showPopup()
        # 调整弹窗宽度
        popup = self.popup()
        if popup:
            # 设置最小宽度
            popup.setMinimumWidth(300)
            # 调整列宽以适应内容
            popup.setColumnWidth(0, 300)

class SQLTextEdit(QTextEdit):
    """SQL文本编辑器"""
    def __init__(self, parent=None):
        super(SQLTextEdit, self).__init__(parent)
        
        # 设置字体
        font = QFont('Consolas', 11)
        self.setFont(font)
        
        # 设置换行模式
        self.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)
        
        # 设置制表符宽度
        metrics = QFontMetrics(font)
        tab_width = metrics.horizontalAdvance(' ' * 4)
        if tab_width > 0:
            self.setTabStopDistance(tab_width)
        
        # 启用代码折叠
        self.setDocument(QTextDocument(self))
        self.document().setIndentWidth(4)
        
        # 添加语法高亮
        self.highlighter = SQLSyntaxHighlighter(self.document())
        
        # 添加自动补全
        self.completer = SQLCompleter(self)
        self.completer.setWidget(self)
        
        # 启用代码折叠
        self.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)
        self.setWordWrapMode(QTextOption.WrapMode.NoWrap)
        
        # 启用行号显示
        self.setViewportMargins(35, 0, 0, 0)  # 为行号预留空间，更紧凑
        
        # 信号连接
        self.textChanged.connect(self.on_text_changed)
        self.cursorPositionChanged.connect(self.on_cursor_position_changed)
        self.document().blockCountChanged.connect(self.update_line_numbers)
        
        # 启用右键菜单
        self.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.customContextMenuRequested.connect(self.show_context_menu)
        
    def paintEvent(self, event):
        """绘制事件，用于显示行号"""
        super().paintEvent(event)
        
        # 绘制行号
        painter = QPainter(self.viewport())
        painter.fillRect(0, 0, 34, self.height(), QColor('#ffffff'))
        painter.setPen(QColor('#909090'))
        painter.setFont(QFont('Consolas', 10, QFont.Weight.Light))
        
        # 获取滚动条位置
        scroll_pos = self.verticalScrollBar().value()
        
        block = self.document().begin()
        line_number = 1
        while block.isValid():
            # 获取块的边界矩形
            layout = self.document().documentLayout()
            rect = layout.blockBoundingRect(block)
            # 转换为视口坐标，考虑滚动位置
            rect.translate(0, -scroll_pos)
            if rect.top() > event.rect().bottom():
                break
            if rect.bottom() >= event.rect().top():
                painter.drawText(5, int(rect.top() + rect.height() - 6), str(line_number))
            line_number += 1
            block = block.next()
        
        # 绘制分隔线
        painter.setPen(QColor('#e0e0e0'))
        painter.drawLine(34, 0, 34, self.height())
    
    def update_line_numbers(self):
        """更新行号"""
        self.viewport().update()
    
    def resizeEvent(self, event):
        """调整大小事件"""
        super().resizeEvent(event)
        self.update_line_numbers()
    
    def update_completion(self, tables=None, columns=None):
        """更新补全列表"""
        if self.completer:
            self.completer.update_completion_list(tables, columns)
    
    def on_text_changed(self):
        """文本变化时的处理"""
        # 触发自动补全
        self.trigger_completion()
    
    def on_cursor_position_changed(self):
        """光标位置变化时的处理"""
        # 显示光标位置信息
        cursor = self.textCursor()
        line = cursor.blockNumber() + 1
        column = cursor.columnNumber() + 1
        # 尝试找到主窗口并更新状态栏
        widget = self.parent()
        while widget:
            if hasattr(widget, 'main_window') and hasattr(widget.main_window, 'status_bar'):
                widget.main_window.status_bar.showMessage(f"行: {line}, 列: {column}")
                break
            widget = widget.parent()
    
    def keyPressEvent(self, event):
        """键盘事件处理"""
        # 检查是否是补全相关的按键
        if event.key() == Qt.Key.Key_Tab:
            # 检查是否有活动的补全
            if self.completer and self.completer.popup().isVisible():
                # 选择当前补全项
                self.completer.popup().hide()
                completion = self.completer.currentCompletion()
                if completion:
                    # 替换当前单词
                    cursor = self.textCursor()
                    cursor.select(QTextCursor.SelectionType.WordUnderCursor)
                    cursor.removeSelectedText()
                    cursor.insertText(completion)
                event.accept()
            else:
                # 插入4个空格而不是制表符
                self.insertPlainText('    ')
                event.accept()
        elif event.key() == Qt.Key.Key_Return or event.key() == Qt.Key.Key_Enter:
            # 检查是否有活动的补全
            if self.completer and self.completer.popup().isVisible():
                # 选择当前补全项
                self.completer.popup().hide()
                completion = self.completer.currentCompletion()
                if completion:
                    # 替换当前单词
                    cursor = self.textCursor()
                    cursor.select(QTextCursor.SelectionType.WordUnderCursor)
                    cursor.removeSelectedText()
                    cursor.insertText(completion)
                event.accept()
            else:
                # 自动缩进
                cursor = self.textCursor()
                block = cursor.block()
                text = block.text()
                
                # 计算缩进
                indent = 0
                for char in text:
                    if char == ' ': indent += 1
                    elif char == '\t': indent += 4
                    else: break
                
                # 检查是否需要增加缩进
                if text.strip().endswith('{') or text.strip().endswith('(') or text.strip().endswith('['):
                    indent += 4
                
                # 插入换行和缩进
                self.insertPlainText('\n' + ' ' * indent)
                event.accept()
        elif event.key() == Qt.Key.Key_BraceRight or event.key() == Qt.Key.Key_ParenRight or event.key() == Qt.Key.Key_BracketRight:
            # 自动匹配右括号
            cursor = self.textCursor()
            block = cursor.block()
            text = block.text()
            
            # 计算缩进
            indent = 0
            for char in text:
                if char == ' ': indent += 1
                elif char == '\t': indent += 4
                else: break
            
            # 插入右括号
            self.insertPlainText(event.text())
            
            # 检查是否需要减少缩进
            if indent >= 4 and (event.key() == Qt.Key.Key_BraceRight or event.key() == Qt.Key.Key_ParenRight or event.key() == Qt.Key.Key_BracketRight):
                # 减少缩进
                self.insertPlainText('\n' + ' ' * (indent - 4))
                # 移动光标到正确位置
                cursor = self.textCursor()
                cursor.movePosition(QTextCursor.MoveOperation.Left, QTextCursor.MoveMode.MoveAnchor, indent - 4)
                self.setTextCursor(cursor)
            event.accept()
        else:
            # 先处理按键事件
            super().keyPressEvent(event)
            # 然后触发自动补全
            self.trigger_completion()
    
    def trigger_completion(self):
        """触发自动补全"""
        # 获取当前光标位置
        cursor = self.textCursor()
        
        # 确定当前单词的范围
        start = cursor.position()
        # 向左查找单词的开始
        while start > 0:
            # 获取前一个字符
            char = self.document().characterAt(start - 1)
            if not char.isalnum() and char != '_':
                break
            start -= 1
        
        # 获取当前单词
        cursor.setPosition(start)
        cursor.setPosition(cursor.position(), QTextCursor.MoveMode.KeepAnchor)
        current_word = cursor.selectedText()
        
        # 如果没有选择到文本，尝试使用 WordUnderCursor
        if not current_word:
            cursor.select(QTextCursor.SelectionType.WordUnderCursor)
            current_word = cursor.selectedText()
        
        # 如果有输入内容，触发自动补全
        if current_word and current_word.isalnum():
            # 设置补全器的前缀
            self.completer.setCompletionPrefix(current_word)
            # 触发补全
            rect = self.cursorRect()
            # 调整补全弹窗的位置和大小
            rect.setWidth(300)  # 设置固定宽度
            self.completer.complete(rect)
        else:
            # 如果当前单词为空或不是字母数字，隐藏补全弹窗
            if self.completer and self.completer.popup().isVisible():
                self.completer.popup().hide()
    
    def show_context_menu(self, pos):
        """显示上下文菜单"""
        menu = QMenu()
        
        # 基本编辑操作
        menu.addAction("复制", self.copy)
        menu.addAction("粘贴", self.paste)
        menu.addAction("剪切", self.cut)
        menu.addSeparator()
        menu.addAction("全选", self.selectAll)
        menu.addSeparator()
        
        # SQL相关操作
        menu.addAction("查找", self.find)
        menu.addAction("替换", self.replace)
        menu.addSeparator()
        menu.addAction("美化SQL", self.format_sql)
        menu.addAction("执行SQL", self.execute_sql)
        menu.addSeparator()
        
        # 其他操作
        menu.addAction("注释/取消注释", self.toggle_comment)
        menu.addSeparator()
        menu.addAction("保存SQL文件", self.save_sql_file)
        menu.addAction("打开SQL文件", self.open_sql_file)
        
        # 显示菜单
        menu.exec(self.mapToGlobal(pos))
    
    def find(self):
        """查找功能"""
        # 尝试找到主窗口并调用查找功能
        widget = self.parent()
        while widget:
            if hasattr(widget, 'main_window') and hasattr(widget.main_window, 'sql_operations'):
                widget.main_window.sql_operations.find_sql()
                break
            widget = widget.parent()
    
    def replace(self):
        """替换功能"""
        # 尝试找到主窗口并调用替换功能
        widget = self.parent()
        while widget:
            if hasattr(widget, 'main_window') and hasattr(widget.main_window, 'sql_operations'):
                widget.main_window.sql_operations.replace_sql()
                break
            widget = widget.parent()
    
    def format_sql(self):
        """美化SQL"""
        # 尝试找到主窗口并调用美化功能
        widget = self.parent()
        while widget:
            if hasattr(widget, 'main_window') and hasattr(widget.main_window, 'sql_operations'):
                widget.main_window.sql_operations.format_sql()
                break
            widget = widget.parent()
    
    def execute_sql(self):
        """执行SQL"""
        # 尝试找到主窗口并调用执行功能
        widget = self.parent()
        while widget:
            if hasattr(widget, 'main_window') and hasattr(widget.main_window, 'sql_operations'):
                widget.main_window.sql_operations.execute_sql()
                break
            widget = widget.parent()
    
    def toggle_comment(self):
        """注释/取消注释"""
        cursor = self.textCursor()
        if cursor.hasSelection():
            # 处理选中的文本
            selected_text = cursor.selectedText()
            lines = selected_text.split('\n')
            commented_lines = []
            
            # 检查是否已经全部注释
            all_commented = True
            for line in lines:
                if not line.strip().startswith('--'):
                    all_commented = False
                    break
            
            if all_commented:
                # 取消注释
                for line in lines:
                    if line.strip().startswith('--'):
                        commented_lines.append(line.replace('--', '', 1).lstrip())
                    else:
                        commented_lines.append(line)
            else:
                # 添加注释
                for line in lines:
                    commented_lines.append('-- ' + line)
            
            # 替换选中的文本
            cursor.insertText('\n'.join(commented_lines))
        else:
            # 处理当前行
            cursor.select(QTextCursor.SelectionType.LineUnderCursor)
            line_text = cursor.selectedText()
            if line_text.strip().startswith('--'):
                # 取消注释
                cursor.insertText(line_text.replace('--', '', 1).lstrip())
            else:
                # 添加注释
                cursor.insertText('-- ' + line_text)
    
    def save_sql_file(self):
        """保存SQL文件"""
        # 尝试找到主窗口并调用保存功能
        widget = self.parent()
        while widget:
            if hasattr(widget, 'main_window') and hasattr(widget.main_window, 'event_handler'):
                widget.main_window.event_handler.save_sql_file()
                break
            widget = widget.parent()
    
    def open_sql_file(self):
        """打开SQL文件"""
        # 尝试找到主窗口并调用打开功能
        widget = self.parent()
        while widget:
            if hasattr(widget, 'main_window') and hasattr(widget.main_window, 'event_handler'):
                widget.main_window.event_handler.open_sql_file()
                break
            widget = widget.parent()