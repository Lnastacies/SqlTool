import React from 'react'
import type { MenuProps } from 'antd'
import ExportOutlined from '@ant-design/icons/ExportOutlined'
import FileSearchOutlined from '@ant-design/icons/FileSearchOutlined'
import FileTextOutlined from '@ant-design/icons/FileTextOutlined'
import FolderAddOutlined from '@ant-design/icons/FolderAddOutlined'
import FolderOpenOutlined from '@ant-design/icons/FolderOpenOutlined'
import ImportOutlined from '@ant-design/icons/ImportOutlined'
import PlusOutlined from '@ant-design/icons/PlusOutlined'
import ReloadOutlined from '@ant-design/icons/ReloadOutlined'
import RollbackOutlined from '@ant-design/icons/RollbackOutlined'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import SnippetsOutlined from '@ant-design/icons/SnippetsOutlined'
import type { DatabaseObjectCategory } from './databaseObjectModel'

export type DatabaseObjectCategoryActionId =
  | 'create'
  | 'import'
  | 'export'
  | 'runSqlFile'
  | 'search'
  | 'createGroup'
  | 'paste'
  | 'refresh'
  | 'openArchive'
  | 'restore'
  | 'extractSql'
  | 'showInFolder'

interface DatabaseObjectContextMenuOptions {
  category: DatabaseObjectCategory
  onAction: (action: DatabaseObjectCategoryActionId) => void
}

type MenuItem = NonNullable<MenuProps['items']>[number]

function command(
  key: DatabaseObjectCategoryActionId,
  label: string,
  icon: React.ReactNode,
  onAction: DatabaseObjectContextMenuOptions['onAction'],
  disabled = false,
): MenuItem {
  return {
    key,
    label,
    icon,
    disabled,
    onClick: () => onAction(key),
  }
}

const divider = (): MenuItem => ({ type: 'divider' })

function groupCommands(
  onAction: DatabaseObjectContextMenuOptions['onAction'],
): MenuItem[] {
  return [
    command('createGroup', '新建组', <FolderAddOutlined />, onAction),
    command('paste', '粘贴', <SnippetsOutlined />, onAction, true),
  ]
}

export function buildDatabaseObjectContextMenu({
  category,
  onAction,
}: DatabaseObjectContextMenuOptions): MenuProps['items'] {
  const createLabels: Partial<Record<DatabaseObjectCategory, string>> = {
    tables: '新建表',
    views: '新建视图',
    functions: '新建函数',
    events: '新建事件',
    queries: '新建查询',
    reports: '新建报表',
    backups: '新建备份',
  }
  const createItem = command(
    'create',
    createLabels[category]!,
    <PlusOutlined />,
    onAction,
  )
  const refreshItem = command(
    'refresh',
    '刷新',
    <ReloadOutlined />,
    onAction,
  )

  if (category === 'tables') {
    return [
      createItem,
      divider(),
      command('import', '导入向导...', <ImportOutlined />, onAction),
      command('export', '导出向导...', <ExportOutlined />, onAction),
      divider(),
      command('runSqlFile', '运行 SQL 文件...', <FileTextOutlined />, onAction),
      command('search', '在数据库中查找', <SearchOutlined />, onAction),
      divider(),
      ...groupCommands(onAction),
      divider(),
      refreshItem,
    ]
  }

  if (category === 'views') {
    return [
      createItem,
      divider(),
      command('export', '导出向导', <ExportOutlined />, onAction),
      divider(),
      ...groupCommands(onAction),
      divider(),
      refreshItem,
    ]
  }

  if (category === 'reports') {
    return [
      createItem,
      command('openArchive', '打开报表存档', <FolderOpenOutlined />, onAction),
      ...groupCommands(onAction),
      divider(),
      command('showInFolder', '在文件夹中显示', <FolderOpenOutlined />, onAction),
      refreshItem,
    ]
  }

  if (category === 'backups') {
    return [
      createItem,
      command('restore', '还原备份从...', <RollbackOutlined />, onAction),
      command('extractSql', '提取 SQL 从...', <FileSearchOutlined />, onAction),
      ...groupCommands(onAction),
      divider(),
      command('showInFolder', '在文件夹中显示', <FolderOpenOutlined />, onAction),
      refreshItem,
    ]
  }

  if (category === 'queries') {
    return [
      createItem,
      command('openArchive', '打开查询文件...', <FolderOpenOutlined />, onAction),
      ...groupCommands(onAction),
      divider(),
      command('showInFolder', '在文件夹中显示', <FolderOpenOutlined />, onAction),
      refreshItem,
    ]
  }

  return [
    createItem,
    ...groupCommands(onAction),
    divider(),
    refreshItem,
  ]
}
