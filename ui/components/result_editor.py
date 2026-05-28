#!/usr/bin/env python3
"""
结果集编辑器组件 - 支持内联编辑和分页
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QLabel, QLineEdit, QComboBox, QSpinBox, QCheckBox,
    QHeaderView, QAbstractItemView, QMenu, QMessageBox, QProgressDialog
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtGui import QColor, QFont, QCursor
from PyQt6.QtWidgets import QApplication

class EditableTableWidget(QTableWidget):
    """可编辑的结果表格"""
    
    # 修改信号
    cell_modified = pyqtSignal(int, int, object, object)  # row, col, old_value, new_value
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.set_edit_triggers(QTableWidget.EditTrigger.DoubleClicked | QTableWidget.EditTrigger.EditKeyPressed)
        self.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)
        self.setAlternatingRowColors(True)
        self.setShowGrid(True)
        self.setGridStyle(Qt.PenStyle.DotLine)
        
        # 原始数据缓存（用于检测修改）
        self._original_data = {}
        self._modified_cells = {}  # {(row, col): (old_value, new_value)}
        self._is_editing = False
        
        # NULL值标记样式
        self._null_color = QColor('#E8E8E8')
        self._modified_color = QColor('#FFF9C4')  # 浅黄色标记修改
        self._blob_color = QColor('#F5F5F5')
    
    def set_data(self, data, columns, primary_keys=None):
        """设置表格数据
        
        Args:
            data: 数据列表
            columns: 列名列表
            primary_keys: 主键列名列表（用于UPDATE）
        """
        self._original_data.clear()
        self._modified_cells.clear()
        self.primary_keys = primary_keys or []
        
        self.setRowCount(len(data))
        self.setColumnCount(len(columns))
        self.setHorizontalHeaderLabels(columns)
        
        # 设置列宽自适应
        header = self.horizontalHeader()
        header.setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
        header.setStretchLastSection(True)
        
        # 填充数据
        for row_idx, row_data in enumerate(data):
            row_values = list(row_data.values()) if isinstance(row_data, dict) else row_data
            
            for col_idx, value in enumerate(row_values):
                # 缓存原始值
                cell_key = (row_idx, col_idx)
                self._original_data[cell_key] = value
                
                # 创建单元格
                item = QTableWidgetItem()
                
                # 处理NULL值
                if value is None:
                    item.setData(Qt.ItemDataRole.DisplayRole, "<NULL>")
                    item.setForeground(QColor('#999999'))
                    item.setBackground(self._null_color)
                    item.setFont(QFont("Segoe UI", 11, QFont.Weight.Light))
                # 处理BLOB/BINARY数据
                elif isinstance(value, (bytes, bytearray)):
                    item.setData(Qt.ItemDataRole.DisplayRole, f"<BLOB: {len(value)} bytes>")
                    item.setBackground(self._blob_color)
                    item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
                # 处理长文本
                elif isinstance(value, str) and len(value) > 1000:
                    item.setData(Qt.ItemDataRole.DisplayRole, value[:1000] + "...")
                    item.setToolTip(value)
                else:
                    item.setData(Qt.ItemDataRole.DisplayRole, str(value))
                
                self.setItem(row_idx, col_idx, item)
        
        self.resizeColumnsToContents()
    
    def set_cell_value(self, row, col, value):
        """设置单元格值（用于编辑后更新）"""
        item = self.item(row, col)
        if item:
            # 记录修改
            old_value = self._original_data.get((row, col))
            self._modified_cells[(row, col)] = (old_value, value)
            
            # 更新显示
            if value is None:
                item.setData(Qt.ItemDataRole.DisplayRole, "<NULL>")
                item.setForeground(QColor('#999999'))
                item.setBackground(self._null_color)
            else:
                item.setData(Qt.ItemDataRole.DisplayRole, str(value))
                item.setBackground(self._modified_color)
            
            # 标记为已修改
            item.setData(Qt.ItemDataRole.UserRole, True)
    
    def get_modified_cells(self):
        """获取所有修改的单元格"""
        return self._modified_cells.copy()
    
    def is_modified(self):
        """检查是否有修改"""
        return len(self._modified_cells) > 0
    
    def get_original_value(self, row, col):
        """获取原始值"""
        return self._original_data.get((row, col))
    
    def revert_cell(self, row, col):
        """撤销单元格修改"""
        if (row, col) in self._modified_cells:
            old_value, _ = self._modified_cells.pop((row, col))
            
            item = self.item(row, col)
            if item:
                if old_value is None:
                    item.setData(Qt.ItemDataRole.DisplayRole, "<NULL>")
                    item.setForeground(QColor('#999999'))
                    item.setBackground(self._null_color)
                else:
                    item.setData(Qt.ItemDataRole.DisplayRole, str(old_value))
                    item.setBackground(QColor('#FFFFFF'))
                item.setData(Qt.ItemDataRole.UserRole, False)
    
    def revert_all(self):
        """撤销所有修改"""
        for (row, col) in list(self._modified_cells.keys()):
            self.revert_cell(row, col)
    
    def get_column_index(self, column_name):
        """根据列名获取列索引"""
        for col in range(self.columnCount()):
            header_item = self.horizontalHeaderItem(col)
            if header_item and header_item.text() == column_name:
                return col
        return -1


class ResultSetEditor(QWidget):
    """结果集编辑器 - 支持分页和内联编辑"""
    
    def __init__(self, main_window, table_name=None):
        super().__init__(main_window)
        self.main_window = main_window
        self.table_name = table_name
        self.logger = main_window.logger
        
        # 分页参数
        self.current_page = 1
        self.page_size = 1000
        self.total_rows = 0
        self.total_pages = 1
        self.current_data = []
        self.current_columns = []
        self.primary_keys = []
        
        # 是否有where子句的原始查询
        self.original_sql = ""
        
        self.setup_ui()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        
        # 顶部工具栏
        toolbar = QWidget()
        toolbar.setStyleSheet("""
            QWidget {
                background-color: #f8f8f8;
                border-bottom: 1px solid #e0e0e0;
                padding: 4px 8px;
            }
        """)
        toolbar_layout = QHBoxLayout(toolbar)
        toolbar_layout.setContentsMargins(4, 4, 4, 4)
        
        # 修改状态标签
        self.modified_label = QLabel("")
        self.modified_label.setStyleSheet("color: #FF9800; font-weight: bold;")
        toolbar_layout.addWidget(self.modified_label)
        
        toolbar_layout.addStretch()
        
        # 分页控制
        self.first_btn = QPushButton("<<")
        self.first_btn.setMaximumWidth(40)
        self.first_btn.clicked.connect(self.go_to_first_page)
        toolbar_layout.addWidget(self.first_btn)
        
        self.prev_btn = QPushButton("<")
        self.prev_btn.setMaximumWidth(30)
        self.prev_btn.clicked.connect(self.go_to_prev_page)
        toolbar_layout.addWidget(self.prev_btn)
        
        self.page_label = QLabel("第 1 / 1 页")
        self.page_label.setStyleSheet("padding: 0 8px;")
        toolbar_layout.addWidget(self.page_label)
        
        self.next_btn = QPushButton(">")
        self.next_btn.setMaximumWidth(30)
        self.next_btn.clicked.connect(self.go_to_next_page)
        toolbar_layout.addWidget(self.next_btn)
        
        self.last_btn = QPushButton(">>")
        self.last_btn.setMaximumWidth(40)
        self.last_btn.clicked.connect(self.go_to_last_page)
        toolbar_layout.addWidget(self.last_btn)
        
        # 跳转到页
        self.goto_page_input = QSpinBox()
        self.goto_page_input.setMinimum(1)
        self.goto_page_input.setMaximum(1)
        self.goto_page_input.setMaximumWidth(60)
        self.goto_page_input.valueChanged.connect(self.go_to_page)
        toolbar_layout.addWidget(QLabel("跳转到:"))
        toolbar_layout.addWidget(self.goto_page_input)
        
        # 每页显示数量
        self.page_size_combo = QComboBox()
        self.page_size_combo.addItems(["100", "500", "1000", "2000", "5000"])
        self.page_size_combo.setCurrentText(str(self.page_size))
        self.page_size_combo.currentTextChanged.connect(self.on_page_size_changed)
        toolbar_layout.addWidget(QLabel("每页:"))
        toolbar_layout.addWidget(self.page_size_combo)
        
        # 记录总数
        self.total_label = QLabel("共 0 条记录")
        toolbar_layout.addWidget(self.total_label)
        
        layout.addWidget(toolbar)
        
        # 数据表格
        self.table = EditableTableWidget()
        self.table.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.table.customContextMenuRequested.connect(self.show_context_menu)
        self.table.cellChanged.connect(self.on_cell_changed)
        layout.addWidget(self.table, 1)
        
        # 底部工具栏
        bottom_toolbar = QWidget()
        bottom_toolbar.setStyleSheet("""
            QWidget {
                background-color: #f8f8f8;
                border-top: 1px solid #e0e0e0;
                padding: 4px 8px;
            }
        """)
        bottom_layout = QHBoxLayout(bottom_toolbar)
        bottom_layout.setContentsMargins(4, 4, 4, 4)
        
        # 刷新按钮
        refresh_btn = QPushButton("刷新")
        refresh_btn.clicked.connect(self.refresh_data)
        bottom_layout.addWidget(refresh_btn)
        
        # 导出按钮
        export_btn = QPushButton("导出")
        export_btn.clicked.connect(self.export_data)
        bottom_layout.addWidget(export_btn)
        
        bottom_layout.addStretch()
        
        # 编辑操作
        self.revert_btn = QPushButton("撤销修改")
        self.revert_btn.setEnabled(False)
        self.revert_btn.clicked.connect(self.revert_changes)
        bottom_layout.addWidget(self.revert_btn)
        
        self.commit_btn = QPushButton("提交更改")
        self.commit_btn.setEnabled(False)
        self.commit_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                border: none;
                padding: 6px 16px;
                border-radius: 3px;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
            QPushButton:disabled {
                background-color: #cccccc;
                color: #666666;
            }
        """)
        self.commit_btn.clicked.connect(self.commit_changes)
        bottom_layout.addWidget(self.commit_btn)
        
        layout.addWidget(bottom_toolbar)
    
    def set_data(self, data, columns, total_count=None, primary_keys=None):
        """设置数据"""
        self.current_data = data
        self.current_columns = columns
        self.primary_keys = primary_keys or []
        
        if total_count is not None:
            self.total_rows = total_count
            self.calculate_pagination()
        
        self.table.set_data(data, columns, primary_keys)
        self.update_pagination_ui()
    
    def calculate_pagination(self):
        """计算分页信息"""
        if self.page_size > 0:
            self.total_pages = max(1, (self.total_rows + self.page_size - 1) // self.page_size)
        else:
            self.total_pages = 1
        
        self.current_page = min(self.current_page, self.total_pages)
    
    def update_pagination_ui(self):
        """更新分页UI"""
        self.page_label.setText(f"第 {self.current_page} / {self.total_pages} 页")
        self.total_label.setText(f"共 {self.total_rows:,} 条记录")
        
        self.goto_page_input.setMaximum(max(1, self.total_pages))
        self.goto_page_input.setValue(self.current_page)
        
        # 更新按钮状态
        self.first_btn.setEnabled(self.current_page > 1)
        self.prev_btn.setEnabled(self.current_page > 1)
        self.next_btn.setEnabled(self.current_page < self.total_pages)
        self.last_btn.setEnabled(self.current_page < self.total_pages)
    
    def go_to_first_page(self):
        """跳转到第一页"""
        if self.current_page > 1:
            self.current_page = 1
            self.load_page_data()
    
    def go_to_prev_page(self):
        """跳转到上一页"""
        if self.current_page > 1:
            self.current_page -= 1
            self.load_page_data()
    
    def go_to_next_page(self):
        """跳转到下一页"""
        if self.current_page < self.total_pages:
            self.current_page += 1
            self.load_page_data()
    
    def go_to_last_page(self):
        """跳转到最后一页"""
        if self.current_page < self.total_pages:
            self.current_page = self.total_pages
            self.load_page_data()
    
    def go_to_page(self, page):
        """跳转到指定页"""
        if 1 <= page <= self.total_pages and page != self.current_page:
            self.current_page = page
            self.load_page_data()
    
    def on_page_size_changed(self, size):
        """每页数量变化"""
        try:
            new_size = int(size)
            if new_size != self.page_size and new_size > 0:
                self.page_size = new_size
                self.current_page = 1
                self.load_page_data()
        except ValueError:
            pass
    
    def load_page_data(self):
        """加载当前页数据（需要子类实现或外部调用）"""
        self.update_pagination_ui()
    
    def on_cell_changed(self, row, col):
        """单元格修改事件"""
        item = self.table.item(row, col)
        if item and not self.table._is_editing:
            new_value = item.data(Qt.ItemDataRole.DisplayRole)
            old_value = self.table.get_original_value(row, col)
            
            # 检查是否有变化
            old_str = str(old_value) if old_value is not None else "<NULL>"
            if new_value != old_str:
                self.table.set_cell_value(row, col, new_value)
                self.update_modified_state()
    
    def update_modified_state(self):
        """更新修改状态"""
        modified = self.table.is_modified()
        count = len(self.table.get_modified_cells())
        
        if modified:
            self.modified_label.setText(f"⚠️ 已修改 {count} 个单元格")
            self.revert_btn.setEnabled(True)
            self.commit_btn.setEnabled(True)
        else:
            self.modified_label.setText("")
            self.revert_btn.setEnabled(False)
            self.commit_btn.setEnabled(False)
    
    def revert_changes(self):
        """撤销所有修改"""
        if QMessageBox.question(self, "撤销修改", "确定要撤销所有未提交的修改吗？",
                              QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes:
            self.table.revert_all()
            self.update_modified_state()
    
    def commit_changes(self):
        """提交修改到数据库"""
        modified_cells = self.table.get_modified_cells()
        if not modified_cells:
            return
        
        if not self.table_name:
            QMessageBox.warning(self, "提交失败", "无法确定目标表名")
            return
        
        try:
            # 构建UPDATE语句
            updates = []
            for (row, col), (old_value, new_value) in modified_cells.items():
                col_name = self.current_columns[col]
                old_str = "NULL" if old_value is None else f"'{str(old_value).replace("'", "''")}'"
                new_str = "NULL" if new_value == "<NULL>" or new_value is None else f"'{str(new_value).replace("'", "''")}'"
                updates.append((col_name, old_str, new_str, row))
            
            # 执行更新
            for col_name, old_str, new_str, row in updates:
                sql = f"UPDATE `{self.table_name}` SET `{col_name}` = {new_str} WHERE `{self.primary_keys[0]}` = {self.table.item(row, 0).text()}"
                
                with self.main_window.db_connection.cursor() as cursor:
                    cursor.execute(sql)
            
            self.main_window.db_connection.commit()
            
            QMessageBox.information(self, "提交成功", f"成功更新 {len(modified_cells)} 条记录")
            self.logger.log('INFO', f"更新表数据: {len(modified_cells)} 条")
            
            # 刷新数据
            self.refresh_data()
            
        except Exception as e:
            self.main_window.db_connection.rollback()
            QMessageBox.critical(self, "提交失败", f"更新数据时出错:\n{str(e)}")
            self.logger.log('ERROR', f"更新数据失败: {str(e)}")
    
    def refresh_data(self):
        """刷新数据"""
        if hasattr(self.main_window, 'table_operations'):
            self.main_window.table_operations.open_table(self.table_name)
    
    def export_data(self):
        """导出数据"""
        self.main_window.event_handler.export_data()
    
    def show_context_menu(self, pos):
        """显示右键菜单"""
        menu = QMenu()
        
        # 获取选中的行
        selected_rows = self.table.selectionModel().selectedRows()
        has_selection = len(selected_rows) > 0
        
        # 复制操作
        copy_menu = menu.addMenu("复制")
        copy_menu.addAction("复制当前单元格", self.copy_cell)
        copy_menu.addAction("复制选中行", self.copy_selected_rows)
        copy_menu.addAction("复制所有行", self.copy_all_rows)
        menu.addSeparator()
        
        # 编辑操作
        if has_selection:
            edit_menu = menu.addMenu("编辑")
            edit_menu.addAction("撤销修改", self.revert_changes)
            edit_menu.addAction("设为NULL", self.set_null)
            edit_menu.addAction("恢复原值", self.revert_selected)
        menu.addSeparator()
        
        # 视图操作
        view_menu = menu.addMenu("视图")
        view_menu.addAction("调整列宽", self.table.resizeColumnsToContents)
        view_menu.addAction("隐藏列...", self.hide_columns)
        view_menu.addAction("显示所有列", self.show_all_columns)
        menu.addSeparator()
        
        # 刷新
        menu.addAction("刷新", self.refresh_data)
        
        menu.exec(self.table.mapToGlobal(pos))
    
    def copy_cell(self):
        """复制当前单元格"""
        current_item = self.table.currentItem()
        if current_item:
            clipboard = QApplication.clipboard()
            clipboard.setText(current_item.text())
    
    def copy_selected_rows(self):
        """复制选中行"""
        selected_rows = self.table.selectionModel().selectedRows()
        if selected_rows:
            data = []
            # 添加表头
            headers = [self.table.horizontalHeaderItem(c).text() for c in range(self.table.columnCount())]
            data.append('\t'.join(headers))
            
            # 添加数据
            for row_model in selected_rows:
                row_data = []
                for col in range(self.table.columnCount()):
                    item = self.table.item(row_model.row(), col)
                    row_data.append(item.text() if item else '')
                data.append('\t'.join(row_data))
            
            clipboard = QApplication.clipboard()
            clipboard.setText('\n'.join(data))
    
    def copy_all_rows(self):
        """复制所有行"""
        data = []
        headers = [self.table.horizontalHeaderItem(c).text() for c in range(self.table.columnCount())]
        data.append('\t'.join(headers))
        
        for row in range(self.table.rowCount()):
            row_data = []
            for col in range(self.table.columnCount()):
                item = self.table.item(row, col)
                row_data.append(item.text() if item else '')
            data.append('\t'.join(row_data))
        
        clipboard = QApplication.clipboard()
        clipboard.setText('\n'.join(data))
    
    def set_null(self):
        """将选中单元格设为NULL"""
        current_row = self.table.currentRow()
        current_col = self.table.currentColumn()
        
        if current_row >= 0 and current_col >= 0:
            self.table.set_cell_value(current_row, current_col, "<NULL>")
            self.update_modified_state()
    
    def revert_selected(self):
        """恢复选中单元格的原值"""
        for row in range(self.table.rowCount()):
            for col in range(self.table.columnCount()):
                item = self.table.item(row, col)
                if item and item.isSelected():
                    self.table.revert_cell(row, col)
        self.update_modified_state()
    
    def hide_columns(self):
        """隐藏列对话框"""
        from PyQt6.QtWidgets import QDialog, QVBoxLayout, QListWidget, QPushButton
        
        dialog = QDialog(self)
        dialog.setWindowTitle("隐藏列")
        dialog.setGeometry(300, 200, 300, 400)
        
        layout = QVBoxLayout(dialog)
        list_widget = QListWidget()
        
        for col in range(self.table.columnCount()):
            header_item = self.table.horizontalHeaderItem(col)
            list_widget.addItem(header_item.text() if header_item else f"列{col+1}")
        
        layout.addWidget(list_widget)
        
        btn_layout = QHBoxLayout()
        hide_btn = QPushButton("隐藏选中")
        hide_btn.clicked.connect(lambda: [self.table.setColumnHidden(list_widget.row(item), True) for item in list_widget.selectedItems()])
        show_btn = QPushButton("显示所有")
        show_btn.clicked.connect(self.show_all_columns)
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(dialog.accept)
        
        btn_layout.addWidget(hide_btn)
        btn_layout.addWidget(show_btn)
        btn_layout.addWidget(close_btn)
        layout.addLayout(btn_layout)
        
        dialog.exec()
    
    def show_all_columns(self):
        """显示所有列"""
        for col in range(self.table.columnCount()):
            self.table.setColumnHidden(col, False)
