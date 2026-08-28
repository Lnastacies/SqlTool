import React from 'react'
import { Alert, Switch } from 'antd'
import type { DatabaseType } from '../../types'
import type { BackupDialogForm } from './backupDialogModel'

interface BackupAdvancedTabProps {
  databaseType: DatabaseType
  value: BackupDialogForm
  disabled: boolean
  onChange: (patch: Partial<BackupDialogForm>) => void
}

export default function BackupAdvancedTab({
  databaseType,
  value,
  disabled,
  onChange,
}: BackupAdvancedTabProps) {
  return (
    <div className="backup-advanced">
      <div className="backup-setting-row">
        <span>
          <strong>写入对象删除语句</strong>
          <small>DROP IF EXISTS</small>
        </span>
        <Switch
          checked={value.includeDropStatements}
          disabled={disabled || value.mode === 'data'}
          onChange={includeDropStatements => onChange({
            includeDropStatements,
          })}
        />
      </div>

      <div className="backup-setting-row">
        <span>
          <strong>还原期间暂停外键检查</strong>
          <small>{databaseType}</small>
        </span>
        <Switch
          checked={value.disableForeignKeyChecks}
          disabled={disabled}
          onChange={disableForeignKeyChecks => onChange({
            disableForeignKeyChecks,
          })}
        />
      </div>

      <div className="backup-setting-row">
        <span>
          <strong>移除 DEFINER</strong>
          <small>MySQL 例程、事件和触发器</small>
        </span>
        <Switch
          checked={value.stripDefiners}
          disabled={disabled || databaseType !== 'MySQL'}
          onChange={stripDefiners => onChange({ stripDefiners })}
        />
      </div>

      {databaseType === 'PostgreSQL' && value.disableForeignKeyChecks && (
        <Alert
          type="warning"
          showIcon
          message="暂停 PostgreSQL 外键检查需要当前账号具备 session_replication_role 权限。"
        />
      )}
    </div>
  )
}
