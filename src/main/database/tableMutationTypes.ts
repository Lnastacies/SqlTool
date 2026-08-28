export interface TableRowInsert {
  values: Record<string, unknown>
}

export interface TableRowUpdate {
  originalKey: Record<string, unknown>
  changes: Record<string, unknown>
}

export interface TableRowDelete {
  originalKey: Record<string, unknown>
}

export interface TableMutationBatch {
  inserts: TableRowInsert[]
  updates: TableRowUpdate[]
  deletes: TableRowDelete[]
}

export interface TableMutationResult {
  insertedRows: number
  updatedRows: number
  deletedRows: number
  affectedRows: number
}

export interface MutationDialect {
  insertRow: (
    connection: any,
    database: string,
    tableName: string,
    insert: TableRowInsert,
  ) => Promise<number>
  updateRow: (
    connection: any,
    database: string,
    tableName: string,
    update: TableRowUpdate,
  ) => Promise<number>
  deleteRow: (
    connection: any,
    database: string,
    tableName: string,
    deletion: TableRowDelete,
  ) => Promise<number>
}
