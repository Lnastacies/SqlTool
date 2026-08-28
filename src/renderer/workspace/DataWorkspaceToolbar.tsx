import React from 'react'
import { Button, Input, message, Modal } from 'antd'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import EditOutlined from '@ant-design/icons/EditOutlined'
import ExportOutlined from '@ant-design/icons/ExportOutlined'
import FilterOutlined from '@ant-design/icons/FilterOutlined'
import PlusOutlined from '@ant-design/icons/PlusOutlined'
import ReloadOutlined from '@ant-design/icons/ReloadOutlined'
import SaveOutlined from '@ant-design/icons/SaveOutlined'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import ClearOutlined from '@ant-design/icons/ClearOutlined'
import CopyOutlined from '@ant-design/icons/CopyOutlined'
import ProfileOutlined from '@ant-design/icons/ProfileOutlined'
import TableOutlined from '@ant-design/icons/TableOutlined'
import UndoOutlined from '@ant-design/icons/UndoOutlined'
import type { TableMutationBatch } from '../types'

interface DataWorkspaceToolbarProps {
  editable: boolean
  editMode: boolean
  pendingCount: number
  selectedCount: number
  batch: TableMutationBatch
  filterCount: number
  viewMode: 'grid' | 'record'
  searchText: string
  onSearchChange: (value: string) => void
  onToggleEdit: () => void
  onAddRow: () => void
  onDeleteRows: () => void
  onCopyRows: () => void
  onViewModeChange: (mode: 'grid' | 'record') => void
  onReload: () => void
  onCommit: (batch: TableMutationBatch) => Promise<boolean>
  onCommitSuccess: () => void
  onRollback: () => void
  onOpenFilters: () => void
  onClearFilters: () => void
  /** 打开导出向导，导出当前表 */
  onExport?: () => void
}

export default function DataWorkspaceToolbar({
  editable,
  editMode,
  pendingCount,
  selectedCount,
  batch,
  filterCount,
  viewMode,
  searchText,
  onSearchChange,
  onToggleEdit,
  onAddRow,
  onDeleteRows,
  onCopyRows,
  onViewModeChange,
  onReload,
  onCommit,
  onCommitSuccess,
  onRollback,
  onOpenFilters,
  onClearFilters,
  onExport,
}: DataWorkspaceToolbarProps) {
  const commitChanges = async () => {
    if (await onCommit(batch)) onCommitSuccess()
  }

  const handleCommit = () => {
    if (batch.deletes.length === 0) {
      void commitChanges()
      return
    }
    Modal.confirm({
      title: '确认提交数据修改',
      content: `本次提交将永久删除 ${batch.deletes.length} 行记录，并同时应用其他修改。`,
      okText: '提交',
      cancelText: '取消',
      okType: 'danger',
      onOk: commitChanges,
    })
  }

  return (
    <div className="data-workspace__toolbar">
      <div className="data-workspace__commands">
        <span className="data-workspace__command-group">
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              if (pendingCount > 0) {
                message.warning('请先提交或回滚当前修改')
                return
              }
              onReload()
            }}
          >
            刷新
          </Button>
          <Button
            size="small"
            type={editMode ? 'primary' : 'default'}
            icon={<EditOutlined />}
            disabled={!editable}
            title={editable ? '切换数据编辑模式' : '该表没有主键，默认禁止直接编辑'}
            onClick={() => {
              if (editMode && pendingCount > 0) {
                message.warning('存在未提交修改，请先提交或回滚')
                return
              }
              onToggleEdit()
            }}
          >
            编辑
          </Button>
        </span>
        <span className="data-workspace__command-group">
          <Button
            size="small"
            icon={<PlusOutlined />}
            disabled={!editable}
            onClick={onAddRow}
          >
            新增
          </Button>
          <Button
            size="small"
            icon={<CopyOutlined />}
            disabled={!editable || selectedCount === 0}
            onClick={onCopyRows}
          >
            复制
          </Button>
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            disabled={!editable || selectedCount === 0}
            onClick={onDeleteRows}
          >
            删除
          </Button>
          {editMode && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                disabled={pendingCount === 0}
                onClick={handleCommit}
              >
                提交{pendingCount > 0 ? ` ${pendingCount}` : ''}
              </Button>
              <Button
                size="small"
                icon={<UndoOutlined />}
                disabled={pendingCount === 0}
                onClick={onRollback}
              >
                回滚
              </Button>
            </>
          )}
        </span>
        <span className="data-workspace__command-group">
          <Button
            size="small"
            icon={<ExportOutlined />}
            title="打开导出向导，导出当前表数据"
            onClick={() => {
              if (!onExport) {
                message.info('当前表暂不支持导出')
                return
              }
              onExport()
            }}
          >
            导出
          </Button>
          <Button
            size="small"
            type={filterCount > 0 ? 'primary' : 'default'}
            icon={<FilterOutlined />}
            onClick={() => {
              if (pendingCount > 0) {
                message.warning('请先提交或回滚当前修改')
                return
              }
              onOpenFilters()
            }}
          >
            筛选{filterCount > 0 ? ` ${filterCount}` : ''}
          </Button>
          {filterCount > 0 && (
            <Button
              className="data-workspace__icon-button"
              size="small"
              type="text"
              icon={<ClearOutlined />}
              title="清除全部筛选条件"
              onClick={() => {
                if (pendingCount > 0) {
                  message.warning('请先提交或回滚当前修改')
                  return
                }
                onClearFilters()
              }}
            />
          )}
        </span>
        <span className="data-workspace__view-switch">
          <Button
            size="small"
            type={viewMode === 'grid' ? 'primary' : 'default'}
            icon={<TableOutlined />}
            title="网格视图"
            onClick={() => onViewModeChange('grid')}
          />
          <Button
            size="small"
            type={viewMode === 'record' ? 'primary' : 'default'}
            icon={<ProfileOutlined />}
            title="记录视图"
            onClick={() => onViewModeChange('record')}
          />
        </span>
      </div>
      <Input
        size="small"
        prefix={<SearchOutlined />}
        allowClear
        value={searchText}
        onChange={event => onSearchChange(event.target.value)}
        placeholder="在当前页查找"
        className="data-workspace__search"
      />
    </div>
  )
}
