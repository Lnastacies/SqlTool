#!/usr/bin/env python3
"""
性能监控组件
"""

import time
import psutil
import os
from datetime import datetime, timedelta
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QTabWidget, QWidget,
    QComboBox, QSpinBox, QTextEdit, QProgressBar, QGroupBox
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtGui import QColor, QFont


class PerformanceMonitor(QDialog):
    """性能监控对话框"""
    
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        self.monitoring = False
        self.metrics_history = []
        
        self.setWindowTitle("性能监控")
        self.setGeometry(150, 100, 900, 600)
        self.setMinimumSize(800, 500)
        self.setStyleSheet("""
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QTableWidget {
                border: 1px solid #d0d0d0;
                background-color: #ffffff;
                font-size: 12px;
            }
            QTableWidget::item {
                padding: 6px;
            }
            QPushButton {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
                border-radius: 3px;
                padding: 8px 20px;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
            }
            QPushButton#primary {
                background-color: #1a73e8;
                color: white;
                border: none;
            }
            QPushButton#danger {
                background-color: #dc3545;
                color: white;
                border: none;
            }
            QLabel {
                font-size: 12px;
            }
            QLabel#big {
                font-size: 28px;
                font-weight: bold;
            }
            QLabel#medium {
                font-size: 18px;
                font-weight: bold;
            }
            QProgressBar {
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                text-align: center;
                height: 20px;
            }
            QProgressBar::chunk {
                background-color: #4CAF50;
                border-radius: 3px;
            }
        """)
        
        self.setup_ui()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(16, 16, 16, 16)
        
        # 标签页
        self.tabs = QTabWidget()
        
        # 系统概览
        overview_tab = self.create_overview_tab()
        self.tabs.addTab(overview_tab, "系统概览")
        
        # 数据库状态
        db_tab = self.create_database_tab()
        self.tabs.addTab(db_tab, "数据库状态")
        
        # 查询历史
        query_tab = self.create_query_tab()
        self.tabs.addTab(query_tab, "查询历史")
        
        # 慢查询
        slow_tab = self.create_slow_query_tab()
        self.tabs.addTab(slow_tab, "慢查询分析")
        
        layout.addWidget(self.tabs)
        
        # 底部按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        self.refresh_btn = QPushButton("刷新")
        self.refresh_btn.clicked.connect(self.refresh_all)
        btn_layout.addWidget(self.refresh_btn)
        
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(self.accept)
        btn_layout.addWidget(close_btn)
        
        layout.addLayout(btn_layout)
    
    def create_overview_tab(self):
        """创建系统概览标签页"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setSpacing(15)
        
        # CPU使用率
        cpu_group = QGroupBox("CPU使用率")
        cpu_layout = QVBoxLayout(cpu_group)
        
        cpu_label_layout = QHBoxLayout()
        self.cpu_label = QLabel("0%")
        self.cpu_label.setObjectName("big")
        self.cpu_label.setStyleSheet("color: #4CAF50;")
        cpu_label_layout.addWidget(self.cpu_label)
        cpu_label_layout.addStretch()
        cpu_layout.addLayout(cpu_label_layout)
        
        self.cpu_bar = QProgressBar()
        self.cpu_bar.setRange(0, 100)
        self.cpu_bar.setValue(0)
        cpu_layout.addWidget(self.cpu_bar)
        
        layout.addWidget(cpu_group)
        
        # 内存使用
        mem_group = QGroupBox("内存使用")
        mem_layout = QVBoxLayout(mem_group)
        
        mem_label_layout = QHBoxLayout()
        self.mem_label = QLabel("0 MB / 0 MB")
        self.mem_label.setObjectName("big")
        self.mem_label.setStyleSheet("color: #2196F3;")
        mem_label_layout.addWidget(self.mem_label)
        mem_label_layout.addStretch()
        mem_layout.addLayout(mem_label_layout)
        
        self.mem_bar = QProgressBar()
        self.mem_bar.setRange(0, 100)
        self.mem_bar.setValue(0)
        mem_layout.addWidget(self.mem_bar)
        
        layout.addWidget(mem_group)
        
        # 磁盘使用
        disk_group = QGroupBox("磁盘使用")
        disk_layout = QVBoxLayout(disk_group)
        
        disk_label_layout = QHBoxLayout()
        self.disk_label = QLabel("0 GB / 0 GB")
        self.disk_label.setObjectName("big")
        self.disk_label.setStyleSheet("color: #FF9800;")
        disk_label_layout.addWidget(self.disk_label)
        disk_label_layout.addStretch()
        disk_layout.addLayout(disk_label_layout)
        
        self.disk_bar = QProgressBar()
        self.disk_bar.setRange(0, 100)
        self.disk_bar.setValue(0)
        disk_layout.addWidget(self.disk_bar)
        
        layout.addWidget(disk_group)
        
        # 进程信息
        process_group = QGroupBox("当前进程")
        process_layout = QVBoxLayout(process_group)
        
        self.process_label = QLabel("进程ID: -")
        process_layout.addWidget(self.process_label)
        
        self.thread_label = QLabel("线程数: -")
        process_layout.addWidget(self.thread_label)
        
        layout.addWidget(process_group)
        
        layout.addStretch()
        
        return tab
    
    def create_database_tab(self):
        """创建数据库状态标签页"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        self.db_status_table = QTableWidget()
        self.db_status_table.setColumnCount(3)
        self.db_status_table.setHorizontalHeaderLabels(["状态项", "当前值", "状态"])
        self.db_status_table.setRowCount(8)
        self.db_status_table.horizontalHeader().setStretchLastSection(True)
        
        status_items = [
            ("连接数", "0", "正常"),
            ("活动连接", "0", "正常"),
            ("最大连接数", "100", "正常"),
            ("查询缓存大小", "-", "正常"),
            ("缓冲池大小", "-", "正常"),
            ("InnoDB缓冲池使用", "-", "正常"),
            ("打开的表", "0", "正常"),
            ("查询缓存命中率", "-", "正常"),
        ]
        
        for i, (name, value, status) in enumerate(status_items):
            self.db_status_table.setItem(i, 0, QTableWidgetItem(name))
            self.db_status_table.setItem(i, 1, QTableWidgetItem(value))
            status_item = QTableWidgetItem(status)
            status_item.setForeground(QColor("#4CAF50"))
            self.db_status_table.setItem(i, 2, status_item)
        
        layout.addWidget(self.db_status_table)
        
        return tab
    
    def create_query_tab(self):
        """创建查询历史标签页"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        self.query_history_table = QTableWidget()
        self.query_history_table.setColumnCount(5)
        self.query_history_table.setHorizontalHeaderLabels(["时间", "查询", "执行时间", "影响行数", "状态"])
        self.query_history_table.horizontalHeader().setStretchLastSection(True)
        
        layout.addWidget(self.query_history_table)
        
        return tab
    
    def create_slow_query_tab(self):
        """创建慢查询标签页"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        info_layout = QHBoxLayout()
        info_layout.addWidget(QLabel("慢查询阈值 (秒):"))
        self.slow_threshold = QSpinBox()
        self.slow_threshold.setRange(1, 300)
        self.slow_threshold.setValue(1)
        info_layout.addWidget(self.slow_threshold)
        info_layout.addStretch()
        layout.addLayout(info_layout)
        
        self.slow_query_table = QTableWidget()
        self.slow_query_table.setColumnCount(4)
        self.slow_query_table.setHorizontalHeaderLabels(["查询", "执行时间", "执行时间戳", "数据库"])
        self.slow_query_table.horizontalHeader().setStretchLastSection(True)
        
        layout.addWidget(self.slow_query_table)
        
        return tab
    
    def refresh_all(self):
        """刷新所有监控数据"""
        self.refresh_system_info()
        self.refresh_database_info()
    
    def refresh_system_info(self):
        """刷新系统信息"""
        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=0.1)
            self.cpu_label.setText(f"{cpu_percent:.1f}%")
            self.cpu_bar.setValue(int(cpu_percent))
            
            if cpu_percent > 80:
                self.cpu_label.setStyleSheet("color: #F44336;")
            elif cpu_percent > 60:
                self.cpu_label.setStyleSheet("color: #FF9800;")
            else:
                self.cpu_label.setStyleSheet("color: #4CAF50;")
            
            # 内存
            mem = psutil.virtual_memory()
            mem_used = mem.used / (1024**3)
            mem_total = mem.total / (1024**3)
            mem_percent = mem.percent
            
            self.mem_label.setText(f"{mem_used:.1f} GB / {mem_total:.1f} GB")
            self.mem_bar.setValue(int(mem_percent))
            
            if mem_percent > 90:
                self.mem_label.setStyleSheet("color: #F44336;")
            elif mem_percent > 70:
                self.mem_label.setStyleSheet("color: #FF9800;")
            else:
                self.mem_label.setStyleSheet("color: #2196F3;")
            
            # 磁盘
            disk = psutil.disk_usage('/')
            disk_used = disk.used / (1024**3)
            disk_total = disk.total / (1024**3)
            disk_percent = disk.percent
            
            self.disk_label.setText(f"{disk_used:.1f} GB / {disk_total:.1f} GB")
            self.disk_bar.setValue(int(disk_percent))
            
            if disk_percent > 90:
                self.disk_label.setStyleSheet("color: #F44336;")
            elif disk_percent > 80:
                self.disk_label.setStyleSheet("color: #FF9800;")
            else:
                self.disk_label.setStyleSheet("color: #FF9800;")
            
            # 进程
            process = psutil.Process(os.getpid())
            self.process_label.setText(f"进程ID: {process.pid}")
            self.thread_label.setText(f"线程数: {process.num_threads()}")
            
        except Exception as e:
            self.logger.log('ERROR', f"刷新系统信息失败: {str(e)}")
    
    def refresh_database_info(self):
        """刷新数据库信息"""
        try:
            if not hasattr(self.main_window, 'db_connection') or not self.main_window.db_connection:
                return
            
            with self.main_window.db_connection.cursor() as cursor:
                if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    cursor.execute("SHOW STATUS LIKE 'Threads_connected'")
                    threads = cursor.fetchone()
                    
                    if threads:
                        self.db_status_table.item(0, 1).setText(threads[1])
        except Exception:
            pass


class QueryAnalyzer:
    """查询分析器"""
    
    @staticmethod
    def explain_query(connection, sql, db_type='MySQL'):
        """分析查询执行计划
        
        Args:
            connection: 数据库连接
            sql: SQL语句
            db_type: 数据库类型
            
        Returns:
            执行计划信息
        """
        try:
            with connection.cursor() as cursor:
                if db_type in ('MySQL', 'MariaDB'):
                    cursor.execute(f"EXPLAIN {sql}")
                    return cursor.fetchall()
                elif db_type == 'PostgreSQL':
                    cursor.execute(f"EXPLAIN ANALYZE {sql}")
                    return cursor.fetchall()
        except Exception as e:
            return None, str(e)
    
    @staticmethod
    def check_query_performance(sql):
        """检查查询性能问题
        
        Args:
            sql: SQL语句
            
        Returns:
            (has_issues, warnings)
        """
        warnings = []
        sql_upper = sql.upper()
        
        # 检查SELECT *
        if 'SELECT *' in sql_upper:
            warnings.append("使用SELECT * 会检索所有列，建议明确指定需要的列")
        
        # 检查LIKE以通配符开头
        if "'%'" in sql_upper or '"%"' in sql_upper:
            warnings.append("LIKE查询以通配符开头无法使用索引")
        
        # 检查子查询
        if 'SELECT' in sql_upper and sql_upper.count('SELECT') > 1:
            warnings.append("存在嵌套子查询，可能影响性能，考虑使用JOIN重写")
        
        # 检查OR条件
        if ' OR ' in sql_upper:
            warnings.append("OR条件可能导致索引失效，考虑使用UNION")
        
        # 检查NOT IN
        if 'NOT IN' in sql_upper:
            warnings.append("NOT IN 可能导致性能问题，考虑使用NOT EXISTS")
        
        # 检查COUNT(*)
        if 'COUNT(*)' in sql_upper:
            warnings.append("COUNT(*) 会统计所有行，如果只需要计数主键使用COUNT(id)")
        
        # 检查JOIN无索引
        if 'JOIN' in sql_upper:
            warnings.append("JOIN操作确保关联列有索引")
        
        return len(warnings) > 0, warnings


class IndexAdvisor:
    """索引建议器"""
    
    @staticmethod
    def suggest_indexes(connection, table_name, recent_queries=None, db_type='MySQL'):
        """为表建议索引
        
        Args:
            connection: 数据库连接
            table_name: 表名
            recent_queries: 最近执行的查询列表
            db_type: 数据库类型
            
        Returns:
            建议的索引列表
        """
        suggestions = []
        
        try:
            with connection.cursor() as cursor:
                if db_type in ('MySQL', 'MariaDB'):
                    # 获取表结构
                    cursor.execute(f"SHOW CREATE TABLE `{table_name}`")
                    create_stmt = cursor.fetchone()
                    
                    # 获取最近的查询（如果有）
                    if recent_queries:
                        for query in recent_queries:
                            if table_name.upper() in query.upper():
                                # 分析WHERE子句中的列
                                import re
                                where_cols = re.findall(r'WHERE\s+(\w+)', query, re.IGNORECASE)
                                for col in where_cols:
                                    suggestions.append({
                                        'table': table_name,
                                        'column': col,
                                        'type': '单列索引',
                                        'reason': f'在查询 "{query[:50]}..." 的WHERE子句中使用'
                                    })
                    
                    # 检查主键
                    cursor.execute(f"SHOW INDEX FROM `{table_name}`")
                    indexes = cursor.fetchall()
                    
                    primary_cols = [idx[4] for idx in indexes if idx[2] == 'PRIMARY']
                    if not primary_cols:
                        suggestions.append({
                            'table': table_name,
                            'column': '建议添加主键',
                            'type': '主键',
                            'reason': '表没有主键'
                        })
        
        except Exception:
            pass
        
        return suggestions
