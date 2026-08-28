import React from 'react'
import type { MenuProps } from 'antd'
import BgColorsOutlined from '@ant-design/icons/BgColorsOutlined'
import CheckOutlined from '@ant-design/icons/CheckOutlined'
import CodeOutlined from '@ant-design/icons/CodeOutlined'
import ConsoleSqlOutlined from '@ant-design/icons/ConsoleSqlOutlined'
import CopyOutlined from '@ant-design/icons/CopyOutlined'
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import DisconnectOutlined from '@ant-design/icons/DisconnectOutlined'
import EditOutlined from '@ant-design/icons/EditOutlined'
import FileTextOutlined from '@ant-design/icons/FileTextOutlined'
import PlusCircleOutlined from '@ant-design/icons/PlusCircleOutlined'
import PlusOutlined from '@ant-design/icons/PlusOutlined'
import ReloadOutlined from '@ant-design/icons/ReloadOutlined'
import TeamOutlined from '@ant-design/icons/TeamOutlined'
import type { ConnectionData, ConnectionGroup } from '../../types'
import { CONNECTION_COLOR_OPTIONS } from './connectionColors'

interface ConnectionContextMenuOptions {
  connection: ConnectionData
  groups: ConnectionGroup[]
  active: boolean
  onConnect: () => void
  onDisconnect: () => void
  onEdit: () => void
  onNewConnection: () => void
  onDelete: () => void
  onDuplicate: () => void
  onCreateDatabase: () => void
  onNewQuery: () => void
  onOpenTerminal: () => void
  onRunSqlFile: () => void
  onRefresh: () => void
  onMoveToGroup: (groupId?: string) => void
  onNewGroup: () => void
  onSetColor: (color?: string) => void
}

export function buildConnectionContextMenu({
  connection,
  groups,
  active,
  onConnect,
  onDisconnect,
  onEdit,
  onNewConnection,
  onDelete,
  onDuplicate,
  onCreateDatabase,
  onNewQuery,
  onOpenTerminal,
  onRunSqlFile,
  onRefresh,
  onMoveToGroup,
  onNewGroup,
  onSetColor,
}: ConnectionContextMenuOptions): MenuProps['items'] {
  const groupItems: MenuProps['items'] = [
    {
      key: 'group:ungrouped',
      label: '未分组',
      disabled: !connection.groupId,
      onClick: () => onMoveToGroup(),
    },
    ...groups.map(group => ({
      key: `group:${group.id}`,
      label: group.name,
      disabled: connection.groupId === group.id,
      onClick: () => onMoveToGroup(group.id),
    })),
    { type: 'divider' as const },
    {
      key: 'group:new',
      icon: <PlusOutlined />,
      label: '新建组...',
      onClick: onNewGroup,
    },
  ]

  const colorItems: MenuProps['items'] = CONNECTION_COLOR_OPTIONS.map(option => ({
    key: `color:${option.key}`,
    label: (
      <span className="connection-color-menu-item">
        <span
          className={`connection-color-swatch${
            option.value ? '' : ' connection-color-swatch--default'
          }`}
          style={option.value ? { backgroundColor: option.value } : undefined}
        />
        <span>{option.label}</span>
        {connection.color === option.value && <CheckOutlined />}
      </span>
    ),
    onClick: () => onSetColor(option.value),
  }))

  return [
    active
      ? {
        key: 'disconnect',
        icon: <DisconnectOutlined />,
        label: '关闭连接',
        onClick: onDisconnect,
      }
      : {
        key: 'connect',
        icon: <DatabaseOutlined />,
        label: '建立连接',
        onClick: onConnect,
      },
    { type: 'divider' },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '编辑连接...',
      onClick: onEdit,
    },
    {
      key: 'new-connection',
      icon: <PlusOutlined />,
      label: '新建连接',
      onClick: onNewConnection,
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除连接',
      danger: true,
      onClick: onDelete,
    },
    {
      key: 'duplicate',
      icon: <CopyOutlined />,
      label: '复制连接...',
      onClick: onDuplicate,
    },
    { type: 'divider' },
    ...(connection.type === 'SQLite'
      ? []
      : [{
        key: 'create-database',
        icon: <PlusCircleOutlined />,
        label: '新建数据库...',
        onClick: onCreateDatabase,
      }]),
    {
      key: 'new-query',
      icon: <CodeOutlined />,
      label: '新建查询',
      onClick: onNewQuery,
    },
    {
      key: 'terminal',
      icon: <ConsoleSqlOutlined />,
      label: '命令列界面...',
      onClick: onOpenTerminal,
    },
    {
      key: 'run-sql-file',
      icon: <FileTextOutlined />,
      label: '运行SQL文件...',
      onClick: onRunSqlFile,
    },
    { type: 'divider' },
    {
      key: 'refresh',
      icon: <ReloadOutlined />,
      label: '刷新',
      onClick: onRefresh,
    },
    {
      key: 'manage-group',
      icon: <TeamOutlined />,
      label: '管理组',
      children: groupItems,
    },
    {
      key: 'color',
      icon: <BgColorsOutlined />,
      label: '颜色',
      children: colorItems,
    },
  ]
}
