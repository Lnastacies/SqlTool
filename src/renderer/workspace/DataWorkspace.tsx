import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  message,
  Spin,
} from 'antd'
import type {
  TableDataQuery,
  TableMutationBatch,
} from '../types'
import type { DataGridRow } from './dataEditingTypes'
import DataFilterDialog from './DataFilterDialog'
import DataRecordView from './DataRecordView'
import DataWorkspaceFooter from './DataWorkspaceFooter'
import DataWorkspaceGrid from './DataWorkspaceGrid'
import DataWorkspaceToolbar from './DataWorkspaceToolbar'
import { useDataEditing } from './useDataEditing'
import { writeWorkspaceLog } from './workspaceLog'
import type { DataWorkspaceDocument } from './workspaceTypes'

interface DataWorkspaceProps {
  document: DataWorkspaceDocument
  onLoad: (
    page: number,
    pageSize: number,
    query: TableDataQuery,
  ) => void
  onCommit: (batch: TableMutationBatch) => Promise<boolean>
  onDirtyChange: (dirty: boolean) => void
  /** 打开导出向导，导出当前表 */
  onExport?: () => void
}

export default function DataWorkspace({
  document,
  onLoad,
  onCommit,
  onDirtyChange,
  onExport,
}: DataWorkspaceProps) {
  const [searchText, setSearchText] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'record'>('grid')
  const editing = useDataEditing(document, onDirtyChange)
  const changePage = (page: number, pageSize: number) => {
    if (editing.pendingCount > 0) {
      message.warning('请先提交或回滚当前修改')
      return
    }

    void writeWorkspaceLog(
      'info',
      `切换数据分页: 文档=${document.id}, 页码=${page}, 每页=${pageSize}, 总记录=${document.total}`,
    )
    onLoad(page, pageSize, document.query)
  }

  useEffect(() => {
    setSelectedRowKeys([])
    setFilterOpen(false)
  }, [document.id, document.page])

  const allRows = useMemo<DataGridRow[]>(() => {
    const draftRows = editing.draftRows.map(draft => ({
      kind: 'draft' as const,
      identity: draft.id,
      data: draft.values,
      sourceIndex: -1,
      draftId: draft.id,
    }))
    const existingRows = editing.rows.map((data, sourceIndex) => ({
      kind: 'existing' as const,
      identity: editing.rowIdentity(data, sourceIndex),
      data,
      sourceIndex,
    }))
    return [...draftRows, ...existingRows]
  }, [editing.draftRows, editing.rows])

  const rows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return allRows
    return allRows.filter(record => (
      record.kind === 'draft'
      || Object.values(record.data).some(
      value => String(value ?? '').toLowerCase().includes(keyword),
      )
    ))
  }, [allRows, searchText])

  const selectedRows = useMemo(() => allRows.filter(record => (
    selectedRowKeys.includes(record.identity)
    && !editing.deletedRows[record.identity]
  )), [allRows, editing.deletedRows, selectedRowKeys])

  useEffect(() => {
    if (viewMode !== 'record') return
    const availableKeys = new Set(
      rows
        .filter(row => !editing.deletedRows[row.identity])
        .map(row => row.identity),
    )
    const currentKey = selectedRowKeys.find(key => availableKeys.has(key))
    const nextKey = currentKey || availableKeys.values().next().value

    if (!nextKey) {
      if (selectedRowKeys.length > 0) setSelectedRowKeys([])
      return
    }
    if (selectedRowKeys.length !== 1 || selectedRowKeys[0] !== nextKey) {
      setSelectedRowKeys([nextKey])
    }
  }, [editing.deletedRows, rows, selectedRowKeys, viewMode])

  return (
    <div className="data-workspace">
      <DataWorkspaceToolbar
        editable={document.editable}
        editMode={editing.editMode}
        pendingCount={editing.pendingCount}
        selectedCount={selectedRowKeys.length}
        batch={editing.batch}
        filterCount={document.query.filters.length}
        viewMode={viewMode}
        searchText={searchText}
        onSearchChange={setSearchText}
        onToggleEdit={() => editing.setEditMode(previous => !previous)}
        onAddRow={() => {
          editing.setEditMode(true)
          editing.addRow()
        }}
        onCopyRows={() => {
          const draftKeys = editing.copyRows(selectedRows)
          editing.setEditMode(true)
          setSelectedRowKeys(
            viewMode === 'record' ? draftKeys.slice(0, 1) : draftKeys,
          )
          void writeWorkspaceLog(
            'info',
            `复制行为草稿: 文档=${document.id}, 表=${JSON.stringify(document.objectName)}, 行数=${draftKeys.length}`,
          )
        }}
        onDeleteRows={() => {
          editing.setEditMode(true)
          editing.markRowsForDeletion(selectedRows)
          setSelectedRowKeys([])
        }}
        onViewModeChange={mode => {
          setViewMode(mode)
          void writeWorkspaceLog(
            'info',
            `切换数据视图: 文档=${document.id}, 模式=${mode}`,
          )
        }}
        onReload={() => onLoad(
          document.page,
          document.pageSize,
          document.query,
        )}
        onCommit={onCommit}
        onCommitSuccess={() => {
          editing.finishCommit()
          setSelectedRowKeys([])
          onLoad(document.page, document.pageSize, document.query)
        }}
        onRollback={() => {
          editing.rollback()
          setSelectedRowKeys([])
          void writeWorkspaceLog(
            'info',
            `回滚数据草稿: 文档=${document.id}`,
          )
        }}
        onOpenFilters={() => setFilterOpen(true)}
        onClearFilters={() => {
          onLoad(1, document.pageSize, {
            ...document.query,
            filters: [],
          })
        }}
        onExport={onExport}
      />

      <DataFilterDialog
        open={filterOpen}
        fields={document.fields}
        query={document.query}
        onClose={() => setFilterOpen(false)}
        onApply={query => {
          setFilterOpen(false)
          onLoad(1, document.pageSize, query)
        }}
      />

      {document.error && (
        <Alert
          type="error"
          showIcon
          message="数据加载失败"
          description={document.error}
          className="data-workspace__error"
        />
      )}

      {viewMode === 'grid' ? (
        <div className="data-workspace__grid">
          <DataWorkspaceGrid
            document={document}
            rows={rows}
            editMode={editing.editMode}
            selectedRowKeys={selectedRowKeys}
            pendingRows={editing.pendingRows}
            deletedRows={editing.deletedRows}
            onSelectionChange={setSelectedRowKeys}
            onCellChange={(record, column, value) => {
              if (record.kind === 'draft' && record.draftId) {
                editing.updateDraftCell(record.draftId, column, value)
                return
              }
              editing.updateCell(
                record.data,
                record.sourceIndex,
                column,
                value,
              )
            }}
            onSortChange={column => {
              if (editing.pendingCount > 0) {
                message.warning('请先提交或回滚当前修改')
                return
              }
              const current = document.query.sorts.find(
                sort => sort.field === column,
              )?.direction
              const sorts = current === 'asc'
                ? [{ field: column, direction: 'desc' as const }]
                : current === 'desc'
                  ? []
                  : [{ field: column, direction: 'asc' as const }]
              onLoad(1, document.pageSize, {
                ...document.query,
                sorts,
              })
            }}
          />
        </div>
      ) : (
        <div className="data-workspace__record">
          <Spin spinning={document.loading}>
            <DataRecordView
              document={document}
              rows={rows}
              editMode={editing.editMode}
              selectedRowKey={selectedRowKeys[0]}
              pendingRows={editing.pendingRows}
              deletedRows={editing.deletedRows}
              onSelect={rowKey => setSelectedRowKeys([rowKey])}
              onCellChange={(record, column, value) => {
                if (record.kind === 'draft' && record.draftId) {
                  editing.updateDraftCell(record.draftId, column, value)
                  return
                }
                editing.updateCell(
                  record.data,
                  record.sourceIndex,
                  column,
                  value,
                )
              }}
            />
          </Spin>
        </div>
      )}
      <DataWorkspaceFooter
        database={document.database}
        objectName={document.objectName}
        page={document.page}
        pageSize={document.pageSize}
        total={document.total}
        filterCount={document.query.filters.length}
        selectedCount={selectedRowKeys.length}
        pendingCount={editing.pendingCount}
        editable={document.editable}
        onPageChange={changePage}
      />
    </div>
  )
}
