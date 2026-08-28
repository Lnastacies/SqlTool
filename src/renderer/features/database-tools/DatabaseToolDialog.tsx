import React, { useMemo } from 'react'
import { Alert, Button, Modal, Steps, Tag } from 'antd'
import CloudSyncOutlined from '@ant-design/icons/CloudSyncOutlined'
import PartitionOutlined from '@ant-design/icons/PartitionOutlined'
import SwapOutlined from '@ant-design/icons/SwapOutlined'
import SyncOutlined from '@ant-design/icons/SyncOutlined'
import type {
  ConnectionData,
  DatabaseToolEndpoint,
  DatabaseToolMode,
} from '../../types'
import DatabaseEndpointCard from './DatabaseEndpointCard'
import DatabaseToolPreview from './DatabaseToolPreview'
import DatabaseToolResult from './DatabaseToolResult'
import DatabaseToolTableStep from './DatabaseToolTableStep'
import { useDatabaseToolTask } from './useDatabaseToolTask'

interface DatabaseToolDialogProps {
  open: boolean
  mode: DatabaseToolMode
  connections: ConnectionData[]
  connectedConnectionIds: ReadonlySet<string>
  initialSource?: DatabaseToolEndpoint
  onConnect: (
    connection: ConnectionData,
  ) => Promise<{ success: boolean; message: string }>
  onClose: () => void
  onCompleted: () => void
}

const TOOL_META = {
  transfer: {
    title: '数据传输',
    description: '按表将数据完整复制到另一个数据库',
    executeText: '开始传输',
    icon: <CloudSyncOutlined />,
  },
  dataSync: {
    title: '数据同步',
    description: '按主键比较差异并同步新增、更新和删除',
    executeText: '部署数据同步',
    icon: <SyncOutlined />,
  },
  structureSync: {
    title: '结构同步',
    description: '比较字段、索引和外键并部署目标端 DDL',
    executeText: '部署结构变更',
    icon: <PartitionOutlined />,
  },
}

export default function DatabaseToolDialog({
  open,
  mode,
  connections,
  connectedConnectionIds,
  initialSource,
  onConnect,
  onClose,
  onCompleted,
}: DatabaseToolDialogProps) {
  const task = useDatabaseToolTask({
    open,
    mode,
    connections,
    connectedConnectionIds,
    initialSource,
  })
  const meta = TOOL_META[mode]
  const sourceName = connections.find(item => item.id === task.source.connId)?.name
  const targetName = connections.find(item => item.id === task.target.connId)?.name
  const blocked = useMemo(
    () => task.preview?.items.some(item => item.status === 'blocked') || false,
    [task.preview],
  )
  const destructive = (
    mode === 'structureSync'
    || (mode === 'transfer' && task.transferStrategy === 'replace')
    || (mode === 'dataSync' && task.syncOptions.delete)
  )

  const confirmExecute = () => {
    Modal.confirm({
      title: `确认${meta.executeText}`,
      content: destructive
        ? '当前任务包含覆盖、删除或结构变更。请确认已核对预览内容，并已准备必要的数据库备份。'
        : '执行时会重新读取源数据，并将变更分批提交到目标数据库。',
      okText: meta.executeText,
      cancelText: '返回检查',
      okButtonProps: { danger: destructive },
      onOk: task.execute,
    })
  }

  const closeDialog = () => {
    if (task.executing || task.previewing || task.loadingTables) return
    if (task.result) onCompleted()
    onClose()
  }

  const footer = task.step === 0
    ? [
      <Button key="cancel" onClick={closeDialog}>取消</Button>,
      <Button
        key="next"
        type="primary"
        loading={task.loadingTables}
        onClick={() => void task.loadTables()}
      >
        读取数据表
      </Button>,
    ]
    : task.step === 1
      ? [
        <Button key="back" onClick={() => task.setStep(0)}>上一步</Button>,
        <Button
          key="preview"
          type="primary"
          loading={task.previewing}
          onClick={() => void task.runPreview()}
        >
          生成预览
        </Button>,
      ]
      : task.step === 2
        ? [
          <Button
            key="back"
            disabled={task.executing}
            onClick={() => task.setStep(1)}
          >
            返回调整
          </Button>,
          <Button
            key="execute"
            type="primary"
            danger={destructive}
            disabled={blocked}
            loading={task.executing}
            onClick={confirmExecute}
          >
            {meta.executeText}
          </Button>,
        ]
        : [
          <Button key="close" type="primary" onClick={closeDialog}>
            完成并关闭
          </Button>,
        ]

  return (
    <Modal
      open={open}
      width={1080}
      title={(
        <div className="database-tool-title">
          <span>{meta.icon}</span>
          <div>
            <strong>{meta.title}</strong>
            <small>{meta.description}</small>
          </div>
        </div>
      )}
      footer={footer}
      onCancel={closeDialog}
      maskClosable={false}
      keyboard={!task.executing}
      destroyOnClose
      className="database-tool-modal"
    >
      <Steps
        size="small"
        current={task.step}
        items={[
          { title: '选择范围' },
          { title: '选择数据表' },
          { title: '预检查' },
          { title: '执行完成' },
        ]}
      />

      {task.step > 0 && task.step < 3 && (
        <div className="database-tool-route">
          <span>
            <Tag color="cyan">源</Tag>
            {sourceName} / {task.source.database}
          </span>
          <SwapOutlined />
          <span>
            <Tag color="blue">目标</Tag>
            {targetName} / {task.target.database}
          </span>
        </div>
      )}

      {task.step === 0 && (
        <>
          {connections.length === 0 && (
            <Alert type="warning" showIcon message="请先创建至少一个数据库连接" />
          )}
          <div className="database-tool-endpoints">
            <DatabaseEndpointCard
              role="source"
              title="源数据库"
              connections={connections}
              connectedConnectionIds={connectedConnectionIds}
              value={task.source}
              onConnect={onConnect}
              onChange={task.setSource}
            />
            <Button
              className="database-tool-swap"
              shape="circle"
              icon={<SwapOutlined />}
              title="交换源和目标"
              onClick={task.swapEndpoints}
            />
            <DatabaseEndpointCard
              role="target"
              title="目标数据库"
              connections={connections}
              connectedConnectionIds={connectedConnectionIds}
              value={task.target}
              onConnect={onConnect}
              onChange={task.setTarget}
            />
          </div>
        </>
      )}

      {task.step === 1 && (
        <DatabaseToolTableStep
          mode={mode}
          sourceTables={task.sourceTables}
          targetTables={task.targetTables}
          selectedTables={task.selectedTables}
          transferStrategy={task.transferStrategy}
          createMissing={task.createMissing}
          syncOptions={task.syncOptions}
          onSelectedTablesChange={task.setSelectedTables}
          onTransferStrategyChange={task.setTransferStrategy}
          onCreateMissingChange={task.setCreateMissing}
          onSyncOptionsChange={task.setSyncOptions}
        />
      )}

      {task.step === 2 && task.preview && (
        <DatabaseToolPreview mode={mode} preview={task.preview} />
      )}
      {task.step === 3 && task.result && (
        <DatabaseToolResult mode={mode} result={task.result} />
      )}
    </Modal>
  )
}
