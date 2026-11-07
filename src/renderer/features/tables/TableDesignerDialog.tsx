import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Input,
  Modal,
  Spin,
  Tabs,
} from 'antd'
import type {
  DatabaseType,
  SaveTableStructureRequest,
  TableMetadata,
  TableStructurePlan,
} from '../../types'
import TableFieldEditor from './TableFieldEditor'
import TableForeignKeyEditor from './TableForeignKeyEditor'
import TableIndexEditor from './TableIndexEditor'
import TableSqlPreview from './TableSqlPreview'
import TDSQLTableOptionsControls from './TDSQLTableOptionsControls'
import { TABLE_DATA_TYPE_OPTIONS } from './tableDataTypeCatalog'
import {
  createTableDefinitionDraft,
  remapFieldReferences,
  toTableDefinition,
  type TableDefinitionDraft,
} from './tableDesignerModel'
import { buildTableDesignerSubmitLogs } from './tableDesignerSubmitLog'
import { validateTableDefinitionDraft } from './tableDesignerValidation'

interface TableDesignerDialogProps {
  open: boolean
  database: string
  databaseType: DatabaseType
  originalName?: string
  metadata?: TableMetadata
  loading: boolean
  saving: boolean
  onCancel: () => void
  onPreview: (
    request: SaveTableStructureRequest,
  ) => Promise<TableStructurePlan>
  onSave: (request: SaveTableStructureRequest) => Promise<void>
}

export default function TableDesignerDialog({
  open,
  database,
  databaseType,
  originalName,
  metadata,
  loading,
  saving,
  onCancel,
  onPreview,
  onSave,
}: TableDesignerDialogProps) {
  const [draft, setDraft] = useState<TableDefinitionDraft>(
    createTableDefinitionDraft(databaseType, originalName || 'new_table'),
  )
  const [preparingSubmit, setPreparingSubmit] = useState(false)

  useEffect(() => {
    if (!open || loading) return
    setDraft(createTableDefinitionDraft(
      databaseType,
      originalName || 'new_table',
      metadata,
    ))
    void window.logger.write(
      'info',
      'TableDesigner',
      `初始化字段类型编辑器: 数据库类型=${databaseType}, 内置类型=${TABLE_DATA_TYPE_OPTIONS[databaseType].length}, 模式=${originalName ? '编辑表' : '新建表'}`,
    )
  }, [databaseType, loading, metadata, open, originalName])

  const request = useMemo<SaveTableStructureRequest>(() => ({
    originalName,
    definition: toTableDefinition(draft),
    // TDSQL 建表选项仅新建表时下发；编辑表走 ALTER，不支持变更分片属性
    tdsqlOptions: originalName ? undefined : draft.tdsql,
  }), [draft, originalName])
  const validationIssues = useMemo(
    () => validateTableDefinitionDraft(databaseType, draft, !originalName),
    [databaseType, draft, originalName],
  )
  const handleSave = async () => {
    if (preparingSubmit || saving) return
    setPreparingSubmit(true)
    try {
      const submitLogs = buildTableDesignerSubmitLogs({
        database,
        databaseType,
        validationIssues,
      }, request)
      for (const logMessage of submitLogs) {
        try {
          const result = await window.logger.write(
            'info',
            'TableDesigner',
            logMessage,
          )
          if (!result.success) {
            console.warn('表结构提交日志写入失败:', result.error?.message)
          }
        } catch (error) {
          // 日志异常不能阻断用户保存，控制台保留最后一道排查线索。
          console.warn('表结构提交日志写入失败:', error)
        }
      }
      await onSave(request)
    } finally {
      setPreparingSubmit(false)
    }
  }

  return (
    <Modal
      open={open}
      width={1200}
      title={originalName ? `设计表：${originalName}` : '新建表'}
      okText={originalName ? '保存结构' : '创建表'}
      cancelText="取消"
      confirmLoading={saving || preparingSubmit}
      okButtonProps={{
        disabled: loading || preparingSubmit || validationIssues.length > 0,
      }}
      onCancel={() => {
        if (!preparingSubmit) onCancel()
      }}
      onOk={() => void handleSave()}
      destroyOnClose
      className="table-designer-modal"
    >
      <Spin spinning={loading}>
        <div className="table-designer__heading">
          <label>
            <span>表名</span>
            <Input
              size="small"
              value={draft.name}
              onChange={event => {
                setDraft(previous => ({
                  ...previous,
                  name: event.target.value,
                }))
              }}
            />
          </label>
          <span>{databaseType} · {database}</span>
        </div>

        <div className="table-designer__validation">
          {validationIssues.length > 0 ? (
            <Alert
              type="error"
              showIcon
              message={`当前结构有 ${validationIssues.length} 个问题`}
              description={validationIssues.slice(0, 3).join('；')}
            />
          ) : (
            <Alert
              type="success"
              showIcon
              message="字段、类型和约束检查通过，可以预览 SQL 或保存结构"
            />
          )}
        </div>

        <Tabs
          size="small"
          items={[
            {
              key: 'fields',
              label: `字段与类型 (${draft.fields.length})`,
              children: (
                <>
                  {databaseType === 'TDSQL' && draft.tdsql && (
                    <TDSQLTableOptionsControls
                      value={draft.tdsql}
                      fields={draft.fields}
                      disabled={Boolean(originalName)}
                      onChange={tdsql => {
                        // 日志埋点：记录 TDSQL 表类型/SHARDKEY 变更，便于排查分表配置问题
                        void window.logger.write(
                          'info',
                          'TableDesigner',
                          `TDSQL 选项变更: 表类型=${tdsql.tableType}, SHARDKEY=${tdsql.shardKey || '未指定'}, 表=${draft.name}`,
                        )
                        setDraft(previous => ({ ...previous, tdsql }))
                      }}
                    />
                  )}
                  <TableFieldEditor
                    databaseType={databaseType}
                    fields={draft.fields}
                    onChange={fields => {
                      setDraft(previous => remapFieldReferences(previous, fields))
                    }}
                  />
                </>
              ),
            },
            {
              key: 'indexes',
              label: `索引 (${draft.indexes.length})`,
              children: (
                <TableIndexEditor
                  fields={draft.fields}
                  indexes={draft.indexes}
                  onChange={indexes => {
                    setDraft(previous => ({ ...previous, indexes }))
                  }}
                />
              ),
            },
            // TDSQL 不支持外键，在 TDSQL 模式下隐藏外键编辑区
            ...(databaseType === 'TDSQL' ? [] : [{
              key: 'foreign-keys',
              label: `外键 (${draft.foreignKeys.length})`,
              children: (
                <TableForeignKeyEditor
                  fields={draft.fields}
                  foreignKeys={draft.foreignKeys}
                  onChange={foreignKeys => {
                    setDraft(previous => ({ ...previous, foreignKeys }))
                  }}
                />
              ),
            }]),
            {
              key: 'sql',
              label: 'SQL 预览',
              children: (
                <TableSqlPreview
                  database={database}
                  request={request}
                  validationIssues={validationIssues}
                  onPreview={onPreview}
                />
              ),
            },
          ]}
        />
      </Spin>
    </Modal>
  )
}
