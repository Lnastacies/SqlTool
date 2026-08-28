import React from 'react'
import { Empty, Tag } from 'antd'
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined'
import CloseCircleOutlined from '@ant-design/icons/CloseCircleOutlined'
import CloudUploadOutlined from '@ant-design/icons/CloudUploadOutlined'
import LoadingOutlined from '@ant-design/icons/LoadingOutlined'
import SafetyCertificateOutlined from '@ant-design/icons/SafetyCertificateOutlined'
import type { DatabaseBackupRecord, DatabaseDumpMode } from '../../types'
import type {
  DatabaseBackupVerification,
} from './databaseBackupActionSupport'

interface BackupDetailsPanelProps {
  record?: DatabaseBackupRecord
  verification?: DatabaseBackupVerification
}

const MODE_LABELS: Record<DatabaseDumpMode, string> = {
  'structure-data': '结构和数据',
  structure: '仅结构',
  data: '仅数据',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = units[0]
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024
    unit = units[index]
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${unit}`
}

export default function BackupDetailsPanel({
  record,
  verification,
}: BackupDetailsPanelProps) {
  if (!record) {
    return (
      <div className="backup-details backup-details--empty">
        <Empty
          image={<CloudUploadOutlined />}
          description="选择备份以查看文件和校验信息"
        />
      </div>
    )
  }

  const verificationTag = verification?.status === 'valid'
    ? <Tag color="success" icon={<CheckCircleOutlined />}>校验通过</Tag>
    : verification?.status === 'invalid'
      ? <Tag color="error" icon={<CloseCircleOutlined />}>校验失败</Tag>
      : verification?.status === 'checking'
        ? <Tag color="processing" icon={<LoadingOutlined spin />}>校验中</Tag>
        : <Tag icon={<SafetyCertificateOutlined />}>未校验</Tag>

  return (
    <section className="backup-details">
      <header className="backup-details__header">
        <span className="backup-details__icon"><CloudUploadOutlined /></span>
        <div>
          <strong>{record.name}</strong>
          <span>{record.fileName}</span>
        </div>
        {verificationTag}
      </header>

      <div className="backup-details__metrics">
        <div><strong>{record.tableCount}</strong><span>数据表</span></div>
        <div><strong>{record.objectCount}</strong><span>附属对象</span></div>
        <div><strong>{record.rowCount.toLocaleString('zh-CN')}</strong><span>数据行</span></div>
        <div><strong>{formatSize(record.size)}</strong><span>文件大小</span></div>
      </div>

      <dl className="backup-details__fields">
        <div><dt>创建时间</dt><dd>{new Date(record.createdAt).toLocaleString('zh-CN', { hour12: false })}</dd></div>
        <div><dt>数据库类型</dt><dd>{record.databaseType}</dd></div>
        <div><dt>备份内容</dt><dd>{MODE_LABELS[record.mode]}</dd></div>
        <div><dt>文件格式</dt><dd>{record.compressed ? 'SQL / GZIP' : 'SQL'}</dd></div>
        <div className="backup-details__wide">
          <dt>SHA-256 校验值</dt>
          <dd title={record.checksumSha256}>
            <SafetyCertificateOutlined />
            {record.checksumSha256 || '旧版记录，将在还原时直接读取'}
          </dd>
        </div>
        <div className="backup-details__wide">
          <dt>最近校验结果</dt>
          <dd title={verification?.message}>
            {verification?.message || '尚未执行完整性校验'}
            {verification?.checkedAt
              ? ` · ${new Date(verification.checkedAt).toLocaleString('zh-CN', { hour12: false })}`
              : ''}
          </dd>
        </div>
        <div className="backup-details__wide">
          <dt>存储路径</dt>
          <dd title={record.filePath}>{record.filePath}</dd>
        </div>
        <div className="backup-details__wide">
          <dt>备注</dt>
          <dd>{record.description || '无'}</dd>
        </div>
      </dl>
    </section>
  )
}
