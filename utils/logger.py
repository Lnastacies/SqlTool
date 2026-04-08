#!/usr/bin/env python3
"""
操作日志记录器
"""

import os
import traceback
from datetime import datetime

class OperationLogger:
    """操作日志记录器"""
    def __init__(self, log_file='operation_log.txt', max_log_size=10 * 1024 * 1024):
        self.log_file = log_file
        self.enabled = True
        self.max_log_size = max_log_size  # 最大日志文件大小（10MB）
        # 确保日志目录存在
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir)
        
        # 检查并轮换日志文件
        self._rotate_log()
    
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
    
    def log(self, operation_type, message, details='', exception=None):
        """记录操作日志"""
        if not self.enabled:
            return
        
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_entry = f"[{timestamp}] [{operation_type}] {message}"
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