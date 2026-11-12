import { Button } from 'antd'
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined'
import ObjectBrowser from '../components/ObjectBrowser'
import ConnectionDatabaseOverview from './ConnectionDatabaseOverview'
import DatabaseTableOverview from './DatabaseTableOverview'
import type {
  DatabaseObjectCategory,
  DatabaseObjectSelection,
  DatabaseObjects,
} from '../features/database-objects/databaseObjectModel'
import type { DatabaseObjectAction } from '../features/database-objects/databaseObjectPresentation'
import type { DatabaseBackupVerification } from '../features/backups/databaseBackupActionSupport'
import type {
  ConnectionData,
  DatabaseBackupRecord,
  DatabaseSummary,
  TableMetadata,
  TableSummary,
} from '../types'

interface ObjectsWorkspacePaneProps {
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

/**
 * 常驻表清单标签的内容。
 * 只负责“当前选中上下文”的对象浏览渲染，标签生命周期由 WorkspaceHost 管理；
 * 组件常驻挂载，切走再切回时内部滚动位置与展开状态得以保留。
 */
export default function ObjectsWorkspacePane({
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
  onSelectObject,
  onOpenDatabase,
  onRefreshConnectionDatabases,
  onRefreshTableSummaries,
  onOpenObject,
  onTableAction,
  onObjectAction,
  onLoadTableMetadata,
  tableStructureRevision,
  onNewQuery,
  onUnavailable,
}: ObjectsWorkspacePaneProps) {
  if (selectedDatabase) {
    if (objectCategory === 'tables') {
      return (
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
      )
    }
    return (
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
    )
  }

  if (selectedConnection) {
    return (
      <ConnectionDatabaseOverview
        connection={selectedConnection}
        databases={connectionDatabases}
        loading={connectionDatabasesLoading}
        onOpenDatabase={onOpenDatabase}
        onRefresh={onRefreshConnectionDatabases}
      />
    )
  }

  return (
    <div className="empty-center-panel">
      <div className="empty-icon"><DatabaseOutlined /></div>
      <h3>选择一个数据库</h3>
      <p>从左侧连接树选择数据库以浏览对象</p>
      <Button type="primary" size="small" onClick={onNewQuery}>
        新建查询
      </Button>
    </div>
  )
}
