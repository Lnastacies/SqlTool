#!/usr/bin/env python3
"""
SqlTool 组件索引
本文档记录所有功能组件的概览和使用方法
"""

# ==================== 核心组件 ====================

# 1. 连接管理
from core.connection_pool import ConnectionPool  # 连接池管理
from core.database_operations import DatabaseOperations  # 数据库操作
from core.ssh_tunnel import SSHTunnelManager, SSHTunnelDialog  # SSH隧道

# 2. 状态和事件
from core.state_manager import ApplicationStateManager  # 状态管理
from core.event_bus import EventBus  # 事件总线

# 3. 历史和快捷键
from core.query_history import QueryHistoryManager, QueryHistoryDialog  # 查询历史
from core.shortcut_manager import SQLEditorShortcutManager  # 快捷键

# 4. 代码片段
from core.snippet_manager import SnippetManager, SnippetDialog  # 代码片段

# 5. 任务调度
from core.task_scheduler import TaskScheduler, TaskSchedulerDialog  # 计划任务


# ==================== UI组件 ====================

# 1. 主窗口
from ui.main_window import NavicatStyleSQLTool  # 主窗口

# 2. 面板组件
from ui.components.left_panel import LeftPanel  # 左侧面板
from ui.components.right_panel import RightPanel  # 右侧面板
from ui.components.info_panel import InfoPanel  # 信息面板

# 3. SQL编辑
from ui.components.sql_editor import SQLTextEdit  # SQL编辑器
from ui.components.query_tab import QueryTab  # 查询标签页

# 4. 表和视图管理
from ui.components.table_operations import TableOperations  # 表操作
from ui.components.table_designer import TableDesigner  # 表设计器
from ui.components.view_manager import ViewManager, ViewDesigner  # 视图管理

# 5. 存储过程/函数/触发器
from ui.components.routine_manager import RoutineManager, RoutineDesigner  # 存储过程和函数
from ui.components.trigger_manager import TriggerManager, TriggerDesigner  # 触发器

# 6. 数据操作
from ui.components.data_import_export import DataImportExport  # 数据导入导出
from ui.components.data_transfer import DataTransfer  # 数据传输
from ui.components.structure_sync import StructureSync  # 结构同步
from ui.components.data_filter import TableFilterWidget, BulkEditor  # 数据过滤和批量编辑
from ui.components.result_editor import EditableTableWidget, ResultSetEditor  # 结果集编辑器

# 7. 可视化
from ui.components.er_diagram import ERDiagramGenerator  # ER图

# 8. 菜单和上下文
from ui.components.menu_toolbar import MenuToolbarManager  # 菜单工具栏
from ui.components.context_menus import ContextMenuManager, StatusBarEnhancer  # 右键菜单和状态栏
from ui.components.event_handler import EventHandler  # 事件处理

# 9. SQL操作
from ui.components.sql_operations import SQLOperations  # SQL操作

# 10. 进度显示
from ui.components.progress_dialog import ProgressDialog, BatchOperationProgress  # 进度对话框


# ==================== 功能特性对照表 ====================

"""
| 功能模块 | 组件 | 状态 | 说明 |
|---------|------|------|------|
| 连接管理 | ConnectionPool, DatabaseOperations | ✅ 完成 | 支持多种数据库 |
| SSH隧道 | SSHTunnelManager | ✅ 完成 | 需安装paramiko |
| 查询历史 | QueryHistoryManager | ✅ 完成 | 持久化存储 |
| 快捷键 | SQLEditorShortcutManager | ✅ 完成 | 完整的快捷键绑定 |
| 代码片段 | SnippetManager | ✅ 完成 | 可自定义分类 |
| 计划任务 | TaskScheduler | ✅ 完成 | 支持定时执行 |
| 表操作 | TableOperations | ✅ 完成 | CRUD操作 |
| 表设计器 | TableDesigner | ✅ 完成 | 图形化设计 |
| 视图管理 | ViewManager | ✅ 完成 | 查看/编辑/删除 |
| 存储过程 | RoutineManager | ✅ 完成 | 创建/编辑/删除 |
| 触发器 | TriggerManager | ✅ 完成 | 完整管理 |
| 数据导入导出 | DataImportExport | ✅ 完成 | CSV/Excel等 |
| 数据传输 | DataTransfer | ✅ 完成 | 两页式操作 |
| ER图 | ERDiagramGenerator | ✅ 完成 | 可导出图片 |
| 结果集编辑 | EditableTableWidget | ✅ 完成 | 支持内联编辑 |
| 数据过滤 | TableFilterWidget | ✅ 完成 | 高级过滤 |
| 批量编辑 | BulkEditor | ✅ 完成 | 批量UPDATE |
| 右键菜单 | ContextMenuManager | ✅ 完成 | 智能上下文菜单 |
| 状态栏 | StatusBarEnhancer | ✅ 完成 | 增强信息显示 |
| 进度显示 | ProgressDialog | ✅ 完成 | 支持取消操作 |
| 错误提示 | SQLOperations | ✅ 完成 | 友好错误信息 |
| 布局保存 | MainWindow | ✅ 完成 | 记忆用户设置 |
"""


# ==================== 使用示例 ====================

"""
1. 打开视图管理器:
   from ui.components.view_manager import ViewManager
   vm = ViewManager(main_window)
   vm.exec()

2. 打开存储过程管理器:
   from ui.components.routine_manager import RoutineManager
   rm = RoutineManager(main_window)
   rm.exec()

3. 打开触发器管理器:
   from ui.components.trigger_manager import TriggerManager
   tm = TriggerManager(main_window)
   tm.exec()

4. 打开代码片段:
   from core.snippet_manager import SnippetDialog
   sd = SnippetDialog(main_window)
   if sd.exec():
       sql = sd.selected_sql
       # 使用选中的SQL

5. 打开数据传输:
   from ui.components.data_transfer import DataTransfer
   dlg = DataTransfer(main_window)
   dlg.exec()

6. 打开ER图:
   from ui.components.er_diagram import ERDiagramGenerator
   er = ERDiagramGenerator(main_window)
   er.exec()

7. 打开计划任务:
   from core.task_scheduler import TaskSchedulerDialog
   tsd = TaskSchedulerDialog(main_window)
   tsd.exec()

8. 打开SSH隧道配置:
   from core.ssh_tunnel import SSHTunnelDialog
   std = SSHTunnelDialog(main_window)
   if std.exec():
       config = std.tunnel_config
       # 使用配置创建隧道
"""
