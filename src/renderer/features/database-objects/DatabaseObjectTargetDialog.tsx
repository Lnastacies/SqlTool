import React, { useEffect, useState } from 'react'
import { Modal, Select } from 'antd'
import type { DatabaseObjectCategory } from './databaseObjectModel'

export type DatabaseObjectTransferAction = 'import' | 'export'

export interface DatabaseObjectTargetDialogValue {
  connId: string
  database: string
  category: Extract<DatabaseObjectCategory, 'tables' | 'views'>
  action: DatabaseObjectTransferAction
  candidates: string[]
  initialValue?: string
}

interface DatabaseObjectTargetDialogProps {
  value: DatabaseObjectTargetDialogValue
  onCancel: () => void
  onConfirm: (name: string) => void
}

export default function DatabaseObjectTargetDialog({
  value,
  onCancel,
  onConfirm,
}: DatabaseObjectTargetDialogProps) {
  const [selectedName, setSelectedName] = useState('')
  const objectLabel = value.category === 'tables' ? '表' : '视图'
  const actionLabel = value.action === 'import' ? '导入' : '导出'

  useEffect(() => {
    const initial = value.initialValue
      && value.candidates.includes(value.initialValue)
      ? value.initialValue
      : value.candidates[0] || ''
    setSelectedName(initial)
  }, [value])

  return (
    <Modal
      open
      width={460}
      title={`${actionLabel}向导 - 选择${objectLabel}`}
      okText="下一步"
      cancelText="取消"
      okButtonProps={{ disabled: !selectedName }}
      onCancel={onCancel}
      onOk={() => onConfirm(selectedName)}
      destroyOnClose
    >
      <Select
        value={selectedName || undefined}
        placeholder={`选择要${actionLabel}的${objectLabel}`}
        showSearch
        optionFilterProp="label"
        style={{ width: '100%' }}
        options={value.candidates.map(name => ({ value: name, label: name }))}
        onChange={setSelectedName}
      />
    </Modal>
  )
}
