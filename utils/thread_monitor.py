#!/usr/bin/env python3
"""
线程监控和性能分析工具
"""

import threading
import time
import traceback
from datetime import datetime
from contextlib import contextmanager


class ThreadMonitor:
    """线程监控器"""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._init()
            return cls._instance
    
    def _init(self):
        self.active_operations = {}
        self.operation_lock = threading.Lock()
        self.logger = None
        self.enabled = True
    
    def set_logger(self, logger):
        """设置日志记录器"""
        self.logger = logger
    
    def _log(self, message, level='INFO'):
        """记录日志"""
        # 确保线程信息正确获取
        thread_name = threading.current_thread().name
        thread_id = threading.current_thread().ident
        
        if self.logger:
            # 传递给logger的日志会包含正确的线程信息
            self.logger.log(level, f"[{thread_name}-{thread_id}] {message}")
        else:
            print(f"[{level}] [{thread_name}-{thread_id}] {message}")
    
    @contextmanager
    def track_operation(self, operation_name):
        """跟踪操作执行时间"""
        if not self.enabled:
            yield
            return
        
        # 立即获取线程信息
        current_thread = threading.current_thread()
        operation_id = f"{operation_name}-{current_thread.ident}-{time.time_ns()}"
        start_time = datetime.now()
        
        with self.operation_lock:
            self.active_operations[operation_id] = {
                'name': operation_name,
                'thread': current_thread.name,
                'thread_id': current_thread.ident,
                'start_time': start_time,
                'stack_trace': ''.join(traceback.format_stack()[:-1])
            }
        
        try:
            self._log(f"开始执行: {operation_name}", 'TRACE_START')
            yield
        finally:
            duration = (datetime.now() - start_time).total_seconds()
            with self.operation_lock:
                self.active_operations.pop(operation_id, None)
            self._log(f"完成执行: {operation_name}, 耗时: {duration:.3f}s", 'TRACE_END')
    
    def check_long_running_operations(self, threshold=5.0):
        """检查长时间运行的操作"""
        if not self.enabled:
            return []
        
        long_running = []
        
        with self.operation_lock:
            for op_id, op_data in self.active_operations.items():
                start_time = op_data['start_time']
                duration = (datetime.now() - start_time).total_seconds()
                if duration > threshold:
                    long_running.append({
                        'id': op_id,
                        'name': op_data['name'],
                        'thread': op_data['thread'],
                        'thread_id': op_data['thread_id'],
                        'duration': duration,
                        'start_time': start_time,
                        'stack_trace': op_data['stack_trace']
                    })
        
        if long_running:
            self._log(f"发现 {len(long_running)} 个长时间运行的操作 (超过 {threshold}s)", 'WARNING')
            for op in long_running:
                self._log(f"  - {op['name']} (线程: {op['thread']}, ID: {op['thread_id']}, 耗时: {op['duration']:.1f}s)", 'WARNING')
                self._log(f"    启动时间: {op['start_time']}", 'DEBUG')
        
        return long_running
    
    def get_active_operations(self):
        """获取当前活跃操作"""
        with self.operation_lock:
            return list(self.active_operations.values())
    
    def dump_threads(self):
        """导出所有线程信息"""
        threads = []
        for thread in threading.enumerate():
            thread_info = {
                'name': thread.name,
                'ident': thread.ident,
                'daemon': thread.daemon,
                'alive': thread.is_alive()
            }
            threads.append(thread_info)
        
        self._log(f"当前活跃线程数: {len(threads)}", 'INFO')
        for t in threads:
            self._log(f"  - {t['name']} (ID: {t['ident']}, 活跃: {t['alive']})", 'DEBUG')
        
        return threads


# 全局线程监控实例
thread_monitor = ThreadMonitor()


def track_operation(operation_name):
    """装饰器：跟踪函数执行"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            with thread_monitor.track_operation(operation_name):
                return func(*args, **kwargs)
        return wrapper
    return decorator


def setup_periodic_monitor(interval=10.0, threshold=5.0):
    """设置定期监控"""
    def monitor_loop():
        while True:
            try:
                thread_monitor.check_long_running_operations(threshold)
                time.sleep(interval)
            except Exception as e:
                thread_monitor._log(f"监控循环异常: {e}", 'ERROR')
    
    monitor_thread = threading.Thread(target=monitor_loop, daemon=True, name="ThreadMonitor")
    monitor_thread.start()
    return monitor_thread
