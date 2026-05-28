#!/usr/bin/env python3
"""
计划任务管理器
"""

import json
import os
import threading
import time
from datetime import datetime, timedelta
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QLabel, QLineEdit, QComboBox, QMessageBox, QMenu,
    QToolBar, QHeaderView, QAbstractItemView, QCheckBox, QSpinBox,
    QTimeEdit, QGroupBox, QFormLayout, QTextEdit, QListWidget,
    QListWidgetItem, QInputDialog
)
from PyQt6.QtCore import Qt, QTimer, QDateTime
from PyQt6.QtGui import QCursor


class ScheduledTask:
    """计划任务"""
    
    def __init__(self, task_id, name, task_type, schedule, action, enabled=True):
        self.id = task_id
        self.name = name
        self.task_type = task_type  # backup, query, export
        self.schedule = schedule     # cron表达式或简单配置
        self.action = action         # 执行的动作
        self.enabled = enabled
        self.last_run = None
        self.next_run = None
        self.status = "等待"
        self.last_result = None


class TaskScheduler:
    """任务调度器"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._initialized = True
        self.tasks = []
        self.running = False
        self.logger = None
        self._load_tasks()
    
    def set_logger(self, logger):
        """设置日志记录器"""
        self.logger = logger
    
    def _load_tasks(self):
        """加载任务配置"""
        if os.path.exists('scheduled_tasks.json'):
            try:
                with open('scheduled_tasks.json', 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.tasks = [ScheduledTask(**t) for t in data]
            except Exception:
                self.tasks = []
    
    def _save_tasks(self):
        """保存任务配置"""
        try:
            data = [{
                'task_id': t.id,
                'name': t.name,
                'task_type': t.task_type,
                'schedule': t.schedule,
                'action': t.action,
                'enabled': t.enabled
            } for t in self.tasks]
            with open('scheduled_tasks.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    
    def add_task(self, name, task_type, schedule, action):
        """添加任务"""
        task_id = f"task_{len(self.tasks) + 1}_{int(time.time())}"
        task = ScheduledTask(task_id, name, task_type, schedule, action)
        self.tasks.append(task)
        self._save_tasks()
        self._calculate_next_run(task)
        
        if self.logger:
            self.logger.log('INFO', f"添加计划任务: {name}")
        
        return task
    
    def remove_task(self, task_id):
        """删除任务"""
        self.tasks = [t for t in self.tasks if t.id != task_id]
        self._save_tasks()
    
    def update_task(self, task_id, **kwargs):
        """更新任务"""
        for task in self.tasks:
            if task.id == task_id:
                for key, value in kwargs.items():
                    if hasattr(task, key):
                        setattr(task, key, value)
                self._save_tasks()
                self._calculate_next_run(task)
                break
    
    def _calculate_next_run(self, task):
        """计算下次执行时间"""
        schedule = task.schedule
        
        if schedule.get('type') == 'interval':
            # 间隔执行
            interval = schedule.get('interval_seconds', 3600)
            if task.last_run:
                task.next_run = datetime.fromtimestamp(
                    task.last_run.timestamp() + interval
                )
            else:
                task.next_run = datetime.now()
        
        elif schedule.get('type') == 'daily':
            # 每日执行
            time_str = schedule.get('time', '00:00')
            hour, minute = map(int, time_str.split(':'))
            now = datetime.now()
            next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if next_run <= now:
                next_run += timedelta(days=1)
            task.next_run = next_run
        
        elif schedule.get('type') == 'weekly':
            # 每周执行
            time_str = schedule.get('time', '00:00')
            day_of_week = schedule.get('day_of_week', 0)
            hour, minute = map(int, time_str.split(':'))
            now = datetime.now()
            next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            days_ahead = day_of_week - now.weekday()
            if days_ahead < 0:
                days_ahead += 7
            elif days_ahead == 0 and next_run <= now:
                days_ahead = 7
            
            task.next_run = next_run + timedelta(days=days_ahead)
    
    def start(self):
        """启动调度器"""
        if self.running:
            return
        
        self.running = True
        self._scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self._scheduler_thread.start()
        
        if self.logger:
            self.logger.log('INFO', "计划任务调度器已启动")
    
    def stop(self):
        """停止调度器"""
        self.running = False
        if self.logger:
            self.logger.log('INFO', "计划任务调度器已停止")
    
    def _run_scheduler(self):
        """运行调度器"""
        while self.running:
            now = datetime.now()
            
            for task in self.tasks:
                if not task.enabled:
                    continue
                
                if task.next_run and now >= task.next_run:
                    self._execute_task(task)
            
            time.sleep(10)  # 每10秒检查一次
    
    def _execute_task(self, task):
        """执行任务"""
        task.status = "执行中"
        task.last_run = datetime.now()
        
        if self.logger:
            self.logger.log('INFO', f"开始执行任务: {task.name}")
        
        try:
            if task.task_type == 'backup':
                self._execute_backup(task)
            elif task.task_type == 'query':
                self._execute_query(task)
            elif task.task_type == 'export':
                self._execute_export(task)
            
            task.status = "成功"
            task.last_result = "执行成功"
            
        except Exception as e:
            task.status = "失败"
            task.last_result = str(e)
            
            if self.logger:
                self.logger.log('ERROR', f"任务执行失败: {task.name} - {str(e)}")
        
        # 计算下次执行时间
        self._calculate_next_run(task)
        self._save_tasks()
    
    def _execute_backup(self, task):
        """执行备份任务"""
        # 实现备份逻辑
        pass
    
    def _execute_query(self, task):
        """执行查询任务"""
        # 实现查询逻辑
        pass
    
    def _execute_export(self, task):
        """执行导出任务"""
        # 实现导出逻辑
        pass


class TaskSchedulerDialog(QDialog):
    """计划任务对话框"""
    
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        self.scheduler = TaskScheduler()
        self.scheduler.set_logger(main_window.logger)
        
        self.setWindowTitle("计划任务")
        self.setGeometry(150, 100, 900, 600)
        self.setMinimumSize(800, 450)
        self.setStyleSheet("""
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QTableWidget {
                background-color: #ffffff;
                alternate-background-color: #f9f9f9;
                border: 1px solid #d0d0d0;
                font-size: 12px;
            }
            QTableWidget::item {
                padding: 6px 8px;
            }
            QTableWidget::item:selected {
                background-color: #e3f2fd;
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
            QPushButton#success {
                background-color: #28a745;
                color: white;
                border: none;
            }
            QPushButton#success:hover {
                background-color: #218838;
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
        """)
        
        self.setup_ui()
        self.load_tasks()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(8)
        
        # 工具栏
        toolbar = QToolBar()
        
        start_btn = QPushButton("启动调度")
        start_btn.clicked.connect(self.start_scheduler)
        toolbar.addWidget(start_btn)
        
        stop_btn = QPushButton("停止调度")
        stop_btn.clicked.connect(self.stop_scheduler)
        toolbar.addWidget(stop_btn)
        
        toolbar.addSeparator()
        
        add_btn = QPushButton("添加任务")
        add_btn.clicked.connect(self.add_task)
        toolbar.addWidget(add_btn)
        
        toolbar.addSeparator()
        
        refresh_btn = QPushButton("刷新")
        refresh_btn.clicked.connect(self.load_tasks)
        toolbar.addWidget(refresh_btn)
        
        layout.addWidget(toolbar)
        
        # 任务列表
        self.task_table = QTableWidget()
        self.task_table.setColumnCount(7)
        self.task_table.setHorizontalHeaderLabels(["状态", "名称", "类型", "计划", "下次执行", "上次执行", "结果"])
        self.task_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.task_table.setAlternatingRowColors(True)
        self.task_table.horizontalHeader().setStretchLastSection(True)
        self.task_table.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.task_table.customContextMenuRequested.connect(self.show_context_menu)
        layout.addWidget(self.task_table, 1)
        
        # 底部按钮
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(self.accept)
        button_layout.addWidget(close_btn)
        
        layout.addLayout(button_layout)
    
    def load_tasks(self):
        """加载任务列表"""
        self.task_table.setRowCount(len(self.scheduler.tasks))
        
        for row, task in enumerate(self.scheduler.tasks):
            # 状态
            status_item = QTableWidgetItem("✓" if task.enabled else "○")
            status_item.setForeground(QColor("#28a745") if task.enabled else QColor("#6c757d"))
            self.task_table.setItem(row, 0, status_item)
            
            # 其他列
            self.task_table.setItem(row, 1, QTableWidgetItem(task.name))
            self.task_table.setItem(row, 2, QTableWidgetItem(task.task_type))
            self.task_table.setItem(row, 3, QTableWidgetItem(str(task.schedule)))
            self.task_table.setItem(row, 4, QTableWidgetItem(
                task.next_run.strftime("%Y-%m-%d %H:%M") if task.next_run else "-"
            ))
            self.task_table.setItem(row, 5, QTableWidgetItem(
                task.last_run.strftime("%Y-%m-%d %H:%M") if task.last_run else "-"
            ))
            self.task_table.setItem(row, 6, QTableWidgetItem(task.last_result or task.status))
    
    def add_task(self):
        """添加任务"""
        dialog = TaskEditorDialog(self)
        if dialog.exec():
            data = dialog.get_data()
            self.scheduler.add_task(
                name=data['name'],
                task_type=data['type'],
                schedule=data['schedule'],
                action=data['action']
            )
            self.load_tasks()
    
    def start_scheduler(self):
        """启动调度器"""
        self.scheduler.start()
        QMessageBox.information(self, "提示", "计划任务调度器已启动")
    
    def stop_scheduler(self):
        """停止调度器"""
        self.scheduler.stop()
        QMessageBox.information(self, "提示", "计划任务调度器已停止")
    
    def show_context_menu(self, pos):
        """右键菜单"""
        menu = QMenu()
        menu.addAction("编辑", self.edit_task)
        menu.addAction("启用/禁用", self.toggle_task)
        menu.addAction("立即执行", self.run_task_now)
        menu.addSeparator()
        menu.addAction("删除", self.delete_task)
        menu.exec(QCursor.pos())
    
    def edit_task(self):
        """编辑任务"""
        QMessageBox.information(self, "提示", "编辑功能待实现")
    
    def toggle_task(self):
        """切换启用状态"""
        row = self.task_table.currentRow()
        if row >= 0 and row < len(self.scheduler.tasks):
            task = self.scheduler.tasks[row]
            task.enabled = not task.enabled
            self.scheduler._save_tasks()
            self.load_tasks()
    
    def run_task_now(self):
        """立即执行"""
        row = self.task_table.currentRow()
        if row >= 0 and row < len(self.scheduler.tasks):
            task = self.scheduler.tasks[row]
            self.scheduler._execute_task(task)
            self.load_tasks()
            QMessageBox.information(self, "提示", f"任务 '{task.name}' 已执行")
    
    def delete_task(self):
        """删除任务"""
        row = self.task_table.currentRow()
        if row >= 0 and row < len(self.scheduler.tasks):
            task = self.scheduler.tasks[row]
            
            if QMessageBox.question(self, "删除确认", 
                                  f"确定要删除任务 '{task.name}' 吗？",
                                  QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes:
                self.scheduler.remove_task(task.id)
                self.load_tasks()


class TaskEditorDialog(QDialog):
    """任务编辑器"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent = parent
        
        self.setWindowTitle("添加任务")
        self.setGeometry(300, 200, 500, 450)
        self.setStyleSheet("""
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QLineEdit, QTextEdit {
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 8px;
            }
            QPushButton {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
                border-radius: 3px;
                padding: 8px 20px;
            }
            QPushButton#primary {
                background-color: #1a73e8;
                color: white;
                border: none;
            }
            QGroupBox {
                font-weight: 600;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                padding: 10px;
            }
        """)
        
        self.setup_ui()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(16, 16, 16, 16)
        
        # 任务名称
        name_layout = QHBoxLayout()
        name_layout.addWidget(QLabel("任务名称:"))
        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("输入任务名称...")
        name_layout.addWidget(self.name_input, 1)
        layout.addLayout(name_layout)
        
        # 任务类型
        type_layout = QHBoxLayout()
        type_layout.addWidget(QLabel("任务类型:"))
        self.type_combo = QComboBox()
        self.type_combo.addItems(["备份", "查询", "导出"])
        type_layout.addWidget(self.type_combo, 1)
        layout.addLayout(type_layout)
        
        # 调度计划
        schedule_group = QGroupBox("执行计划")
        schedule_layout = QVBoxLayout(schedule_group)
        
        self.schedule_type = QComboBox()
        self.schedule_type.addItems(["间隔执行", "每日执行", "每周执行"])
        schedule_layout.addWidget(self.schedule_type)
        
        self.interval_layout = QHBoxLayout()
        self.interval_layout.addWidget(QLabel("间隔(秒):"))
        self.interval_input = QSpinBox()
        self.interval_input.setRange(60, 86400)
        self.interval_input.setValue(3600)
        self.interval_layout.addWidget(self.interval_input)
        schedule_layout.addLayout(self.interval_layout)
        
        self.time_layout = QHBoxLayout()
        self.time_layout.addWidget(QLabel("执行时间:"))
        self.time_input = QTimeEdit()
        self.time_input.setTime(Qt.Time(0, 0))
        self.time_layout.addWidget(self.time_input)
        schedule_layout.addLayout(self.time_layout)
        
        layout.addWidget(schedule_group)
        
        # 执行动作
        action_group = QGroupBox("执行动作")
        action_layout = QVBoxLayout(action_group)
        
        self.action_text = QTextEdit()
        self.action_text.setPlaceholderText("输入SQL语句或配置...")
        action_layout.addWidget(self.action_text)
        
        layout.addWidget(action_group, 1)
        
        # 按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        save_btn = QPushButton("保存")
        save_btn.setObjectName("primary")
        save_btn.clicked.connect(self.accept)
        btn_layout.addWidget(save_btn)
        
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)
        
        layout.addLayout(btn_layout)
    
    def get_data(self):
        """获取数据"""
        schedule = {}
        
        if self.schedule_type.currentIndex() == 0:
            schedule = {
                'type': 'interval',
                'interval_seconds': self.interval_input.value()
            }
        elif self.schedule_type.currentIndex() == 1:
            schedule = {
                'type': 'daily',
                'time': self.time_input.time().toString("HH:mm")
            }
        elif self.schedule_type.currentIndex() == 2:
            schedule = {
                'type': 'weekly',
                'time': self.time_input.time().toString("HH:mm"),
                'day_of_week': 0
            }
        
        return {
            'name': self.name_input.text(),
            'type': self.type_combo.currentText(),
            'schedule': schedule,
            'action': self.action_text.toPlainText()
        }
