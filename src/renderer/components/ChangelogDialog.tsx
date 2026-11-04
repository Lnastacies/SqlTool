import React, { useEffect, useState } from 'react'
import { Modal } from 'antd'

export interface ChangelogItem {
  version: string
  date: string
  changes: string[]
}

interface ChangelogDialogProps {
  open: boolean
  currentVersion?: string
  onClose: () => void
}

// 版本更新记录数据（最新版本排在最前）
const CHANGELOG_VERSIONS: ChangelogItem[] = [
  {
    version: 'v1.1.4',
    date: '2026-10-13',
    changes: [
      '优化：数据库概览与表概览面板样式，标题栏图标/字号、工具栏按钮、搜索框统一为紧凑规格',
      '优化：概览面板数据表格行高与汇总条高度调整，提升列表信息密度',
      '新增：概览面板错误提示条样式，异常信息展示更清晰',
    ],
  },
  {
    version: 'v1.1.3',
    date: '2026-10-13',
    changes: [
      '新增：数据库对象内存缓存，表清单与表元数据本地缓存，大幅缓解 800+ 表数据库切换/重选时的卡顿',
      '新增：缓存自动失效策略，断开连接、单表结构变更（保存设计/删除/重命名）、右键刷新数据库时自动清理对应缓存',
      '增强：数据库对象树刷新链路接入缓存，减少重复 IPC 往返与整树重建',
      '增强：缓存读写与清理均输出本地日志，便于后续问题跟踪排查',
    ],
  },
  {
    version: 'v1.1.2',
    date: '2026-10-13',
    changes: [
      '新增：数据库备份表数据读取器（databaseBackupTableReader），支持逐表提取备份数据',
      '增强：备份创建服务、数据 SQL 生成与 dump 服务链路优化',
      '增强：备份失败处理、生命周期与 SQL 生成测试脚本完善',
      '增强：数据库管理与备份相关测试脚本更新',
    ],
  },
  {
    version: 'v1.1.1',
    date: '2026-10-13',
    changes: [
      '新增：TDSQL 分布式数据库专用表选项编辑控件（TDSQLTableOptionsControls）',
      '新增：MySQL 兼容层（mysqlCompat），统一 MySQL 系数据库行为差异',
      '新增：Monaco 编辑器注册中心（editorRegistry），集中管理编辑器实例',
      '增强：TDSQL 主进程适配模块与前端功能面板完善',
      '增强：表设计器、数据类型目录与校验逻辑优化',
      '增强：备份高级选项、数据库还原对话框与用户管理界面改进',
      '增强：连接对话框、新建/编辑数据库对话框交互细节完善',
      '新增：自动化发版脚本（npm run release），支持版本递增、引用同步、产物版本闭环校验',
      '修复：版本号硬编码统一收敛至 package.json，更新记录对话框自动读取运行时版本',
    ],
  },
  {
    version: 'v1.1.0',
    date: '2026-09-07',
    changes: [
      '新增：TDSQL 分布式数据库支持，含实例监控、会话列表、分片分布与 DDL 任务面板',
      '新增：数据传输向导，支持 Excel、CSV、JSON 等多种格式的表数据导入导出',
      '新增：结构同步功能，支持跨库结构比对与安全校验执行',
      '新增：数据库备份与还原完整流程，支持对象选择、高级选项与执行日志面板',
      '新增：自动化任务、数据库模型、用户管理与数据库搜索对话框',
      '新增：命令行对话框与连接颜色标识，便于多连接区分管理',
      '增强：表设计器支持字段类型/长度/精度/小数位拆分编辑，支持 ENUM/SET、NVARCHAR(MAX)、无符号类型',
      '增强：新建数据库动态展示 40 种字符集与 322 种排序规则，编辑时显示实际字符集',
      '增强：数据面板紧凑布局，结果分页与滚动区域自适应填充',
      '修复：MySQL 切换数据库后表名缓存失效、连接超时单位换算等问题',
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-04-30',
    changes: [
      '新增：多数据库连接管理（MySQL、PostgreSQL、SQL Server、SQLite）',
      '新增：SQL 编辑器与查询结果面板',
      '新增：表结构设计与编辑',
      '新增：数据导入导出、数据传输、数据同步、结构同步',
      '新增：数据库备份与还原',
      '新增：关于对话框与版本更新记录',
    ],
  },
]

// 兜底版本号（IPC 获取失败时使用），需与 package.json 版本保持一致
const FALLBACK_VERSION = 'v1.1.4'

function ChangelogDialog({ open, currentVersion, onClose }: ChangelogDialogProps) {
  // 运行时版本号：优先使用外部传入，否则从主进程拉取 package.json 版本
  const [runtimeVersion, setRuntimeVersion] = useState<string>('')

  useEffect(() => {
    if (!open || currentVersion) return
    let cancelled = false
    const loadVersion = async () => {
      try {
        const result = await (window as any).sys?.appInfo?.()
        if (!cancelled && result?.success && result.data?.version) {
          // 主进程返回纯数字版本号（如 1.1.0），展示时统一补 v 前缀
          const version = String(result.data.version)
          setRuntimeVersion(version.startsWith('v') ? version : `v${version}`)
        }
      } catch (error) {
        console.warn('[sqltool] 获取应用版本失败，使用默认值:', error)
      }
    }
    void loadVersion()
    return () => {
      cancelled = true
    }
  }, [open, currentVersion])

  const displayVersion = currentVersion || runtimeVersion || FALLBACK_VERSION

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      className="changelog-dialog"
      closeIcon={null}
      maskClosable
    >
      <div className="changelog-content">
        <button
          type="button"
          className="changelog-close"
          onClick={onClose}
          title="关闭"
        >
          ✕
        </button>

        <div className="changelog-header">
          <div className="changelog-title">📦 版本更新记录</div>
          <div className="changelog-subtitle">查看 SQLTool 的版本更新内容</div>
        </div>

        <div className="changelog-divider" />

        <div className="changelog-list">
          {CHANGELOG_VERSIONS.map(item => (
            <div className="changelog-item" key={item.version}>
              <div className="changelog-version">
                {item.version}
                <span className="changelog-date">{item.date}</span>
              </div>
              <div className="changelog-changes">
                {item.changes.map((change, index) => (
                  <div className="changelog-change" key={`${item.version}-${index}`}>
                    • {change}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="changelog-footer">
          <div className="changelog-current">
            当前版本：{displayVersion}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ChangelogDialog
