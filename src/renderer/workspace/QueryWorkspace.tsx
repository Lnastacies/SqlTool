import React, { useCallback, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import Editor from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import type { ConnectionData } from '../types'
import type { QueryExecutionMode } from './queryExecutionSql'
import QueryResultPanel from './QueryResultPanel'
import QueryWorkspaceToolbar from './QueryWorkspaceToolbar'
import type { QueryWorkspaceDocument } from './workspaceTypes'
import { buildQueryResultCsv } from './queryResultCsv'

interface QueryWorkspaceProps {
  document: QueryWorkspaceDocument
  connections: Map<string, ConnectionData>
  activeConnections: Set<string>
  onExecute: (documentId: string, mode: QueryExecutionMode) => void
  onCancel: (documentId: string) => void
  onContextChange: (
    documentId: string,
    patch: { connId?: string; database?: string },
  ) => void
  onTransaction: (
    documentId: string,
    action: 'begin' | 'commit' | 'rollback',
  ) => void
  onUpdate: (
    documentId: string,
    patch: Partial<QueryWorkspaceDocument>,
  ) => void
}

export default function QueryWorkspace({
  document,
  connections,
  activeConnections,
  onExecute,
  onCancel,
  onContextChange,
  onTransaction,
  onUpdate,
}: QueryWorkspaceProps) {
  const [databases, setDatabases] = useState<string[]>([])
  const cursorListener = useRef<{ dispose: () => void }>()

  useEffect(() => () => cursorListener.current?.dispose(), [])

  useEffect(() => {
    if (!document.connId || !activeConnections.has(document.connId)) {
      setDatabases([])
      return
    }

    let cancelled = false
    window.database.getDatabases(document.connId)
      .then(result => {
        if (!cancelled) {
          setDatabases(
            result.success && Array.isArray(result.data) ? result.data : [],
          )
        }
      })
      .catch(error => {
        console.error('加载查询数据库列表失败:', error)
        void window.logger?.write(
          'error',
          'QueryWorkspace',
          `加载查询数据库列表失败: 会话=${document.id}, 连接=${document.connId}, 原因=${error instanceof Error ? error.message : String(error)}`,
        )
        if (!cancelled) setDatabases([])
      })
    return () => {
      cancelled = true
    }
  }, [activeConnections, document.connId])

  const handleEditorMount: OnMount = (editor) => {
    cursorListener.current?.dispose()
    const updateExecutionContext = () => {
      const model = editor.getModel()
      const selection = editor.getSelection()
      const position = editor.getPosition()
      if (!model || !selection || !position) return
      onUpdate(document.id, {
        selectedSql: model.getValueInRange(selection),
        cursorOffset: model.getOffsetAt(position),
      })
    }
    cursorListener.current = editor.onDidChangeCursorSelection(
      updateExecutionContext,
    )
    updateExecutionContext()
  }

  const handleExportResult = useCallback(() => {
    // 优先导出当前选中的结果集，否则取最近一次执行的结果
    const activeIndex = document.activeResultIndex >= 0
      ? document.activeResultIndex
      : document.resultSets.length - 1
    const resultSet = document.resultSets[activeIndex]
    if (!resultSet) {
      message.warning('没有可导出的查询结果')
      return
    }
    const suggestedName = `${(document.name || '查询').replace(/[<>:"/\\|?*]/g, '_')}_结果${activeIndex + 1}.csv`
    void window.resultExport.exportCsv({ suggestedName, content: buildQueryResultCsv(resultSet) })
      .then(result => {
        if (!result.success) {
          const detail = result.error?.message ?? '未知错误'
          message.error(`导出查询结果失败：${detail}`)
          return
        }
        if (result.data?.cancelled) {
          message.info('已取消导出')
          return
        }
        message.success(`查询结果已导出：${result.data?.filePath ?? ''}`)
      })
      .catch(error => {
        const detail = error instanceof Error ? error.message : String(error)
        void window.logger?.write(
          'error',
          'QueryWorkspace',
          `导出查询结果失败: 会话=${document.id}, 结果集=${activeIndex + 1}, 原因=${detail}`,
        )
        message.error(`导出查询结果失败：${detail}`)
      })
  }, [document])

  return (
    <div className="query-panel">
      <QueryWorkspaceToolbar
        document={document}
        connections={connections}
        activeConnections={activeConnections}
        databases={databases}
        onExecute={mode => onExecute(document.id, mode)}
        onCancel={() => onCancel(document.id)}
        onContextChange={patch => onContextChange(document.id, patch)}
        onTransaction={action => onTransaction(document.id, action)}
        onExport={handleExportResult}
      />

      <div className="query-editor-container">
        <Editor
          height="100%"
          language="sql"
          theme="vs-dark"
          value={document.sql}
          onMount={handleEditorMount}
          onChange={(value) => {
            if (value !== undefined) {
              onUpdate(document.id, { sql: value, dirty: true })
            }
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            tabSize: 4,
            insertSpaces: false,
          }}
        />
      </div>

      <QueryResultPanel
        document={document}
        onActiveResultChange={activeResultIndex => {
          onUpdate(document.id, { activeResultIndex })
        }}
      />
    </div>
  )
}
