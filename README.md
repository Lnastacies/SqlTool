# SQL Tool - 数据库管理工具

一个类似Navicat的开源数据库管理工具，支持MySQL、PostgreSQL、SQL Server和SQLite，可在Windows 11上运行。

## 功能特性

### 1. 多数据库支持
- MySQL
- PostgreSQL
- SQL Server
- SQLite

### 2. 数据库连接管理
- 新建数据库连接
- 保存连接配置
- 快速加载已保存的连接

### 3. SQL编辑器
- 语法高亮（待实现）
- SQL语句执行
- 结果显示
- 清空编辑器

### 4. 数据管理
- 表数据查询
- 结果导出（CSV、JSON）

### 5. 数据库对象管理
- 表查看
- （待实现：视图、存储过程、函数等）

## 安装说明

### 环境要求
- Windows 11
- Python 3.8 或更高版本

### 安装步骤

1. **安装Python依赖**
```bash
pip install -r requirements.txt
```

2. **安装数据库驱动（如果需要）**
- MySQL：已包含在依赖中
- PostgreSQL：已包含在依赖中
- SQL Server：需要安装ODBC驱动
  - 下载地址：https://learn.microsoft.com/zh-cn/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16
- SQLite：Python标准库已包含

3. **运行程序**
```bash
python sqltool.py
```

## 使用说明

### 1. 连接数据库

1. 在左侧面板选择数据库类型
2. 填写连接信息
   - MySQL/PostgreSQL/SQL Server：主机、端口、数据库名、用户名、密码
   - SQLite：选择SQLite文件路径
3. 点击"连接"按钮

### 2. 执行SQL语句

1. 在SQL编辑器标签页中输入SQL语句
2. 点击"执行SQL"按钮
3. 在结果标签页中查看执行结果

### 3. 保存连接

1. 填写连接信息
2. 点击"保存连接"按钮
3. 保存的连接会显示在"已保存连接"列表中

### 4. 导出结果

1. 执行查询获取结果
2. 在结果标签页点击"导出结果"按钮
3. 选择导出格式（CSV或JSON）和保存路径

## 开发计划

- [x] 基本框架搭建
- [x] 数据库连接功能
- [x] SQL编辑器和执行
- [x] 结果显示和导出
- [ ] 语法高亮
- [ ] 表结构编辑
- [ ] 数据导入功能
- [ ] 视图、存储过程管理
- [ ] 数据同步功能
- [ ] 数据备份和恢复

## 技术栈

- **界面框架**：PyQt6
- **数据库驱动**：
  - MySQL：mysql-connector-python
  - PostgreSQL：psycopg2-binary
  - SQL Server：pyodbc
  - SQLite：sqlite3（Python标准库）

## 许可证

MIT License