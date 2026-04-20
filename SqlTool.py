#!/usr/bin/env python3
"""
Navicat风格的数据库管理工具 - 主入口文件
"""

import sys
from PyQt6.QtWidgets import QApplication

# 导入拆分后的模块
from ui.main_window import NavicatStyleSQLTool

if __name__ == '__main__':
    print("正在启动TRAE SQL Manager...")
    # 创建应用程序
    app = QApplication(sys.argv)
    print("应用程序创建成功")
    
    # 创建主窗口
    print("正在创建主窗口...")
    main_window = NavicatStyleSQLTool()
    print("主窗口创建成功")
    
    # 显示主窗口
    main_window.show()
    print("主窗口显示成功")
    
    # 运行应用程序
    print("正在运行应用程序...")
    sys.exit(app.exec())