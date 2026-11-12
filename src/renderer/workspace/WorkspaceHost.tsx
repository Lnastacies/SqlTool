import React, { useRef } from 'react'
import { Tabs } from 'antd'
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined'
import ObjectsWorkspacePane from './ObjectsWorkspacePane'
import type {
  DatabaseObjectCategory,
  DatabaseObjectSelection,
  DatabaseObjects,
} from '../features/database-objects/databaseObjectModel'
import type {
  DatabaseObjectAction,
} from '../features/database-objects/databaseObjectPresentation'
import type {
  DatabaseBackupVerification,
} from '../features/backups/databaseBackupActionSupport'
import type {
  ConnectionData,
  DatabaseBackupRecord,
  DatabaseSummary,
  TableDataQuery,
  TableMetadata,
  TableMutationBatch,
  TableSummary,
} from '../types'
import DataWorkspacePane from './DataWorkspacePane'
import QueryWorkspace from './QueryWorkspace'
import type { QueryExecutionMode } from './queryExecutionSql'
import { useStableEvent } from './useStableEvent'
import { useTabWheelScroll } from './useTabWheelScroll'
import { writeWorkspaceLog } from './workspaceLog'
import {
  OBJECTS_TAB_ID,
  getDocumentIcon,
  getDocumentTabTitle,
  getObjectsTabTitle,
  resolveActiveTabAfterClose,
} from './workspaceTabModel'
import type {
  QueryWorkspaceDocument,
  WorkspaceDocument,
  WorkspaceSurface,
} from './workspaceTypes'

interface WorkspaceHostProps {
  documents: WorkspaceDocument[]
  activeDocumentId: string
  surface: WorkspaceSurface
  connections: Map<string, ConnectionData>
  activeConnections: Set<string>
  selectedConnection: ConnectionData | null
  selectedDatabase: { connId: string; database: string } | null
  connectionDatabases: DatabaseSummary[]
  connectionDatabasesLoading: boolean
  objectCategory: DatabaseObjectCategory
  databaseObjects: DatabaseObjects
  tableSummaries: TableSummary[]
  tableSummariesError: string
  databaseBackupRecords: DatabaseBackupRecord[]
  databaseBackupVerification: Record<string, DatabaseBackupVerification>
  databaseObjectsLoading: boolean
  selectedObject: DatabaseObjectSelection | null
  onActivate: (documentId: string) => void
  onClose: (documentId: string) => void
  onExecuteQuery: (
    documentId: string,
    mode: QueryExecutionMode,
  ) => void
  onCancelQuery: (documentId: string) => void
  onChangeQueryContext: (
    documentId: string,
    patch: { connId?: string; database?: string },
  ) => void
  onQueryTransaction: (
    documentId: string,
    action: 'begin' | 'commit' | 'rollback',
  ) => void
  onUpdateQuery: (
    documentId: string,
    patch: Partial<QueryWorkspaceDocument>,
  ) => void
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
  /** 打开导出向导，导出指定表 */
  onExportData?: (
    connId: string,
    database: string,
    tableName: string,
  ) => void
  onSelectObject: (selection: DatabaseObjectSelection) => void
  onOpenDatabase: (database: string) => void
  onRefreshConnectionDatabases: () => void
  onRefreshTableSummaries: () => void
  onOpenObject: (tableName: string) => void
  onTableAction: (
    action: DatabaseObjectAction,
    tableName?: string,
  ) => void
  onObjectAction: (
    action: DatabaseObjectAction,
    selection?: DatabaseObjectSelection,
  ) => void
  onLoadTableMetadata: (
    connectionId: string,
    database: string,
    tableName: string,
  ) => Promise<TableMetadata>
  tableStructureRevision: number
  onNewQuery: () => void
  onUnavailable: (label: string) => void
}

export default function WorkspaceHost({
  documents,
  activeDocumentId,
  surface,
  connections,
  activeConnections,
  selectedConnection,
  selectedDatabase,
  connectionDatabases,
  connectionDatabasesLoading,
  objectCategory,
  databaseObjects,
  tableSummaries,
  tableSummariesError,
  databaseBackupRecords,
  databaseBackupVerification,
  databaseObjectsLoading,
  selectedObject,
  onOpenDatabase,
  onRefreshConnectionDatabases,
  onRefreshTableSummaries,
  onActivate,
  onClose,
  onExecuteQuery,
  onCancelQuery,
  onChangeQueryContext,
  onQueryTransaction,
  onUpdateQuery,
  onLoadData,
  onCommitData,
  onDirtyData,
  onExportData,
  onSelectObject,
  onOpenObject,
  onTableAction,
  onObjectAction,
  onLoadTableMetadata,
  tableStructureRevision,
  onNewQuery,
  onUnavailable,
}: WorkspaceHostProps) {
  const stableLoadData = useStableEvent(onLoadData)
  const stableCommitData = useStableEvent(onCommitData)
  const stableDirtyData = useStableEvent(onDirtyData)
  const containerRef = useRef<HTMLElement>(null)
  // 标签栏滚轮横向滚动（边界释放事件，保留 antd「更多」下拉兜底）
  useTabWheelScroll(containerRef)

  // 对象浏览视图作为常驻标签参与标签栏排序与激活
  const activeTabId = surface === 'objects' ? OBJECTS_TAB_ID : activeDocumentId
  const tabIds = [OBJECTS_TAB_ID, ...documents.map(document => document.id)]
  const objectsTabTitle = getObjectsTabTitle(
    selectedDatabase?.database || null,
    objectCategory,
  )

  const handleActivate = useStableEvent((tabId: string) => {
    if (tabId === OBJECTS_TAB_ID) {
      void writeWorkspaceLog(
        'info',
        `聚焦表清单标签: 连接=${selectedDatabase?.connId || '未选择'}, 数据库=${selectedDatabase?.database || '未选择'}, 分类=${objectCategory}`,
        'WorkspaceTabs',
      )
      onActivate(tabId)
      return
    }
    const document = documents.find(item => item.id === tabId)
    if (document?.kind === 'data') {
      void writeWorkspaceLog(
        'info',
        document.loading
          ? `切换数据标签: 文档=${document.id}, 表=${JSON.stringify(document.objectName)}, 状态=加载中`
          : `切换已缓存数据标签: 文档=${document.id}, 表=${JSON.stringify(document.objectName)}, 行数=${document.rows.length}, 未触发重新读取`,
        'WorkspaceTabs',
      )
    } else {
      void writeWorkspaceLog(
        'info',
        `聚焦工作区标签: 标签=${document ? getDocumentTabTitle(document) : tabId}, 类型=${document?.kind || '未知'}`,
        'WorkspaceTabs',
      )
    }
    onActivate(tabId)
  })

  const handleClose = useStableEvent((tabId: string) => {
    const closingDocument = documents.find(document => document.id === tabId)
    const nextTabId = resolveActiveTabAfterClose(tabIds, tabId, activeTabId)
    const nextDocument = documents.find(document => document.id === nextTabId)
    void writeWorkspaceLog(
      'info',
      `关闭工作区标签: 标签=${closingDocument ? getDocumentTabTitle(closingDocument) : tabId}, 激活回落=${nextDocument ? getDocumentTabTitle(nextDocument) : '表清单'}`,
      'WorkspaceTabs',
    )
    onClose(tabId)
  })

  return (
    <main className="sqltool-center-panel" ref={containerRef}>
      <Tabs
        activeKey={activeTabId}
        onChange={handleActivate}
        type="editable-card"
        hideAdd
        destroyOnHidden={false}
        animated={{ inkBar: true, tabPane: false }}
        onEdit={(targetKey, action) => {
          if (action === 'remove' && typeof targetKey === 'string') {
            handleClose(targetKey)
          }
        }}
        items={[
          {
            key: OBJECTS_TAB_ID,
            // 常驻标签不可关闭，且始终保持挂载以保留滚动位置与展开状态
            closable: false,
            forceRender: true,
            label: (
              <span className="workspace-tab-label" title={objectsTabTitle}>
                <DatabaseOutlined />
                <span>{objectsTabTitle}</span>
              </span>
            ),
            children: (
              <ObjectsWorkspacePane
                selectedConnection={selectedConnection}
                selectedDatabase={selectedDatabase}
                connectionDatabases={connectionDatabases}
                connectionDatabasesLoading={connectionDatabasesLoading}
                objectCategory={objectCategory}
                databaseObjects={databaseObjects}
                tableSummaries={tableSummaries}
                tableSummariesError={tableSummariesError}
                databaseBackupRecords={databaseBackupRecords}
                databaseBackupVerification={databaseBackupVerification}
                databaseObjectsLoading={databaseObjectsLoading}
                selectedObject={selectedObject}
                onSelectObject={onSelectObject}
                onOpenDatabase={onOpenDatabase}
                onRefreshConnectionDatabases={onRefreshConnectionDatabases}
                onRefreshTableSummaries={onRefreshTableSummaries}
                onOpenObject={onOpenObject}
                onTableAction={onTableAction}
                onObjectAction={onObjectAction}
                onLoadTableMetadata={onLoadTableMetadata}
                tableStructureRevision={tableStructureRevision}
                onNewQuery={onNewQuery}
                onUnavailable={onUnavailable}
              />
            ),
          },
          ...documents.map(document => {
            const title = getDocumentTabTitle(document)
            return {
              key: document.id,
              forceRender: true,
              label: (
                <span className="workspace-tab-label" title={title}>
                  {getDocumentIcon(document)}
                  <span>{title}</span>
                  {document.dirty && <span className="workspace-tab-dirty">*</span>}
                </span>
              ),
              children: document.kind === 'query' ? (
                <QueryWorkspace
                  document={document}
                  connections={connections}
                  activeConnections={activeConnections}
                  onExecute={onExecuteQuery}
                  onCancel={onCancelQuery}
                  onContextChange={onChangeQueryContext}
                  onTransaction={onQueryTransaction}
                  onUpdate={onUpdateQuery}
                />
              ) : document.kind === 'data' ? (
                <DataWorkspacePane
                  document={document}
                  onLoadData={stableLoadData}
                  onCommitData={stableCommitData}
                  onDirtyData={stableDirtyData}
                  onExport={onExportData}
                />
              ) : (
                <div className="workspace-placeholder">
                  <DatabaseOutlined />
                  {/* 通用工作区占位：当前版本仅有查询、数据两类内置文档；
                      其他类型（模型、报表、传输等）通常通过独立对话框承载，
                      此处给出友好提示而非显示「正在迁移」以免误解为功能故障。 */}
                  <span className="workspace-placeholder__title">
                    {document.name}
                  </span>
                  <span className="workspace-placeholder__subtitle">
                    工作区内容已在独立窗口中打开，可使用顶部菜单切换相关功能。
                  </span>
                </div>
              ),
            }
          }),
        ]}
      />
    </main>
  )
}
