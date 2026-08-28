import React, { useEffect, useState } from 'react'
import { Input, Modal, message } from 'antd'
import type { ConnectionGroup } from '../types'

interface ConnectionGroupDialogProps {
  group?: ConnectionGroup
  onClose: () => void
  onSave: (name: string) => Promise<void>
}

function ConnectionGroupDialog({
  group,
  onClose,
  onSave,
}: ConnectionGroupDialogProps) {
  const [name, setName] = useState(group?.name || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => setName(group?.name || ''), [group])

  const handleSave = async () => {
    if (!name.trim()) {
      message.error('请输入分组名称')
      return
    }
    try {
      setSaving(true)
      await onSave(name.trim())
      message.success(group ? '分组已重命名' : '分组已创建')
      onClose()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存分组失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={group ? '重命名分组' : '新建分组'}
      open
      onCancel={onClose}
      onOk={() => void handleSave()}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      width={400}
      destroyOnHidden
    >
      <Input
        value={name}
        maxLength={64}
        placeholder="输入分组名称"
        autoFocus
        onChange={event => setName(event.target.value)}
        onPressEnter={() => void handleSave()}
      />
    </Modal>
  )
}

export default ConnectionGroupDialog
