#!/usr/bin/env python3
"""
操作日志记录器
"""

import os
import traceback
import threading
import time
from datetime import datetime

class OperationLogger:
    """操作日志记录器"""
    def __init__(self, log_file='operation_log.txt', max_log_size=10 * 1024 * 1024, debug_mode=True):
        self.log_file = log_file
        self.enabled = True
        self.debug_mode = debug_mode
        self.max_log_size = max_log_size  # 最大日志文件大小（10MB）
        # 确保日志目录存在
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir)
        
        # 检查并轮换日志文件
        self._rotate_log()
        # 记录程序启动信息
        self._log_startup_info()
    
    def _log_startup_info(self):
        """记录程序启动信息"""
        startup_info = [
            "=" * 80,
            "程序启动",
            f"启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')}",
            f"进程ID: {os.getpid()}",
            f"主线程: {threading.main_thread().name}",
            "=" * 80
        ]
        for line in startup_info:
            print(line)
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write('\n'.join(startup_info) + '\n\n')
        except Exception as e:
            print(f"启动日志记录失败: {e}")
    
    def _rotate_log(self):
        """轮换日志文件"""
        if os.path.exists(self.log_file):
            file_size = os.path.getsize(self.log_file)
            if file_size >= self.max_log_size:
                # 生成新的日志文件名
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                backup_file = f"{self.log_file}.{timestamp}.bak"
                try:
                    os.rename(self.log_file, backup_file)
                    print(f"日志文件已轮换: {backup_file}")
                except Exception as e:
                    print(f"日志轮换失败: {e}")
    
    def _get_thread_info(self):
        """获取线程信息"""
        current_thread = threading.current_thread()
        return f"Thread-{current_thread.ident}-{current_thread.name}"
    
    def log(self, operation_type, message, details='', exception=None):
        """记录操作日志"""
        if not self.enabled:
            return
        
        # 获取高精度时间戳
        now = datetime.now()
        timestamp = now.strftime('%Y-%m-%d %H:%M:%S.%f')
        thread_info = self._get_thread_info()
        
        log_entry = f"[{timestamp}] [{operation_type}] [{thread_info}] {message}"
        if details:
            log_entry += f"\n  详情: {details}"
        if exception:
            log_entry += f"\n  异常信息: {str(exception)}"
            # 添加堆栈跟踪
            traceback_info = traceback.format_exc()
            log_entry += f"\n  堆栈跟踪:\n{traceback_info}"
        
        print(log_entry)
        
        try:
            # 再次检查日志文件大小
            self._rotate_log()
            
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(log_entry + '\n\n')
        except Exception as e:
            print(f"日志记录失败: {e}")
    
    def trace_start(self, operation_name):
        """开始跟踪操作"""
        if not self.debug_mode:
            return
        self.log('TRACE_START', f"开始操作: {operation_name}")
    
    def trace_end(self, operation_name, duration=None):
        """结束跟踪操作"""
        if not self.debug_mode:
            return
        msg = f"结束操作: {operation_name}"
        if duration is not None:
            msg += f" (耗时: {duration:.3f}s)"
        self.log('TRACE_END', msg)
    
    def info(self, message, details=''):
        """记录信息日志"""
        self.log('INFO', message, details)
    
    def warning(self, message, details=''):
        """记录警告日志"""
        self.log('WARNING', message, details)
    
    def error(self, message, details='', exception=None):
        """记录错误日志"""
        self.log('ERROR', message, details, exception)
    
    def debug(self, message, details=''):
        """记录调试日志"""
        self.log('DEBUG', message, details)
    
    def critical(self, message, details='', exception=None):
        """记录严重错误日志"""
        self.log('CRITICAL', message, details, exception)
    
    def set_log_level(self, level):
        """设置日志级别"""
        levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if level in levels:
            self.log_level = level
        else:
            self.log_level = 'INFO'