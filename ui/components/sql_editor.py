#!/usr/bin/env python3
"""
SQL编辑器相关组件
"""

from PyQt6.QtWidgets import QWidget, QMenu, QTextEdit
from PyQt6.QtCore import Qt, QSize, QRect
from PyQt6.QtGui import QColor, QFont

# 尝试导入Qsci模块，如果失败则使用QTextEdit
try:
    from PyQt6.Qsci import QsciScintilla, QsciLexerSQL, QsciAPIs
    HAS_QSCI = True
except ImportError:
    HAS_QSCI = False

if HAS_QSCI:
    class SQLTextEdit(QsciScintilla):
        """SQL文本编辑器"""
        def __init__(self, parent=None):
            super(SQLTextEdit, self).__init__(parent)
            
            # 设置字体
            font = QFont('Consolas', 13)
            self.setFont(font)
            self.setMarginsFont(font)
            
            # 设置行号边距
            self.setMarginWidth(1, 40)
            self.setMarginLineNumbers(1, True)
            self.setMarginsBackgroundColor(QColor('#F8F9FA'))
            self.setMarginsForegroundColor(QColor('#9E9E9E'))
            
            # 设置语法高亮
            lexer = QsciLexerSQL()
            lexer.setFont(font)
            lexer.setColor(QColor('#0000FF'), QsciLexerSQL.Keyword)
            lexer.setColor(QColor('#E74C3C'), QsciLexerSQL.DoubleQuotedString)
            lexer.setColor(QColor('#E74C3C'), QsciLexerSQL.SingleQuotedString)
            lexer.setColor(QColor('#2ECC71'), QsciLexerSQL.Comment)
            self.setLexer(lexer)
            
            # 设置代码折叠
            self.setFolding(QsciScintilla.FoldStyle.BoxedTreeFoldStyle)
            
            # 设置括号匹配
            self.setBraceMatching(QsciScintilla.BraceMatch.SloppyBraceMatch)
            self.setMatchedBraceBackgroundColor(QColor('#E3F2FD'))
            self.setMatchedBraceForegroundColor(QColor('#007ACC'))
            
            # 设置自动补全
            self.setAutoCompletionThreshold(1)
            self.setAutoCompletionSource(QsciScintilla.AutoCompletionSource.AcsAll)
            self.setAutoCompletionCaseSensitivity(False)
            
            # 初始化API
            self.api = QsciAPIs(lexer)
            
            # 初始化补全列表
            self.tables = []
            self.columns = {}
            
            # 启用右键菜单
            self.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
            self.customContextMenuRequested.connect(self.show_context_menu)
        
        def update_completion(self, tables=None, columns=None):
            """更新补全列表"""
            self.tables = tables or []
            self.columns = columns or {}
            
            # 清空API
            self.api.clear()
            
            # 添加表名
            for table in self.tables:
                self.api.add(table)
            
            # 添加列名
            for table, cols in self.columns.items():
                for col in cols:
                    self.api.add(f"{table}.{col}")
            
            # 添加SQL关键字
            keywords = [
                'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
                'FULL', 'CROSS', 'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET', 
                'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME', 
                'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'TABLE', 'DATABASE', 'SCHEMA',
                'USE', 'AS', 'ON', 'IN', 'LIKE', 'BETWEEN', 'AND', 'OR', 'NOT', 'IS', 'NULL',
                'TRUE', 'FALSE', 'DEFAULT', 'PRIMARY', 'FOREIGN', 'KEY', 'REFERENCES', 'CHECK',
                'UNIQUE', 'AUTO_INCREMENT', 'EXISTS', 'DISTINCT', 'TOP', 'VALUES', 'SET', 'REPLACE',
                'IF', 'ELSE', 'CASE', 'WHEN', 'THEN', 'END', 'WHILE', 'DO', 'LOOP', 'REPEAT', 'UNTIL',
                'DECLARE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'GRANT', 'REVOKE', 'DENY',
                'SHOW', 'DESCRIBE', 'EXPLAIN', 'ANALYZE', 'OPTIMIZE', 'REPAIR', 'CHECK', 'FLUSH',
                'LOCK', 'UNLOCK', 'START', 'STOP', 'RESET', 'CHANGE', 'ADD', 'DROP', 'MODIFY',
                'RENAME TO', 'ALTER TABLE', 'CREATE TABLE', 'DROP TABLE', 'TRUNCATE TABLE',
                'CREATE DATABASE', 'DROP DATABASE', 'USE DATABASE', 'CREATE INDEX', 'DROP INDEX',
                'CREATE VIEW', 'DROP VIEW', 'CREATE PROCEDURE', 'DROP PROCEDURE', 'CREATE FUNCTION',
                'DROP FUNCTION', 'CREATE TRIGGER', 'DROP TRIGGER', 'INSERT INTO', 'UPDATE SET',
                'DELETE FROM', 'SELECT DISTINCT', 'SELECT TOP', 'SELECT LIMIT', 'GROUP BY',
                'ORDER BY', 'WHERE EXISTS', 'WHERE NOT EXISTS', 'INNER JOIN', 'LEFT JOIN',
                'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'ON', 'USING', 'NATURAL JOIN'
            ]
            for keyword in keywords:
                self.api.add(keyword)
            
            # 添加函数
            functions = [
                'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'CONCAT', 'CONCAT_WS', 'SUBSTRING', 'SUBSTR',
                'LENGTH', 'CHAR_LENGTH', 'DATE', 'TIME', 'DATETIME', 'NOW', 'CURRENT_TIMESTAMP', 
                'CURRENT_DATE', 'CURRENT_TIME', 'CAST', 'CONVERT', 'ROUND', 'FLOOR', 'CEIL', 'CEILING',
                'ABS', 'MOD', 'POW', 'POWER', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'ATAN2',
                'LOG', 'LOG10', 'EXP', 'SQRT', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM',
                'DATE_ADD', 'DATE_SUB', 'DATEDIFF', 'TIMEDIFF', 'TIMESTAMPADD', 'TIMESTAMPDIFF',
                'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'WEEK', 'QUARTER', 'DAYOFWEEK',
                'DAYOFYEAR', 'MONTHNAME', 'DAYNAME', 'ISNULL', 'IFNULL', 'NULLIF', 'COALESCE',
                'CASE', 'WHEN', 'THEN', 'END', 'IF', 'ELSE', 'ELSEIF', 'IN', 'NOT IN', 'BETWEEN',
                'LIKE', 'NOT LIKE', 'REGEXP', 'NOT REGEXP', 'RLIKE', 'NOT RLIKE', 'IS', 'IS NOT',
                'GREATEST', 'LEAST', 'RAND', 'RANDOM', 'UUID', 'UUID_SHORT', 'MD5', 'SHA1', 'SHA2',
                'PASSWORD', 'ENCRYPT', 'DECRYPT', 'CHAR', 'ASCII', 'HEX', 'UNHEX', 'BIN', 'OCT', 'HEX',
                'CONV', 'FORMAT', 'LEFT', 'RIGHT', 'MID', 'POSITION', 'INSTR', 'REPLACE', 'INSERT',
                'REVERSE', 'SPACE', 'REPEAT', 'LPAD', 'RPAD', 'TRUNCATE', 'ABS', 'SIGN', 'PI', 'RADIANS',
                'DEGREES', 'SINH', 'COSH', 'TANH', 'COT', 'SIGN', 'MOD', 'DIV', 'POW', 'SQRT',
                'EXP', 'LOG', 'LOG10', 'LOG2', 'LN', 'FLOOR', 'CEILING', 'ROUND', 'TRUNCATE', 'ABS'
            ]
            for function in functions:
                self.api.add(function)
            
            # 编译API
            self.api.prepare()
        
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
            
            # 行操作
            line_menu = menu.addMenu("行操作")
            line_menu.addAction("复制行", self.copy_line)
            line_menu.addAction("删除行", self.delete_line)
            line_menu.addAction("插入上行", self.insert_line_above)
            line_menu.addAction("插入下行", self.insert_line_below)
            line_menu.addSeparator()
            line_menu.addAction("复制并粘贴到下行", self.duplicate_line)
            menu.addSeparator()
            
            # 代码格式化
            format_menu = menu.addMenu("代码格式化")
            format_menu.addAction("美化SQL", self.format_sql)
            format_menu.addAction("增加缩进", self.indent_increase)
            format_menu.addAction("减少缩进", self.indent_decrease)
            format_menu.addSeparator()
            format_menu.addAction("转换为大写", self.convert_to_uppercase)
            format_menu.addAction("转换为小写", self.convert_to_lowercase)
            menu.addSeparator()
            
            # SQL相关操作
            sql_menu = menu.addMenu("SQL操作")
            sql_menu.addAction("执行SQL", self.execute_sql)
            sql_menu.addAction("执行计划", self.explain_sql)
            sql_menu.addSeparator()
            sql_menu.addAction("查找", self.find)
            sql_menu.addAction("替换", self.replace)
            menu.addSeparator()
            
            # 代码折叠
            fold_menu = menu.addMenu("代码折叠")
            fold_menu.addAction("折叠当前块", self.fold_current_block)
            fold_menu.addAction("展开当前块", self.unfold_current_block)
            fold_menu.addSeparator()
            fold_menu.addAction("折叠所有块", self.fold_all_blocks)
            fold_menu.addAction("展开所有块", self.unfold_all_blocks)
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
            # 获取当前选中的文本
            selected_text = self.selectedText()
            if selected_text:
                # 处理选中的文本
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
                self.replaceSelectedText('\n'.join(commented_lines))
            else:
                # 处理当前行
                line_start = self.positionFromLineIndex(self.lineNumber(), 0)
                line_end = self.positionFromLineIndex(self.lineNumber(), self.lineLength(self.lineNumber()))
                self.setSelection(line_start, 0, line_end, 0)
                line_text = self.selectedText()
                if line_text.strip().startswith('--'):
                    # 取消注释
                    self.replaceSelectedText(line_text.replace('--', '', 1).lstrip())
                else:
                    # 添加注释
                    self.replaceSelectedText('-- ' + line_text)
        
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
        
        # 行操作方法
        def copy_line(self):
            """复制当前行"""
            line_start = self.positionFromLineIndex(self.lineNumber(), 0)
            line_end = self.positionFromLineIndex(self.lineNumber(), self.lineLength(self.lineNumber()))
            self.setSelection(line_start, 0, line_end, 0)
            self.copy()
        
        def delete_line(self):
            """删除当前行"""
            line_start = self.positionFromLineIndex(self.lineNumber(), 0)
            line_end = self.positionFromLineIndex(self.lineNumber(), self.lineLength(self.lineNumber()))
            self.setSelection(line_start, 0, line_end, 0)
            self.removeSelectedText()
        
        def insert_line_above(self):
            """在当前行上方插入新行"""
            line_start = self.positionFromLineIndex(self.lineNumber(), 0)
            self.setCursorPosition(line_start)
            self.insert('\n')
            self.setCursorPosition(line_start)
        
        def insert_line_below(self):
            """在当前行下方插入新行"""
            line_end = self.positionFromLineIndex(self.lineNumber(), self.lineLength(self.lineNumber()))
            self.setCursorPosition(line_end)
            self.insert('\n')
        
        def duplicate_line(self):
            """复制并粘贴到下行"""
            line_start = self.positionFromLineIndex(self.lineNumber(), 0)
            line_end = self.positionFromLineIndex(self.lineNumber(), self.lineLength(self.lineNumber()))
            self.setSelection(line_start, 0, line_end, 0)
            line_text = self.selectedText()
            self.setCursorPosition(line_end)
            self.insert('\n' + line_text)
        
        # 代码格式化方法
        def indent_increase(self):
            """增加缩进"""
            if self.hasSelectedText():
                # 处理选中的多行
                selected_text = self.selectedText()
                lines = selected_text.split('\n')
                indented_lines = []
                for line in lines:
                    indented_lines.append('    ' + line)
                self.replaceSelectedText('\n'.join(indented_lines))
            else:
                # 处理当前行
                line_start = self.positionFromLineIndex(self.lineNumber(), 0)
                line_end = self.positionFromLineIndex(self.lineNumber(), self.lineLength(self.lineNumber()))
                self.setSelection(line_start, 0, line_end, 0)
                line_text = self.selectedText()
                self.replaceSelectedText('    ' + line_text)
        
        def indent_decrease(self):
            """减少缩进"""
            if self.hasSelectedText():
                # 处理选中的多行
                selected_text = self.selectedText()
                lines = selected_text.split('\n')
                indented_lines = []
                for line in lines:
                    if line.startswith('    '):
                        indented_lines.append(line[4:])
                    elif line.startswith(' '):
                        # 处理不同缩进级别
                        stripped = line.lstrip()
                        if stripped:
                            indented_lines.append(stripped)
                        else:
                            indented_lines.append('')
                    else:
                        indented_lines.append(line)
                self.replaceSelectedText('\n'.join(indented_lines))
            else:
                # 处理当前行
                line_start = self.positionFromLineIndex(self.lineNumber(), 0)
                line_end = self.positionFromLineIndex(self.lineNumber(), self.lineLength(self.lineNumber()))
                self.setSelection(line_start, 0, line_end, 0)
                line_text = self.selectedText()
                if line_text.startswith('    '):
                    self.replaceSelectedText(line_text[4:])
                elif line_text.startswith(' '):
                    # 处理不同缩进级别
                    stripped = line_text.lstrip()
                    if stripped:
                        self.replaceSelectedText(stripped)
                    else:
                        self.replaceSelectedText('')
        
        def convert_to_uppercase(self):
            """转换为大写"""
            if self.hasSelectedText():
                selected_text = self.selectedText()
                self.replaceSelectedText(selected_text.upper())
            else:
                # 转换当前单词
                self.selectWord()
                word = self.selectedText()
                if word:
                    self.replaceSelectedText(word.upper())
        
        def convert_to_lowercase(self):
            """转换为小写"""
            if self.hasSelectedText():
                selected_text = self.selectedText()
                self.replaceSelectedText(selected_text.lower())
            else:
                # 转换当前单词
                self.selectWord()
                word = self.selectedText()
                if word:
                    self.replaceSelectedText(word.lower())
        
        # SQL相关操作
        def explain_sql(self):
            """执行计划"""
            # 尝试找到主窗口并调用执行计划功能
            widget = self.parent()
            while widget:
                if hasattr(widget, 'main_window') and hasattr(widget.main_window, 'sql_operations'):
                    widget.main_window.sql_operations.explain_sql()
                    break
                widget = widget.parent()
        
        # 代码折叠相关
        def fold_current_block(self):
            """折叠当前块"""
            self.foldLine(self.lineNumber())
        
        def unfold_current_block(self):
            """展开当前块"""
            self.unfoldLine(self.lineNumber())
        
        def fold_all_blocks(self):
            """折叠所有块"""
            self.foldAll()
        
        def unfold_all_blocks(self):
            """展开所有块"""
            self.unfoldAll()
else:
    class SQLTextEdit(QTextEdit):
        """SQL文本编辑器（QTextEdit备选方案）"""
        def __init__(self, parent=None):
            super(SQLTextEdit, self).__init__(parent)
            
            # 设置字体
            font = QFont('Consolas', 13)
            self.setFont(font)
            
            # 设置样式
            self.setStyleSheet("background-color: #ffffff; color: #333333;")
            
            # 启用右键菜单
            self.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
            self.customContextMenuRequested.connect(self.show_context_menu)
        
        def update_completion(self, tables=None, columns=None):
            """更新补全列表"""
            pass
        
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
            
            # 其他操作
            menu.addAction("保存SQL文件", self.save_sql_file)
            menu.addAction("打开SQL文件", self.open_sql_file)
            
            # 显示菜单
            menu.exec(self.mapToGlobal(pos))
        
        def find(self):
            """查找功能"""
            pass
        
        def replace(self):
            """替换功能"""
            pass
        
        def format_sql(self):
            """美化SQL"""
            pass
        
        def execute_sql(self):
            """执行SQL"""
            pass
        
        def toggle_comment(self):
            """注释/取消注释"""
            pass
        
        def save_sql_file(self):
            """保存SQL文件"""
            pass
        
        def open_sql_file(self):
            """打开SQL文件"""
            pass
        
        # 行操作方法
        def copy_line(self):
            """复制当前行"""
            pass
        
        def delete_line(self):
            """删除当前行"""
            pass
        
        def insert_line_above(self):
            """在当前行上方插入新行"""
            pass
        
        def insert_line_below(self):
            """在当前行下方插入新行"""
            pass
        
        def duplicate_line(self):
            """复制并粘贴到下行"""
            pass
        
        # 代码格式化方法
        def indent_increase(self):
            """增加缩进"""
            pass
        
        def indent_decrease(self):
            """减少缩进"""
            pass
        
        def convert_to_uppercase(self):
            """转换为大写"""
            pass
        
        def convert_to_lowercase(self):
            """转换为小写"""
            pass
        
        # SQL相关操作
        def explain_sql(self):
            """执行计划"""
            pass
        
        # 代码折叠相关
        def fold_current_block(self):
            """折叠当前块"""
            pass
        
        def unfold_current_block(self):
            """展开当前块"""
            pass
        
        def fold_all_blocks(self):
            """折叠所有块"""
            pass
        
        def unfold_all_blocks(self):
            """展开所有块"""
            pass