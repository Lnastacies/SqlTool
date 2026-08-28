import React, { memo, useEffect } from 'react'
import type { TableDataQuery, TableMutationBatch } from '../types'
import DataWorkspace from './DataWorkspace'
import { writeWorkspaceLog } from './workspaceLog'
import type { DataWorkspaceDocument } from './workspaceTypes'

interface DataWorkspacePaneProps {
  document: DataWorkspaceDocument
  onLoadData: (
    documentId: string,
    page: number,
    pageSize: number,
    query: TableDataQuery,
  ) => void
  onCommitData: (
    documentId: string,
    batch: TableMutationBatch,
  ) => Promise<boolean>
  onDirtyData: (documentId: string, dirty: boolean) => void
  /** 打开导出向导，导出当前表 */
  onExport?: (connId: string, database: string, tableName: string) => void
}

function DataWorkspacePane({
  document,
  onLoadData,
  onCommitData,
  onDirtyData,
  onExport,
}: DataWorkspacePaneProps) {
  useEffect(() => {
    void writeWorkspaceLog(
      'info',
      `数据标签进入页面缓存: 文档=${document.id}, 表=${JSON.stringify(document.objectName)}`,
    )
    return () => {
      void writeWorkspaceLog(
        'info',
        `数据标签退出页面缓存: 文档=${document.id}, 表=${JSON.stringify(document.objectName)}`,
      )
    }
  }, [document.id, document.objectName])

  return (
    <DataWorkspace
      document={document}
      onLoad={(page, pageSize, query) => {
        onLoadData(document.id, page, pageSize, query)
      }}
      onCommit={updates => onCommitData(document.id, updates)}
      onDirtyChange={dirty => onDirtyData(document.id, dirty)}
      onExport={() => (
        onExport?.(document.connId, document.database, document.objectName)
      )}
    />
  )
}

// 文档对象未变化时跳过渲染，标签切换只改变可见页面。
export default memo(DataWorkspacePane)
