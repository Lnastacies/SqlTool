import React, { useEffect, useRef, useState } from 'react'
import { Button, Modal, message } from 'antd'
import CheckOutlined from '@ant-design/icons/CheckOutlined'
import CloudUploadOutlined from '@ant-design/icons/CloudUploadOutlined'
import type {
  CreateDatabaseBackupRequest,
  CreateDatabaseBackupResult,
  DatabaseModel,
} from '../../types'
import BackupDialogContent from './BackupDialogContent'
import {
  buildBackupRequest,
  initialBackupForm,
  type BackupDialogForm,
  type BackupDialogLog,
} from './backupDialogModel'
import type { DatabaseBackupContext } from './useDatabaseBackupActions'

interface DatabaseBackupDialogProps extends DatabaseBackupContext {
  loading: boolean
  model?: DatabaseModel
  error?: string
  onClose: () => void
  onCreate: (
    request: CreateDatabaseBackupRequest,
  ) => Promise<CreateDatabaseBackupResult>
}

function newOperationId(): string {
  const value = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `backup-${value}`
}

export default function DatabaseBackupDialog({
  connection,
  database,
  loading,
  model,
  error,
  onClose,
  onCreate,
}: DatabaseBackupDialogProps) {
  const [activeTab, setActiveTab] = useState('general')
  const [form, setForm] = useState<BackupDialogForm>(
    () => initialBackupForm(database, model),
  )
  const [logs, setLogs] = useState<BackupDialogLog[]>([])
  const [percent, setPercent] = useState(0)
  const [running, setRunning] = useState(false)
  const [failed, setFailed] = useState(false)
  const [completed, setCompleted] = useState(false)
  const operationIdRef = useRef('')
  const modelInitialized = useRef(Boolean(model))

  useEffect(() => {
    if (!model || modelInitialized.current) return
    modelInitialized.current = true
    setForm(previous => ({
      ...previous,
      scope: initialBackupForm(database, model).scope,
    }))
  }, [database, model])

  useEffect(() => window.database.onBackupProgress(progress => {
    if (progress.operationId !== operationIdRef.current) return
    setPercent(progress.percent)
    setLogs(previous => [...previous, {
      ...progress,
      id: `${progress.timestamp}-${previous.length}`,
    }])
  }), [])

  const updateForm = (patch: Partial<BackupDialogForm>) => {
    setForm(previous => ({ ...previous, ...patch }))
  }

  const startBackup = async () => {
    if (!model) return
    if (!form.name.trim()) {
      setActiveTab('general')
      message.error('请输入备份名称')
      return
    }
    const selectedCount = form.mode === 'data'
      ? form.scope.tables.length
      : Object.values(form.scope).reduce(
        (total, values) => total + values.length,
        0,
      )
    if (selectedCount === 0) {
      setActiveTab('objects')
      message.error('至少选择一个备份对象')
      return
    }

    const operationId = newOperationId()
    operationIdRef.current = operationId
    setLogs([])
    setPercent(0)
    setFailed(false)
    setCompleted(false)
    setRunning(true)
    setActiveTab('log')
    try {
      await onCreate(buildBackupRequest(operationId, form))
      setCompleted(true)
      setPercent(100)
    } catch (backupError) {
      const detail = backupError instanceof Error
        ? backupError.message
        : String(backupError)
      setFailed(true)
      setLogs(previous => [...previous, {
        id: `error-${Date.now()}`,
        operationId,
        phase: 'complete',
        percent: previous.at(-1)?.percent || 0,
        level: 'error',
        message: detail,
        timestamp: new Date().toISOString(),
      }])
      message.error(`创建备份失败：${detail}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Modal
      className="database-backup-dialog"
      title={`新建备份 - ${database}`}
      open
      width={760}
      maskClosable={false}
      destroyOnHidden
      onCancel={() => !running && onClose()}
      footer={[
        <Button key="cancel" disabled={running} onClick={onClose}>
          {completed ? '关闭' : '取消'}
        </Button>,
        !completed && (
          <Button
            key="backup"
            type="primary"
            icon={running ? undefined : <CloudUploadOutlined />}
            loading={running}
            disabled={Boolean(error) || loading || !model}
            onClick={() => void startBackup()}
          >
            开始备份
          </Button>
        ),
        completed && (
          <Button key="done" type="primary" icon={<CheckOutlined />} onClick={onClose}>
            完成
          </Button>
        ),
      ]}
    >
      <BackupDialogContent
        connection={connection}
        database={database}
        loading={loading}
        model={model}
        error={error}
        activeTab={activeTab}
        form={form}
        logs={logs}
        percent={percent}
        running={running}
        failed={failed}
        onTabChange={setActiveTab}
        onFormChange={updateForm}
      />
    </Modal>
  )
}
