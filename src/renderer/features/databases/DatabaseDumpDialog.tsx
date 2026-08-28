import React, { useState } from 'react'
import { Button, Modal, Radio, message } from 'antd'
import ExportOutlined from '@ant-design/icons/ExportOutlined'
import type { DatabaseDumpMode } from '../../types'

interface DatabaseDumpDialogProps {
  database: string
  onClose: () => void
  onDump: (mode: DatabaseDumpMode) => Promise<void>
}

const options: Array<{
  value: DatabaseDumpMode
  label: string
  description: string
}> = [
  {
    value: 'structure-data',
    label: '结构和数据',
    description: '输出建表语句和全部表数据。',
  },
  {
    value: 'structure',
    label: '仅结构',
    description: '只输出建表语句，不读取表数据。',
  },
  {
    value: 'data',
    label: '仅数据',
    description: '只输出 INSERT 语句。',
  },
]

export default function DatabaseDumpDialog({
  database,
  onClose,
  onDump,
}: DatabaseDumpDialogProps) {
  const [mode, setMode] = useState<DatabaseDumpMode>('structure-data')
  const [dumping, setDumping] = useState(false)

  const dump = async () => {
    try {
      setDumping(true)
      await onDump(mode)
      onClose()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '数据库转储失败')
    } finally {
      setDumping(false)
    }
  }

  return (
    <Modal
      className="database-management-dialog"
      title={`转储 SQL 文件 - ${database}`}
      open
      width={500}
      maskClosable={false}
      destroyOnHidden
      onCancel={onClose}
      footer={[
        <Button key="cancel" disabled={dumping} onClick={onClose}>取消</Button>,
        <Button
          key="dump"
          type="primary"
          icon={<ExportOutlined />}
          loading={dumping}
          onClick={() => void dump()}
        >
          选择文件并转储
        </Button>,
      ]}
    >
      <Radio.Group
        className="database-dump-options"
        value={mode}
        onChange={event => setMode(event.target.value)}
      >
        {options.map(option => (
          <Radio key={option.value} value={option.value}>
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </Radio>
        ))}
      </Radio.Group>
    </Modal>
  )
}
