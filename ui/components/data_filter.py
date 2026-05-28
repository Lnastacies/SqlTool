#!/usr/bin/env python3
"""
表数据过滤器
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QComboBox, QPushButton, QTableWidget, QTableWidgetItem,
    QHeaderView, QCheckBox, QSpinBox, QCompleter, QMenu
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QColor


class TableFilterWidget(QWidget):
    """表数据过滤器"""
    
    filter_applied = pyqtSignal(dict)
    
    def __init__(self, main_window, parent=None):
        super().__init__(parent)
        self.main_window = main_window
        self.columns = []
        self.filters = []
        
        self.setup_ui()
    
    def setup_ui(self):
        """设置UI"""
        self.setStyleSheet("""
            QWidget {
                background-color: #f8f8f8;
                border-bottom: 1px solid #e0e0e0;
            }
            QLineEdit {
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 4px 8px;
                background-color: #ffffff;
            }
            QLineEdit:focus {
                border: 1px solid #1a73e8;
            }
            QComboBox {
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 4px 8px;
                background-color: #ffffff;
            }
            QPushButton {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
                border-radius: 3px;
                padding: 4px 12px;
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
            QLabel {
                font-size: 12px;
                color: #666666;
            }
        """)
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(6)
        
        # 快速搜索
        search_layout = QHBoxLayout()
        search_layout.addWidget(QLabel("🔍 搜索:"))
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("输入关键字搜索（支持多列）...")
        self.search_input.returnPressed.connect(self.apply_quick_filter)
        search_layout.addWidget(self.search_input, 1)
        
        self.search_btn = QPushButton("搜索")
        self.search_btn.setObjectName("primary")
        self.search_btn.clicked.connect(self.apply_quick_filter)
        search_layout.addWidget(self.search_btn)
        
        self.clear_search_btn = QPushButton("清除")
        self.clear_search_btn.clicked.connect(self.clear_search)
        search_layout.addWidget(self.clear_search_btn)
        
        layout.addLayout(search_layout)
        
        # 高级过滤
        filter_layout = QHBoxLayout()
        filter_layout.addWidget(QLabel("过滤列:"))
        
        self.filter_column_combo = QComboBox()
        self.filter_column_combo.setMinimumWidth(120)
        filter_layout.addWidget(self.filter_column_combo)
        
        filter_layout.addWidget(QLabel("条件:"))
        
        self.filter_operator_combo = QComboBox()
        self.filter_operator_combo.addItems(["等于", "不等于", "包含", "不包含", "开头是", "结尾是", "大于", "小于", "大于等于", "小于等于", "为空", "不为空"])
        self.filter_operator_combo.setMinimumWidth(100)
        filter_layout.addWidget(self.filter_operator_combo)
        
        self.filter_value_input = QLineEdit()
        self.filter_value_input.setPlaceholderText("输入值...")
        filter_layout.addWidget(self.filter_value_input, 1)
        
        self.add_filter_btn = QPushButton("添加条件")
        self.add_filter_btn.clicked.connect(self.add_filter_condition)
        filter_layout.addWidget(self.add_filter_btn)
        
        layout.addLayout(filter_layout)
        
        # 当前过滤条件标签
        self.filter_tags_layout = QHBoxLayout()
        self.filter_tags_layout.addWidget(QLabel("当前条件:"))
        self.filter_tags_layout.addStretch()
        layout.addLayout(self.filter_tags_layout)
    
    def set_columns(self, columns):
        """设置列"""
        self.columns = columns
        self.filter_column_combo.clear()
        self.filter_column_combo.addItems(columns)
    
    def apply_quick_filter(self):
        """应用快速搜索"""
        search_text = self.search_input.text().strip()
        if not search_text:
            self.filter_applied.emit({})
            return
        
        # 构建过滤条件
        filters = {}
        for col in self.columns:
            filters[col] = {
                'operator': 'contains',
                'value': search_text
            }
        
        self.filter_applied.emit({'quick_search': filters})
    
    def clear_search(self):
        """清除搜索"""
        self.search_input.clear()
        self.filter_applied.emit({})
    
    def add_filter_condition(self):
        """添加过滤条件"""
        column = self.filter_column_combo.currentText()
        operator = self.filter_operator_combo.currentText()
        value = self.filter_value_input.text()
        
        if not column:
            return
        
        operator_map = {
            "等于": "=",
            "不等于": "!=",
            "包含": "LIKE",
            "不包含": "NOT LIKE",
            "开头是": "LIKE",
            "结尾是": "LIKE",
            "大于": ">",
            "小于": "<",
            "大于等于": ">=",
            "小于等于": "<=",
            "为空": "IS NULL",
            "不为空": "IS NOT NULL"
        }
        
        sql_operator = operator_map.get(operator, "=")
        
        # 构建SQL片段
        if operator in ("为空", "不为空"):
            sql = f"`{column}` {sql_operator}"
        elif operator == "包含":
            sql = f"`{column}` LIKE '%{value}%'"
        elif operator == "不包含":
            sql = f"`{column}` NOT LIKE '%{value}%'"
        elif operator == "开头是":
            sql = f"`{column}` LIKE '{value}%'"
        elif operator == "结尾是":
            sql = f"`{column}` LIKE '%{value}'"
        else:
            sql = f"`{column}` {sql_operator} '{value}'"
        
        self.filters.append({
            'column': column,
            'operator': operator,
            'value': value,
            'sql': sql
        })
        
        # 更新标签显示
        self._update_filter_tags()
        
        # 清空输入
        self.filter_value_input.clear()
    
    def remove_filter(self, index):
        """移除过滤条件"""
        if 0 <= index < len(self.filters):
            self.filters.pop(index)
            self._update_filter_tags()
    
    def clear_all_filters(self):
        """清除所有过滤条件"""
        self.filters.clear()
        self._update_filter_tags()
    
    def _update_filter_tags(self):
        """更新过滤标签显示"""
        # 清除现有标签
        while self.filter_tags_layout.count() > 1:
            item = self.filter_tags_layout.takeAt(1)
            if item.widget():
                item.widget().deleteLater()
        
        # 添加新标签
        for i, f in enumerate(self.filters):
            tag = FilterTagWidget(f, i, self.remove_filter)
            self.filter_tags_layout.insertWidget(self.filter_tags_layout.count() - 1, tag)
    
    def get_filter_sql(self):
        """获取过滤SQL"""
        if not self.filters:
            return ""
        
        conditions = [f['sql'] for f in self.filters]
        return " WHERE " + " AND ".join(conditions)


class FilterTagWidget(QWidget):
    """过滤条件标签"""
    
    def __init__(self, filter_data, index, remove_callback):
        super().__init__()
        self.filter_data = filter_data
        self.index = index
        self.remove_callback = remove_callback
        
        self.setup_ui()
    
    def setup_ui(self):
        """设置UI"""
        layout = QHBoxLayout(self)
        layout.setContentsMargins(4, 2, 4, 2)
        layout.setSpacing(4)
        
        label = QLabel(f"{self.filter_data['column']} {self.filter_data['operator']} {self.filter_data['value']}")
        label.setStyleSheet("""
            background-color: #E3F2FD;
            color: #1A73E8;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
        """)
        layout.addWidget(label)
        
        remove_btn = QPushButton("×")
        remove_btn.setStyleSheet("""
            background-color: transparent;
            border: none;
            color: #666;
            font-size: 14px;
            padding: 0 4px;
        """)
        remove_btn.clicked.connect(lambda: self.remove_callback(self.index))
        layout.addWidget(remove_btn)


class BulkEditor(QWidget):
    """批量编辑器"""
    
    def __init__(self, main_window, parent=None):
        super().__init__(parent)
        self.main_window = main_window
        self.edits = []
        
        self.setup_ui()
    
    def setup_ui(self):
        """设置UI"""
        self.setStyleSheet("""
            QWidget {
                background-color: #ffffff;
            }
            QTableWidget {
                border: 1px solid #e0e0e0;
                background-color: #ffffff;
                font-size: 12px;
            }
            QTableWidget::item {
                padding: 4px;
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
        """)
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # 工具栏
        toolbar = QWidget()
        toolbar.setStyleSheet("background-color: #f8f8f8; border-bottom: 1px solid #e0e0e0; padding: 4px;")
        toolbar_layout = QHBoxLayout(toolbar)
        toolbar_layout.setContentsMargins(4, 4, 4, 4)
        
        add_btn = QPushButton("+ 添加修改")
        add_btn.clicked.connect(self.add_edit_row)
        toolbar_layout.addWidget(add_btn)
        
        remove_btn = QPushButton("- 移除选中")
        remove_btn.clicked.connect(self.remove_selected)
        toolbar_layout.addWidget(remove_btn)
        
        toolbar_layout.addStretch()
        
        apply_btn = QPushButton("应用修改")
        apply_btn.setObjectName("primary")
        apply_btn.clicked.connect(self.apply_bulk_edit)
        toolbar_layout.addWidget(apply_btn)
        
        rollback_btn = QPushButton("撤销全部")
        rollback_btn.clicked.connect(self.rollback_all)
        toolbar_layout.addWidget(rollback_btn)
        
        layout.addWidget(toolbar)
        
        # 编辑表格
        self.edit_table = QTableWidget()
        self.edit_table.setColumnCount(5)
        self.edit_table.setHorizontalHeaderLabels(["表名", "条件列", "条件值", "修改列", "新值"])
        self.edit_table.horizontalHeader().setStretchLastSection(True)
        self.edit_table.setColumnWidth(0, 150)
        self.edit_table.setColumnWidth(1, 120)
        self.edit_table.setColumnWidth(2, 150)
        self.edit_table.setColumnWidth(3, 120)
        self.edit_table.setColumnWidth(4, 150)
        layout.addWidget(self.edit_table, 1)
        
        # 预览区域
        preview_label = QLabel("SQL预览:")
        preview_label.setStyleSheet("padding: 4px 8px; font-weight: bold;")
        layout.addWidget(preview_label)
        
        self.sql_preview = QLineEdit()
        self.sql_preview.setReadOnly(True)
        self.sql_preview.setStyleSheet("""
            background-color: #f5f5f5;
            border: 1px solid #e0e0e0;
            padding: 6px;
            font-family: 'Consolas', monospace;
        """)
        layout.addWidget(self.sql_preview)
    
    def add_edit_row(self, table_name="", column="", value="", set_column="", set_value=""):
        """添加编辑行"""
        row = self.edit_table.rowCount()
        self.edit_table.insertRow(row)
        
        self.edit_table.setCellWidget(row, 0, self._create_combo_box([""], table_name))
        self.edit_table.setCellWidget(row, 1, self._create_combo_box(["id", "name", "status"], column))
        
        value_item = QTableWidgetItem(value)
        self.edit_table.setItem(row, 2, value_item)
        
        self.edit_table.setCellWidget(row, 3, self._create_combo_box(["status", "name", "value"], set_column))
        
        set_value_item = QTableWidgetItem(set_value)
        self.edit_table.setItem(row, 4, set_value_item)
    
    def _create_combo_box(self, items, current=""):
        """创建下拉框"""
        combo = QComboBox()
        combo.addItems(items if items else ["-- 选择 --"])
        if current:
            combo.setCurrentText(current)
        return combo
    
    def remove_selected(self):
        """移除选中的行"""
        rows = sorted(set(index.row() for index in self.edit_table.selectedIndexes()), reverse=True)
        for row in rows:
            self.edit_table.removeRow(row)
    
    def rollback_all(self):
        """撤销所有编辑"""
        self.edit_table.setRowCount(0)
        self.sql_preview.clear()
    
    def apply_bulk_edit(self):
        """应用批量编辑"""
        sql_statements = []
        
        for row in range(self.edit_table.rowCount()):
            table_widget = self.edit_table.cellWidget(row, 0)
            condition_col_widget = self.edit_table.cellWidget(row, 1)
            condition_value = self.edit_table.item(row, 2).text() if self.edit_table.item(row, 2) else ""
            set_col_widget = self.edit_table.cellWidget(row, 3)
            set_value = self.edit_table.item(row, 4).text() if self.edit_table.item(row, 4) else ""
            
            table_name = table_widget.currentText() if table_widget else ""
            condition_col = condition_col_widget.currentText() if condition_col_widget else ""
            set_col = set_col_widget.currentText() if set_col_widget else ""
            
            if table_name and condition_col and set_col and condition_value and set_value:
                sql = f"UPDATE `{table_name}` SET `{set_col}` = '{set_value}' WHERE `{condition_col}` = '{condition_value}'"
                sql_statements.append(sql)
        
        if sql_statements:
            full_sql = ";\n".join(sql_statements)
            self.sql_preview.setText(full_sql)
            
            from PyQt6.QtWidgets import QMessageBox
            reply = QMessageBox.question(
                self, "确认执行",
                f"确定要执行以下 {len(sql_statements)} 条UPDATE语句吗？\n\n{full_sql}",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            
            if reply == QMessageBox.StandardButton.Yes:
                self._execute_sql(full_sql)
    
    def _execute_sql(self, sql):
        """执行SQL"""
        try:
            self.main_window.table_operations._ensure_database_context()
            
            statements = sql.split(';')
            success_count = 0
            error_count = 0
            
            with self.main_window.db_connection.cursor() as cursor:
                for statement in statements:
                    if statement.strip():
                        try:
                            cursor.execute(statement)
                            success_count += 1
                        except Exception as e:
                            error_count += 1
            
            self.main_window.db_connection.commit()
            
            from PyQt6.QtWidgets import QMessageBox
            QMessageBox.information(
                self, "执行完成",
                f"成功: {success_count} 条\n失败: {error_count} 条"
            )
            
            self.rollback_all()
            
        except Exception as e:
            from PyQt6.QtWidgets import QMessageBox
            QMessageBox.critical(self, "执行失败", f"执行SQL时出错:\n{str(e)}")
