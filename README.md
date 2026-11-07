# SQLTool

SQLTool 是一款基于 Electron、React 和 TypeScript 的桌面数据库管理工具，支持
MySQL、PostgreSQL、SQL Server、SQLite 和 TDSQL（腾讯分布式数据库）。

## 主要功能

- 数据库连接、分组及连接状态管理
- 数据库、表、视图、函数、事件等对象浏览
- SQL 编辑、执行、分页结果及查询历史
- 表结构设计、数据编辑和结构同步
- 数据导入、导出及跨库传输
- 数据库备份、恢复和常用管理工具
- 本地日志记录与关键操作追踪

## 环境要求

- Windows 10/11
- Node.js 18 或更高版本
- Yarn 1.x 或 npm
- SQL Server 连接需安装可用的 SQL Server 服务及网络访问环境

## 安装与运行

安装依赖：

```bash
yarn install
```

构建并启动：

```bash
yarn build
yarn start
```

开发模式需要分别启动编译服务和 Electron：

```powershell
# 终端 1
yarn dev

# 终端 2
$env:NODE_ENV = 'development'
yarn start
```

## 常用命令

```bash
yarn build
yarn verify:production
yarn test:connection-lifecycle
yarn test:database-backup
yarn test:table-features
yarn test:database-tools
yarn package
```

## 项目结构

```text
SqlTool/
|-- src/
|   |-- main/                 Electron 主进程、IPC 和数据库服务
|   `-- renderer/             React 界面、功能模块和样式
|-- scripts/                  构建校验与自动化测试脚本
|-- resources/                应用图标等打包资源
|-- index.html                渲染进程入口
|-- package.json              依赖、命令和打包配置
|-- tsconfig.json             TypeScript 配置
`-- vite.config.js            Vite 构建配置
```

## 本地数据与日志

连接配置、查询历史等运行数据保存在 Electron 用户数据目录。应用日志默认写入项目
`logs/` 目录，并按日期生成 `sqltool_YYYYMMDD.log`，关键连接、查询、备份及数据变更
操作均可通过该日志追踪。
