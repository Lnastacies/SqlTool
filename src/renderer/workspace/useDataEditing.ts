import { useEffect, useMemo, useState } from 'react'
import type {
  TableMutationBatch,
  TableRowUpdate,
} from '../types'
import {
  normalizeInput,
  serializeIdentityValue,
} from './dataEditingUtils'
import { useDataRowLifecycle } from './useDataRowLifecycle'
import type { DataRowTarget } from './dataEditingTypes'
import type { DataWorkspaceDocument } from './workspaceTypes'

interface PendingRow {
  rowIndex: number
  update: TableRowUpdate
}

export function useDataEditing(
  document: DataWorkspaceDocument,
  onDirtyChange: (dirty: boolean) => void,
) {
  const [editMode, setEditMode] = useState(false)
  const [pendingRows, setPendingRows] = useState<Record<string, PendingRow>>({})
  const removePendingRows = (identities: string[]) => {
    setPendingRows(previous => {
      const next = { ...previous }
      identities.forEach(identity => delete next[identity])
      return next
    })
  }
  const lifecycle = useDataRowLifecycle(document, removePendingRows)

  useEffect(() => {
    setEditMode(false)
    setPendingRows({})
    lifecycle.resetLifecycle()
    onDirtyChange(false)
  }, [document.id, document.page, document.rows])

  const rowIdentity = (
    row: Record<string, unknown>,
    index: number,
  ): string => {
    const source = document.rows[index] || row
    return document.primaryKeys.length > 0
      ? document.primaryKeys.map(key => (
        `${encodeURIComponent(key)}=${encodeURIComponent(
          serializeIdentityValue(source[key]),
        )}`
      )).join('&')
    : `${document.page}-${index}`
  }

  const updateCell = (
    row: Record<string, unknown>,
    rowIndex: number,
    column: string,
    inputValue: unknown,
  ) => {
    const originalRow = document.rows[rowIndex] || row
    const identity = rowIdentity(originalRow, rowIndex)
    const originalValue = originalRow[column]
    const value = normalizeInput(inputValue, originalValue)
    setPendingRows(previous => {
      const existing = previous[identity]
      const changes = {
        ...(existing?.update.changes || {}),
        [column]: value,
      }
      if (Object.is(value, originalValue)) {
        delete changes[column]
      }

      const next = { ...previous }
      if (Object.keys(changes).length === 0) {
        delete next[identity]
      } else {
        next[identity] = {
          rowIndex,
          update: {
            originalKey: Object.fromEntries(
              document.primaryKeys.map(key => [key, originalRow[key]]),
            ),
            changes,
          },
        }
      }
      onDirtyChange(Object.keys(next).length > 0)
      return next
    })
  }

  const rows = useMemo(
    () => document.rows.map((row, rowIndex) => {
      const pending = pendingRows[rowIdentity(row, rowIndex)]
      return pending ? { ...row, ...pending.update.changes } : row
    }),
    [document.rows, pendingRows],
  )

  const batch = useMemo<TableMutationBatch>(() => ({
    inserts: lifecycle.draftRows.map(draft => ({ values: draft.values })),
    updates: Object.values(pendingRows).map(item => item.update),
    deletes: Object.values(lifecycle.deletedRows),
  }), [lifecycle.deletedRows, lifecycle.draftRows, pendingRows])
  const pendingCount = (
    batch.inserts.length
    + batch.updates.length
    + batch.deletes.length
  )

  useEffect(() => {
    onDirtyChange(pendingCount > 0)
  }, [pendingCount])

  const rollback = () => {
    setPendingRows({})
    lifecycle.resetLifecycle()
    onDirtyChange(false)
  }

  const finishCommit = () => {
    setPendingRows({})
    lifecycle.resetLifecycle()
    setEditMode(false)
    onDirtyChange(false)
  }

  const copyRows = (targets: DataRowTarget[]) => {
    const primaryKeys = new Set(document.primaryKeys)
    const copies = targets.map(target => Object.fromEntries(
      document.columns
        .filter(column => (
          !primaryKeys.has(column)
          && Object.prototype.hasOwnProperty.call(target.data, column)
          && target.data[column] !== undefined
        ))
        .map(column => [column, cloneCellValue(target.data[column])]),
    ))
    return lifecycle.addRows(copies).map(draft => draft.id)
  }

  return {
    editMode,
    setEditMode,
    pendingCount,
    pendingRows,
    draftRows: lifecycle.draftRows,
    deletedRows: lifecycle.deletedRows,
    rows,
    rowIdentity,
    updateCell,
    updateDraftCell: lifecycle.updateDraftCell,
    addRow: lifecycle.addRow,
    copyRows,
    markRowsForDeletion: lifecycle.markRowsForDeletion,
    batch,
    rollback,
    finishCommit,
  }
}

function cloneCellValue(value: unknown): unknown {
  if (value instanceof Uint8Array) return value.slice()
  if (value instanceof Date) return new Date(value.getTime())
  if (Array.isArray(value)) return value.map(cloneCellValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        cloneCellValue(item),
      ]),
    )
  }
  return value
}
