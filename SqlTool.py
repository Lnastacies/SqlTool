#!/usr/bin/env python3
"""
Navicat风格的数据库管理工具 - 主入口文件
"""

import sys
from PyQt6.QtWidgets import QApplication

# 导入拆分后的模块
from ui.main_window import NavicatStyleSQLTool

if __name__ == '__main__':
    # 创建应用程序
    app = QApplication(sys.argv)
    
    # 创建主窗口
    main_window = NavicatStyleSQLTool()
    
    # 显示主窗口
    main_window.show()
    
    # 运行应用程序
    sys.exit(app.exec())