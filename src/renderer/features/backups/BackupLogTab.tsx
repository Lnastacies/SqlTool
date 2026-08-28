import React, { useEffect, useRef } from 'react'
import { Empty, Progress } from 'antd'
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined'
import CloseCircleOutlined from '@ant-design/icons/CloseCircleOutlined'
import InfoCircleOutlined from '@ant-design/icons/InfoCircleOutlined'
import type { BackupDialogLog } from './backupDialogModel'

interface BackupLogTabProps {
  logs: BackupDialogLog[]
  percent: number
  running: boolean
  failed: boolean
}

export default function BackupLogTab({
  logs,
  percent,
  running,
  failed,
}: BackupLogTabProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [logs])

  return (
    <div className="backup-log">
      <div className="backup-log__progress">
        <Progress
          percent={percent}
          status={failed ? 'exception' : running ? 'active' : 'normal'}
          strokeColor="#2d8a69"
        />
      </div>
      <div className="backup-log__entries">
        {logs.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无执行日志"
          />
        ) : logs.map(log => (
          <div
            key={log.id}
            className={`backup-log__entry backup-log__entry--${log.level}`}
          >
            <span className="backup-log__entry-icon">
              {log.level === 'error'
                ? <CloseCircleOutlined />
                : log.phase === 'complete'
                  ? <CheckCircleOutlined />
                  : <InfoCircleOutlined />}
            </span>
            <time>
              {new Date(log.timestamp).toLocaleTimeString('zh-CN', {
                hour12: false,
              })}
            </time>
            <span>{log.message}</span>
            <small>{log.percent}%</small>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
