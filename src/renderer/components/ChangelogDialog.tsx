import React from 'react'
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

// 版本更新记录数据
const CHANGELOG_VERSIONS: ChangelogItem[] = [
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

function ChangelogDialog({ open, currentVersion, onClose }: ChangelogDialogProps) {
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
            当前版本：{currentVersion || 'v1.0.0'}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ChangelogDialog
