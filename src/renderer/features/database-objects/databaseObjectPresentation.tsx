import React from 'react'
import BarChartOutlined from '@ant-design/icons/BarChartOutlined'
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined'
import CloudUploadOutlined from '@ant-design/icons/CloudUploadOutlined'
import CodeOutlined from '@ant-design/icons/CodeOutlined'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import EditOutlined from '@ant-design/icons/EditOutlined'
import ExportOutlined from '@ant-design/icons/ExportOutlined'
import EyeOutlined from '@ant-design/icons/EyeOutlined'
import FileSearchOutlined from '@ant-design/icons/FileSearchOutlined'
import FolderOpenOutlined from '@ant-design/icons/FolderOpenOutlined'
import FunctionOutlined from '@ant-design/icons/FunctionOutlined'
import ImportOutlined from '@ant-design/icons/ImportOutlined'
import PauseCircleOutlined from '@ant-design/icons/PauseCircleOutlined'
import PlayCircleOutlined from '@ant-design/icons/PlayCircleOutlined'
import PlusOutlined from '@ant-design/icons/PlusOutlined'
import ReloadOutlined from '@ant-design/icons/ReloadOutlined'
import RollbackOutlined from '@ant-design/icons/RollbackOutlined'
import SafetyCertificateOutlined from '@ant-design/icons/SafetyCertificateOutlined'
import TableOutlined from '@ant-design/icons/TableOutlined'
import type {
  DatabaseObjectCategory,
  DatabaseObjectKind,
} from './databaseObjectModel'

export type DatabaseObjectActionId =
  | 'open'
  | 'design'
  | 'create'
  | 'delete'
  | 'truncate'
  | 'import'
  | 'export'
  | 'execute'
  | 'enable'
  | 'disable'
  | 'restore'
  | 'extract'
  | 'rename'
  | 'verify'
  | 'showInFolder'
  | 'refresh'

export interface DatabaseObjectAction {
  id: DatabaseObjectActionId
  label: string
  icon: React.ReactNode
  requiresSelection?: boolean
}

export const DATABASE_OBJECT_CATEGORY_ICONS:
  Record<DatabaseObjectCategory, React.ReactNode> = {
    tables: <TableOutlined />,
    views: <EyeOutlined />,
    functions: <FunctionOutlined />,
    events: <ClockCircleOutlined />,
    queries: <CodeOutlined />,
    reports: <BarChartOutlined />,
    backups: <CloudUploadOutlined />,
  }

export const DATABASE_OBJECT_KIND_ICONS:
  Record<DatabaseObjectKind, React.ReactNode> = {
    table: <TableOutlined />,
    view: <EyeOutlined />,
    function: <FunctionOutlined />,
    procedure: <PlayCircleOutlined />,
    event: <ClockCircleOutlined />,
    query: <CodeOutlined />,
    report: <BarChartOutlined />,
    backup: <CloudUploadOutlined />,
  }

export const DATABASE_OBJECT_ACTIONS:
  Record<DatabaseObjectCategory, DatabaseObjectAction[]> = {
    tables: [
      { id: 'open', label: '打开表', icon: <FolderOpenOutlined />, requiresSelection: true },
      { id: 'design', label: '设计表', icon: <EditOutlined />, requiresSelection: true },
      { id: 'create', label: '新建表', icon: <PlusOutlined /> },
      { id: 'delete', label: '删除表', icon: <DeleteOutlined />, requiresSelection: true },
      { id: 'truncate', label: '清空表', icon: <DeleteOutlined />, requiresSelection: true },
      { id: 'import', label: '导入向导', icon: <ImportOutlined />, requiresSelection: true },
      { id: 'export', label: '导出向导', icon: <ExportOutlined />, requiresSelection: true },
    ],
    views: [
      { id: 'open', label: '打开视图', icon: <FolderOpenOutlined />, requiresSelection: true },
      { id: 'design', label: '设计视图', icon: <EditOutlined />, requiresSelection: true },
      { id: 'create', label: '新建视图', icon: <PlusOutlined /> },
      { id: 'delete', label: '删除视图', icon: <DeleteOutlined />, requiresSelection: true },
      { id: 'export', label: '导出向导', icon: <ExportOutlined /> },
    ],
    functions: [
      { id: 'design', label: '设计函数', icon: <EditOutlined />, requiresSelection: true },
      { id: 'create', label: '新建函数', icon: <PlusOutlined /> },
      { id: 'delete', label: '删除函数', icon: <DeleteOutlined />, requiresSelection: true },
      { id: 'execute', label: '运行函数', icon: <PlayCircleOutlined />, requiresSelection: true },
    ],
    events: [
      { id: 'design', label: '设计事件', icon: <EditOutlined />, requiresSelection: true },
      { id: 'create', label: '新建事件', icon: <PlusOutlined /> },
      { id: 'delete', label: '删除事件', icon: <DeleteOutlined />, requiresSelection: true },
      { id: 'enable', label: '启用事件', icon: <PlayCircleOutlined />, requiresSelection: true },
      { id: 'disable', label: '停用事件', icon: <PauseCircleOutlined />, requiresSelection: true },
    ],
    queries: [
      { id: 'open', label: '打开查询', icon: <FolderOpenOutlined />, requiresSelection: true },
      { id: 'create', label: '新建查询', icon: <PlusOutlined /> },
      { id: 'delete', label: '删除查询', icon: <DeleteOutlined />, requiresSelection: true },
    ],
    reports: [
      { id: 'open', label: '打开报表', icon: <FolderOpenOutlined />, requiresSelection: true },
      { id: 'design', label: '设计报表', icon: <EditOutlined />, requiresSelection: true },
      { id: 'create', label: '新建报表', icon: <PlusOutlined /> },
      { id: 'delete', label: '删除报表', icon: <DeleteOutlined />, requiresSelection: true },
      { id: 'export', label: '导出报表', icon: <ExportOutlined />, requiresSelection: true },
    ],
    backups: [
      { id: 'create', label: '新建备份', icon: <CloudUploadOutlined /> },
      { id: 'restore', label: '还原备份', icon: <RollbackOutlined />, requiresSelection: true },
      { id: 'extract', label: '提取 SQL', icon: <FileSearchOutlined />, requiresSelection: true },
      { id: 'rename', label: '重命名', icon: <EditOutlined />, requiresSelection: true },
      { id: 'verify', label: '校验备份', icon: <SafetyCertificateOutlined />, requiresSelection: true },
      { id: 'delete', label: '删除备份', icon: <DeleteOutlined />, requiresSelection: true },
      { id: 'showInFolder', label: '打开目录', icon: <FolderOpenOutlined /> },
      { id: 'refresh', label: '刷新记录', icon: <ReloadOutlined /> },
    ],
  }
