import React from 'react'
import { Alert, Descriptions, Result, Tag } from 'antd'
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined'
import type {
  DataSyncResult,
  DataTransferResult,
  DatabaseToolMode,
  StructureSyncResult,
} from '../../types'

type ToolResult = DataTransferResult | DataSyncResult | StructureSyncResult

interface DatabaseToolResultProps {
  mode: DatabaseToolMode
  result: ToolResult
}

export default function DatabaseToolResult({
  mode,
  result,
}: DatabaseToolResultProps) {
  const common = [
    { key: 'tables', label: '完成表数', children: result.tableCount },
  ]
  const details = mode === 'transfer'
    ? [
      ...common,
      {
        key: 'rows',
        label: '传输行数',
        children: (result as DataTransferResult).transferredRows,
      },
      {
        key: 'created',
        label: '创建表数',
        children: (result as DataTransferResult).createdTables.length,
      },
    ]
    : mode === 'dataSync'
      ? [
        ...common,
        {
          key: 'inserted',
          label: '新增',
          children: (result as DataSyncResult).insertedRows,
        },
        {
          key: 'updated',
          label: '更新',
          children: (result as DataSyncResult).updatedRows,
        },
        {
          key: 'deleted',
          label: '删除',
          children: (result as DataSyncResult).deletedRows,
        },
      ]
      : [
        ...common,
        {
          key: 'statements',
          label: '执行 SQL',
          children: (result as StructureSyncResult).statementCount,
        },
        {
          key: 'created',
          label: '创建表',
          children: (result as StructureSyncResult).createdTables.length,
        },
        {
          key: 'altered',
          label: '变更表',
          children: (result as StructureSyncResult).alteredTables.length,
        },
      ]

  return (
    <div className="database-tool-result">
      <Result
        icon={<CheckCircleOutlined />}
        status="success"
        title="任务执行完成"
        subTitle="执行结果已写入本地日志，可通过日志文件继续排查每张表的处理过程。"
      />
      <Descriptions bordered size="small" column={details.length} items={details} />
      {result.warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="任务提示"
          description={result.warnings.map(warning => (
            <Tag key={warning}>{warning}</Tag>
          ))}
        />
      )}
    </div>
  )
}
