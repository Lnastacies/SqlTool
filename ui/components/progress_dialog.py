#!/usr/bin/env python3
"""
操作进度显示组件
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QProgressBar, QLabel,
    QPushButton, QTextEdit, QApplication
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtGui import QFont


class ProgressDialog(QDialog):
    """进度对话框"""
    
    canceled = pyqtSignal()
    
    def __init__(self, parent=None, title="执行中", message="正在处理..."):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.setWindowFlags(Qt.WindowType.Dialog | Qt.WindowType.WindowTitleHint | Qt.WindowType.WindowCloseButtonHint)
        self.setModal(True)
        self.setMinimumWidth(400)
        self.setStyleSheet("""
            QDialog {
                background-color: #FFFFFF;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QProgressBar {
                border: 1px solid #CCCCCC;
                border-radius: 4px;
                text-align: center;
                height: 24px;
                font-size: 12px;
            }
            QProgressBar::chunk {
                background-color: #4CAF50;
                border-radius: 3px;
            }
            QLabel {
                font-size: 13px;
                color: #333333;
            }
            QTextEdit {
                border: 1px solid #E0E0E0;
                background-color: #FAFAFA;
                font-family: 'Consolas', monospace;
                font-size: 11px;
                max-height: 100px;
            }
            QPushButton {
                background-color: #F0F0F0;
                border: 1px solid #D0D0D0;
                border-radius: 3px;
                padding: 6px 20px;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #E0E0E0;
            }
            QPushButton#cancel_btn {
                background-color: #f44336;
                color: white;
                border: none;
            }
            QPushButton#cancel_btn:hover {
                background-color: #d32f2f;
            }
        """)
        
        self._is_canceled = False
        self._setup_ui(message)
    
    def _setup_ui(self, message):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(20, 20, 20, 20)
        
        # 状态标签
        self.status_label = QLabel(message)
        self.status_label.setWordWrap(True)
        layout.addWidget(self.status_label)
        
        # 进度条
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        self.progress_bar.setTextVisible(True)
        self.progress_bar.setFormat("%p% - %v/%m")
        layout.addWidget(self.progress_bar)
        
        # 详细信息
        self.details_text = QTextEdit()
        self.details_text.setReadOnly(True)
        self.details_text.setMaximumHeight(80)
        layout.addWidget(self.details_text)
        
        # 按钮区域
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        
        self.cancel_btn = QPushButton("取消")
        self.cancel_btn.setObjectName("cancel_btn")
        self.cancel_btn.clicked.connect(self.on_cancel)
        button_layout.addWidget(self.cancel_btn)
        
        layout.addLayout(button_layout)
    
    def set_message(self, message):
        """设置状态消息"""
        self.status_label.setText(message)
        self.details_text.append(message)
        QApplication.processEvents()
    
    def set_progress(self, value, message=""):
        """设置进度
        
        Args:
            value: 进度值（0-100）
            message: 状态消息
        """
        self.progress_bar.setValue(value)
        if message:
            self.status_label.setText(message)
            self.details_text.append(message)
        QApplication.processEvents()
    
    def set_progress_with_count(self, current, total, message=""):
        """设置进度（带数量显示）
        
        Args:
            current: 当前数量
            total: 总数量
            message: 状态消息
        """
        if total > 0:
            percent = int(current * 100 / total)
            self.progress_bar.setValue(percent)
        
        if message:
            self.status_label.setText(message)
            self.details_text.append(message)
        QApplication.processEvents()
    
    def add_detail(self, detail):
        """添加详细信息"""
        self.details_text.append(detail)
        QApplication.processEvents()
    
    def set_indeterminate(self, indeterminate=True):
        """设置是否为不确定模式"""
        if indeterminate:
            self.progress_bar.setRange(0, 0)
            self.progress_bar.setFormat("处理中...")
        else:
            self.progress_bar.setRange(0, 100)
            self.progress_bar.setFormat("%p%")
    
    def is_canceled(self):
        """检查是否已取消"""
        return self._is_canceled
    
    def on_cancel(self):
        """取消操作"""
        self._is_canceled = True
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.setText("正在取消...")
        self.canceled.emit()


class BatchOperationProgress(QDialog):
    """批量操作进度对话框"""
    
    def __init__(self, parent=None, title="批量操作"):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.setWindowFlags(Qt.WindowType.Dialog | Qt.WindowType.WindowTitleHint | Qt.WindowType.WindowCloseButtonHint)
        self.setModal(True)
        self.setMinimumWidth(500)
        self.setMinimumHeight(350)
        self.setStyleSheet("""
            QDialog {
                background-color: #FFFFFF;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QProgressBar {
                border: 1px solid #CCCCCC;
                border-radius: 4px;
                text-align: center;
                height: 20px;
            }
            QProgressBar::chunk {
                background-color: #2196F3;
                border-radius: 3px;
            }
            QLabel {
                font-size: 12px;
                color: #666666;
            }
            QTextEdit {
                border: 1px solid #E0E0E0;
                background-color: #FAFAFA;
                font-family: 'Consolas', monospace;
                font-size: 11px;
            }
            QPushButton {
                background-color: #F0F0F0;
                border: 1px solid #D0D0D0;
                border-radius: 3px;
                padding: 6px 20px;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #E0E0E0;
            }
        """)
        
        self._is_canceled = False
        self._setup_ui()
    
    def _setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(10)
        layout.setContentsMargins(20, 20, 20, 20)
        
        # 总体进度
        overall_layout = QHBoxLayout()
        overall_layout.addWidget(QLabel("总体进度:"))
        self.overall_progress = QProgressBar()
        self.overall_progress.setRange(0, 100)
        overall_layout.addWidget(self.overall_progress, 1)
        self.overall_label = QLabel("0%")
        overall_layout.addWidget(self.overall_label)
        layout.addLayout(overall_layout)
        
        # 当前操作
        current_layout = QHBoxLayout()
        current_layout.addWidget(QLabel("当前操作:"))
        self.current_label = QLabel("-")
        self.current_label.setStyleSheet("color: #333333; font-weight: bold;")
        current_layout.addWidget(self.current_label, 1)
        layout.addLayout(current_layout)
        
        # 单项进度
        item_layout = QHBoxLayout()
        item_layout.addWidget(QLabel("单项进度:"))
        self.item_progress = QProgressBar()
        self.item_progress.setRange(0, 100)
        item_layout.addWidget(self.item_progress, 1)
        self.item_label = QLabel("0/0")
        item_layout.addWidget(self.item_label)
        layout.addLayout(item_layout)
        
        # 详细信息
        self.details_text = QTextEdit()
        self.details_text.setReadOnly(True)
        layout.addWidget(self.details_text, 1)
        
        # 统计信息
        stats_layout = QHBoxLayout()
        self.success_label = QLabel("成功: 0")
        self.success_label.setStyleSheet("color: #4CAF50;")
        stats_layout.addWidget(self.success_label)
        
        self.failed_label = QLabel("失败: 0")
        self.failed_label.setStyleSheet("color: #f44336;")
        stats_layout.addWidget(self.failed_label)
        
        self.elapsed_label = QLabel("耗时: 0秒")
        stats_layout.addWidget(self.elapsed_label)
        
        stats_layout.addStretch()
        layout.addLayout(stats_layout)
        
        # 按钮
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        
        self.cancel_btn = QPushButton("取消")
        self.cancel_btn.clicked.connect(self.on_cancel)
        button_layout.addWidget(self.cancel_btn)
        
        self.close_btn = QPushButton("关闭")
        self.close_btn.setEnabled(False)
        self.close_btn.clicked.connect(self.accept)
        button_layout.addWidget(self.close_btn)
        
        layout.addLayout(button_layout)
    
    def set_overall_progress(self, value, message=""):
        """设置总体进度"""
        self.overall_progress.setValue(value)
        self.overall_label.setText(f"{value}%")
        if message:
            self.current_label.setText(message)
            self.add_log(message)
    
    def set_item_progress(self, current, total):
        """设置单项进度"""
        if total > 0:
            percent = int(current * 100 / total)
            self.item_progress.setValue(percent)
            self.item_label.setText(f"{current}/{total}")
    
    def set_success_count(self, count):
        """设置成功数量"""
        self.success_label.setText(f"成功: {count}")
    
    def set_failed_count(self, count):
        """设置失败数量"""
        self.failed_label.setText(f"失败: {count}")
    
    def set_elapsed_time(self, seconds):
        """设置已用时间"""
        if seconds < 60:
            self.elapsed_label.setText(f"耗时: {seconds}秒")
        else:
            mins = seconds // 60
            secs = seconds % 60
            self.elapsed_label.setText(f"耗时: {mins}分{secs}秒")
    
    def add_log(self, message):
        """添加日志"""
        from datetime import datetime
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.details_text.append(f"[{timestamp}] {message}")
    
    def is_canceled(self):
        """检查是否已取消"""
        return self._is_canceled
    
    def on_cancel(self):
        """取消操作"""
        self._is_canceled = True
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.setText("正在取消...")
    
    def finish(self, success_count, failed_count, elapsed_seconds):
        """完成"""
        self.set_success_count(success_count)
        self.set_failed_count(failed_count)
        self.set_elapsed_time(elapsed_seconds)
        self.cancel_btn.setEnabled(False)
        self.close_btn.setEnabled(True)
        self.setWindowTitle("操作完成")
