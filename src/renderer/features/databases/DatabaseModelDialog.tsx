import React, { useEffect, useState } from 'react'
import { Alert, Button, Collapse, Empty, Modal, Spin, Tag } from 'antd'
import type { DatabaseModel } from '../../types'

interface DatabaseModelDialogProps {
  connId: string
  database: string
  onClose: () => void
}

export default function DatabaseModelDialog({
  connId,
  database,
  onClose,
}: DatabaseModelDialogProps) {
  const [model, setModel] = useState<DatabaseModel>()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void window.database.getDatabaseModel(connId, database).then(result => {
      if (cancelled) return
      if (!result.success || !result.data) {
        setError(result.error?.detail || result.error?.message || '模型读取失败')
        return
      }
      setModel(result.data)
    }).catch(loadError => {
      if (!cancelled) {
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      }
    })
    return () => {
      cancelled = true
    }
  }, [connId, database])

  return (
    <Modal
      className="database-model-dialog"
      title={`数据库模型 - ${database}`}
      open
      width={920}
      destroyOnHidden
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      {!model && !error && (
        <div className="database-model-dialog__loading">
          <Spin />
          <span>正在读取表结构和外键关系...</span>
        </div>
      )}
      {error && <Alert type="error" showIcon message="模型读取失败" description={error} />}
      {model && (
        <>
          <div className="database-model-summary">
            <Tag color="blue">{model.type}</Tag>
            <span>表 {model.tables.length}</span>
            <span>视图 {model.views.length}</span>
            <span>函数 {model.functions.length}</span>
            <span>存储过程 {model.procedures.length}</span>
            <span>事件 {model.events.length}</span>
          </div>
          {model.tables.length === 0 ? (
            <Empty description="该数据库没有数据表" />
          ) : (
            <Collapse
              size="small"
              items={model.tables.map(table => ({
                key: table.name,
                label: (
                  <span className="database-model-table-title">
                    <strong>{table.name}</strong>
                    <span>{table.fields.length} 个字段</span>
                    <span>{table.foreignKeys.length} 个外键</span>
                  </span>
                ),
                children: (
                  <div className="database-model-table">
                    <div className="database-model-field database-model-field--header">
                      <span>字段</span>
                      <span>类型</span>
                      <span>约束</span>
                      <span>默认值</span>
                    </div>
                    {table.fields.map(field => (
                      <div className="database-model-field" key={field.name}>
                        <span>{field.name}</span>
                        <span>{field.type}</span>
                        <span>
                          {[
                            field.primary ? '主键' : '',
                            field.auto_increment ? '自增' : '',
                            field.not_null ? '非空' : '',
                          ].filter(Boolean).join(' / ') || '-'}
                        </span>
                        <span>{String(field.default_expression ?? field.default ?? '-')}</span>
                      </div>
                    ))}
                    {table.foreignKeys.map(foreignKey => (
                      <div className="database-model-relation" key={foreignKey.name}>
                        外键 {foreignKey.name}：{foreignKey.fields.join(', ')}
                        {' → '}
                        {foreignKey.referenced_table}
                        ({foreignKey.referenced_fields.join(', ')})
                      </div>
                    ))}
                  </div>
                ),
              }))}
            />
          )}
        </>
      )}
    </Modal>
  )
}
