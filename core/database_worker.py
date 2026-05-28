#!/usr/bin/env python3
"""
数据库操作工作线程 - 用于异步执行数据库查询操作
"""

import traceback
import threading
from PyQt6.QtCore import QThread, pyqtSignal

class DatabaseWorker(QThread):
    """数据库操作工作线程"""
    
    finished = pyqtSignal(object)
    error = pyqtSignal(str)
    progress = pyqtSignal(str, object)
    
    def __init__(self, engine, operation, *args, **kwargs):
        super().__init__()
        self.engine = engine
        self.operation = operation
        self.args = args
        self.kwargs = kwargs
        self._is_running = True
        self.logger = engine.logger if hasattr(engine, 'logger') else None
        # 设置线程名称
        self.setObjectName(f"DBWorker-{operation}")
        # 只对支持进度回调的操作传递 on_progress 参数
        progress_ops = {'compare_all_tables', 'transfer_tables'}
        if operation in progress_ops and 'on_progress' not in kwargs:
            kwargs['on_progress'] = self._on_progress_callback
    
    def run(self):
        """执行数据库操作"""
        # 获取当前线程信息
        current_thread = threading.current_thread()
        thread_name = current_thread.name
        thread_id = current_thread.ident
        
        self._log_info(f"数据库工作线程启动, 线程: {thread_name} (ID: {thread_id}), 操作: {self.operation}")
        
        try:
            # 调用操作
            result = self._execute_operation()
            
            if self._is_running:
                self._log_info(f"数据库操作完成, 操作: {self.operation}, 结果类型: {type(result).__name__}")
                # 使用 Qt.QueuedConnection 确保信号在主线程中处理
                self.finished.emit(result)
        except Exception as e:
            if self._is_running:
                self._log_error(f"数据库操作失败, 操作: {self.operation}, 错误: {str(e)}")
                self._log_error(f"错误堆栈: {traceback.format_exc()}")
                self.error.emit(str(e))
    
    def _execute_operation(self):
        """执行数据库操作"""
        operations = {
            'fetch_databases': self.engine.fetch_databases,
            'fetch_tables': self.engine.fetch_tables,
            'compare_tables': self.engine.compare_tables,
            'compare_all_tables': self.engine.compare_all_tables,
            'transfer_tables': self.engine.transfer_tables,
            'generate_transfer_sql': self.engine.generate_transfer_sql,
            'get_column_names': self.engine.get_column_names,
            'get_column_info': self.engine.get_column_info,
            'get_primary_keys': self.engine.get_primary_keys,
            'fetch_table_rows': self.engine.fetch_table_rows,
            'preview_table': self.engine.preview_table,
        }
        
        func = operations.get(self.operation)
        if func:
            self._log_info(f"开始执行数据库操作: {self.operation}")
            return func(*self.args, **self.kwargs)
        else:
            raise ValueError(f"未知操作类型: {self.operation}")
    
    def stop(self):
        """停止线程"""
        self._log_info(f"数据库工作线程停止, 操作: {self.operation}")
        self._is_running = False
        self.quit()
        self.wait()
    
    def _log_info(self, message):
        """记录信息日志"""
        thread_name = threading.current_thread().name
        if self.logger:
            self.logger.log('INFO', f"[DBWorker-{thread_name}] {message}")
        else:
            print(f"[INFO] [DBWorker-{thread_name}] {message}")
    
    def _on_progress_callback(self, table_name, progress_info):
        """进度回调方法"""
        if self._is_running:
            self._log_info(f"进度更新: {table_name} - {progress_info}")
            self.progress.emit(table_name, progress_info)

    def _log_error(self, message):
        """记录错误日志"""
        thread_name = threading.current_thread().name
        if self.logger:
            self.logger.log('ERROR', f"[DBWorker-{thread_name}] {message}")
        else:
            print(f"[ERROR] [DBWorker-{thread_name}] {message}")


class DatabaseSyncWorker(QThread):
    """数据库同步操作工作线程 - 支持比对和传输操作"""
    
    progress = pyqtSignal(str, int)
    finished = pyqtSignal(dict)
    
    def __init__(self, engine, operation, *args, **kwargs):
        super().__init__()
        self.engine = engine
        self.operation = operation
        self.args = args
        self.kwargs = kwargs
        self._is_running = True
        self.logger = engine.logger if hasattr(engine, 'logger') else None
        self.setObjectName(f"SyncWorker-{operation}")
    
    def run(self):
        """执行同步操作"""
        current_thread = threading.current_thread()
        self._log_info(f"同步工作线程启动, 线程: {current_thread.name}, 操作: {self.operation}")
        self._log_info(f"参数: {self.args}")
        
        try:
            self._log_info(f"开始执行操作: {self.operation}")
            result = self._execute_operation()
            self._log_info(f"操作执行完成, 结果类型: {type(result).__name__}")
            
            if self._is_running:
                self._log_info(f"同步操作完成, 操作: {self.operation}")
                self.finished.emit(result if result else {})
        except Exception as e:
            self._log_error(f"同步操作失败, 操作: {self.operation}, 错误: {str(e)}")
            self._log_error(f"错误堆栈: {traceback.format_exc()}")
            if self._is_running:
                self.finished.emit({'success': 0, 'error': str(e)})
    
    def _execute_operation(self):
        """执行具体操作"""
        operations = {
            'compare_all_tables': self._compare_all_tables,
            'transfer_tables': self._transfer_tables,
            'execute_sync': self._execute_sync,
        }
        
        func = operations.get(self.operation)
        if func:
            return func()
        else:
            raise ValueError(f"未知操作类型: {self.operation}")
    
    def _compare_all_tables(self):
        """比对所有表"""
        src_conn, src_db, tgt_conn, tgt_db, tables = self.args
        
        def on_progress(table_name, progress):
            if self._is_running:
                self._log_info(f"比对进度: {table_name} - {progress}")
                self.progress.emit(table_name, progress)
        
        return self.engine.compare_all_tables(
            src_conn, src_db, tgt_conn, tgt_db, tables,
            on_progress=on_progress
        )
    
    def _transfer_tables(self):
        """传输表数据"""
        src_conn, src_db, tgt_conn, tgt_db, tables = self.args
        operations = self.kwargs.get('operations')
        
        def on_progress(table_name, progress):
            if self._is_running:
                self._log_info(f"传输进度: {table_name} - {progress}")
                self.progress.emit(table_name, progress)
        
        return self.engine.transfer_tables(
            src_conn, src_db, tgt_conn, tgt_db, tables,
            on_progress=on_progress,
            operations=operations
        )
    
    def _execute_sync(self):
        """执行同步"""
        tgt_name, tgt_db, tables_cache = self.args
        
        def on_progress(affected):
            if self._is_running:
                self._log_info(f"同步进度: 已同步 {affected} 行")
                self.progress.emit(f"已同步 {affected} 行", affected)
        
        return self.engine.execute_sync(
            tgt_name, tgt_db, tables_cache,
            on_progress=on_progress
        )
    
    def stop(self):
        """停止线程"""
        self._log_info(f"同步工作线程停止, 操作: {self.operation}")
        self._is_running = False
        self.quit()
        self.wait()
    
    def _log_info(self, message):
        """记录信息日志"""
        thread_name = threading.current_thread().name
        if self.logger:
            self.logger.log('INFO', f"[SyncWorker-{thread_name}] {message}")
        else:
            print(f"[INFO] [SyncWorker-{thread_name}] {message}")
    
    def _log_error(self, message):
        """记录错误日志"""
        thread_name = threading.current_thread().name
        if self.logger:
            self.logger.log('ERROR', f"[SyncWorker-{thread_name}] {message}")
        else:
            print(f"[ERROR] [SyncWorker-{thread_name}] {message}")
