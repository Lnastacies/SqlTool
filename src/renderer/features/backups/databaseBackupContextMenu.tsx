import React from 'react'
import type { MenuProps } from 'antd'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import EditOutlined from '@ant-design/icons/EditOutlined'
import FileSearchOutlined from '@ant-design/icons/FileSearchOutlined'
import FolderOpenOutlined from '@ant-design/icons/FolderOpenOutlined'
import RollbackOutlined from '@ant-design/icons/RollbackOutlined'
import SafetyCertificateOutlined from '@ant-design/icons/SafetyCertificateOutlined'
import type {
  DatabaseObjectActionId,
} from '../database-objects/databaseObjectPresentation'

export type DatabaseBackupRecordActionId = Extract<
  DatabaseObjectActionId,
  'restore' | 'extract' | 'rename' | 'verify' | 'delete' | 'showInFolder'
>

interface DatabaseBackupContextMenuOptions {
  onAction: (action: DatabaseBackupRecordActionId) => void
}

export function buildDatabaseBackupContextMenu({
  onAction,
}: DatabaseBackupContextMenuOptions): MenuProps['items'] {
  return [
    {
      key: 'restore',
      label: '还原此备份...',
      icon: <RollbackOutlined />,
      onClick: () => onAction('restore'),
    },
    {
      key: 'extract',
      label: '提取 SQL...',
      icon: <FileSearchOutlined />,
      onClick: () => onAction('extract'),
    },
    { type: 'divider' },
    {
      key: 'rename',
      label: '重命名',
      icon: <EditOutlined />,
      onClick: () => onAction('rename'),
    },
    {
      key: 'verify',
      label: '校验完整性',
      icon: <SafetyCertificateOutlined />,
      onClick: () => onAction('verify'),
    },
    {
      key: 'showInFolder',
      label: '在文件夹中显示',
      icon: <FolderOpenOutlined />,
      onClick: () => onAction('showInFolder'),
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: '删除备份',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => onAction('delete'),
    },
  ]
}
