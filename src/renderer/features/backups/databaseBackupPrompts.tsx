import React from 'react'
import { Input, Modal, message } from 'antd'
import type { DatabaseBackupTarget } from './databaseBackupActionSupport'

export function confirmBackupDelete(
  target: DatabaseBackupTarget,
): Promise<boolean> {
  return new Promise(resolve => {
    Modal.confirm({
      title: '删除备份',
      content: `确定永久删除备份文件“${target.fileName}”吗？`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}

export function promptBackupRename(
  target: DatabaseBackupTarget,
): Promise<string | undefined> {
  let nextName = target.name
  return new Promise(resolve => {
    Modal.confirm({
      title: '重命名备份',
      content: (
        <Input
          autoFocus
          defaultValue={target.name}
          maxLength={80}
          placeholder="输入备份名称"
          onChange={event => {
            nextName = event.target.value
          }}
          onPressEnter={event => {
            event.currentTarget.closest('.ant-modal-confirm')
              ?.querySelector<HTMLButtonElement>('.ant-btn-primary')
              ?.click()
          }}
        />
      ),
      okText: '重命名',
      cancelText: '取消',
      onOk: () => {
        const normalized = nextName.trim()
        if (!normalized) {
          message.error('备份名称不能为空')
          return Promise.reject(new Error('备份名称不能为空'))
        }
        resolve(normalized)
      },
      onCancel: () => resolve(undefined),
    })
  })
}
