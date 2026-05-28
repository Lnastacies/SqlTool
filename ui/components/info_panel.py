#!/usr/bin/env python3
"""
右侧信息面板模块
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QTabWidget, QFormLayout, QLabel, QLineEdit, QTextEdit,
    QTableWidget, QTableWidgetItem, QScrollArea
)
from PyQt6.QtCore import Qt
from datetime import datetime

class InfoPanel(QWidget):
    """
    右侧信息面板类，包含常规、字段、索引、外键、DDL标签页
    """
    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.logger = main_window.logger
        
        self.setup_ui()
    
    def setup_ui(self):
        """
        设置右侧信息面板UI
        """
        # 主布局
        main_layout = QVBoxLayout(self)
        
        # 标签页
        self.tabs = QTabWidget()
        self.tabs.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #E0E0E0;
                background-color: #FFFFFF;
            }
            QTabBar::tab {
                padding: 8px 16px;
                font-size: 12px;
                font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
                background-color: #F8F9FA;
                border: none;
                border-bottom: 2px solid transparent;
                margin-right: 2px;
                height: 32px;
            }
            QTabBar::tab:selected {
                background-color: #FFFFFF;
                border-bottom: 2px solid #007ACC;
                font-weight: normal;
            }
            QTabBar::tab:hover {
                background-color: #E3F2FD;
            }
        """)
        
        # 常规标签页
        general_tab = QWidget()
        general_layout = QFormLayout(general_tab)
        general_layout.setSpacing(8)
        general_layout.setContentsMargins(12, 12, 12, 12)
        general_layout.setLabelAlignment(Qt.AlignmentFlag.AlignLeft)
        
        # 设置标签宽度
        general_layout.setFieldGrowthPolicy(QFormLayout.FieldGrowthPolicy.ExpandingFieldsGrow)
        
        self.name_label = QLabel("名称:")
        self.name_label.setFixedWidth(80)
        self.name_value = QLineEdit()
        self.name_value.setReadOnly(True)
        self.name_value.setStyleSheet("height: 28px; padding: 4px 8px; font-size: 12px; font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;")
        general_layout.addRow(self.name_label, self.name_value)
        
        self.type_label = QLabel("类型:")
        self.type_label.setFixedWidth(80)
        self.type_value = QLineEdit()
        self.type_value.setReadOnly(True)
        self.type_value.setStyleSheet("height: 28px; padding: 4px 8px; font-size: 12px; font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;")
        general_layout.addRow(self.type_label, self.type_value)
        
        self.created_label = QLabel("创建时间:")
        self.created_label.setFixedWidth(80)
        self.created_value = QLineEdit()
        self.created_value.setReadOnly(True)
        self.created_value.setStyleSheet("height: 28px; padding: 4px 8px; font-size: 12px; font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;")
        general_layout.addRow(self.created_label, self.created_value)
        
        self.updated_label = QLabel("更新时间:")
        self.updated_label.setFixedWidth(80)
        self.updated_value = QLineEdit()
        self.updated_value.setReadOnly(True)
        self.updated_value.setStyleSheet("height: 28px; padding: 4px 8px; font-size: 12px; font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;")
        general_layout.addRow(self.updated_label, self.updated_value)
        
        self.tabs.addTab(general_tab, "常规")
        
        # 字段标签页
        fields_tab = QWidget()
        fields_layout = QVBoxLayout(fields_tab)
        
        self.fields_table = QTableWidget()
        self.fields_table.setColumnCount(7)
        self.fields_table.setHorizontalHeaderLabels(["字段名", "类型", "长度", "主键", "非空", "默认值", "注释"])
        self.fields_table.setSortingEnabled(True)
        fields_layout.addWidget(self.fields_table)
        
        self.tabs.addTab(fields_tab, "字段")
        
        # 索引标签页
        indexes_tab = QWidget()
        indexes_layout = QVBoxLayout(indexes_tab)
        
        self.indexes_table = QTableWidget()
        self.indexes_table.setColumnCount(4)
        self.indexes_table.setHorizontalHeaderLabels(["索引名", "类型", "字段", "唯一"])
        self.indexes_table.setSortingEnabled(True)
        indexes_layout.addWidget(self.indexes_table)
        
        self.tabs.addTab(indexes_tab, "索引")
        
        # 外键标签页
        foreign_keys_tab = QWidget()
        foreign_keys_layout = QVBoxLayout(foreign_keys_tab)
        
        self.foreign_keys_table = QTableWidget()
        self.foreign_keys_table.setColumnCount(4)
        self.foreign_keys_table.setHorizontalHeaderLabels(["外键名", "字段", "引用表", "引用字段"])
        self.foreign_keys_table.setSortingEnabled(True)
        foreign_keys_layout.addWidget(self.foreign_keys_table)
        
        self.tabs.addTab(foreign_keys_tab, "外键")
        
        # DDL标签页
        ddl_tab = QWidget()
        ddl_layout = QVBoxLayout(ddl_tab)
        
        self.ddl_text = QTextEdit()
        self.ddl_text.setReadOnly(True)
        ddl_layout.addWidget(self.ddl_text)
        
        self.tabs.addTab(ddl_tab, "DDL")
        
        main_layout.addWidget(self.tabs)
    
    def show_object_details(self, item_type, item_name):
        """
        显示对象详情
        """
        from core.database_operations import DatabaseOperations
        
        if not self.main_window.state_manager.db_connection:
            return
        
        try:
            # 获取对象详情
            if item_type == 'table':
                db_ops = DatabaseOperations(
                    self.main_window.state_manager.db_connection,
                    self.main_window.state_manager.current_db_type
                )
                object_info = db_ops.get_table_info(item_name)
                self.update_info('表', item_name, object_info)
            elif item_type == 'view':
                # 视图详情
                object_info = {'fields': [], 'indexes': [], 'foreign_keys': [], 'ddl': ''}
                self.update_info('视图', item_name, object_info)
            elif item_type == 'procedure':
                object_info = {'fields': [], 'indexes': [], 'foreign_keys': [], 'ddl': ''}
                self.update_info('存储过程', item_name, object_info)
            elif item_type == 'function':
                object_info = {'fields': [], 'indexes': [], 'foreign_keys': [], 'ddl': ''}
                self.update_info('函数', item_name, object_info)
            elif item_type == 'trigger':
                object_info = {'fields': [], 'indexes': [], 'foreign_keys': [], 'ddl': ''}
                self.update_info('触发器', item_name, object_info)
            elif item_type == 'database':
                object_info = {'fields': [], 'indexes': [], 'foreign_keys': [], 'ddl': ''}
                self.update_info('数据库', item_name, object_info)
            else:
                object_info = {'fields': [], 'indexes': [], 'foreign_keys': [], 'ddl': ''}
                self.update_info(item_type, item_name, object_info)
        except Exception as e:
            self.logger.log('ERROR', f"获取对象详情失败: {str(e)}")
    
    def update_info(self, object_type, object_name, object_info):
        """
        更新信息面板内容
        """
        # 更新常规标签页
        self.name_value.setText(object_name)
        self.type_value.setText(object_type)
        
        created_val = object_info.get('created', '')
        if isinstance(created_val, datetime):
            created_val = created_val.strftime('%Y-%m-%d %H:%M:%S')
        self.created_value.setText(str(created_val) if created_val else '')
        
        updated_val = object_info.get('updated', '')
        if isinstance(updated_val, datetime):
            updated_val = updated_val.strftime('%Y-%m-%d %H:%M:%S')
        self.updated_value.setText(str(updated_val) if updated_val else '')
        
        # 更新字段标签页
        self.fields_table.setRowCount(0)
        fields = object_info.get('fields', [])
        for field in fields:
            row_position = self.fields_table.rowCount()
            self.fields_table.insertRow(row_position)
            self.fields_table.setItem(row_position, 0, QTableWidgetItem(field.get('name', '')))
            self.fields_table.setItem(row_position, 1, QTableWidgetItem(field.get('type', '')))
            self.fields_table.setItem(row_position, 2, QTableWidgetItem(str(field.get('length', '')) if field.get('length') else ''))
            self.fields_table.setItem(row_position, 3, QTableWidgetItem('✓' if field.get('primary') else ''))
            self.fields_table.setItem(row_position, 4, QTableWidgetItem('✓' if field.get('not_null') else ''))
            self.fields_table.setItem(row_position, 5, QTableWidgetItem(str(field.get('default', '')) if field.get('default') is not None else ''))
            self.fields_table.setItem(row_position, 6, QTableWidgetItem(field.get('comment', '')))
        
        # 更新索引标签页
        self.indexes_table.setRowCount(0)
        indexes = object_info.get('indexes', [])
        for index in indexes:
            row_position = self.indexes_table.rowCount()
            self.indexes_table.insertRow(row_position)
            self.indexes_table.setItem(row_position, 0, QTableWidgetItem(index.get('name', '')))
            self.indexes_table.setItem(row_position, 1, QTableWidgetItem(index.get('type', '')))
            self.indexes_table.setItem(row_position, 2, QTableWidgetItem(', '.join(index.get('fields', [])) if index.get('fields') else ''))
            self.indexes_table.setItem(row_position, 3, QTableWidgetItem('✓' if index.get('unique') else ''))
        
        # 更新外键标签页
        self.foreign_keys_table.setRowCount(0)
        foreign_keys = object_info.get('foreign_keys', [])
        for fk in foreign_keys:
            row_position = self.foreign_keys_table.rowCount()
            self.foreign_keys_table.insertRow(row_position)
            self.foreign_keys_table.setItem(row_position, 0, QTableWidgetItem(fk.get('name', '')))
            self.foreign_keys_table.setItem(row_position, 1, QTableWidgetItem(', '.join(fk.get('fields', [])) if fk.get('fields') else ''))
            self.foreign_keys_table.setItem(row_position, 2, QTableWidgetItem(fk.get('referenced_table', '')))
            self.foreign_keys_table.setItem(row_position, 3, QTableWidgetItem(', '.join(fk.get('referenced_fields', [])) if fk.get('referenced_fields') else ''))
        
        # 更新DDL标签页
        self.ddl_text.setText(object_info.get('ddl', ''))
