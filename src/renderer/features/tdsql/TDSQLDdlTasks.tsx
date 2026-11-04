/**
 * TDSQL DDL 任务列表组件
 *
 * 展示 SHOW DDL 命令的查询结果。
 * 由于 TDSQL 不同内核版本返回的字段可能不一致，
 * 列定义采用动态生成：取首行所有字段作为列。
 */

import React, { useMemo } from 'react'
import { Alert, Empty, Table } from 'antd'
import { buildDdlTaskColumns } from './tdsqlMonitorColumns'
import type { TDSQLDdlTaskRow } from './tdsqlMonitorModel'

interface TDSQLDdlTasksProps {
  /** DDL 任务原始行数据 */
  ddlTasks: TDSQLDdlTaskRow[]
  /** 加载态 */
  loading: boolean
}

export default function TDSQLDdlTasks({
  ddlTasks,
  loading,
}: TDSQLDdlTasksProps) {
  // 列根据数据动态生成，避免 TDSQL 版本差异导致列缺失
  const columns = useMemo(
    () => buildDdlTaskColumns(ddlTasks),
    [ddlTasks],
  )

  if (!loading && ddlTasks.length === 0) {
    return (
      <div className="tdsql-monitor__panel">
        <Alert
          type="info"
          showIcon
          message="当前集群没有正在执行或已完成的 DDL 任务"
          description="SHOW DDL 返回空结果，可能是集群刚启动或暂未发起 DDL 操作。"
        />
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无 DDL 任务"
          style={{ marginTop: 24 }}
        />
      </div>
    )
  }

  return (
    <div className="tdsql-monitor__panel">
      <Alert
        type="warning"
        showIcon
        message="DDL 任务字段因 TDSQL 内核版本不同可能存在差异"
        description="列按返回数据的字段顺序动态生成，可横向滚动查看完整内容。"
        style={{ marginBottom: 12 }}
      />
      <Table<TDSQLDdlTaskRow>
        className="tdsql-monitor__table"
        rowKey={(_, index) => String(index)}
        size="small"
        loading={loading}
        dataSource={ddlTasks}
        columns={columns}
        scroll={{ x: 'max-content', y: 'calc(100vh - 360px)' }}
        pagination={{ pageSize: 50, showSizeChanger: false, size: 'small' }}
      />
    </div>
  )
}
