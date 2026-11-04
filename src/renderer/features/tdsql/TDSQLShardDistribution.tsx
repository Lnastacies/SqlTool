/**
 * TDSQL 分片分布组件
 *
 * 通过数据库选择 + 表选择查看表的分区分布。
 * 数据来源：window.tdsql.getTableMetadata（综合 SHOW CREATE 与 PARTITIONS）。
 * 数据长度/索引长度格式化为 KB/MB/GB 展示。
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Empty, Select, Spin, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { partitionColumns } from './tdsqlMonitorColumns'
import { formatTableSize } from '../../workspace/tableSummaryFormat'

interface TDSQLShardDistributionProps {
  /** 连接 ID */
  connId: string
  /** 已选数据库列表（用于数据库下拉） */
  databases: string[]
  /** 当前选中的数据库（受控） */
  database: string
  /** 当前数据库下的表名列表 */
  tables: string[]
  /** 表列表加载态 */
  tablesLoading: boolean
  /** 切换数据库 */
  onDatabaseChange: (database: string) => void
}

/** 单行分区数据（带表名前缀） */
type PartitionRow = {
  tableName: string
  partitionName: string
  tableSchema: string
  tableRows: number
  dataLength: number
  indexLength: number
}

/** 表类型映射为标签颜色，便于快速识别分表/单表/广播表 */
function tableTypeTag(tableType: string): React.ReactNode {
  const colorMap: Record<string, string> = {
    shard: 'blue',
    noshard: 'default',
    broadcast: 'gold',
    unknown: 'default',
  }
  return <Tag color={colorMap[tableType] || 'default'}>{tableType}</Tag>
}

export default function TDSQLShardDistribution({
  connId,
  databases,
  database,
  tables,
  tablesLoading,
  onDatabaseChange,
}: TDSQLShardDistributionProps) {
  const [tableName, setTableName] = useState<string>()
  const [rows, setRows] = useState<PartitionRow[]>([])
  const [tableType, setTableType] = useState<string>('')
  const [shardKey, setShardKey] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 切换数据库时重置表选择
  useEffect(() => {
    setTableName(undefined)
    setRows([])
    setTableType('')
    setShardKey('')
  }, [database])

  // 选定表后拉取分区信息
  useEffect(() => {
    let active = true
    if (!database || !tableName) {
      setRows([])
      return () => {
        active = false
      }
    }
    setLoading(true)
    setError('')
    void window.tdsql.getTableMetadata(connId, database, tableName)
      .then(result => {
        if (!active) return
        if (!result.success || !result.data) {
          throw new Error(
            result.error?.detail
            || result.error?.message
            || '获取表分布式元数据失败',
          )
        }
        const meta = result.data
        setTableType(meta.tableType)
        setShardKey(meta.shardKey?.fieldName || '')
        // 将分区信息平铺为表格行，附带表名前缀
        const flatRows: PartitionRow[] = meta.partitions.map(partition => ({
          tableName: meta.tableName,
          partitionName: partition.partitionName,
          tableSchema: partition.tableSchema,
          tableRows: partition.tableRows,
          dataLength: partition.dataLength,
          indexLength: partition.indexLength,
        }))
        setRows(flatRows)
        void window.logger.write(
          'info',
          'TDSQLMonitor',
          `查询分片分布完成: ${database}.${tableName}, 类型=${meta.tableType}, 分区数=${flatRows.length}`,
        )
      })
      .catch(err => {
        if (!active) return
        const detail = err instanceof Error ? err.message : String(err)
        setError(detail)
        void window.logger.write(
          'error',
          'TDSQLMonitor',
          `查询分片分布失败: ${database}.${tableName}, 原因=${detail}`,
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [connId, database, tableName])

  const columns = useMemo<ColumnsType<PartitionRow>>(
    () => partitionColumns as ColumnsType<PartitionRow>,
    [],
  )

  return (
    <div className="tdsql-monitor__panel">
      <div className="tdsql-monitor__toolbar">
        <span className="tdsql-monitor__toolbar-label">数据库</span>
        <Select
          size="small"
          style={{ width: 200 }}
          placeholder="选择数据库"
          value={database || undefined}
          options={databases.map(name => ({ label: name, value: name }))}
          onChange={onDatabaseChange}
          showSearch
        />
        <span className="tdsql-monitor__toolbar-label">表</span>
        <Select
          size="small"
          style={{ width: 280 }}
          placeholder="选择表查看分区分布"
          value={tableName}
          loading={tablesLoading}
          options={tables.map(name => ({ label: name, value: name }))}
          onChange={value => setTableName(value)}
          showSearch
          optionFilterProp="label"
        />
        {tableName && tableType && (
          <span className="tdsql-monitor__meta">
            类型：{tableTypeTag(tableType)}
            {shardKey && <Tag color="geekblue">SHARDKEY={shardKey}</Tag>}
          </span>
        )}
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="分片分布查询失败"
          description={error}
          style={{ marginBottom: 12 }}
        />
      )}

      <Spin spinning={loading}>
        {rows.length === 0 && !loading && !error ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              database
                ? '请选择一张表查看分区分布'
                : '请先选择数据库'
            }
            style={{ marginTop: 48 }}
          />
        ) : (
          <Table<PartitionRow>
            className="tdsql-monitor__table"
            rowKey={row => `${row.tableName}-${row.partitionName}`}
            size="small"
            dataSource={rows}
            columns={columns}
            scroll={{ x: 880, y: 'calc(100vh - 360px)' }}
            pagination={false}
            summary={pageData => {
              if (pageData.length === 0) return null
              const totalRows = pageData.reduce((sum, r) => sum + r.tableRows, 0)
              const totalData = pageData.reduce((sum, r) => sum + r.dataLength, 0)
              const totalIndex = pageData.reduce((sum, r) => sum + r.indexLength, 0)
              return (
                <Table.Summary>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
                    <Table.Summary.Cell index={1} colSpan={2}>
                      {pageData.length} 个分区
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      {totalRows.toLocaleString()}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      {formatTableSize(totalData)}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right">
                      {formatTableSize(totalIndex)}
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )
            }}
          />
        )}
      </Spin>
    </div>
  )
}
