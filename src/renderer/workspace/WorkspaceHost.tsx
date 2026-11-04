import React from 'react'
import { Button, Tabs } from 'antd'
import CodeOutlined from '@ant-design/icons/CodeOutlined'
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined'
import TableOutlined from '@ant-design/icons/TableOutlined'
import ObjectBrowser from '../components/ObjectBrowser'
import ConnectionDatabaseOverview from './ConnectionDatabaseOverview'
import DatabaseTableOverview from './DatabaseTableOverview'
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
import { writeWorkspaceLog } from './workspaceLog'
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

function getDocumentIcon(document: WorkspaceDocument) {
  if (document.kind === 'query') return <CodeOutlined />
  if (document.kind === 'data') return <TableOutlined />
  return <DatabaseOutlined />
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
  const handleActivate = useStableEvent((documentId: string) => {
    const document = documents.find(item => item.id === documentId)
    if (document?.kind === 'data') {
      void writeWorkspaceLog(
        'info',
        document.loading
          ? `切换数据标签: 文档=${document.id}, 表=${JSON.stringify(document.objectName)}, 状态=加载中`
          : `切换已缓存数据标签: 文档=${document.id}, 表=${JSON.stringify(document.objectName)}, 行数=${document.rows.length}, 未触发重新读取`,
      )
    }
    onActivate(documentId)
  })

  if (surface === 'objects' && selectedDatabase) {
    if (objectCategory === 'tables') {
      return (
        <main className="sqltool-center-panel">
          <DatabaseTableOverview
            database={selectedDatabase.database}
            rows={tableSummaries}
            loading={databaseObjectsLoading}
            error={tableSummariesError}
            selectedObject={selectedObject}
            onSelectObject={onSelectObject}
            onOpenTable={onOpenObject}
            onTableAction={onTableAction}
            onRefresh={onRefreshTableSummaries}
          />
        </main>
      )
    }
    return (
      <main className="sqltool-center-panel">
        <ObjectBrowser
          connectionId={selectedDatabase.connId}
          database={selectedDatabase.database}
          category={objectCategory}
          objects={databaseObjects}
          backupRecords={databaseBackupRecords}
          backupVerification={databaseBackupVerification}
          loading={databaseObjectsLoading}
          selectedObject={selectedObject}
          onSelectObject={onSelectObject}
          onOpenTable={onOpenObject}
          onTableAction={onTableAction}
          onObjectAction={onObjectAction}
          onLoadTableMetadata={onLoadTableMetadata}
          tableStructureRevision={tableStructureRevision}
          onNewQuery={onNewQuery}
          onUnavailable={onUnavailable}
        />
      </main>
    )
  }

  if (surface === 'objects' && selectedConnection) {
    return (
      <main className="sqltool-center-panel">
        <ConnectionDatabaseOverview
          connection={selectedConnection}
          databases={connectionDatabases}
          loading={connectionDatabasesLoading}
          onOpenDatabase={onOpenDatabase}
          onRefresh={onRefreshConnectionDatabases}
        />
      </main>
    )
  }

  if (documents.length === 0) {
    return (
      <main className="sqltool-center-panel">
        <div className="empty-center-panel">
          <div className="empty-icon"><DatabaseOutlined /></div>
          <h3>选择一个数据库</h3>
          <p>从左侧连接树选择数据库以浏览对象</p>
          <Button type="primary" size="small" onClick={onNewQuery}>
            新建查询
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="sqltool-center-panel">
      <Tabs
        activeKey={activeDocumentId}
        onChange={handleActivate}
        type="editable-card"
        hideAdd
        destroyOnHidden={false}
        animated={{ inkBar: true, tabPane: false }}
        onEdit={(targetKey, action) => {
          if (action === 'remove' && typeof targetKey === 'string') {
            onClose(targetKey)
          }
        }}
        items={documents.map(document => ({
          key: document.id,
          forceRender: true,
          label: (
            <span className="workspace-tab-label">
              {getDocumentIcon(document)}
              <span>{document.name}</span>
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
        }))}
      />
    </main>
  )
}
