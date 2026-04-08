#!/usr/bin/env python3
"""
SQL操作模块
"""

from PyQt6.QtWidgets import QMessageBox, QInputDialog, QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton, QTableWidget, QTableWidgetItem
from PyQt6.QtCore import QThreadPool
from PyQt6.QtGui import QTextCursor
from core.database_operations import SQLWorker, DatabaseOperations

class SQLOperations:
    """
    SQL操作类
    """
    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
    
    def execute_sql(self):
        """
        执行SQL
        """
        try:
            current_tab = self.main_window.right_panel.tabs.currentWidget()
            if not current_tab:
                QMessageBox.warning(self.main_window, "执行SQL", "没有打开的查询标签页")
                self.logger.warning("尝试执行SQL但没有打开的查询标签页")
                return
            
            # 获取SQL编辑器
            sql_editor = None
            result_table = None
            message_output = None
            
            # 检查是否是QueryTab组件
            if hasattr(current_tab, 'sql_editor') and hasattr(current_tab, 'result_table') and hasattr(current_tab, 'message_output'):
                # 从QueryTab组件中获取
                sql_editor = current_tab.sql_editor
                result_table = current_tab.result_table
                message_output = current_tab.message_output
                self.logger.log('INFO', "从QueryTab组件中获取SQL编辑器和结果表格")
            else:
                # 对于旧的标签页，保持原有逻辑
                # 遍历子部件找到SQL编辑器和结果区域
                for widget in current_tab.findChildren(QWidget):
                    from ui.components.sql_editor import SQLTextEdit
                    if isinstance(widget, SQLTextEdit):
                        sql_editor = widget
                    elif isinstance(widget, QTableWidget):
                        result_table = widget
                    elif isinstance(widget, QTextEdit) and not isinstance(widget, SQLTextEdit):
                        # 确保只选择普通QTextEdit作为消息输出，排除SQLTextEdit
                        message_output = widget
                
                # 如果没有找到，尝试遍历分割器中的部件
                if not result_table or not message_output:
                    for widget in current_tab.findChildren(QSplitter):
                        for splitter_widget in widget.findChildren(QWidget):
                            if isinstance(splitter_widget, QTableWidget):
                                result_table = splitter_widget
                            elif isinstance(splitter_widget, QTextEdit) and not isinstance(splitter_widget, SQLTextEdit):
                                message_output = splitter_widget
            
            if not sql_editor:
                QMessageBox.warning(self.main_window, "执行SQL", "无法找到SQL编辑器")
                self.logger.warning("尝试执行SQL但无法找到SQL编辑器")
                return
            
            # 检查是否有选中的文本
            cursor = sql_editor.textCursor()
            if cursor.hasSelection():
                # 执行选中的文本
                sql = cursor.selectedText()
            else:
                # 执行整个编辑器的内容
                sql = sql_editor.toPlainText()
            
            if not sql.strip():
                QMessageBox.warning(self.main_window, "执行SQL", "请输入SQL语句")
                self.logger.warning("尝试执行SQL但SQL语句为空")
                return
            
            # 检查是否已连接数据库
            if not hasattr(self.main_window, 'db_connection'):
                QMessageBox.warning(self.main_window, "执行SQL", "请先连接到数据库")
                self.logger.warning("尝试执行SQL但未连接到数据库")
                return
            
            # 显示执行中的提示
            if message_output:
                message_output.setPlainText("SQL执行中...")
            
            # 记录SQL执行开始
            self.logger.info(f"开始执行SQL语句: {sql[:100]}...")
            
            # 创建工作线程
            worker = SQLWorker(sql, self.main_window.db_connection, self.main_window.current_db_type, self.main_window)
            
            # 连接信号
            def on_finished(result):
                try:
                    # 清空结果
                    if result_table:
                        result_table.setRowCount(0)
                        result_table.setColumnCount(0)
                    
                    # 处理结果
                    results = result['results']
                    affected_rows = result['affected_rows']
                    execution_time = result['execution_time']
                    
                    if results and result_table:
                        try:
                            # 设置列
                            if self.main_window.current_db_type == 'MySQL' or self.main_window.current_db_type == 'PostgreSQL':
                                columns = list(results[0].keys()) if isinstance(results[0], dict) else [f'列{i+1}' for i in range(len(results[0]))]
                            elif self.main_window.current_db_type == 'SQL Server':
                                # 尝试获取列名，如果失败则使用默认列名
                                columns = [f'列{i+1}' for i in range(len(results[0]))]
                            else:
                                columns = [f'列{i+1}' for i in range(len(results[0]))]
                            
                            result_table.setColumnCount(len(columns))
                            result_table.setHorizontalHeaderLabels(columns)
                            
                            # 添加数据
                            result_table.setRowCount(len(results))
                            for row_idx, row_data in enumerate(results):
                                row_values = list(row_data.values()) if isinstance(row_data, dict) else row_data
                                for col_idx, value in enumerate(row_values):
                                    item = QTableWidgetItem(str(value))
                                    result_table.setItem(row_idx, col_idx, item)
                            
                            # 调整列宽
                            result_table.resizeColumnsToContents()
                        except Exception as e:
                            self.logger.error("处理查询结果时出错", exception=e)
                            if message_output:
                                message_output.setPlainText(f"SQL执行成功但处理结果时出错: {e}")
                    
                    # 显示执行信息
                    if message_output:
                        message_output.setPlainText(f"SQL执行成功 | 执行时间: {execution_time:.4f} 秒 | 影响行数: {affected_rows if affected_rows else len(results) if results else 0}")
                    
                    # 更新状态栏
                    self.main_window.execution_time.setText(f"执行时间: {execution_time:.4f} 秒")
                    if results:
                        self.main_window.record_count.setText(f"记录数: {len(results)}")
                    else:
                        self.main_window.record_count.setText(f"影响行数: {affected_rows}")
                    self.main_window.status_info.setText("SQL执行成功")
                    
                    self.logger.info(f"执行SQL语句成功，执行时间: {execution_time:.4f} 秒，影响行数: {affected_rows if affected_rows else len(results) if results else 0}")
                except Exception as e:
                    self.logger.error("处理SQL执行结果时出错", exception=e)
                    if message_output:
                        message_output.setPlainText(f"处理SQL执行结果时出错: {e}")
                    self.main_window.status_info.setText("处理结果失败")
            
            def on_error(error):
                # 显示错误信息
                if message_output:
                    message_output.setPlainText(f"SQL执行失败 | 错误信息: {error}")
                
                # 更新状态栏
                self.main_window.status_info.setText("SQL执行失败")
                
                # 分析错误类型并提供更友好的错误信息
                error_message = f"执行SQL语句时出错: {error}"
                if "Lost connection" in str(error):
                    error_message += "\n\n可能的原因：\n- 数据库服务器连接超时\n- 网络连接不稳定\n- 数据库服务器重启"
                elif "Access denied" in str(error):
                    error_message += "\n\n可能的原因：\n- 用户名或密码错误\n- 权限不足"
                elif "Table doesn't exist" in str(error):
                    error_message += "\n\n可能的原因：\n- 表名错误\n- 表不存在"
                
                QMessageBox.critical(self.main_window, "执行SQL", error_message)
                self.logger.error(f"执行SQL语句失败: {error}")
            
            worker.signals.finished.connect(on_finished)
            worker.signals.error.connect(on_error)
            
            # 启动工作线程
            QThreadPool.globalInstance().start(worker)
        except Exception as e:
            self.logger.error("执行SQL时出错", exception=e)
            QMessageBox.critical(self.main_window, "执行SQL", f"执行SQL时出错: {str(e)}")
            self.main_window.status_info.setText("执行SQL失败")
    
    def format_sql(self):
        """
        SQL格式化
        """
        current_tab = self.main_window.right_panel.tabs.currentWidget()
        if not current_tab:
            return
        
        # 获取SQL编辑器
        sql_editor = None
        
        # 检查是否是QueryTab组件
        if hasattr(current_tab, 'sql_editor'):
            # 从QueryTab组件中获取
            sql_editor = current_tab.sql_editor
            self.logger.log('INFO', "从QueryTab组件中获取SQL编辑器")
        else:
            # 对于旧的标签页，保持原有逻辑
            from ui.components.sql_editor import SQLTextEdit
            for widget in current_tab.findChildren(QWidget):
                if isinstance(widget, SQLTextEdit):
                    sql_editor = widget
                    break
        
        if not sql_editor:
            return
        
        # 获取SQL文本
        sql = sql_editor.toPlainText()
        if not sql.strip():
            QMessageBox.warning(self.main_window, "SQL格式化", "请输入SQL语句")
            return
        
        # 简单的SQL格式化
        formatted_sql = self._format_sql(sql)
        sql_editor.setPlainText(formatted_sql)
        QMessageBox.information(self.main_window, "SQL格式化", "SQL格式化成功")
    
    def _format_sql(self, sql):
        """
        格式化SQL语句
        """
        # 简单的SQL格式化实现
        sql = sql.replace('\r\n', '\n')
        sql = sql.replace('\r', '\n')
        # 替换Unicode行分隔符
        sql = sql.replace('\u2028', '\n')
        sql = sql.replace('\u2029', '\n')
        # 替换全角分号为半角分号
        sql = sql.replace('；', ';')
        
        # 大写关键字
        keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME', 'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'TABLE', 'DATABASE', 'SCHEMA', 'USE', 'AS', 'ON', 'IN', 'LIKE', 'BETWEEN', 'AND', 'OR', 'NOT', 'IS', 'NULL', 'TRUE', 'FALSE', 'DEFAULT', 'PRIMARY', 'FOREIGN', 'KEY', 'REFERENCES', 'CHECK', 'UNIQUE', 'AUTO_INCREMENT', 'EXISTS', 'DISTINCT', 'TOP', 'VALUES', 'SET', 'REPLACE', 'IF', 'ELSE', 'CASE', 'WHEN', 'THEN', 'END', 'WHILE', 'DO', 'LOOP', 'REPEAT', 'UNTIL', 'DECLARE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'GRANT', 'REVOKE', 'DENY']
        
        # 函数名
        functions = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'CONCAT', 'SUBSTRING', 'LENGTH', 'DATE', 'TIME', 'NOW', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME', 'CAST', 'CONVERT', 'ROUND', 'FLOOR', 'CEIL', 'ABS', 'MOD', 'POW', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'LOG', 'EXP', 'SQRT', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'DATE_ADD', 'DATE_SUB', 'DATEDIFF', 'TIMEDIFF', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'WEEK', 'QUARTER', 'DAYOFWEEK', 'DAYOFYEAR', 'MONTHNAME', 'DAYNAME', 'ISNULL', 'IFNULL', 'NULLIF', 'COALESCE']
        
        # 大写关键字和函数
        for keyword in keywords:
            import re
            # 确保只替换完整的单词
            pattern = r'\b' + keyword.lower() + r'\b'
            sql = re.sub(pattern, keyword, sql, flags=re.IGNORECASE)
        
        for function in functions:
            import re
            # 确保只替换完整的函数名
            pattern = r'\b' + function.lower() + r'\b'
            sql = re.sub(pattern, function, sql, flags=re.IGNORECASE)
        
        lines = sql.split('\n')
        formatted_lines = []
        indent = 0
        indent_size = 4
        
        for line in lines:
            line = line.strip()
            if not line:
                formatted_lines.append('')
                continue
            
            # 检查是否需要减少缩进
            if line.startswith(')') or line.startswith('END') or line.startswith('ELSE'):
                indent = max(0, indent - indent_size)
            
            # 添加缩进
            formatted_line = ' ' * indent + line
            formatted_lines.append(formatted_line)
            
            # 检查是否需要增加缩进
            if line.endswith('(') or line.endswith('{') or line.endswith('['):
                indent += indent_size
            elif any(keyword in line for keyword in keywords) and not line.endswith(';') and not line.endswith(')'):
                indent += indent_size
            elif 'CASE' in line and 'END' not in line:
                indent += indent_size
        
        return '\n'.join(formatted_lines)
    
    def explain_sql(self):
        """
        执行计划
        """
        current_tab = self.main_window.right_panel.tabs.currentWidget()
        if not current_tab:
            return
        
        # 获取SQL编辑器
        sql_editor = None
        
        # 检查是否是QueryTab组件
        if hasattr(current_tab, 'sql_editor'):
            # 从QueryTab组件中获取
            sql_editor = current_tab.sql_editor
            self.logger.log('INFO', "从QueryTab组件中获取SQL编辑器")
        else:
            # 对于旧的标签页，保持原有逻辑
            from ui.components.sql_editor import SQLTextEdit
            for widget in current_tab.findChildren(QWidget):
                if isinstance(widget, SQLTextEdit):
                    sql_editor = widget
                    break
        
        if not sql_editor:
            return
        
        # 获取SQL文本
        sql = sql_editor.toPlainText()
        if not sql.strip():
            QMessageBox.warning(self.main_window, "执行计划", "请输入SQL语句")
            return
        
        # 检查是否已连接数据库
        if not hasattr(self.main_window, 'db_connection'):
            QMessageBox.warning(self.main_window, "执行计划", "请先连接到数据库")
            return
        
        # 生成执行计划
        db_operations = DatabaseOperations(self.main_window.db_connection, self.main_window.current_db_type)
        plan = db_operations.get_execution_plan(sql)
        
        # 显示执行计划
        dialog = QDialog(self.main_window)
        dialog.setWindowTitle("执行计划")
        dialog.setGeometry(300, 200, 800, 400)
        
        layout = QVBoxLayout(dialog)
        
        table = QTableWidget()
        if plan:
            table.setRowCount(len(plan))
            table.setColumnCount(len(plan[0]))
            table.setHorizontalHeaderLabels(plan[0])
            
            for i, row in enumerate(plan[1:]):
                for j, value in enumerate(row):
                    item = QTableWidgetItem(str(value))
                    table.setItem(i, j, item)
            
            table.resizeColumnsToContents()
        
        layout.addWidget(table)
        dialog.exec()
    
    def find_sql(self):
        """
        查找SQL
        """
        current_tab = self.main_window.right_panel.tabs.currentWidget()
        if not current_tab:
            return
        
        # 获取SQL编辑器
        sql_editor = None
        
        # 检查是否是QueryTab组件
        if hasattr(current_tab, 'sql_editor'):
            # 从QueryTab组件中获取
            sql_editor = current_tab.sql_editor
            self.logger.log('INFO', "从QueryTab组件中获取SQL编辑器")
        else:
            # 对于旧的标签页，保持原有逻辑
            from ui.components.sql_editor import SQLTextEdit
            for widget in current_tab.findChildren(QWidget):
                if isinstance(widget, SQLTextEdit):
                    sql_editor = widget
                    break
        
        if not sql_editor:
            return
        
        # 打开查找对话框
        find_text, ok = QInputDialog.getText(self.main_window, "查找", "请输入要查找的文本:")
        if ok and find_text:
            # 查找文本
            cursor = sql_editor.textCursor()
            cursor.movePosition(QTextCursor.MoveOperation.Start)
            sql_editor.setTextCursor(cursor)
            
            found = False
            while True:
                cursor = sql_editor.document().find(find_text, cursor)
                if cursor.isNull():
                    break
                sql_editor.setTextCursor(cursor)
                found = True
                # 询问是否继续查找
                if QMessageBox.question(self.main_window, "查找", "是否继续查找下一个?", 
                                       QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.No:
                    break
            
            if not found:
                QMessageBox.information(self.main_window, "查找", f"未找到 '{find_text}'")
    
    def replace_sql(self):
        """
        替换SQL
        """
        current_tab = self.main_window.right_panel.tabs.currentWidget()
        if not current_tab:
            return
        
        # 获取SQL编辑器
        sql_editor = None
        
        # 检查是否是QueryTab组件
        if hasattr(current_tab, 'sql_editor'):
            # 从QueryTab组件中获取
            sql_editor = current_tab.sql_editor
            self.logger.log('INFO', "从QueryTab组件中获取SQL编辑器")
        else:
            # 对于旧的标签页，保持原有逻辑
            from ui.components.sql_editor import SQLTextEdit
            for widget in current_tab.findChildren(QWidget):
                if isinstance(widget, SQLTextEdit):
                    sql_editor = widget
                    break
        
        if not sql_editor:
            return
        
        # 打开替换对话框
        dialog = QDialog(self.main_window)
        dialog.setWindowTitle("替换")
        dialog.setGeometry(300, 200, 400, 150)
        
        layout = QVBoxLayout(dialog)
        
        # 查找文本
        find_layout = QHBoxLayout()
        find_layout.addWidget(QLabel("查找:"))
        find_edit = QLineEdit()
        find_layout.addWidget(find_edit)
        layout.addLayout(find_layout)
        
        # 替换文本
        replace_layout = QHBoxLayout()
        replace_layout.addWidget(QLabel("替换:"))
        replace_edit = QLineEdit()
        replace_layout.addWidget(replace_edit)
        layout.addLayout(replace_layout)
        
        # 按钮
        button_layout = QHBoxLayout()
        replace_btn = QPushButton("替换")
        replace_all_btn = QPushButton("全部替换")
        cancel_btn = QPushButton("取消")
        
        button_layout.addWidget(replace_btn)
        button_layout.addWidget(replace_all_btn)
        button_layout.addWidget(cancel_btn)
        layout.addLayout(button_layout)
        
        # 替换单个
        def replace_single():
            find_text = find_edit.text()
            replace_text = replace_edit.text()
            if not find_text:
                return
            
            cursor = sql_editor.textCursor()
            if cursor.hasSelection():
                selected_text = cursor.selectedText()
                if selected_text == find_text:
                    cursor.insertText(replace_text)
            else:
                # 查找下一个
                cursor = sql_editor.document().find(find_text, cursor)
                if not cursor.isNull():
                    cursor.select(QTextCursor.SelectionType.WordUnderCursor)
                    sql_editor.setTextCursor(cursor)
        
        # 全部替换
        def replace_all():
            find_text = find_edit.text()
            replace_text = replace_edit.text()
            if not find_text:
                return
            
            text = sql_editor.toPlainText()
            new_text = text.replace(find_text, replace_text)
            sql_editor.setPlainText(new_text)
            QMessageBox.information(self.main_window, "替换", f"成功替换 {text.count(find_text)} 处")
        
        replace_btn.clicked.connect(replace_single)
        replace_all_btn.clicked.connect(replace_all)
        cancel_btn.clicked.connect(dialog.reject)
        
        dialog.exec()
    
    def copy_sql(self):
        """
        复制SQL
        """
        current_tab = self.main_window.right_panel.tabs.currentWidget()
        if not current_tab:
            return
        
        # 获取SQL编辑器
        sql_editor = None
        
        # 检查是否是QueryTab组件
        if hasattr(current_tab, 'sql_editor'):
            # 从QueryTab组件中获取
            sql_editor = current_tab.sql_editor
        else:
            # 对于旧的标签页，保持原有逻辑
            from ui.components.sql_editor import SQLTextEdit
            for widget in current_tab.findChildren(QWidget):
                if isinstance(widget, SQLTextEdit):
                    sql_editor = widget
                    break
        
        if sql_editor:
            sql_editor.copy()
    
    def paste_sql(self):
        """
        粘贴SQL
        """
        current_tab = self.main_window.right_panel.tabs.currentWidget()
        if not current_tab:
            return
        
        # 获取SQL编辑器
        sql_editor = None
        
        # 检查是否是QueryTab组件
        if hasattr(current_tab, 'sql_editor'):
            # 从QueryTab组件中获取
            sql_editor = current_tab.sql_editor
        else:
            # 对于旧的标签页，保持原有逻辑
            from ui.components.sql_editor import SQLTextEdit
            for widget in current_tab.findChildren(QWidget):
                if isinstance(widget, SQLTextEdit):
                    sql_editor = widget
                    break
        
        if sql_editor:
            sql_editor.paste()
    
    def cut_sql(self):
        """
        剪切SQL
        """
        current_tab = self.main_window.right_panel.tabs.currentWidget()
        if not current_tab:
            return
        
        # 获取SQL编辑器
        sql_editor = None
        
        # 检查是否是QueryTab组件
        if hasattr(current_tab, 'sql_editor'):
            # 从QueryTab组件中获取
            sql_editor = current_tab.sql_editor
        else:
            # 对于旧的标签页，保持原有逻辑
            from ui.components.sql_editor import SQLTextEdit
            for widget in current_tab.findChildren(QWidget):
                if isinstance(widget, SQLTextEdit):
                    sql_editor = widget
                    break
        
        if sql_editor:
            sql_editor.cut()
    
    def select_all_sql(self):
        """
        全选SQL
        """
        current_tab = self.main_window.right_panel.tabs.currentWidget()
        if not current_tab:
            return
        
        # 获取SQL编辑器
        sql_editor = None
        
        # 检查是否是QueryTab组件
        if hasattr(current_tab, 'sql_editor'):
            # 从QueryTab组件中获取
            sql_editor = current_tab.sql_editor
        else:
            # 对于旧的标签页，保持原有逻辑
            from ui.components.sql_editor import SQLTextEdit
            for widget in current_tab.findChildren(QWidget):
                if isinstance(widget, SQLTextEdit):
                    sql_editor = widget
                    break
        
        if sql_editor:
            sql_editor.selectAll()
