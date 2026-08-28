import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  QueryWorkspaceDocument,
  WorkspaceDocument,
} from '../../workspace/workspaceTypes'
import type { CloseDecision } from './UnsavedChangesDialog'

interface DocumentCloseGuardOptions {
  documents: WorkspaceDocument[]
  saveQueryDocument: (
    document: QueryWorkspaceDocument,
  ) => Promise<boolean>
  finalizeClose: (document: WorkspaceDocument) => Promise<void>
}

async function writeCloseLog(
  level: 'info' | 'warn',
  message: string,
): Promise<void> {
  try {
    await window.logger.write(level, 'DocumentClose', message)
  } catch (error) {
    console.warn('文档关闭日志写入失败:', error)
  }
}

export function useDocumentCloseGuard({
  documents,
  saveQueryDocument,
  finalizeClose,
}: DocumentCloseGuardOptions) {
  const [pendingDocument, setPendingDocument] =
    useState<WorkspaceDocument>()
  const decisionResolver = useRef<
    ((decision: CloseDecision) => void) | undefined
  >()
  const operationRunning = useRef(false)

  const requestDecision = useCallback((document: WorkspaceDocument) => {
    return new Promise<CloseDecision>((resolve) => {
      decisionResolver.current = resolve
      setPendingDocument(document)
    })
  }, [])

  const decide = useCallback((decision: CloseDecision) => {
    const resolve = decisionResolver.current
    decisionResolver.current = undefined
    setPendingDocument(undefined)
    resolve?.(decision)
  }, [])

  useEffect(() => () => {
    decisionResolver.current?.('cancel')
    decisionResolver.current = undefined
  }, [])

  const closeOne = useCallback(async (document: WorkspaceDocument) => {
    if (document.dirty) {
      await writeCloseLog(
        'info',
        `检测到未保存文档: 文档=${document.name}, 类型=${document.kind}`,
      )
      const decision = await requestDecision(document)
      await writeCloseLog(
        'info',
        `用户处理未保存文档: 文档=${document.name}, 决策=${decision}`,
      )
      if (decision === 'cancel') return false
      if (decision === 'save') {
        if (document.kind !== 'query') return false
        const saved = await saveQueryDocument(document)
        if (!saved) {
          await writeCloseLog(
            'warn',
            `未保存文档保持打开: 文档=${document.name}, 原因=保存未完成`,
          )
          return false
        }
      }
    }

    await finalizeClose(document)
    await writeCloseLog(
      'info',
      `文档关闭完成: 文档=${document.name}, 类型=${document.kind}`,
    )
    return true
  }, [finalizeClose, requestDecision, saveQueryDocument])

  const closeDocumentSafely = useCallback(async (documentId: string) => {
    if (operationRunning.current) {
      await writeCloseLog('warn', '忽略重复关闭请求: 已有关闭流程正在执行')
      return false
    }
    const document = documents.find(item => item.id === documentId)
    if (!document) return true

    operationRunning.current = true
    try {
      return await closeOne(document)
    } finally {
      operationRunning.current = false
    }
  }, [closeOne, documents])

  const closeAllDocumentsSafely = useCallback(async () => {
    if (operationRunning.current) {
      await writeCloseLog('warn', '忽略重复关闭全部请求: 已有关闭流程正在执行')
      return false
    }

    operationRunning.current = true
    try {
      for (const document of documents) {
        if (!await closeOne(document)) return false
      }
      return true
    } finally {
      operationRunning.current = false
    }
  }, [closeOne, documents])

  return {
    pendingDocument,
    decide,
    closeDocumentSafely,
    closeAllDocumentsSafely,
  }
}
