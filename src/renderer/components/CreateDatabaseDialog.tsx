import React, { useEffect, useMemo, useState } from 'react'
import { Form, Input, Modal, Select, message } from 'antd'
import type {
  ConnectionData,
  CreateDatabaseOptions,
  DatabaseEncodingCatalog,
} from '../types'
import {
  POSTGRES_ENCODING_OPTIONS,
  SQL_SERVER_COLLATION_OPTIONS,
  mysqlCharsetOptions,
  mysqlCollationOptions,
  mysqlDefaultCollation,
} from '../features/databases/createDatabaseEncodingOptions'
import { isMySQLCompatible } from '../features/mysqlCompat'

interface CreateDatabaseDialogProps {
  connection: ConnectionData
  onClose: () => void
  onCreate: (
    name: string,
    options: CreateDatabaseOptions,
  ) => Promise<void>
}

const NAME_LIMITS: Record<Exclude<ConnectionData['type'], 'SQLite'>, number> = {
  MySQL: 64,
  TDSQL: 64,
  PostgreSQL: 63,
  'SQL Server': 128,
}

function CreateDatabaseDialog({
  connection,
  onClose,
  onCreate,
}: CreateDatabaseDialogProps) {
  const [name, setName] = useState('')
  const mysqlCompatible = isMySQLCompatible(connection.type)
  const initialCharset = mysqlCompatible
    ? connection.charset?.trim() || 'utf8mb4'
    : undefined
  const [charset, setCharset] = useState<string | undefined>(initialCharset)
  const [encoding, setEncoding] = useState<string | undefined>(
    connection.type === 'PostgreSQL' ? 'UTF8' : undefined,
  )
  const [collation, setCollation] = useState<string | undefined>(
    mysqlCompatible
      ? mysqlDefaultCollation(initialCharset || 'utf8mb4')
      : undefined,
  )
  const [encodingCatalog, setEncodingCatalog] = useState<
    DatabaseEncodingCatalog
  >()
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const maxLength = useMemo(
    () => connection.type === 'SQLite' ? 64 : NAME_LIMITS[connection.type],
    [connection.type],
  )
  const createOptions = useMemo<CreateDatabaseOptions>(() => ({
    charset: isMySQLCompatible(connection.type) ? charset : undefined,
    encoding: connection.type === 'PostgreSQL' ? encoding : undefined,
    collation: collation?.trim() || undefined,
  }), [charset, collation, connection.type, encoding])
  const charsetOptions = useMemo(
    () => mysqlCharsetOptions(encodingCatalog, charset),
    [charset, encodingCatalog],
  )
  const collationOptions = useMemo(
    () => mysqlCollationOptions(charset, encodingCatalog, collation),
    [charset, collation, encodingCatalog],
  )

  useEffect(() => {
    if (!isMySQLCompatible(connection.type)) return
    let active = true
    setCatalogLoading(true)
    void window.logger.write(
      'info',
      'CreateDatabaseDialog',
      `开始加载数据库编码目录: 连接=${connection.id}`,
    )
    void window.database.getDatabaseEncodingCatalog(connection.id)
      .then(result => {
        if (!active) return
        if (!result.success || !result.data) {
          const detail = result.error?.detail
            || result.error?.message
            || '未知错误'
          void window.logger.write(
            'warn',
            'CreateDatabaseDialog',
            `数据库编码目录加载失败，使用本地回退目录: 连接=${connection.id}, 原因=${detail}`,
          )
          return
        }
        setEncodingCatalog(result.data)
        const selectedCharset = initialCharset || 'utf8mb4'
        setCharset(current => current || selectedCharset)
        setCollation(current => {
          const available = mysqlCollationOptions(
            selectedCharset,
            result.data,
            current,
          )
          return available.some(item => item.value === current)
            ? current
            : mysqlDefaultCollation(selectedCharset, result.data)
        })
        void window.logger.write(
          'info',
          'CreateDatabaseDialog',
          `数据库编码目录加载完成: 连接=${connection.id}, 字符集=${result.data.charsets.length}, 排序规则=${result.data.collations.length}`,
        )
      })
      .finally(() => {
        if (active) setCatalogLoading(false)
      })
    return () => {
      active = false
    }
  }, [connection.id, connection.type, initialCharset])

  const handleCreate = async () => {
    const databaseName = name.trim()
    if (!databaseName) {
      message.error('请输入数据库名称')
      return
    }
    try {
      setCreating(true)
      await onCreate(databaseName, createOptions)
      message.success(`数据库“${databaseName}”已创建`)
      onClose()
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : '新建数据库失败',
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      title="新建数据库"
      open
      width={500}
      okText="创建"
      cancelText="取消"
      confirmLoading={creating}
      destroyOnHidden
      onCancel={onClose}
      onOk={() => void handleCreate()}
    >
      <Form layout="vertical">
        <Form.Item
          label="数据库名称"
          required
          extra={`目标连接：${connection.name}（${connection.type}）`}
        >
          <Input
            value={name}
            autoFocus
            maxLength={maxLength}
            showCount
            placeholder="输入数据库名称"
            status={name && !name.trim() ? 'error' : undefined}
            onChange={event => setName(event.target.value)}
            onPressEnter={() => void handleCreate()}
          />
        </Form.Item>
        {isMySQLCompatible(connection.type) && (
          <>
            <Form.Item label="默认字符集">
              <Select
                value={charset}
                allowClear
                showSearch
                optionFilterProp="label"
                loading={catalogLoading}
                placeholder="使用服务器默认字符集"
                options={charsetOptions}
                onChange={value => {
                  setCharset(value)
                  const nextCollations = mysqlCollationOptions(
                    value,
                    encodingCatalog,
                  )
                  if (!nextCollations.some(item => item.value === collation)) {
                    setCollation(
                      value
                        ? mysqlDefaultCollation(value, encodingCatalog)
                        : undefined,
                    )
                  }
                }}
              />
            </Form.Item>
            <Form.Item label="默认排序规则">
              <Select
                value={collation}
                allowClear
                showSearch
                optionFilterProp="label"
                loading={catalogLoading}
                placeholder="使用字符集默认排序规则"
                options={collationOptions}
                onChange={setCollation}
              />
            </Form.Item>
          </>
        )}
        {connection.type === 'PostgreSQL' && (
          <>
            <Form.Item label="数据库编码">
              <Select
                value={encoding}
                allowClear
                showSearch
                placeholder="使用服务器默认编码"
                options={POSTGRES_ENCODING_OPTIONS}
                onChange={setEncoding}
              />
            </Form.Item>
            <Form.Item label="区域设置（LC_COLLATE / LC_CTYPE）">
              <Input
                value={collation}
                maxLength={128}
                placeholder="使用服务器默认区域设置"
                onChange={event => setCollation(event.target.value)}
              />
            </Form.Item>
          </>
        )}
        {connection.type === 'SQL Server' && (
          <Form.Item label="排序规则（决定字符编码）">
            <Select
              value={collation}
              allowClear
              showSearch
              placeholder="使用服务器默认排序规则"
              options={SQL_SERVER_COLLATION_OPTIONS}
              onChange={setCollation}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

export default CreateDatabaseDialog
