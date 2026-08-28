import React, { useEffect, useState } from 'react'
import EditOutlined from '@ant-design/icons/EditOutlined'
import FolderOpenOutlined from '@ant-design/icons/FolderOpenOutlined'
import ReloadOutlined from '@ant-design/icons/ReloadOutlined'
import TableOutlined from '@ant-design/icons/TableOutlined'
import { Alert, Button, Empty, Spin, Tag } from 'antd'
import type { TableMetadata } from '../../types'
import TableStructureTabs from './TableStructureTabs'

interface TableStructurePanelProps {
  connectionId: string
  database: string
  tableName?: string
  revision: number
  onLoadMetadata: (
    connectionId: string,
    database: string,
    tableName: string,
  ) => Promise<TableMetadata>
  onOpenData: () => void
  onDesign: () => void
}

export default function TableStructurePanel({
  connectionId,
  database,
  tableName,
  revision,
  onLoadMetadata,
  onOpenData,
  onDesign,
}: TableStructurePanelProps) {
  const [metadata, setMetadata] = useState<TableMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reloadSequence, setReloadSequence] = useState(0)

  useEffect(() => {
    let active = true
    setMetadata(null)
    setError('')
    if (!tableName) {
      setLoading(false)
      return () => {
        active = false
      }
    }

    setLoading(true)
    void onLoadMetadata(connectionId, database, tableName)
      .then(result => {
        if (!active) return
        setMetadata(result)
      })
      .catch(reason => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [
    connectionId,
    database,
    onLoadMetadata,
    reloadSequence,
    revision,
    tableName,
  ])

  if (!tableName) {
    return (
      <section className="table-structure table-structure--empty">
        <Empty
          image={<TableOutlined />}
          description={(
            <span>
              选择一张表，查看并管理字段、数据类型、索引和外键
            </span>
          )}
        />
      </section>
    )
  }

  return (
    <section className="table-structure">
      <header className="table-structure__header">
        <div className="table-structure__identity">
          <TableOutlined />
          <div>
            <strong>{tableName}</strong>
            <span>{database}</span>
          </div>
        </div>
        <div className="table-structure__actions">
          <Button
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={onOpenData}
          >
            打开数据
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<EditOutlined />}
            onClick={onDesign}
          >
            编辑结构
          </Button>
          <Button
            size="small"
            aria-label="刷新表结构"
            title="刷新表结构"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => setReloadSequence(value => value + 1)}
          />
        </div>
      </header>

      {metadata && (
        <div className="table-structure__summary">
          <Tag>{metadata.fields.length} 个字段</Tag>
          <Tag>{metadata.indexes.length} 个索引</Tag>
          <Tag>{metadata.foreign_keys.length} 个外键</Tag>
          {metadata.fields.some(field => field.primary) && (
            <Tag color="gold">
              主键：{metadata.fields
                .filter(field => field.primary)
                .map(field => field.name)
                .join(', ')}
            </Tag>
          )}
        </div>
      )}

      <div className="table-structure__content">
        <Spin spinning={loading}>
          {error && (
            <Alert
              type="error"
              showIcon
              message="表结构加载失败"
              description={error}
              action={(
                <Button
                  size="small"
                  onClick={() => setReloadSequence(value => value + 1)}
                >
                  重试
                </Button>
              )}
            />
          )}
          {!error && metadata && (
            <TableStructureTabs metadata={metadata} />
          )}
        </Spin>
      </div>
    </section>
  )
}
