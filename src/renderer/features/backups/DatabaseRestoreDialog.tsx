import React, { useEffect, useRef, useState } from 'react'
import { Alert, Button, Modal, Switch, message } from 'antd'
import CheckOutlined from '@ant-design/icons/CheckOutlined'
import FolderOpenOutlined from '@ant-design/icons/FolderOpenOutlined'
import RollbackOutlined from '@ant-design/icons/RollbackOutlined'
import type {
  RestoreDatabaseBackupRequest,
  RestoreDatabaseBackupResult,
} from '../../types'
import BackupLogTab from './BackupLogTab'
import type { BackupDialogLog } from './backupDialogModel'
import {
  newBackupOperationId,
  type DatabaseBackupTarget,
} from './databaseBackupActionSupport'
import type { DatabaseBackupContext } from './useDatabaseBackupActions'

interface DatabaseRestoreDialogProps extends DatabaseBackupContext {
  target?: DatabaseBackupTarget
  onClose: () => void
  onRestore: (
    request: RestoreDatabaseBackupRequest,
  ) => Promise<RestoreDatabaseBackupResult>
}

export default function DatabaseRestoreDialog({
  connection,
  database,
  target,
  onClose,
  onRestore,
}: DatabaseRestoreDialogProps) {
  const [continueOnError, setContinueOnError] = useState(false)
  const [useTransaction, setUseTransaction] = useState(
    connection.type !== 'MySQL',
  )
  const [logs, setLogs] = useState<BackupDialogLog[]>([])
  const [percent, setPercent] = useState(0)
  const [running, setRunning] = useState(false)
  const [failed, setFailed] = useState(false)
  const [completed, setCompleted] = useState(false)
  const operationIdRef = useRef('')

  useEffect(() => window.database.onBackupProgress(progress => {
    if (progress.operationId !== operationIdRef.current) return
    setPercent(progress.percent)
    setLogs(previous => [...previous, {
      ...progress,
      id: `${progress.timestamp}-${previous.length}`,
    }])
  }), [])

  const startRestore = async () => {
    const operationId = newBackupOperationId('restore')
    operationIdRef.current = operationId
    setLogs([])
    setPercent(0)
    setFailed(false)
    setCompleted(false)
    setRunning(true)
    try {
      const result = await onRestore({
        operationId,
        backupId: target?.id,
        continueOnError,
        useTransaction: useTransaction && !continueOnError,
      })
      if (result.cancelled) {
        setLogs(previous => [...previous, {
          id: `cancelled-${Date.now()}`,
          operationId,
          phase: 'complete',
          percent: 0,
          level: 'warn',
          message: '已取消选择备份文件',
          timestamp: new Date().toISOString(),
        }])
        return
      }
      setCompleted(true)
      setPercent(100)
      message.success(
        `还原完成：成功 ${result.completedStatements} 条，失败 ${result.failedStatements} 条`,
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      setFailed(true)
      setLogs(previous => [...previous, {
        id: `error-${Date.now()}`,
        operationId,
        phase: 'restore',
        percent: previous.at(-1)?.percent || 0,
        level: 'error',
        message: detail,
        timestamp: new Date().toISOString(),
      }])
      message.error(`还原备份失败：${detail}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Modal
      className="database-restore-dialog"
      title={`还原备份 - ${database}`}
      open
      width={680}
      maskClosable={false}
      destroyOnHidden
      onCancel={() => !running && onClose()}
      footer={[
        <Button key="close" disabled={running} onClick={onClose}>
          {completed ? '关闭' : '取消'}
        </Button>,
        !completed && (
          <Button
            key="restore"
            type="primary"
            danger
            loading={running}
            icon={target ? <RollbackOutlined /> : <FolderOpenOutlined />}
            onClick={() => void startRestore()}
          >
            {target ? '开始还原' : '选择文件并还原'}
          </Button>
        ),
        completed && (
          <Button key="done" type="primary" icon={<CheckOutlined />} onClick={onClose}>
            完成
          </Button>
        ),
      ]}
    >
      <div className="restore-dialog__body">
        <Alert
          type="warning"
          showIcon
          message="还原会执行备份中的结构和数据 SQL，并可能覆盖同名对象。"
        />
        <div className="restore-target">
          <span><small>目标数据库</small><strong>{database}</strong></span>
          <span><small>备份来源</small><strong>{target?.fileName || '本地 SQL / GZIP 文件'}</strong></span>
        </div>
        <div className="restore-options">
          <div className="backup-setting-row">
            <span><strong>事务保护</strong><small>失败时自动回滚已执行语句</small></span>
            <Switch
              checked={useTransaction && !continueOnError}
              disabled={running || continueOnError || connection.type === 'MySQL'}
              onChange={setUseTransaction}
            />
          </div>
          <div className="backup-setting-row">
            <span><strong>遇到错误继续</strong><small>记录失败语句并继续执行后续内容</small></span>
            <Switch
              checked={continueOnError}
              disabled={running}
              onChange={setContinueOnError}
            />
          </div>
        </div>
        <BackupLogTab
          logs={logs}
          percent={percent}
          running={running}
          failed={failed}
        />
      </div>
    </Modal>
  )
}
