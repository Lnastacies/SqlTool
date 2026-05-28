#!/usr/bin/env python3

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QToolBar, QSplitter, QWidget, QLabel, QComboBox,
    QLineEdit, QCheckBox, QTabWidget, QTextEdit, QGroupBox, QInputDialog, QMessageBox,
    QAbstractItemView, QHeaderView, QSpacerItem, QSizePolicy, QFrame, QGridLayout
)
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QAction, QFont, QColor, QPainter, QIcon, QPixmap

class TableDesigner(QDialog):
    def __init__(self, main_window, table_name=None):
        super().__init__(main_window)
        self.main_window = main_window
        self.table_name = table_name
        self.logger = main_window.logger
        self.column_data = []

        self.setWindowTitle(f"设计表: {table_name}" if table_name else "新建表")
        self.setGeometry(100, 100, 1200, 700)
        self.setMinimumSize(1100, 600)
        self.setStyleSheet(self._get_dialog_style())

        self.setup_ui()

    def _get_dialog_style(self):
        return """
            QDialog {
                background-color: #f0f0f0;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
                font-size: 12px;
            }
            QToolBar {
                background-color: #f8f8f8;
                border: none;
                border-bottom: 1px solid #d0d0d0;
                padding: 2px 4px;
                spacing: 2px;
            }
            QToolBar QToolButton {
                padding: 4px 10px;
                border: 1px solid transparent;
                border-radius: 3px;
                color: #333333;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
                background-color: transparent;
            }
            QToolBar QToolButton:hover {
                background-color: #e0e0e0;
                border: 1px solid #c0c0c0;
            }
            QToolBar QToolButton:pressed {
                background-color: #d0d0d0;
                border: 1px solid #b0b0b0;
            }
            QToolBar QToolButton[separator="true"] {
                border: none;
                background: transparent;
            }
            QTableWidget {
                background-color: #ffffff;
                alternate-background-color: #f5f7fa;
                color: #333333;
                border: 1px solid #d0d0d0;
                gridline-color: #e8e8e8;
                font-size: 12px;
                selection-background-color: #e3f2fd;
                selection-color: #1a73e8;
            }
            QTableWidget::item {
                padding: 3px 6px;
                border-right: 1px solid #e8e8e8;
                border-bottom: 1px solid #e8e8e8;
            }
            QTableWidget::item:selected {
                background-color: #e3f2fd;
                color: #1a73e8;
            }
            QTableWidget::item:hover {
                background-color: #f0f7ff;
            }
            QHeaderView::section {
                background-color: #f8f8f8;
                color: #444444;
                padding: 6px 8px;
                border: none;
                border-right: 1px solid #e0e0e0;
                border-bottom: 2px solid #1a73e8;
                font-weight: 600;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
                letter-spacing: 0.3px;
            }
            QHeaderView::section:hover {
                background-color: #f0f0f0;
            }
            QTabWidget::pane {
                background-color: #ffffff;
                border: 1px solid #d0d0d0;
                border-top: none;
            }
            QTabBar::tab {
                background-color: #e8e8e8;
                color: #666666;
                padding: 6px 16px;
                border: 1px solid #d0d0d0;
                border-bottom: none;
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
                min-width: 80px;
            }
            QTabBar::tab:selected {
                background-color: #ffffff;
                color: #333333;
                border-bottom: 1px solid #ffffff;
            }
            QTabBar::tab:hover:!selected {
                background-color: #f0f0f0;
                color: #333333;
            }
            QTextEdit {
                background-color: #ffffff;
                color: #333333;
                border: 1px solid #d0d0d0;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 11px;
            }
            QGroupBox {
                font-size: 11px;
                color: #444444;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                margin-top: 8px;
                padding-top: 14px;
                font-family: 'Microsoft YaHei', Arial;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                subcontrol-position: top left;
                padding: 0 6px;
                color: #666666;
            }
            QComboBox {
                background-color: #ffffff;
                color: #333333;
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 3px 6px;
                font-size: 12px;
                min-height: 24px;
                max-height: 24px;
            }
            QComboBox:hover {
                border: 1px solid #1a73e8;
            }
            QComboBox:focus {
                border: 1px solid #1a73e8;
                outline: none;
            }
            QComboBox::drop-down {
                subcontrol-origin: padding;
                subcontrol-position: top right;
                width: 22px;
                height: 22px;
                border-left-width: 1px;
                border-left-color: #d0d0d0;
                border-left-style: solid;
                border-top-right-radius: 3px;
                border-bottom-right-radius: 3px;
                background-color: #f8f8f8;
            }
            QComboBox::drop-down:hover {
                background-color: #e8e8e8;
            }
            QComboBox::down-arrow {
                image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%23666666' d='M0 2 L4 6 L8 2'/%3E%3C/svg%3E");
                width: 8px;
                height: 8px;
            }
            QComboBox QAbstractItemView {
                background-color: #ffffff;
                color: #333333;
                selection-background-color: #e3f2fd;
                border: 1px solid #d0d0d0;
                outline: none;
                padding: 2px;
            }
            QComboBox QAbstractItemView::item {
                padding: 4px 8px;
                min-height: 24px;
            }
            QComboBox QAbstractItemView::item:hover {
                background-color: #f0f7ff;
            }
            QCheckBox {
                color: #444444;
                font-size: 11px;
                spacing: 6px;
            }
            QCheckBox::indicator {
                width: 15px;
                height: 15px;
                border: 1px solid #a0a0a0;
                border-radius: 3px;
                background-color: #ffffff;
            }
            QCheckBox::indicator:checked {
                background-color: #ffffff;
                border: 1px solid #1a73e8;
                image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231a73e8' d='M2 6L5 9l7-5' stroke='%231a73e8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
                image-position: center;
            }
            QCheckBox::indicator:hover {
                border: 1px solid #1a73e8;
            }
            QCheckBox::indicator:checked:hover {
                background-color: #f0f7ff;
            }
            QLineEdit {
                background-color: #ffffff;
                color: #333333;
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 4px 8px;
                font-size: 12px;
                min-height: 24px;
            }
            QLineEdit:focus {
                border: 1px solid #1a73e8;
                outline: none;
                background-color: #ffffff;
            }
            QLineEdit:hover {
                border: 1px solid #a0a0a0;
            }
            QSplitter::handle {
                background-color: #d0d0d0;
                width: 2px;
            }
            QPushButton {
                background-color: #f0f0f0;
                color: #444444;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                padding: 6px 18px;
                font-size: 11px;
                font-family: 'Microsoft YaHei', Arial;
                min-height: 26px;
            }
            QPushButton:hover {
                background-color: #e8e8e8;
                border: 1px solid #b0b0b0;
            }
            QPushButton:pressed {
                background-color: #d8d8d8;
            }
            QPushButton#save_btn {
                background-color: #1a73e8;
                color: #ffffff;
                border: 1px solid #1557b0;
            }
            QPushButton#save_btn:hover {
                background-color: #1557b0;
            }
            QPushButton#save_btn:pressed {
                background-color: #0d47a1;
            }
            QLabel {
                color: #444444;
                font-size: 11px;
            }
        """

    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        toolbar = self._create_toolbar()
        main_layout.addWidget(toolbar)

        content_area = QWidget()
        content_layout = QHBoxLayout(content_area)
        content_layout.setContentsMargins(8, 4, 8, 4)
        content_layout.setSpacing(8)

        splitter = QSplitter(Qt.Orientation.Horizontal)

        left_widget = self._create_left_panel()
        right_widget = self._create_right_panel()

        splitter.addWidget(left_widget)
        splitter.addWidget(right_widget)
        splitter.setSizes([850, 300])
        splitter.setHandleWidth(1)

        content_layout.addWidget(splitter)
        main_layout.addWidget(content_area, 1)

        bottom_bar = self._create_bottom_bar()
        main_layout.addWidget(bottom_bar)

        self.field_table.setCurrentCell(0, 0)

    def _create_toolbar(self):
        toolbar = QToolBar()
        toolbar.setMovable(False)
        toolbar.setIconSize(QSize(14, 14))

        add_action = self._make_action("新增字段", "新增字段", self.add_column)
        delete_action = self._make_action("删除字段", "删除字段", self.delete_column)
        move_up_action = self._make_action("上移", "上移", self.move_column_up)
        move_down_action = self._make_action("下移", "下移", self.move_column_down)

        toolbar.addAction(add_action)
        toolbar.addAction(delete_action)

        sep1 = toolbar.addSeparator()
        sep1.setProperty("separator", True)

        toolbar.addAction(move_up_action)
        toolbar.addAction(move_down_action)

        sep2 = toolbar.addSeparator()
        sep2.setProperty("separator", True)

        key_action = self._make_action("主键", "设置主键", self.show_feature_not_implemented)
        index_action = self._make_action("索引", "索引管理", self.show_index_dialog)
        fk_action = self._make_action("外键", "外键管理", self.show_foreign_key_dialog)

        toolbar.addAction(key_action)
        toolbar.addAction(index_action)
        toolbar.addAction(fk_action)

        sep3 = toolbar.addSeparator()
        sep3.setProperty("separator", True)

        sql_action = self._make_action("SQL预览", "SQL预览", self.show_sql_preview)
        options_action = self._make_action("选项", "表选项", self.show_options_dialog)

        toolbar.addAction(sql_action)
        toolbar.addAction(options_action)

        spacer = QWidget()
        spacer.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        toolbar.addWidget(spacer)

        toolbar.addWidget(QLabel("  "))

        return toolbar

    def _make_action(self, text, tip, slot):
        action = QAction(text, self)
        action.setToolTip(tip)
        action.triggered.connect(slot)
        return action

    def _create_left_panel(self):
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)

        self.field_table = QTableWidget()
        self.field_table.setColumnCount(8)
        self.field_table.setHorizontalHeaderLabels([
            "字段名", "类型", "长度", "小数点", "允许空值", "默认值", "主键", "注释"
        ])
        self.field_table.setAlternatingRowColors(True)
        self.field_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.field_table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.field_table.verticalHeader().setDefaultSectionSize(30)
        self.field_table.verticalHeader().setVisible(False)
        self.field_table.setShowGrid(True)
        self.field_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)

        self.field_table.setColumnWidth(0, 130)
        self.field_table.setColumnWidth(1, 160)
        self.field_table.setColumnWidth(2, 65)
        self.field_table.setColumnWidth(3, 65)
        self.field_table.setColumnWidth(4, 75)
        self.field_table.setColumnWidth(5, 110)
        self.field_table.setColumnWidth(6, 55)
        self.field_table.setColumnWidth(7, 180)

        if self.table_name:
            self.load_table_structure()
        else:
            self.add_default_column()

        layout.addWidget(self.field_table, 1)

        return panel

    def _create_right_panel(self):
        panel = QWidget()
        panel.setMinimumWidth(280)
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)

        tab_widget = QTabWidget()

        info_tab = self._create_info_tab()
        ddl_tab = self._create_ddl_tab()

        tab_widget.addTab(info_tab, "表信息")
        tab_widget.addTab(ddl_tab, "SQL预览")

        layout.addWidget(tab_widget, 1)

        return panel

    def _create_info_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(6)

        info_edit = QTextEdit()
        info_edit.setReadOnly(True)
        info_edit.setMaximumHeight(240)
        info_edit.setText(self._get_table_info())
        self.info_display = info_edit
        layout.addWidget(info_edit)

        options_group = QGroupBox("表选项")
        options_layout = QVBoxLayout(options_group)
        options_layout.setSpacing(4)

        charset_row = QHBoxLayout()
        charset_row.addWidget(QLabel("字符集:"))
        self.charset_combo = QComboBox()
        self.charset_combo.addItems(["utf8mb4", "utf8", "latin1", "utf8mb3"])
        self.charset_combo.setCurrentText("utf8mb4")
        charset_row.addWidget(self.charset_combo, 1)
        options_layout.addLayout(charset_row)

        collation_row = QHBoxLayout()
        collation_row.addWidget(QLabel("排序规则:"))
        self.collation_combo = QComboBox()
        self.collation_combo.addItems([
            "utf8mb4_general_ci", "utf8mb4_unicode_ci",
            "utf8mb4_bin", "utf8_general_ci"
        ])
        self.collation_combo.setCurrentText("utf8mb4_general_ci")
        collation_row.addWidget(self.collation_combo, 1)
        options_layout.addLayout(collation_row)

        engine_row = QHBoxLayout()
        engine_row.addWidget(QLabel("引擎:"))
        self.engine_combo = QComboBox()
        self.engine_combo.addItems(["InnoDB", "MyISAM", "MEMORY"])
        self.engine_combo.setCurrentText("InnoDB")
        engine_row.addWidget(self.engine_combo, 1)
        options_layout.addLayout(engine_row)

        layout.addWidget(options_group)

        layout.addStretch()

        return tab

    def _create_ddl_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(6, 6, 6, 6)

        self.ddl_preview = QTextEdit()
        self.ddl_preview.setReadOnly(True)
        self.ddl_preview.setPlaceholderText("点击SQL预览生成DDL语句")
        layout.addWidget(self.ddl_preview, 1)

        return tab

    def _create_bottom_bar(self):
        bar = QWidget()
        bar.setFixedHeight(40)
        bar.setStyleSheet("""
            QWidget {
                background-color: #252526;
                border-top: 1px solid #3c3c3c;
            }
        """)
        layout = QHBoxLayout(bar)
        layout.setContentsMargins(12, 4, 12, 4)

        layout.addStretch()

        save_btn = QPushButton("保存")
        save_btn.setObjectName("save_btn")
        save_btn.setFixedWidth(90)
        save_btn.clicked.connect(self.save_table)

        cancel_btn = QPushButton("取消")
        cancel_btn.setFixedWidth(80)
        cancel_btn.clicked.connect(self.reject)

        layout.addWidget(save_btn)
        layout.addWidget(cancel_btn)

        return bar

    def _create_centered_checkbox(self, checked=False, tooltip=""):
        check = QCheckBox()
        check.setChecked(checked)
        check.setToolTip(tooltip)
        container = QWidget()
        layout = QHBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(check)
        return container

    def load_table_structure(self):
        try:
            self.main_window.table_operations._ensure_database_context()
            with self.main_window.db_connection.cursor() as cursor:
                cursor.execute(f"SHOW FULL COLUMNS FROM `{self.table_name}`")
                columns = cursor.fetchall()

            self.field_table.setRowCount(len(columns))
            for i, col in enumerate(columns):
                col_name = col['Field'] if isinstance(col, dict) else col[0]
                col_type = col['Type'] if isinstance(col, dict) else col[1]
                col_null = col['Null'] if isinstance(col, dict) else col[2]
                col_default = col['Default'] if isinstance(col, dict) else col[3]
                col_key = col['Key'] if isinstance(col, dict) else col[4]
                col_extra = col['Extra'] if isinstance(col, dict) else col[5]
                col_comment = col['Comment'] if isinstance(col, dict) else col[8]

                import re
                type_match = re.match(r'([a-zA-Z]+)(\((\d+)(,(\d+))?\))?', col_type)
                if type_match:
                    field_type = type_match.group(1)
                    length = type_match.group(3) or ""
                    decimal = type_match.group(5) or ""
                else:
                    field_type = col_type
                    length = ""
                    decimal = ""

                name_item = QTableWidgetItem(col_name)
                name_item.setToolTip(f"字段名: {col_name}")
                self.field_table.setItem(i, 0, name_item)

                type_combo = self._create_type_combo(field_type)
                self.field_table.setCellWidget(i, 1, type_combo)

                self.field_table.setItem(i, 2, QTableWidgetItem(length))
                self.field_table.setItem(i, 3, QTableWidgetItem(decimal))

                null_check = self._create_centered_checkbox(
                    checked=col_null.upper() == "YES",
                    tooltip="勾选表示允许为空"
                )
                self.field_table.setCellWidget(i, 4, null_check)

                if col_default is not None:
                    default_item = QTableWidgetItem(str(col_default))
                else:
                    default_item = QTableWidgetItem("")
                self.field_table.setItem(i, 5, default_item)

                pk_check = self._create_centered_checkbox(
                    checked=col_key == "PRI",
                    tooltip="勾选设置为主键"
                )
                self.field_table.setCellWidget(i, 6, pk_check)

                if col_extra:
                    extra_text = col_extra
                else:
                    extra_text = ""
                comment_item = QTableWidgetItem(col_comment if col_comment else (extra_text if extra_text else ""))
                comment_item.setToolTip(extra_text if extra_text else "")
                self.field_table.setItem(i, 7, comment_item)
        except Exception as e:
            self.logger.log('ERROR', f"加载表结构失败: {str(e)}")

    def add_default_column(self):
        self.field_table.setRowCount(1)

        name_item = QTableWidgetItem("id")
        name_item.setToolTip("字段名: id")
        self.field_table.setItem(0, 0, name_item)

        type_combo = self._create_type_combo("INT")
        self.field_table.setCellWidget(0, 1, type_combo)
        self.field_table.setItem(0, 2, QTableWidgetItem("11"))
        self.field_table.setItem(0, 3, QTableWidgetItem(""))

        null_check = self._create_centered_checkbox(
            checked=False,
            tooltip="勾选表示允许为空"
        )
        self.field_table.setCellWidget(0, 4, null_check)

        self.field_table.setItem(0, 5, QTableWidgetItem("AUTO_INCREMENT"))

        pk_check = self._create_centered_checkbox(
            checked=True,
            tooltip="勾选设置为主键"
        )
        self.field_table.setCellWidget(0, 6, pk_check)

        self.field_table.setItem(0, 7, QTableWidgetItem(""))

    def _create_type_combo(self, current_type=""):
        combo = QComboBox()
        combo.setEditable(True)
        combo.setInsertPolicy(QComboBox.InsertPolicy.NoInsert)
        
        db_types = self._get_database_types()
        if db_types:
            combo.addItems(db_types)
        else:
            common_types = [
                'INT', 'VARCHAR', 'TEXT', 'DATE', 'DATETIME', 'TIMESTAMP',
                'DECIMAL', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'TINYINT', 'SMALLINT',
                'MEDIUMINT', 'BIGINT', 'CHAR', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT',
                'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB', 'ENUM', 'SET',
                'JSON', 'YEAR', 'TIME', 'BINARY', 'VARBINARY'
            ]
            combo.addItems(common_types)
        
        if current_type:
            combo.setCurrentText(current_type.upper())
        else:
            combo.setCurrentText("VARCHAR")
        combo.completer().setCompletionMode(combo.completer().CompletionMode.PopupCompletion)
        combo.completer().setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        return combo

    def _get_database_types(self):
        try:
            self.main_window.table_operations._ensure_database_context()
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    cursor.execute("SELECT DISTINCT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS ORDER BY DATA_TYPE")
                    types = [row['DATA_TYPE'].upper() for row in cursor.fetchall()]
                    additional_types = ['SERIAL', 'BIGSERIAL', 'MEDIUMSERIAL', 'SMALLSERIAL']
                    types = list(set(types + additional_types))
                    types.sort()
                    return types
                elif self.main_window.current_db_type == 'PostgreSQL':
                    cursor.execute("SELECT typname FROM pg_type WHERE typname ~ '^[a-z]+' ORDER BY typname")
                    types = [row['typname'].upper() for row in cursor.fetchall()]
                    return types
                else:
                    return None
        except Exception as e:
            self.logger.log('WARNING', f"获取数据库类型失败: {str(e)}")
            return None

    def add_column(self):
        row_count = self.field_table.rowCount()
        self.field_table.setRowCount(row_count + 1)
        type_combo = self._create_type_combo("VARCHAR")
        self.field_table.setCellWidget(row_count, 1, type_combo)
        null_check = self._create_centered_checkbox(
            checked=True,
            tooltip="勾选表示允许为空"
        )
        self.field_table.setCellWidget(row_count, 4, null_check)
        pk_check = self._create_centered_checkbox(
            tooltip="勾选设置为主键"
        )
        self.field_table.setCellWidget(row_count, 6, pk_check)
        self.field_table.setCurrentCell(row_count, 0)

    def delete_column(self):
        rows = self.field_table.selectionModel().selectedRows()
        if rows:
            row = rows[0].row()
            self.field_table.removeRow(row)

    def move_column_up(self):
        rows = self.field_table.selectionModel().selectedRows()
        if rows:
            row = rows[0].row()
            if row > 0:
                self._swap_rows(row, row - 1)
                self.field_table.setCurrentCell(row - 1, 0)

    def move_column_down(self):
        rows = self.field_table.selectionModel().selectedRows()
        if rows:
            row = rows[0].row()
            if row < self.field_table.rowCount() - 1:
                self._swap_rows(row, row + 1)
                self.field_table.setCurrentCell(row + 1, 0)

    def _swap_rows(self, r1, r2):
        for col in range(self.field_table.columnCount()):
            if col in (1, 4, 6):
                w1 = self.field_table.cellWidget(r1, col)
                w2 = self.field_table.cellWidget(r2, col)
                if w1 and w2:
                    if col == 1:
                        t1, t2 = w1.currentText(), w2.currentText()
                        w1.setCurrentText(t2)
                        w2.setCurrentText(t1)
                    else:
                        c1 = w1.findChild(QCheckBox)
                        c2 = w2.findChild(QCheckBox)
                        if c1 and c2:
                            v1, v2 = c1.isChecked(), c2.isChecked()
                            c1.setChecked(v2)
                            c2.setChecked(v1)
                elif w1:
                    self.field_table.setCellWidget(r2, col, w1)
                    self.field_table.removeCellWidget(r1, col)
                elif w2:
                    self.field_table.setCellWidget(r1, col, w2)
                    self.field_table.removeCellWidget(r2, col)
            else:
                i1 = self.field_table.takeItem(r1, col)
                i2 = self.field_table.takeItem(r2, col)
                self.field_table.setItem(r1, col, i2)
                self.field_table.setItem(r2, col, i1)

    def save_table(self):
        try:
            if self.table_name:
                sql = self._generate_create_table_sql(self.table_name)
            else:
                table_name, ok = QInputDialog.getText(self, "新建表", "请输入表名:")
                if not ok or not table_name:
                    return
                sql = self._generate_create_table_sql(table_name)

            self.main_window.table_operations._ensure_database_context()

            with self.main_window.db_connection.cursor() as cursor:
                if self.table_name:
                    backup_table = f"{self.table_name}_backup"
                    try:
                        cursor.execute(f"CREATE TABLE IF NOT EXISTS `{backup_table}` LIKE `{self.table_name}`")
                        cursor.execute(f"INSERT INTO `{backup_table}` SELECT * FROM `{self.table_name}`")
                    except Exception:
                        pass
                    cursor.execute(f"DROP TABLE IF EXISTS `{self.table_name}`")

                cursor.execute(sql)

                if self.table_name:
                    try:
                        backup_table = f"{self.table_name}_backup"
                        new_cols = []
                        with self.main_window.db_connection.cursor() as c2:
                            c2.execute(f"DESCRIBE `{self.table_name}`")
                            for row in c2.fetchall():
                                new_cols.append(row['Field'] if isinstance(row, dict) else row[0])
                        backup_cols = []
                        with self.main_window.db_connection.cursor() as c2:
                            c2.execute(f"DESCRIBE `{backup_table}`")
                            for row in c2.fetchall():
                                backup_cols.append(row['Field'] if isinstance(row, dict) else row[0])
                        common = [c for c in backup_cols if c in new_cols]
                        if common:
                            cols_str = ", ".join(f"`{c}`" for c in common)
                            cursor.execute(f"INSERT INTO `{self.table_name}` ({cols_str}) SELECT {cols_str} FROM `{backup_table}`")
                        cursor.execute(f"DROP TABLE IF EXISTS `{backup_table}`")
                    except Exception as e:
                        self.logger.log('WARNING', f"恢复数据失败: {str(e)}")

            self.main_window.db_connection.commit()

            table_name_to_refresh = self.table_name or table_name
            
            QMessageBox.information(self, "保存成功", f"表结构 '{table_name_to_refresh}' 保存成功")
            self.logger.log('INFO', f"保存表结构: {table_name_to_refresh}")

            self.main_window.left_panel.load_connections_to_tree(show_only_current=False)
            
            self._notify_table_structure_changed(table_name_to_refresh)
            
            self.accept()
        except Exception as e:
            self.main_window.db_connection.rollback()
            QMessageBox.critical(self, "保存失败", f"保存表结构时出错: {str(e)}")
            self.logger.log('ERROR', f"保存表结构失败: {str(e)}")

    def _generate_create_table_sql(self, table_name):
        columns = []

        for i in range(self.field_table.rowCount()):
            name_item = self.field_table.item(i, 0)
            if not name_item or not name_item.text().strip():
                continue
            col_name = name_item.text().strip()

            type_combo = self.field_table.cellWidget(i, 1)
            col_type = type_combo.currentText() if type_combo else "VARCHAR"

            length_item = self.field_table.item(i, 2)
            col_length = length_item.text().strip() if length_item else ""

            decimal_item = self.field_table.item(i, 3)
            col_decimal = decimal_item.text().strip() if decimal_item else ""

            null_container = self.field_table.cellWidget(i, 4)
            null_check = null_container.findChild(QCheckBox) if null_container else None
            allow_null = null_check.isChecked() if null_check else True

            default_item = self.field_table.item(i, 5)
            col_default = default_item.text().strip() if default_item else ""

            pk_container = self.field_table.cellWidget(i, 6)
            pk_check = pk_container.findChild(QCheckBox) if pk_container else None
            is_primary = pk_check.isChecked() if pk_check else False

            comment_item = self.field_table.item(i, 7)
            col_comment = comment_item.text().strip() if comment_item else ""

            col_def = f"  `{col_name}` {col_type}"
            if col_length:
                if col_decimal:
                    col_def += f"({col_length},{col_decimal})"
                elif col_type.upper() in ('VARCHAR', 'CHAR', 'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT'):
                    col_def += f"({col_length})"
            if not allow_null:
                col_def += " NOT NULL"
            if col_default:
                if col_default.upper() == 'AUTO_INCREMENT':
                    pass
                elif col_default.upper() in ('CURRENT_TIMESTAMP', 'NOW()', 'NULL', 'TRUE', 'FALSE'):
                    col_def += f" DEFAULT {col_default}"
                else:
                    col_def += f" DEFAULT '{col_default}'"
            if col_default.upper() == 'AUTO_INCREMENT':
                col_def += " AUTO_INCREMENT"
            if col_comment:
                col_def += f" COMMENT '{col_comment}'"
            if is_primary:
                col_def += " PRIMARY KEY"
            columns.append(col_def)

        if not columns:
            return ""

        charset = self.charset_combo.currentText() if hasattr(self, 'charset_combo') else "utf8mb4"
        collation = self.collation_combo.currentText() if hasattr(self, 'collation_combo') else "utf8mb4_general_ci"
        engine = self.engine_combo.currentText() if hasattr(self, 'engine_combo') else "InnoDB"

        sql = f"CREATE TABLE `{table_name}` (\n"
        sql += ",\n".join(columns)
        sql += f"\n) ENGINE={engine} DEFAULT CHARSET={charset} COLLATE={collation};"

        return sql

    def _get_table_info(self):
        if not self.table_name:
            return (f"表名: (新建)\n"
                    f"行数: 0\n"
                    f"引擎: InnoDB\n"
                    f"自动递增: 0\n"
                    f"字符集: utf8mb4\n"
                    f"排序规则: utf8mb4_general_ci\n"
                    f"创建时间: -\n"
                    f"修改时间: -")
        try:
            self.main_window.table_operations._ensure_database_context()
            with self.main_window.db_connection.cursor() as cursor:
                cursor.execute(f"SHOW TABLE STATUS LIKE '{self.table_name}'")
                status = cursor.fetchone()
                if status:
                    if isinstance(status, dict):
                        rows = status.get('Rows', 0)
                        engine = status.get('Engine', 'InnoDB')
                        auto_inc = status.get('Auto_increment', '0')
                        collation = status.get('Collation', 'utf8mb4_general_ci')
                        create_time = status.get('Create_time', '-')
                        update_time = status.get('Update_time', '-')
                    else:
                        rows = status[4]
                        engine = status[1]
                        auto_inc = status[10] if len(status) > 10 else '0'
                        collation = status[14] if len(status) > 14 else '-'
                        create_time = status[11] if len(status) > 11 else '-'
                        update_time = status[12] if len(status) > 12 else '-'

                    if hasattr(create_time, 'strftime'):
                        create_time = create_time.strftime('%Y-%m-%d %H:%M:%S')
                    if hasattr(update_time, 'strftime'):
                        update_time = update_time.strftime('%Y-%m-%d %H:%M:%S')

                    import re
                    charset_match = re.match(r'^[^_]+', collation)
                    charset = charset_match.group(0) if charset_match else 'utf8mb4'

                    return (f"表名: {self.table_name}\n"
                            f"行数: {rows}\n"
                            f"引擎: {engine}\n"
                            f"自动递增: {auto_inc}\n"
                            f"字符集: {charset}\n"
                            f"排序规则: {collation}\n"
                            f"创建时间: {create_time}\n"
                            f"修改时间: {update_time}")
        except Exception as e:
            self.logger.log('ERROR', f"获取表信息失败: {str(e)}")
        return (f"表名: {self.table_name}\n"
                f"行数: 0\n引擎: InnoDB\n自动递增: 0\n"
                f"字符集: utf8mb4\n排序规则: utf8mb4_general_ci\n"
                f"创建时间: -\n修改时间: -")

    def show_sql_preview(self):
        try:
            if self.table_name:
                sql = self._generate_create_table_sql(self.table_name)
            else:
                sql = self._generate_create_table_sql("new_table")

            if hasattr(self, 'ddl_preview'):
                tab_widget = self.ddl_preview.parent()
                while tab_widget and not isinstance(tab_widget, QTabWidget):
                    tab_widget = tab_widget.parent()
                if tab_widget:
                    tab_widget.setCurrentIndex(1)

                self.ddl_preview.setPlainText(sql if sql else "请先添加字段")
        except Exception as e:
            QMessageBox.critical(self, "错误", f"生成SQL预览失败: {str(e)}")

    def show_index_dialog(self):
        dialog = QDialog(self)
        dialog.setWindowTitle("索引管理")
        dialog.setGeometry(200, 200, 650, 400)
        dialog.setStyleSheet(self._get_dialog_style())

        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(8)

        label = QLabel("管理表的索引:")
        label.setStyleSheet("color: #cccccc; font-size: 12px; font-family: 'Microsoft YaHei', Arial;")
        layout.addWidget(label)

        table = QTableWidget()
        table.setColumnCount(4)
        table.setHorizontalHeaderLabels(["索引名", "类型", "字段", "唯一"])
        table.setAlternatingRowColors(True)
        table.verticalHeader().setVisible(False)
        table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)

        if self.table_name:
            try:
                self.main_window.table_operations._ensure_database_context()
                with self.main_window.db_connection.cursor() as cursor:
                    cursor.execute(f"SHOW INDEX FROM `{self.table_name}`")
                    indexes = cursor.fetchall()
                    seen = {}
                    for idx in indexes:
                        if isinstance(idx, dict):
                            key_name = idx['Key_name']
                            col_name = idx['Column_name']
                            non_unique = idx['Non_unique']
                            idx_type = idx.get('Index_type', '')
                        else:
                            key_name = idx[2]
                            col_name = idx[4]
                            non_unique = idx[1]
                            idx_type = idx[3] if len(idx) > 3 else ''
                        if key_name not in seen:
                            seen[key_name] = {'cols': [], 'type': idx_type, 'unique': non_unique == 0}
                        seen[key_name]['cols'].append(col_name)
                    table.setRowCount(len(seen))
                    for r, (kname, kinfo) in enumerate(seen.items()):
                        table.setItem(r, 0, QTableWidgetItem(kname))
                        table.setItem(r, 1, QTableWidgetItem(kinfo['type']))
                        table.setItem(r, 2, QTableWidgetItem(', '.join(kinfo['cols'])))
                        table.setItem(r, 3, QTableWidgetItem('是' if kinfo['unique'] else '否'))
            except Exception:
                pass

        layout.addWidget(table, 1)

        btn_row = QHBoxLayout()
        btn_row.addStretch()
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(dialog.accept)
        btn_row.addWidget(close_btn)
        layout.addLayout(btn_row)

        dialog.exec()

    def show_foreign_key_dialog(self):
        dialog = QDialog(self)
        dialog.setWindowTitle("外键管理")
        dialog.setGeometry(200, 200, 650, 400)
        dialog.setStyleSheet(self._get_dialog_style())

        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(8)

        label = QLabel("管理表的外键:")
        label.setStyleSheet("color: #cccccc; font-size: 12px; font-family: 'Microsoft YaHei', Arial;")
        layout.addWidget(label)

        table = QTableWidget()
        table.setColumnCount(4)
        table.setHorizontalHeaderLabels(["外键名", "字段", "引用表", "引用字段"])
        table.setAlternatingRowColors(True)
        table.verticalHeader().setVisible(False)
        table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)

        if self.table_name:
            try:
                self.main_window.table_operations._ensure_database_context()
                with self.main_window.db_connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT k.CONSTRAINT_NAME, k.COLUMN_NAME,
                               k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME
                        FROM information_schema.KEY_COLUMN_USAGE k
                        WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = %s
                          AND k.REFERENCED_TABLE_NAME IS NOT NULL
                    """, (self.table_name,))
                    fks = cursor.fetchall()
                    seen = {}
                    for fk in fks:
                        if isinstance(fk, dict):
                            name = fk['CONSTRAINT_NAME']
                            col = fk['COLUMN_NAME']
                            ref_t = fk['REFERENCED_TABLE_NAME']
                            ref_c = fk['REFERENCED_COLUMN_NAME']
                        else:
                            name = fk[0]
                            col = fk[1]
                            ref_t = fk[2]
                            ref_c = fk[3]
                        if name not in seen:
                            seen[name] = {'cols': [], 'ref_t': ref_t, 'ref_cols': []}
                        seen[name]['cols'].append(col)
                        seen[name]['ref_cols'].append(ref_c)
                    table.setRowCount(len(seen))
                    for r, (fkname, fkinfo) in enumerate(seen.items()):
                        table.setItem(r, 0, QTableWidgetItem(fkname))
                        table.setItem(r, 1, QTableWidgetItem(', '.join(fkinfo['cols'])))
                        table.setItem(r, 2, QTableWidgetItem(fkinfo['ref_t']))
                        table.setItem(r, 3, QTableWidgetItem(', '.join(fkinfo['ref_cols'])))
            except Exception:
                pass

        layout.addWidget(table, 1)

        btn_row = QHBoxLayout()
        btn_row.addStretch()
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(dialog.accept)
        btn_row.addWidget(close_btn)
        layout.addLayout(btn_row)

        dialog.exec()

    def show_options_dialog(self):
        dialog = QDialog(self)
        dialog.setWindowTitle("高级表选项")
        dialog.setGeometry(200, 200, 450, 350)
        dialog.setStyleSheet(self._get_dialog_style())

        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        engine_group = QGroupBox("存储引擎")
        eng_layout = QVBoxLayout(engine_group)
        eng_combo = QComboBox()
        eng_combo.addItems(["InnoDB", "MyISAM", "MEMORY"])
        eng_combo.setCurrentText("InnoDB")
        eng_layout.addWidget(eng_combo)
        layout.addWidget(engine_group)

        comment_group = QGroupBox("表注释")
        comm_layout = QVBoxLayout(comment_group)
        comm_edit = QTextEdit()
        comm_edit.setMaximumHeight(80)
        comm_edit.setPlaceholderText("输入表注释...")
        comm_layout.addWidget(comm_edit)
        layout.addWidget(comment_group)

        auto_group = QGroupBox("自动递增起始值")
        auto_layout = QHBoxLayout(auto_group)
        auto_input = QLineEdit()
        auto_input.setPlaceholderText("留空则使用默认值")
        auto_layout.addWidget(auto_input)
        layout.addWidget(auto_group)

        layout.addStretch()

        btn_row = QHBoxLayout()
        btn_row.addStretch()
        ok_btn = QPushButton("确定")
        ok_btn.setObjectName("save_btn")
        ok_btn.clicked.connect(dialog.accept)
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(dialog.reject)
        btn_row.addWidget(ok_btn)
        btn_row.addWidget(cancel_btn)
        layout.addLayout(btn_row)

        dialog.exec()

    def _notify_table_structure_changed(self, table_name):
        """通知表结构变更，刷新相关UI"""
        if hasattr(self.main_window, 'event_bus'):
            self.main_window.event_bus.publish('table_structure_changed', {
                'table_name': table_name,
                'database': self.main_window.current_db
            })
    
    def show_feature_not_implemented(self):
        self.main_window.event_handler.show_feature_not_implemented("功能开发中")
