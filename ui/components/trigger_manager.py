#!/usr/bin/env python3
"""
触发器管理器
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QLabel, QLineEdit, QComboBox, QMessageBox, QMenu,
    QToolBar, QHeaderView, QAbstractItemView, QTextEdit, QCompleter
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QAction, QCursor


class TriggerManager(QDialog):
    """触发器管理器"""
    
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        self.current_triggers = []
        self.available_tables = []
        
        self.setWindowTitle("触发器管理")
        self.setGeometry(150, 100, 900, 600)
        self.setMinimumSize(700, 400)
        self.setStyleSheet(self._get_dialog_style())
        
        self.setup_ui()
        self.load_triggers()
    
    def _get_dialog_style(self):
        return """
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QTableWidget {
                background-color: #ffffff;
                alternate-background-color: #f9f9f9;
                border: 1px solid #d0d0d0;
                gridline-color: #e8e8e8;
                font-size: 12px;
            }
            QTableWidget::item {
                padding: 6px 8px;
            }
            QTableWidget::item:selected {
                background-color: #e3f2fd;
            }
            QHeaderView::section {
                background-color: #f0f0f0;
                padding: 8px;
                border: none;
                border-right: 1px solid #d0d0d0;
                border-bottom: 2px solid #1a73e8;
                font-weight: 600;
            }
            QPushButton {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
                border-radius: 3px;
                padding: 6px 16px;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
            }
            QPushButton#primary {
                background-color: #1a73e8;
                color: white;
                border: none;
            }
            QPushButton#primary:hover {
                background-color: #1557b0;
            }
            QPushButton#danger {
                background-color: #dc3545;
                color: white;
                border: none;
            }
            QPushButton#danger:hover {
                background-color: #c82333;
            }
            QToolBar {
                background-color: #f8f8f8;
                border: none;
                border-bottom: 1px solid #e0e0e0;
                padding: 4px;
            }
            QToolBar QToolButton {
                padding: 6px 12px;
                border: 1px solid transparent;
                border-radius: 3px;
            }
            QToolBar QToolButton:hover {
                background-color: #e0e0e0;
            }
        """
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(8)
        
        # 工具栏
        toolbar = QToolBar()
        
        refresh_action = QAction("刷新", self)
        refresh_action.triggered.connect(self.load_triggers)
        toolbar.addAction(refresh_action)
        
        toolbar.addSeparator()
        
        open_action = QAction("编辑", self)
        open_action.triggered.connect(self.edit_trigger)
        toolbar.addAction(open_action)
        
        create_action = QAction("新建触发器", self)
        create_action.triggered.connect(self.create_trigger)
        toolbar.addAction(create_action)
        
        toolbar.addSeparator()
        
        drop_action = QAction("删除", self)
        drop_action.triggered.connect(self.drop_trigger)
        toolbar.addAction(drop_action)
        
        layout.addWidget(toolbar)
        
        # 搜索栏
        search_layout = QHBoxLayout()
        search_layout.addWidget(QLabel("搜索:"))
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("输入触发器名称搜索...")
        self.search_input.textChanged.connect(self.filter_triggers)
        search_layout.addWidget(self.search_input, 1)
        layout.addLayout(search_layout)
        
        # 触发器列表
        self.trigger_table = QTableWidget()
        self.trigger_table.setColumnCount(5)
        self.trigger_table.setHorizontalHeaderLabels(["触发器名称", "所属表", "触发时机", "触发事件", "创建时间"])
        self.trigger_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.trigger_table.setAlternatingRowColors(True)
        self.trigger_table.horizontalHeader().setStretchLastSection(True)
        self.trigger_table.itemDoubleClicked.connect(self.edit_trigger)
        self.trigger_table.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.trigger_table.customContextMenuRequested.connect(self.show_context_menu)
        layout.addWidget(self.trigger_table, 1)
        
        # 底部按钮
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(self.accept)
        button_layout.addWidget(close_btn)
        
        layout.addLayout(button_layout)
    
    def load_triggers(self):
        """加载触发器列表"""
        self.trigger_table.setRowCount(0)
        self.available_tables.clear()
        
        try:
            self.main_window.table_operations._ensure_database_context()
            
            # 获取表列表
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    cursor.execute("""
                        SELECT TABLE_NAME 
                        FROM INFORMATION_SCHEMA.TABLES 
                        WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'
                        ORDER BY TABLE_NAME
                    """, (self.main_window.current_db,))
                    self.available_tables = [row[0] for row in cursor.fetchall()]
                    
                    cursor.execute("""
                        SELECT 
                            TRIGGER_NAME,
                            EVENT_OBJECT_TABLE,
                            ACTION_TIMING,
                            EVENT_MANIPULATION,
                            CREATED
                        FROM INFORMATION_SCHEMA.TRIGGERS
                        WHERE EVENT_OBJECT_SCHEMA = %s
                        ORDER BY TRIGGER_NAME
                    """, (self.main_window.current_db,))
                    triggers = cursor.fetchall()
                    
                elif self.main_window.current_db_type == 'PostgreSQL':
                    cursor.execute("""
                        SELECT 
                            t.tgname as trigger_name,
                            c.relname as table_name,
                            CASE WHEN t.tgtype & 1 = 1 THEN 'BEFORE' ELSE 'AFTER' END as timing,
                            CASE 
                                WHEN t.tgtype & 2 = 2 THEN 'INSERT'
                                WHEN t.tgtype & 4 = 4 THEN 'DELETE'
                                WHEN t.tgtype & 8 = 8 THEN 'UPDATE'
                                ELSE 'UNKNOWN'
                            END as event,
                            NULL as created
                        FROM pg_trigger t
                        JOIN pg_class c ON t.tgrelid = c.oid
                        JOIN pg_namespace n ON c.relnamespace = n.oid
                        WHERE n.nspname = 'public'
                        AND NOT t.tgisinternal
                        ORDER BY t.tgname
                    """)
                    triggers = cursor.fetchall()
                    
                elif self.main_window.current_db_type == 'SQL Server':
                    cursor.execute("""
                        SELECT 
                            t.name as trigger_name,
                            OBJECT_NAME(t.parent_id) as table_name,
                            CASE WHEN t.is_disabled = 0 THEN 'AFTER' ELSE 'DISABLED' END as timing,
                            CASE 
                                WHEN OBJECTPROPERTY(t.object_id, 'ExecIsInsertTrigger') = 1 THEN 'INSERT'
                                WHEN OBJECTPROPERTY(t.object_id, 'ExecIsUpdateTrigger') = 1 THEN 'UPDATE'
                                WHEN OBJECTPROPERTY(t.object_id, 'ExecIsDeleteTrigger') = 1 THEN 'DELETE'
                            END as event,
                            t.create_date as created
                        FROM sys.triggers t
                        ORDER BY t.name
                    """)
                    triggers = cursor.fetchall()
                else:
                    triggers = []
            
            self.current_triggers = triggers
            
            for row, trigger in enumerate(triggers):
                self.trigger_table.insertRow(row)
                
                if isinstance(trigger, dict):
                    name = trigger.get('trigger_name', '')
                    table = trigger.get('table_name', trigger.get('EVENT_OBJECT_TABLE', ''))
                    timing = trigger.get('timing', trigger.get('ACTION_TIMING', ''))
                    event = trigger.get('event', trigger.get('EVENT_MANIPULATION', ''))
                    created = trigger.get('created', '')
                else:
                    name = str(trigger[0]) if len(trigger) > 0 else ''
                    table = str(trigger[1]) if len(trigger) > 1 else ''
                    timing = str(trigger[2]) if len(trigger) > 2 else ''
                    event = str(trigger[3]) if len(trigger) > 3 else ''
                    created = str(trigger[4]) if len(trigger) > 4 else ''
                
                self.trigger_table.setItem(row, 0, QTableWidgetItem(name))
                self.trigger_table.setItem(row, 1, QTableWidgetItem(table))
                self.trigger_table.setItem(row, 2, QTableWidgetItem(timing))
                self.trigger_table.setItem(row, 3, QTableWidgetItem(event))
                self.trigger_table.setItem(row, 4, QTableWidgetItem(str(created)))
            
            self.logger.log('INFO', f"加载触发器: {len(triggers)} 个")
            
        except Exception as e:
            QMessageBox.critical(self, "加载失败", f"加载触发器列表时出错:\n{str(e)}")
            self.logger.log('ERROR', f"加载触发器失败: {str(e)}")
    
    def filter_triggers(self, text):
        """筛选触发器"""
        if not text:
            for row in range(self.trigger_table.rowCount()):
                self.trigger_table.setRowHidden(row, False)
            return
        
        text_lower = text.lower()
        for row in range(self.trigger_table.rowCount()):
            name_item = self.trigger_table.item(row, 0)
            if name_item:
                self.trigger_table.setRowHidden(row, text_lower not in name_item.text().lower())
    
    def get_selected_trigger(self):
        """获取选中的触发器"""
        row = self.trigger_table.currentRow()
        if row >= 0:
            name = self.trigger_table.item(row, 0).text()
            table = self.trigger_table.item(row, 1).text()
            return name, table
        return None, None
    
    def create_trigger(self):
        """创建触发器"""
        designer = TriggerDesigner(self.main_window, self.available_tables)
        if designer.exec():
            self.load_triggers()
    
    def edit_trigger(self):
        """编辑触发器"""
        name, table = self.get_selected_trigger()
        if not name:
            QMessageBox.warning(self, "提示", "请先选择一个触发器")
            return
        
        designer = TriggerDesigner(self.main_window, self.available_tables, name, table)
        if designer.exec():
            self.load_triggers()
    
    def drop_trigger(self):
        """删除触发器"""
        name, table = self.get_selected_trigger()
        if not name:
            QMessageBox.warning(self, "提示", "请先选择一个触发器")
            return
        
        if QMessageBox.question(self, "删除确认", 
                              f"确定要删除触发器 '{name}' 吗？\n此操作不可恢复！",
                              QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) != QMessageBox.StandardButton.Yes:
            return
        
        try:
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    cursor.execute(f"DROP TRIGGER IF EXISTS `{name}`")
                elif self.main_window.current_db_type == 'PostgreSQL':
                    cursor.execute(f"DROP TRIGGER IF EXISTS {name}")
                elif self.main_window.current_db_type == 'SQL Server':
                    cursor.execute(f"DROP TRIGGER {name}")
                self.main_window.db_connection.commit()
            
            QMessageBox.information(self, "删除成功", f"触发器 '{name}' 已删除")
            self.logger.log('INFO', f"删除触发器: {name}")
            self.load_triggers()
            
        except Exception as e:
            QMessageBox.critical(self, "删除失败", f"删除时出错:\n{str(e)}")
            self.logger.log('ERROR', f"删除触发器失败: {str(e)}")
    
    def show_context_menu(self, pos):
        """右键菜单"""
        menu = QMenu()
        menu.addAction("编辑", self.edit_trigger)
        menu.addAction("删除", self.drop_trigger)
        menu.exec(QCursor.pos())


class TriggerDesigner(QDialog):
    """触发器设计器"""
    
    def __init__(self, main_window, tables=None, trigger_name=None, table_name=None):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        self.trigger_name = trigger_name
        self.table_name = table_name
        self.tables = tables or []
        
        self.setWindowTitle(f"编辑触发器: {trigger_name}" if trigger_name else "新建触发器")
        self.setGeometry(150, 100, 900, 650)
        self.setMinimumSize(700, 450)
        self.setStyleSheet("""
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QTextEdit {
                border: 1px solid #d0d0d0;
                background-color: #ffffff;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 12px;
            }
            QPushButton {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
                border-radius: 3px;
                padding: 6px 16px;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
            }
            QPushButton#primary {
                background-color: #1a73e8;
                color: white;
                border: none;
            }
            QPushButton#primary:hover {
                background-color: #1557b0;
            }
            QComboBox {
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 6px 10px;
            }
            QLabel {
                font-size: 12px;
            }
            QGroupBox {
                font-weight: 600;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                margin-top: 10px;
                padding-top: 10px;
            }
        """)
        
        self.setup_ui()
        if trigger_name:
            self.load_trigger_definition()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)
        
        # 触发器基本信息
        info_group = QWidget()
        info_layout = QHBoxLayout(info_group)
        info_layout.setContentsMargins(0, 0, 0, 0)
        
        info_layout.addWidget(QLabel("触发器名称:"))
        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("输入触发器名称...")
        info_layout.addWidget(self.name_input, 1)
        
        layout.addWidget(info_group)
        
        # 表和事件配置
        config_group = QWidget()
        config_layout = QHBoxLayout(config_group)
        config_layout.setContentsMargins(0, 0, 0, 0)
        
        config_layout.addWidget(QLabel("所属表:"))
        self.table_combo = QComboBox()
        self.table_combo.setEditable(True)
        self.table_combo.addItems(self.tables)
        config_layout.addWidget(self.table_combo, 2)
        
        config_layout.addWidget(QLabel("触发时机:"))
        self.timing_combo = QComboBox()
        self.timing_combo.addItems(['BEFORE', 'AFTER'])
        config_layout.addWidget(self.timing_combo, 1)
        
        config_layout.addWidget(QLabel("触发事件:"))
        self.event_combo = QComboBox()
        self.event_combo.addItems(['INSERT', 'UPDATE', 'DELETE'])
        config_layout.addWidget(self.event_combo, 1)
        
        layout.addWidget(config_group)
        
        # SQL编辑器
        body_label = QLabel("触发器SQL:")
        layout.addWidget(body_label)
        
        self.body_editor = QTextEdit()
        self.body_editor.setPlaceholderText("""输入触发器SQL语句，例如:

BEGIN
    -- 触发器逻辑
    INSERT INTO audit_log (action, table_name, timestamp)
    VALUES ('DELETE', 'users', NOW());
END""")
        layout.addWidget(self.body_editor, 1)
        
        # 帮助信息
        help_label = QLabel("""提示:
• BEFORE: 在事件执行前触发
• AFTER: 在事件执行后触发
• INSERT/UPDATE/DELETE: 触发的事件类型
• 使用NEW.column_name访问新数据（INSERT/UPDATE）
• 使用OLD.column_name访问旧数据（UPDATE/DELETE）""")
        help_label.setStyleSheet("color: #666666; font-size: 11px; background-color: #f0f0f0; padding: 8px; border-radius: 4px;")
        layout.addWidget(help_label)
        
        # 按钮
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        
        test_btn = QPushButton("测试语法")
        test_btn.clicked.connect(self.test_syntax)
        button_layout.addWidget(test_btn)
        
        save_btn = QPushButton("保存")
        save_btn.setObjectName("primary")
        save_btn.clicked.connect(self.save_trigger)
        button_layout.addWidget(save_btn)
        
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)
        
        layout.addLayout(button_layout)
    
    def load_trigger_definition(self):
        """加载触发器定义"""
        try:
            self.name_input.setText(self.trigger_name)
            self.table_combo.setCurrentText(self.table_name)
            
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    cursor.execute("""
                        SELECT 
                            ACTION_TIMING,
                            EVENT_MANIPULATION,
                            STATEMENT_STATEMENT
                        FROM INFORMATION_SCHEMA.TRIGGERS
                        WHERE TRIGGER_NAME = %s AND EVENT_OBJECT_TABLE = %s
                    """, (self.trigger_name, self.table_name))
                    result = cursor.fetchone()
                    if result:
                        self.timing_combo.setCurrentText(result[0])
                        self.event_combo.setCurrentText(result[1])
                        self.body_editor.setPlainText(result[2])
                        
                elif self.main_window.current_db_type == 'PostgreSQL':
                    cursor.execute("""
                        SELECT pg_get_triggerdef(t.oid) as trigger_def
                        FROM pg_trigger t
                        WHERE t.tgname = %s
                    """, (self.trigger_name,))
                    result = cursor.fetchone()
                    if result:
                        self.body_editor.setPlainText("-- " + str(result[0]))
            
        except Exception as e:
            QMessageBox.critical(self, "加载失败", f"加载触发器定义时出错:\n{str(e)}")
            self.logger.log('ERROR', f"加载触发器定义失败: {str(e)}")
    
    def test_syntax(self):
        """测试语法"""
        try:
            if not self.validate_input():
                return
            
            sql = self.generate_sql()
            
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                cursor.execute(f"EXPLAIN {sql}")
            
            QMessageBox.information(self, "语法检查", "语法检查通过！")
            
        except Exception as e:
            QMessageBox.critical(self, "语法错误", f"SQL语法有误:\n{str(e)}")
    
    def validate_input(self):
        """验证输入"""
        if not self.name_input.text().strip():
            QMessageBox.warning(self, "提示", "请输入触发器名称")
            return False
        if not self.table_combo.currentText().strip():
            QMessageBox.warning(self, "提示", "请选择或输入表名")
            return False
        if not self.body_editor.toPlainText().strip():
            QMessageBox.warning(self, "提示", "请输入触发器SQL")
            return False
        return True
    
    def generate_sql(self):
        """生成SQL"""
        name = self.name_input.text().strip()
        table = self.table_combo.currentText().strip()
        timing = self.timing_combo.currentText()
        event = self.event_combo.currentText()
        body = self.body_editor.toPlainText().strip()
        
        if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
            if body.startswith('CREATE'):
                return body
            else:
                return f"""CREATE TRIGGER `{name}`
{-timing} {event} ON `{table}`
FOR EACH ROW
{body}"""
        elif self.main_window.current_db_type == 'PostgreSQL':
            return f"""CREATE OR REPLACE TRIGGER {name}
{-timing} {event}
ON {table}
FOR EACH ROW
EXECUTE FUNCTION trigger_function()"""
        else:
            return body
    
    def save_trigger(self):
        """保存触发器"""
        if not self.validate_input():
            return
        
        try:
            sql = self.generate_sql()
            
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    # 先删除已存在的
                    cursor.execute(f"DROP TRIGGER IF EXISTS `{self.trigger_name}`" if self.trigger_name else "SELECT 1")
                    cursor.execute(sql)
                elif self.main_window.current_db_type == 'PostgreSQL':
                    cursor.execute(f"DROP TRIGGER IF EXISTS {self.trigger_name} ON {self.table_combo.currentText()}" if self.trigger_name else "SELECT 1")
                    cursor.execute(sql)
                
                self.main_window.db_connection.commit()
            
            QMessageBox.information(self, "保存成功", "触发器保存成功")
            self.logger.log('INFO', f"保存触发器: {self.name_input.text()}")
            self.accept()
            
        except Exception as e:
            QMessageBox.critical(self, "保存失败", f"保存触发器时出错:\n{str(e)}")
            self.logger.log('ERROR', f"保存触发器失败: {str(e)}")
