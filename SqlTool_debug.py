#!/usr/bin/env python3
"""
Navicat风格的数据库管理工具 - 调试版本入口
此版本包含详细的日志和线程监控，用于排查界面卡住等问题
"""

import sys
import os
from PyQt6.QtWidgets import QApplication

print("=" * 80)
print("TRAE SQL Manager - Debug Mode")
print("=" * 80)
print(f"Python 版本: {sys.version}")
print(f"工作目录: {os.getcwd()}")
print(f"系统平台: {sys.platform}")
print("=" * 80)
print()

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from ui.main_window import NavicatStyleSQLTool
    print("导入主窗口模块成功")
except Exception as e:
    print(f"导入主窗口模块失败: {e}")
    import traceback
    print("错误堆栈:")
    print(traceback.format_exc())
    sys.exit(1)

if __name__ == '__main__':
    try:
        print("正在创建 QApplication...")
        app = QApplication(sys.argv)
        print("QApplication 创建成功")
        
        print()
        print("正在创建主窗口...")
        main_window = NavicatStyleSQLTool()
        print("主窗口创建成功")
        
        print()
        print("正在显示主窗口...")
        main_window.show()
        print("主窗口显示成功")
        
        print()
        print("=" * 80)
        print("程序已启动，正在运行...")
        print("=" * 80)
        print()
        print("调试提示:")
        print("- 详细日志将同时输出到控制台和 operation_log.txt")
        print("- 线程监控每10秒检查一次，超过5秒的操作会被警告")
        print("- 如果界面卡住，请查看日志最后的操作")
        print()
        
        # 运行应用程序
        exit_code = app.exec()
        print(f"程序退出，退出码: {exit_code}")
        sys.exit(exit_code)
        
    except Exception as e:
        print(f"程序启动失败: {e}")
        import traceback
        print("错误堆栈:")
        print(traceback.format_exc())
        sys.exit(1)
