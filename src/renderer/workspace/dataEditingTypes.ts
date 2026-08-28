export interface DraftRow {
  id: string
  values: Record<string, unknown>
}

export interface DataRowTarget {
  kind: 'existing' | 'draft'
  identity: string
  data: Record<string, unknown>
  sourceIndex: number
  draftId?: string
}

export type DataGridRow = DataRowTarget
