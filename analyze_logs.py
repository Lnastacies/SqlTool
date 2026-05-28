#!/usr/bin/env python3
"""
日志分析工具 - 用于快速定位卡住和性能问题
"""

import sys
import os
from datetime import datetime
import re

def analyze_log_file(log_file='operation_log.txt'):
    """分析日志文件"""
    if not os.path.exists(log_file):
        print(f"错误: 日志文件 {log_file} 不存在")
        return
    
    print("=" * 80)
    print("TRAE SQL Manager - 日志分析工具")
    print("=" * 80)
    print(f"正在分析日志文件: {log_file}")
    print()
    
    with open(log_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    print(f"日志总行数: {len(lines)}")
    print()
    
    # 查找长时间运行的操作
    print("=" * 80)
    print("长时间运行的操作检查")
    print("=" * 80)
    
    operations = {}
    current_operation = None
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # 匹配开始操作
        start_match = re.search(r'\[TRACE_START\].*开始操作: (.+)', line)
        if start_match:
            op_name = start_match.group(1)
            time_match = re.search(r'\[([^\]]+)\]', line)
            if time_match:
                time_str = time_match.group(1)
                try:
                    op_time = datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S.%f')
                    operations[op_name] = {'start_line': i, 'start_time': op_time}
                except:
                    pass
            continue
        
        # 匹配结束操作
        end_match = re.search(r'\[TRACE_END\].*完成操作: (.+), 耗时: ([\d.]+)s', line)
        if end_match:
            op_name = end_match.group(1)
            duration = float(end_match.group(2))
            
            if op_name in operations:
                operations[op_name]['end_line'] = i
                operations[op_name]['duration'] = duration
        
        # 匹配警告
        if 'WARNING' in line and '长时间运行' in line:
            print(f"\n警告: {line}")
    
    # 输出执行时间超过1秒的操作
    print("\n执行时间较长的操作:")
    slow_ops = []
    for op_name, info in operations.items():
        if 'duration' in info and info['duration'] > 1.0:
            slow_ops.append((info['duration'], op_name, info))
    
    if slow_ops:
        for duration, name, info in sorted(slow_ops, key=lambda x: -x[0]):
            print(f"  - {name}: {duration:.3f}秒")
            if 'start_line' in info:
                print(f"    开始行: {info['start_line'] + 1}")
    else:
        print("  (没有发现超过1秒的操作)")
    
    # 查找错误
    print("\n" + "=" * 80)
    print("错误检查")
    print("=" * 80)
    
    errors = []
    for i, line in enumerate(lines):
        if '[ERROR]' in line:
            errors.append((i + 1, line.strip()))
    
    if errors:
        print(f"\n发现 {len(errors)} 个错误:")
        for line_num, err_line in errors[-10:]:  # 显示最后10个错误
            print(f"  行 {line_num}: {err_line}")
            # 显示错误后的堆栈信息
            if line_num < len(lines):
                for j in range(line_num, min(line_num + 10, len(lines))):
                    if lines[j].strip() and not lines[j].startswith('['):
                        print(f"    {lines[j].rstrip()}")
    else:
        print("  (没有发现错误)")
    
    # 查找最近的操作
    print("\n" + "=" * 80)
    print("最后的操作")
    print("=" * 80)
    
    recent_ops = []
    for line in lines[-50:]:
        if '[TRACE_START]' in line or '[TRACE_END]' in line or '[INFO]' in line:
            recent_ops.append(line.strip())
    
    if recent_ops:
        for op in recent_ops[-20:]:  # 显示最后20个重要操作
            print(f"  {op}")
    
    print("\n" + "=" * 80)
    print("日志分析完成")
    print("=" * 80)
    print()
    print("提示:")
    print("- 如果界面卡住，查看日志最后的 TRACE_START 操作")
    print("- 长时间运行的操作会触发 WARNING 警告")
    print("- 每个日志条目都包含线程信息，方便排查")

if __name__ == '__main__':
    log_file = 'operation_log.txt'
    if len(sys.argv) > 1:
        log_file = sys.argv[1]
    analyze_log_file(log_file)
