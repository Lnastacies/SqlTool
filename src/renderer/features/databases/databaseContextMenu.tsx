import React from 'react'
import type { MenuProps } from 'antd'
import ApartmentOutlined from '@ant-design/icons/ApartmentOutlined'
import CloseCircleOutlined from '@ant-design/icons/CloseCircleOutlined'
import CodeOutlined from '@ant-design/icons/CodeOutlined'
import ConsoleSqlOutlined from '@ant-design/icons/ConsoleSqlOutlined'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import EditOutlined from '@ant-design/icons/EditOutlined'
import ExportOutlined from '@ant-design/icons/ExportOutlined'
import FileTextOutlined from '@ant-design/icons/FileTextOutlined'
import PlusCircleOutlined from '@ant-design/icons/PlusCircleOutlined'
import PrinterOutlined from '@ant-design/icons/PrinterOutlined'
import ReloadOutlined from '@ant-design/icons/ReloadOutlined'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import type { ConnectionData } from '../../types'

interface DatabaseContextMenuOptions {
  connection: ConnectionData
  onClose: () => void
  onEdit: () => void
  onCreate: () => void
  onDelete: () => void
  onNewQuery: () => void
  onOpenTerminal: () => void
  onRunSqlFile: () => void
  onDump: () => void
  onPrint: () => void
  onReverseModel: () => void
  onSearch: () => void
  onRefresh: () => void
}

export function buildDatabaseContextMenu({
  connection,
  onClose,
  onEdit,
  onCreate,
  onDelete,
  onNewQuery,
  onOpenTerminal,
  onRunSqlFile,
  onDump,
  onPrint,
  onReverseModel,
  onSearch,
  onRefresh,
}: DatabaseContextMenuOptions): MenuProps['items'] {
  const sqlite = connection.type === 'SQLite'
  return [
    {
      key: 'close-database',
      icon: <CloseCircleOutlined />,
      label: '关闭数据库',
      onClick: onClose,
    },
    { type: 'divider' },
    {
      key: 'edit-database',
      icon: <EditOutlined />,
      label: '编辑数据库...',
      onClick: onEdit,
    },
    ...(sqlite
      ? []
      : [{
        key: 'create-database',
        icon: <PlusCircleOutlined />,
        label: '新建数据库...',
        onClick: onCreate,
      }]),
    {
      key: 'delete-database',
      icon: <DeleteOutlined />,
      label: '删除数据库',
      danger: true,
      disabled: sqlite,
      onClick: onDelete,
    },
    { type: 'divider' },
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
      key: 'dump-database',
      icon: <ExportOutlined />,
      label: '转储SQL文件',
      onClick: onDump,
    },
    {
      key: 'print-database',
      icon: <PrinterOutlined />,
      label: '打印数据库',
      onClick: onPrint,
    },
    {
      key: 'reverse-model',
      icon: <ApartmentOutlined />,
      label: '逆向数据库到模型...',
      onClick: onReverseModel,
    },
    {
      key: 'search-database',
      icon: <SearchOutlined />,
      label: '在数据库中查找',
      onClick: onSearch,
    },
    { type: 'divider' },
    {
      key: 'refresh',
      icon: <ReloadOutlined />,
      label: '刷新',
      onClick: onRefresh,
    },
  ]
}
