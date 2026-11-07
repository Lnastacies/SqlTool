import React, { useEffect, useState } from 'react'
import { Modal, Typography } from 'antd'
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined'

export interface AppInfo {
  name?: string
  productName?: string
  version?: string
  description?: string
  author?: string
  authorEmail?: string
  company?: string
  homepage?: string
  license?: string
  copyright?: string
}

interface AboutDialogProps {
  open: boolean
  onClose: () => void
}

// 默认应用信息（IPC 获取失败时的兜底值）
const DEFAULT_APP_INFO: AppInfo = {
  productName: 'SQLTool',
  version: '1.1.4',
  description: 'Navicat 风格的数据库管理工具，支持 MySQL、PostgreSQL、SQL Server、SQLite、TDSQL',
  author: 'Locus',
  company: 'ADTEC-先进数通',
  authorEmail: '1656113@163.com',
  license: 'MIT',
  copyright: `Copyright © ${new Date().getFullYear()} Locus`,
}

// 版权协议说明
const LICENSE_NOTICE =
  '本工具允许个人免费使用、复制、修改源码；如需用于商业用途（包括但不限于集成、发行、托管服务等），必须获得作者书面授权。'

function AboutDialog({ open, onClose }: AboutDialogProps) {
  const [appInfo, setAppInfo] = useState<AppInfo>(DEFAULT_APP_INFO)

  // 打开时从主进程拉取应用信息
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const loadAppInfo = async () => {
      try {
        const result = await (window as any).sys?.appInfo?.()
        if (!cancelled && result?.success && result.data) {
          setAppInfo(previous => ({ ...previous, ...result.data }))
        }
      } catch (error) {
        console.warn('[sqltool] 获取应用信息失败，使用默认值:', error)
      }
    }
    void loadAppInfo()
    return () => {
      cancelled = true
    }
  }, [open])

  const rows: Array<{ label: string; value?: string }> = [
    { label: '作者', value: appInfo.author },
    { label: '公司', value: appInfo.company },
    { label: '邮箱', value: appInfo.authorEmail },
    { label: '许可', value: appInfo.license },
    { label: '版权', value: appInfo.copyright },
  ]

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={460}
      className="about-dialog"
      closeIcon={null}
      maskClosable
    >
      <div className="about-content">
        <button
          type="button"
          className="about-close"
          onClick={onClose}
          title="关闭"
        >
          ✕
        </button>

        <div className="about-bg" aria-hidden="true">
          <span className="about-floating-icon" style={{ animationDelay: '0s' }}>✨</span>
          <span className="about-floating-icon" style={{ animationDelay: '0.5s' }}>💫</span>
          <span className="about-floating-icon" style={{ animationDelay: '1s' }}>🌟</span>
          <span className="about-floating-icon" style={{ animationDelay: '1.5s' }}>⚡</span>
          <span className="about-floating-icon" style={{ animationDelay: '2s' }}>✨</span>
        </div>

        <div className="about-header">
          <div className="about-logo-wrapper">
            <div className="about-logo">
              <DatabaseOutlined />
            </div>
            <div className="about-glow" />
          </div>
          <div className="about-title">{appInfo.productName || 'SQLTool'}</div>
          <div className="about-version">版本 {appInfo.version}</div>
          <div className="about-desc">{appInfo.description}</div>
        </div>

        <div className="about-divider" />

        <div className="about-info">
          {rows.filter(row => row.value).map((row, index) => (
            <div
              className="about-row"
              key={row.label}
              style={{ animationDelay: `${0.2 + index * 0.05}s` }}
            >
              <span className="about-label">{row.label}</span>
              <span className="about-value">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="about-license">
          <Typography.Text className="about-license-text">
            {LICENSE_NOTICE}
          </Typography.Text>
        </div>

        <div className="about-footer">
          <div className="about-heart">💖 Made with love</div>
        </div>
      </div>
    </Modal>
  )
}

export default AboutDialog
