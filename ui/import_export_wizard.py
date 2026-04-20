#!/usr/bin/env python3
"""
导入导出向导
"""

from PyQt6.QtWidgets import (QWizard, QWizardPage, QVBoxLayout, QHBoxLayout, QLabel, 
                             QComboBox, QLineEdit, QPushButton, QFileDialog, 
                             QRadioButton, QButtonGroup, QTableWidget, QTableWidgetItem, 
                             QCheckBox, QSpinBox, QTextEdit, QMessageBox)
from PyQt6.QtCore import Qt

class ImportExportWizard(QWizard):
    """导入导出向导"""
    def __init__(self, parent=None, mode='export'):  # mode: 'import' or 'export'
        super(ImportExportWizard, self).__init__(parent)
        self.setWindowTitle("导入向导" if mode == 'import' else "导出向导")
        self.setGeometry(200, 100, 700, 500)
        
        self.mode = mode
        self.result = None
        
        # 添加页面
        if mode == 'export':
            self.addPage(ExportSourcePage(self))
            self.addPage(ExportFormatPage(self))
            self.addPage(ExportOptionsPage(self))
            self.addPage(ExportSummaryPage(self))
        else:
            self.addPage(ImportSourcePage(self))
            self.addPage(ImportFormatPage(self))
            self.addPage(ImportOptionsPage(self))
            self.addPage(ImportSummaryPage(self))
        
        # 完成按钮
        self.button(QWizard.WizardButton.FinishButton).clicked.connect(self.on_finish)
    
    def on_finish(self):
        """完成向导"""
        self.result = {
            'mode': self.mode,
            'source': self.field('source'),
            'format': self.field('format'),
            'file_path': self.field('file_path'),
            'options': {
                'encoding': self.field('encoding'),
                'delimiter': self.field('delimiter'),
                'quote': self.field('quote'),
                'header': self.field('header'),
                'batch_size': self.field('batch_size')
            }
        }

class ExportSourcePage(QWizardPage):
    """导出源页面"""
    def __init__(self, parent):
        super(ExportSourcePage, self).__init__(parent)
        self.setTitle("导出源")
        self.setSubTitle("选择要导出的数据源")
        
        layout = QVBoxLayout()
        
        # 源类型
        source_group = QButtonGroup()
        
        table_radio = QRadioButton("表")
        table_radio.setChecked(True)
        source_group.addButton(table_radio, 0)
        
        query_radio = QRadioButton("查询结果")
        source_group.addButton(query_radio, 1)
        
        layout.addWidget(table_radio)
        layout.addWidget(query_radio)
        
        # 表选择
        table_layout = QHBoxLayout()
        table_label = QLabel("表:")
        self.table_combo = QComboBox()
        # 这里应该从数据库加载表列表
        self.table_combo.addItems(["users", "products", "orders"])
        table_layout.addWidget(table_label)
        table_layout.addWidget(self.table_combo)
        layout.addLayout(table_layout)
        
        # 字段选择
        fields_label = QLabel("字段:")
        layout.addWidget(fields_label)
        
        self.fields_table = QTableWidget()
        self.fields_table.setColumnCount(2)
        self.fields_table.setHorizontalHeaderLabels(["字段名", "导出"])
        self.fields_table.setRowCount(3)
        self.fields_table.setItem(0, 0, QTableWidgetItem("id"))
        self.fields_table.setCellWidget(0, 1, QCheckBox())
        self.fields_table.setItem(1, 0, QTableWidgetItem("name"))
        self.fields_table.setCellWidget(1, 1, QCheckBox())
        self.fields_table.setItem(2, 0, QTableWidgetItem("email"))
        self.fields_table.setCellWidget(2, 1, QCheckBox())
        layout.addWidget(self.fields_table)
        
        # 全选/取消全选
        select_layout = QHBoxLayout()
        select_all_btn = QPushButton("全选")
        select_all_btn.clicked.connect(self.select_all_fields)
        deselect_all_btn = QPushButton("取消全选")
        deselect_all_btn.clicked.connect(self.deselect_all_fields)
        select_layout.addWidget(select_all_btn)
        select_layout.addWidget(deselect_all_btn)
        select_layout.addStretch()
        layout.addLayout(select_layout)
        
        self.setLayout(layout)
    
    def select_all_fields(self):
        """全选字段"""
        for i in range(self.fields_table.rowCount()):
            check_box = self.fields_table.cellWidget(i, 1)
            if check_box:
                check_box.setChecked(True)
    
    def deselect_all_fields(self):
        """取消全选字段"""
        for i in range(self.fields_table.rowCount()):
            check_box = self.fields_table.cellWidget(i, 1)
            if check_box:
                check_box.setChecked(False)
    
    def isComplete(self):
        """检查是否完成"""
        return True

class ExportFormatPage(QWizardPage):
    """导出格式页面"""
    def __init__(self, parent):
        super(ExportFormatPage, self).__init__(parent)
        self.setTitle("导出格式")
        self.setSubTitle("选择导出文件的格式")
        
        layout = QVBoxLayout()
        
        # 格式选择
        format_group = QButtonGroup()
        
        csv_radio = QRadioButton("CSV")
        csv_radio.setChecked(True)
        format_group.addButton(csv_radio, 0)
        
        excel_radio = QRadioButton("Excel")
        format_group.addButton(excel_radio, 1)
        
        json_radio = QRadioButton("JSON")
        format_group.addButton(json_radio, 2)
        
        sql_radio = QRadioButton("SQL")
        format_group.addButton(sql_radio, 3)
        
        layout.addWidget(csv_radio)
        layout.addWidget(excel_radio)
        layout.addWidget(json_radio)
        layout.addWidget(sql_radio)
        
        # 文件路径
        file_layout = QHBoxLayout()
        file_label = QLabel("文件路径:")
        self.file_edit = QLineEdit()
        browse_btn = QPushButton("浏览...")
        browse_btn.clicked.connect(self.browse_file)
        file_layout.addWidget(file_label)
        file_layout.addWidget(self.file_edit)
        file_layout.addWidget(browse_btn)
        layout.addLayout(file_layout)
        
        self.registerField('format', format_group)
        self.registerField('file_path', self.file_edit)
        
        self.setLayout(layout)
    
    def browse_file(self):
        """浏览文件"""
        format = self.field('format')
        filters = {
            0: "CSV文件 (*.csv)",
            1: "Excel文件 (*.xlsx)",
            2: "JSON文件 (*.json)",
            3: "SQL文件 (*.sql)"
        }
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存文件", "", filters.get(format, "所有文件 (*.*)")
        )
        if file_path:
            self.file_edit.setText(file_path)
    
    def isComplete(self):
        """检查是否完成"""
        return bool(self.file_edit.text())

class ExportOptionsPage(QWizardPage):
    """导出选项页面"""
    def __init__(self, parent):
        super(ExportOptionsPage, self).__init__(parent)
        self.setTitle("导出选项")
        self.setSubTitle("设置导出选项")
        
        layout = QVBoxLayout()
        
        # 编码
        encoding_layout = QHBoxLayout()
        encoding_label = QLabel("编码:")
        self.encoding_combo = QComboBox()
        self.encoding_combo.addItems(["UTF-8", "GBK", "ISO-8859-1"])
        self.encoding_combo.setCurrentText("UTF-8")
        encoding_layout.addWidget(encoding_label)
        encoding_layout.addWidget(self.encoding_combo)
        layout.addLayout(encoding_layout)
        
        # 分隔符 (仅CSV)
        delimiter_layout = QHBoxLayout()
        delimiter_label = QLabel("分隔符:")
        self.delimiter_edit = QLineEdit(",")
        self.delimiter_edit.setMaximumWidth(50)
        delimiter_layout.addWidget(delimiter_label)
        delimiter_layout.addWidget(self.delimiter_edit)
        layout.addLayout(delimiter_layout)
        
        # 引号 (仅CSV)
        quote_layout = QHBoxLayout()
        quote_label = QLabel("引号:")
        self.quote_edit = QLineEdit('"')
        self.quote_edit.setMaximumWidth(50)
        quote_layout.addWidget(quote_label)
        quote_layout.addWidget(self.quote_edit)
        layout.addLayout(quote_layout)
        
        # 包含表头
        self.header_check = QCheckBox("包含表头")
        self.header_check.setChecked(True)
        layout.addWidget(self.header_check)
        
        # 批量大小
        batch_layout = QHBoxLayout()
        batch_label = QLabel("批量大小:")
        self.batch_spin = QSpinBox()
        self.batch_spin.setRange(1, 10000)
        self.batch_spin.setValue(1000)
        batch_layout.addWidget(batch_label)
        batch_layout.addWidget(self.batch_spin)
        layout.addLayout(batch_layout)
        
        self.registerField('encoding', self.encoding_combo)
        self.registerField('delimiter', self.delimiter_edit)
        self.registerField('quote', self.quote_edit)
        self.registerField('header', self.header_check)
        self.registerField('batch_size', self.batch_spin)
        
        self.setLayout(layout)

class ExportSummaryPage(QWizardPage):
    """导出摘要页面"""
    def __init__(self, parent):
        super(ExportSummaryPage, self).__init__(parent)
        self.setTitle("导出摘要")
        self.setSubTitle("确认导出设置")
        
        layout = QVBoxLayout()
        
        self.summary_text = QTextEdit()
        self.summary_text.setReadOnly(True)
        layout.addWidget(self.summary_text)
        
        self.setLayout(layout)
    
    def initializePage(self):
        """初始化页面"""
        source = self.wizard().field('source')
        format = self.wizard().field('format')
        file_path = self.wizard().field('file_path')
        encoding = self.wizard().field('encoding')
        
        format_names = {0: "CSV", 1: "Excel", 2: "JSON", 3: "SQL"}
        
        summary = f"导出源: {source}\n"
        summary += f"导出格式: {format_names.get(format, '未知')}\n"
        summary += f"文件路径: {file_path}\n"
        summary += f"编码: {encoding}\n"
        summary += f"包含表头: {'是' if self.wizard().field('header') else '否'}\n"
        summary += f"批量大小: {self.wizard().field('batch_size')}\n"
        
        self.summary_text.setPlainText(summary)

class ImportSourcePage(QWizardPage):
    """导入源页面"""
    def __init__(self, parent):
        super(ImportSourcePage, self).__init__(parent)
        self.setTitle("导入源")
        self.setSubTitle("选择要导入的数据源")
        
        layout = QVBoxLayout()
        
        # 文件路径
        file_layout = QHBoxLayout()
        file_label = QLabel("文件路径:")
        self.file_edit = QLineEdit()
        browse_btn = QPushButton("浏览...")
        browse_btn.clicked.connect(self.browse_file)
        file_layout.addWidget(file_label)
        file_layout.addWidget(self.file_edit)
        file_layout.addWidget(browse_btn)
        layout.addLayout(file_layout)
        
        # 目标表
        table_layout = QHBoxLayout()
        table_label = QLabel("目标表:")
        self.table_combo = QComboBox()
        # 这里应该从数据库加载表列表
        self.table_combo.addItems(["users", "products", "orders"])
        table_layout.addWidget(table_label)
        table_layout.addWidget(self.table_combo)
        layout.addLayout(table_layout)
        
        # 导入方式
        mode_group = QButtonGroup()
        
        append_radio = QRadioButton("追加数据")
        append_radio.setChecked(True)
        mode_group.addButton(append_radio, 0)
        
        replace_radio = QRadioButton("替换数据")
        mode_group.addButton(replace_radio, 1)
        
        layout.addWidget(append_radio)
        layout.addWidget(replace_radio)
        
        self.registerField('file_path', self.file_edit)
        self.registerField('source', self.table_combo)
        
        self.setLayout(layout)
    
    def browse_file(self):
        """浏览文件"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择文件", "", "所有支持的文件 (*.csv *.xlsx *.json *.sql);;CSV文件 (*.csv);;Excel文件 (*.xlsx);;JSON文件 (*.json);;SQL文件 (*.sql)"
        )
        if file_path:
            self.file_edit.setText(file_path)
    
    def isComplete(self):
        """检查是否完成"""
        return bool(self.file_edit.text())

class ImportFormatPage(QWizardPage):
    """导入格式页面"""
    def __init__(self, parent):
        super(ImportFormatPage, self).__init__(parent)
        self.setTitle("导入格式")
        self.setSubTitle("选择导入文件的格式")
        
        layout = QVBoxLayout()
        
        # 格式选择
        format_group = QButtonGroup()
        
        csv_radio = QRadioButton("CSV")
        csv_radio.setChecked(True)
        format_group.addButton(csv_radio, 0)
        
        excel_radio = QRadioButton("Excel")
        format_group.addButton(excel_radio, 1)
        
        json_radio = QRadioButton("JSON")
        format_group.addButton(json_radio, 2)
        
        sql_radio = QRadioButton("SQL")
        format_group.addButton(sql_radio, 3)
        
        layout.addWidget(csv_radio)
        layout.addWidget(excel_radio)
        layout.addWidget(json_radio)
        layout.addWidget(sql_radio)
        
        self.registerField('format', format_group)
        
        self.setLayout(layout)

class ImportOptionsPage(QWizardPage):
    """导入选项页面"""
    def __init__(self, parent):
        super(ImportOptionsPage, self).__init__(parent)
        self.setTitle("导入选项")
        self.setSubTitle("设置导入选项")
        
        layout = QVBoxLayout()
        
        # 编码
        encoding_layout = QHBoxLayout()
        encoding_label = QLabel("编码:")
        self.encoding_combo = QComboBox()
        self.encoding_combo.addItems(["UTF-8", "GBK", "ISO-8859-1"])
        self.encoding_combo.setCurrentText("UTF-8")
        encoding_layout.addWidget(encoding_label)
        encoding_layout.addWidget(self.encoding_combo)
        layout.addLayout(encoding_layout)
        
        # 分隔符 (仅CSV)
        delimiter_layout = QHBoxLayout()
        delimiter_label = QLabel("分隔符:")
        self.delimiter_edit = QLineEdit(",")
        self.delimiter_edit.setMaximumWidth(50)
        delimiter_layout.addWidget(delimiter_label)
        delimiter_layout.addWidget(self.delimiter_edit)
        layout.addLayout(delimiter_layout)
        
        # 引号 (仅CSV)
        quote_layout = QHBoxLayout()
        quote_label = QLabel("引号:")
        self.quote_edit = QLineEdit('"')
        self.quote_edit.setMaximumWidth(50)
        quote_layout.addWidget(quote_label)
        quote_layout.addWidget(self.quote_edit)
        layout.addLayout(quote_layout)
        
        # 包含表头
        self.header_check = QCheckBox("包含表头")
        self.header_check.setChecked(True)
        layout.addWidget(self.header_check)
        
        # 批量大小
        batch_layout = QHBoxLayout()
        batch_label = QLabel("批量大小:")
        self.batch_spin = QSpinBox()
        self.batch_spin.setRange(1, 10000)
        self.batch_spin.setValue(1000)
        batch_layout.addWidget(batch_label)
        batch_layout.addWidget(self.batch_spin)
        layout.addLayout(batch_layout)
        
        self.registerField('encoding', self.encoding_combo)
        self.registerField('delimiter', self.delimiter_edit)
        self.registerField('quote', self.quote_edit)
        self.registerField('header', self.header_check)
        self.registerField('batch_size', self.batch_spin)
        
        self.setLayout(layout)

class ImportSummaryPage(QWizardPage):
    """导入摘要页面"""
    def __init__(self, parent):
        super(ImportSummaryPage, self).__init__(parent)
        self.setTitle("导入摘要")
        self.setSubTitle("确认导入设置")
        
        layout = QVBoxLayout()
        
        self.summary_text = QTextEdit()
        self.summary_text.setReadOnly(True)
        layout.addWidget(self.summary_text)
        
        self.setLayout(layout)
    
    def initializePage(self):
        """初始化页面"""
        file_path = self.wizard().field('file_path')
        format = self.wizard().field('format')
        table = self.wizard().field('source')
        encoding = self.wizard().field('encoding')
        
        format_names = {0: "CSV", 1: "Excel", 2: "JSON", 3: "SQL"}
        
        summary = f"文件路径: {file_path}\n"
        summary += f"文件格式: {format_names.get(format, '未知')}\n"
        summary += f"目标表: {table}\n"
        summary += f"编码: {encoding}\n"
        summary += f"包含表头: {'是' if self.wizard().field('header') else '否'}\n"
        summary += f"批量大小: {self.wizard().field('batch_size')}\n"
        
        self.summary_text.setPlainText(summary)
