import { useRef, useState } from 'react'
import type { TableRowDelete } from '../types'
import { normalizeInput } from './dataEditingUtils'
import type {
  DataRowTarget,
  DraftRow,
} from './dataEditingTypes'
import type { DataWorkspaceDocument } from './workspaceTypes'

export function useDataRowLifecycle(
  document: DataWorkspaceDocument,
  removePendingRows: (identities: string[]) => void,
) {
  const [draftRows, setDraftRows] = useState<DraftRow[]>([])
  const [deletedRows, setDeletedRows] = useState<
    Record<string, TableRowDelete>
  >({})
  const draftSequence = useRef(0)

  const addRows = (
    initialRows: Record<string, unknown>[] = [{}],
  ) => {
    const drafts = initialRows.map(values => {
      draftSequence.current += 1
      return {
        id: `draft-${document.id}-${draftSequence.current}`,
        values,
      }
    })
    setDraftRows(previous => [...drafts, ...previous])
    return drafts
  }

  const updateDraftCell = (
    draftId: string,
    column: string,
    inputValue: unknown,
  ) => {
    const sampleValue = document.rows.find(
      row => row[column] !== null && row[column] !== undefined,
    )?.[column]
    setDraftRows(previous => previous.map(draft => (
      draft.id === draftId
        ? updateDraftValue(draft, column, inputValue, sampleValue)
        : draft
    )))
  }

  const markRowsForDeletion = (targets: DataRowTarget[]) => {
    const draftIds = new Set(
      targets
        .filter(target => target.kind === 'draft')
        .map(target => target.draftId),
    )
    const existingTargets = targets.filter(
      target => target.kind === 'existing',
    )
    setDraftRows(previous => previous.filter(
      draft => !draftIds.has(draft.id),
    ))
    removePendingRows(existingTargets.map(target => target.identity))
    setDeletedRows(previous => {
      const next = { ...previous }
      existingTargets.forEach(target => {
        const originalRow = (
          document.rows[target.sourceIndex]
          || target.data
        )
        if (!originalRow) return
        next[target.identity] = {
          originalKey: Object.fromEntries(
            document.primaryKeys.map(key => [key, originalRow[key]]),
          ),
        }
      })
      return next
    })
  }

  const resetLifecycle = () => {
    setDraftRows([])
    setDeletedRows({})
  }

  return {
    draftRows,
    deletedRows,
    addRow: (values?: Record<string, unknown>) => addRows([values || {}]),
    addRows,
    updateDraftCell,
    markRowsForDeletion,
    resetLifecycle,
  }
}

function updateDraftValue(
  draft: DraftRow,
  column: string,
  inputValue: unknown,
  sampleValue: unknown,
): DraftRow {
  const values = { ...draft.values }
  // undefined 表示使用数据库默认值，因此必须从 INSERT 字段列表中省略。
  if (inputValue === undefined) {
    delete values[column]
  } else {
    values[column] = normalizeInput(inputValue, sampleValue)
  }
  return { ...draft, values }
}
