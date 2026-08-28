import React from 'react'
import { Input, Segmented, Switch } from 'antd'
import CloudUploadOutlined from '@ant-design/icons/CloudUploadOutlined'
import type { BackupDialogForm } from './backupDialogModel'

interface BackupGeneralTabProps {
  database: string
  value: BackupDialogForm
  disabled: boolean
  onChange: (patch: Partial<BackupDialogForm>) => void
}

export default function BackupGeneralTab({
  database,
  value,
  disabled,
  onChange,
}: BackupGeneralTabProps) {
  return (
    <div className="backup-general">
      <div className="backup-target">
        <span className="backup-target__icon"><CloudUploadOutlined /></span>
        <span>
          <small>目标数据库</small>
          <strong>{database}</strong>
        </span>
        <span className="backup-target__format">
          {value.compressed ? 'SQL / GZIP' : 'SQL'}
        </span>
      </div>

      <label className="backup-field">
        <span>备份名称</span>
        <Input
          value={value.name}
          maxLength={80}
          disabled={disabled}
          onChange={event => onChange({ name: event.target.value })}
        />
      </label>

      <label className="backup-field">
        <span>备份内容</span>
        <Segmented
          block
          disabled={disabled}
          value={value.mode}
          options={[
            { label: '结构和数据', value: 'structure-data' },
            { label: '仅结构', value: 'structure' },
            { label: '仅数据', value: 'data' },
          ]}
          onChange={mode => onChange({
            mode: mode as BackupDialogForm['mode'],
          })}
        />
      </label>

      <label className="backup-field">
        <span>备注</span>
        <Input.TextArea
          value={value.description}
          rows={4}
          maxLength={500}
          showCount
          disabled={disabled}
          onChange={event => onChange({ description: event.target.value })}
        />
      </label>

      <div className="backup-setting-row">
        <span>
          <strong>压缩备份</strong>
          <small>GZIP</small>
        </span>
        <Switch
          checked={value.compressed}
          disabled={disabled}
          onChange={compressed => onChange({ compressed })}
        />
      </div>
    </div>
  )
}
