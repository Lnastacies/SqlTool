import React, { useEffect, useRef, useState } from 'react'
import { Select, Spin, Tag } from 'antd'
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined'
import type {
  ConnectionData,
  DatabaseToolEndpoint,
} from '../../types'

interface DatabaseEndpointCardProps {
  role: 'source' | 'target'
  title: string
  connections: ConnectionData[]
  connectedConnectionIds: ReadonlySet<string>
  value: DatabaseToolEndpoint
  disabled?: boolean
  onConnect: (
    connection: ConnectionData,
  ) => Promise<{ success: boolean; message: string }>
  onChange: (value: DatabaseToolEndpoint) => void
}

export default function DatabaseEndpointCard({
  role,
  title,
  connections,
  connectedConnectionIds,
  value,
  disabled,
  onConnect,
  onChange,
}: DatabaseEndpointCardProps) {
  const [databases, setDatabases] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const loadSequence = useRef(0)
  const onChangeRef = useRef(onChange)
  const onConnectRef = useRef(onConnect)
  const valueRef = useRef(value)
  const connection = connections.find(item => item.id === value.connId)
  const connected = connectedConnectionIds.has(value.connId)

  useEffect(() => {
    onChangeRef.current = onChange
    onConnectRef.current = onConnect
    valueRef.current = value
  }, [onChange, onConnect, value])

  useEffect(() => {
    if (!value.connId || !connection) {
      setDatabases([])
      setLoadFailed(false)
      return
    }
    const sequence = loadSequence.current + 1
    loadSequence.current = sequence
    setLoading(true)
    setLoadFailed(false)

    const loadDatabases = async () => {
      try {
        if (!connected) {
          void window.logger.write(
            'info',
            'DatabaseTool',
            `数据库工具按需建立连接: 连接=${connection.id}, 名称=${connection.name}`,
          )
          const connectResult = await onConnectRef.current(connection)
          if (!connectResult.success) {
            throw new Error(connectResult.message || '数据库连接失败')
          }
        }
        if (sequence !== loadSequence.current) return
        const result = await window.database.getDatabases(value.connId)
        if (!result.success || !result.data) {
          throw new Error(
            result.error?.detail
            || result.error?.message
            || '数据库列表加载失败',
          )
        }
        if (sequence !== loadSequence.current) return
        setDatabases(result.data)
        const currentValue = valueRef.current
        if (
          currentValue.connId === value.connId
          && !result.data.includes(currentValue.database)
        ) {
          const preferred = connection.database
          onChangeRef.current({
            connId: value.connId,
            database: preferred && result.data.includes(preferred)
              ? preferred
              : result.data[0] || '',
          })
        }
      } catch (error) {
        if (sequence !== loadSequence.current) return
        setDatabases([])
        setLoadFailed(true)
        const detail = error instanceof Error ? error.message : String(error)
        void window.logger.write(
          'error',
          'DatabaseTool',
          `数据库工具加载数据库列表失败: 连接=${value.connId}, 原因=${detail}`,
        )
      } finally {
        if (sequence === loadSequence.current) setLoading(false)
      }
    }
    void loadDatabases()
    return () => {
      if (loadSequence.current === sequence) loadSequence.current += 1
    }
  }, [
    connected,
    connection,
    value.connId,
  ])

  return (
    <section className={`database-tool-endpoint database-tool-endpoint--${role}`}>
      <header>
        <span className="database-tool-endpoint__icon">
          <DatabaseOutlined />
        </span>
        <div>
          <strong>{title}</strong>
          <small>{role === 'source' ? '读取数据与结构' : '接收并应用变更'}</small>
        </div>
        {connection && <Tag>{connection.type}</Tag>}
      </header>
      <label>
        <span>连接</span>
        <Select
          value={value.connId || undefined}
          placeholder="选择数据库连接"
          disabled={disabled}
          options={connections.map(item => ({
            value: item.id,
            label: item.name,
          }))}
          onChange={connId => onChange({ connId, database: '' })}
        />
      </label>
      <label>
        <span>数据库</span>
        <Select
          value={value.database || undefined}
          placeholder={loading ? '正在读取...' : '选择数据库'}
          loading={loading}
          disabled={disabled || !value.connId}
          notFoundContent={
            loading
              ? <Spin size="small" />
              : loadFailed ? '连接失败，请检查配置' : '没有可用数据库'
          }
          options={databases.map(database => ({
            value: database,
            label: database,
          }))}
          onChange={database => onChange({ ...value, database })}
        />
      </label>
    </section>
  )
}
