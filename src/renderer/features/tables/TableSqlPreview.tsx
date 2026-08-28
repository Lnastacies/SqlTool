import React, { useEffect, useRef, useState } from 'react'
import ReloadOutlined from '@ant-design/icons/ReloadOutlined'
import {
  Alert,
  Button,
  Segmented,
  Tooltip,
} from 'antd'
import type {
  SaveTableStructureRequest,
  TableStructurePlan,
} from '../../types'

interface TableSqlPreviewProps {
  database: string
  request: SaveTableStructureRequest
  onPreview: (
    request: SaveTableStructureRequest,
  ) => Promise<TableStructurePlan>
  validationIssues: string[]
}

export default function TableSqlPreview({
  database,
  request,
  onPreview,
  validationIssues,
}: TableSqlPreviewProps) {
  const [preview, setPreview] = useState<TableStructurePlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'definition' | 'change'>('definition')
  const requestSequence = useRef(0)

  const refreshPreview = async (trigger: 'auto' | 'manual') => {
    const sequence = ++requestSequence.current
    setLoading(true)
    setError('')
    const definition = request.definition
    void window.logger.write(
      'info',
      'TableDesigner',
      `生成结构 SQL 预览: 触发=${trigger === 'auto' ? '自动' : '手动'}, 数据库=${database}, 表=${definition.name}, 字段=${definition.fields.length}, 索引=${definition.indexes.length}, 外键=${definition.foreignKeys.length}`,
    )
    try {
      const plan = await onPreview(request)
      if (sequence !== requestSequence.current) return
      setPreview(plan)
      void window.logger.write(
        'info',
        'TableDesigner',
        `结构 SQL 预览完成: 表=${definition.name}, 模式=${plan.mode}, 完整结构语句=${plan.definitionStatements?.length || plan.statements.length}, 变更语句=${plan.mode === 'alter' ? plan.statements.length : 0}, 警告=${plan.warnings.length}`,
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      if (sequence !== requestSequence.current) return
      setPreview(null)
      setError(detail)
      void window.logger.write(
        'error',
        'TableDesigner',
        `结构 SQL 预览失败: 数据库=${database}, 表=${definition.name}, 原因=${detail}`,
      )
    } finally {
      if (sequence === requestSequence.current) setLoading(false)
    }
  }

  useEffect(() => {
    requestSequence.current += 1
    setPreview(null)
    setError('')
    if (validationIssues.length > 0) {
      setLoading(false)
      return undefined
    }
    const timer = window.setTimeout(() => {
      void refreshPreview('auto')
    }, 180)
    return () => window.clearTimeout(timer)
  }, [request, validationIssues.join('\u0000')])

  const statements = view === 'definition'
    ? preview?.definitionStatements || preview?.statements || []
    : preview?.statements || []
  const sql = statements.map(statement => `${statement};`).join('\n\n')

  return (
    <div className="table-designer__sql">
      <div className="table-designer__sql-toolbar">
        {request.originalName ? (
          <Segmented
            size="small"
            value={view}
            options={[
              { label: '完整建表结构', value: 'definition' },
              { label: '实际变更语句', value: 'change' },
            ]}
            onChange={value => setView(value as 'definition' | 'change')}
          />
        ) : (
          <span className="table-designer__sql-mode">完整建表结构</span>
        )}
        <Tooltip title="刷新 SQL">
          <Button
            size="small"
            type="text"
            aria-label="刷新 SQL"
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={validationIssues.length > 0}
            onClick={() => void refreshPreview('manual')}
          />
        </Tooltip>
      </div>
      {validationIssues.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="当前结构校验未通过，修正后将自动生成 SQL"
        />
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          message={`SQL 预览生成失败：${error}`}
        />
      )}
      {preview?.warnings.map(warning => (
        <Alert
          key={warning}
          type="warning"
          showIcon
          message={warning}
        />
      ))}
      <pre>
        {loading
          ? '正在生成 SQL...'
          : preview
            ? sql || '-- 当前草稿与数据库结构一致，没有需要执行的变更语句。'
            : validationIssues.length > 0
              ? '-- 等待结构校验通过'
              : '-- 正在准备 SQL 预览'}
      </pre>
    </div>
  )
}
