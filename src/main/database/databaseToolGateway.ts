import type { ExecuteResult, TableMetadata, TableDataPage } from './adapters'
import type { ConnectionCatalog } from './connectionConfigTypes'
import type {
  TableMutationBatch,
  TableMutationResult,
} from './tableMutationTypes'
import type {
  SaveTableStructureRequest,
  SaveTableStructureResult,
  TableStructurePlan,
} from './tableStructureTypes'

export interface DatabaseToolGateway {
  getConnectionCatalog(): ConnectionCatalog
  getTables(connId: string, database: string): Promise<string[]>
  getTableMetadata(
    connId: string,
    database: string,
    tableName: string,
  ): Promise<TableMetadata>
  getTableData(
    connId: string,
    database: string,
    tableName: string,
    page: number,
    pageSize: number,
  ): Promise<TableDataPage>
  mutateTableRows(
    connId: string,
    database: string,
    tableName: string,
    batch: TableMutationBatch,
  ): Promise<TableMutationResult>
  previewTableStructure(
    connId: string,
    database: string,
    request: SaveTableStructureRequest,
  ): Promise<TableStructurePlan>
  saveTableStructure(
    connId: string,
    database: string,
    request: SaveTableStructureRequest,
  ): Promise<SaveTableStructureResult>
  executeSQL(
    connId: string,
    database: string,
    sql: string,
  ): Promise<ExecuteResult>
}
