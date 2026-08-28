import React from 'react'
import { Alert, Spin, Tabs } from 'antd'
import CloudUploadOutlined from '@ant-design/icons/CloudUploadOutlined'
import ControlOutlined from '@ant-design/icons/ControlOutlined'
import FileTextOutlined from '@ant-design/icons/FileTextOutlined'
import UnorderedListOutlined from '@ant-design/icons/UnorderedListOutlined'
import type {
  ConnectionData,
  DatabaseModel,
} from '../../types'
import BackupAdvancedTab from './BackupAdvancedTab'
import BackupGeneralTab from './BackupGeneralTab'
import BackupLogTab from './BackupLogTab'
import BackupObjectTab from './BackupObjectTab'
import type {
  BackupDialogForm,
  BackupDialogLog,
} from './backupDialogModel'

interface BackupDialogContentProps {
  connection: ConnectionData
  database: string
  loading: boolean
  model?: DatabaseModel
  error?: string
  activeTab: string
  form: BackupDialogForm
  logs: BackupDialogLog[]
  percent: number
  running: boolean
  failed: boolean
  onTabChange: (tab: string) => void
  onFormChange: (patch: Partial<BackupDialogForm>) => void
}

export default function BackupDialogContent({
  connection,
  database,
  loading,
  model,
  error,
  activeTab,
  form,
  logs,
  percent,
  running,
  failed,
  onTabChange,
  onFormChange,
}: BackupDialogContentProps) {
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="无法读取备份对象"
        description={error}
      />
    )
  }
  if (loading || !model) {
    return (
      <div className="backup-dialog__loading">
        <Spin />
        <span>正在读取数据库对象...</span>
      </div>
    )
  }

  const disabled = running
  const objectCount = Object.values(form.scope).reduce(
    (total, values) => total + values.length,
    0,
  )
  return (
    <Tabs
      activeKey={activeTab}
      onChange={onTabChange}
      items={[
        {
          key: 'general',
          label: <span><CloudUploadOutlined /> 常规</span>,
          children: (
            <BackupGeneralTab
              database={database}
              value={form}
              disabled={disabled}
              onChange={onFormChange}
            />
          ),
        },
        {
          key: 'objects',
          label: <span><UnorderedListOutlined /> 对象 ({objectCount})</span>,
          children: (
            <BackupObjectTab
              model={model}
              scope={form.scope}
              dataOnly={form.mode === 'data'}
              disabled={disabled}
              onChange={scope => onFormChange({ scope })}
            />
          ),
        },
        {
          key: 'advanced',
          label: <span><ControlOutlined /> 高级</span>,
          children: (
            <BackupAdvancedTab
              databaseType={connection.type}
              value={form}
              disabled={disabled}
              onChange={onFormChange}
            />
          ),
        },
        {
          key: 'log',
          label: <span><FileTextOutlined /> 信息日志</span>,
          children: (
            <BackupLogTab
              logs={logs}
              percent={percent}
              running={running}
              failed={failed}
            />
          ),
        },
      ]}
    />
  )
}
