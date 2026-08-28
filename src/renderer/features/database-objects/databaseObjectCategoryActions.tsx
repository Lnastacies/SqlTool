import React from 'react'
import { Input, Modal, message } from 'antd'
import type { ConnectionData } from '../../types'
import { buildDatabaseObjectCreateDocument } from './databaseObjectCreateTemplate'
import type {
  DatabaseObjectCategoryActionId,
} from './databaseObjectContextMenu'
import type { DatabaseObjectCategory } from './databaseObjectModel'
import {
  createCategoryActionTrace,
  type DatabaseObjectActionTrace,
} from './databaseObjectActionTrace'

export interface DatabaseObjectCategoryActionContext {
  connection: ConnectionData
  database: string
  category: DatabaseObjectCategory
}

interface DatabaseObjectCategoryActionOptions {
  onFocus: (context: DatabaseObjectCategoryActionContext) => void
  onCreateTable: (
    context: DatabaseObjectCategoryActionContext,
  ) => void | Promise<void>
  onSelectTransferTarget: (
    context: DatabaseObjectCategoryActionContext,
    action: 'import' | 'export',
  ) => void | Promise<void>
  onOpenQueryDocument: (
    context: DatabaseObjectCategoryActionContext,
    input: { name: string; sql: string },
  ) => void
  onOpenSqlFiles: (
    context: DatabaseObjectCategoryActionContext,
  ) => void | Promise<void>
  onSearch: (context: DatabaseObjectCategoryActionContext) => void
  onOpenBackup: (context: DatabaseObjectCategoryActionContext) => void
  onRestoreBackup: (
    context: DatabaseObjectCategoryActionContext,
  ) => void | Promise<void>
  onExtractBackupSql: (
    context: DatabaseObjectCategoryActionContext,
  ) => void | Promise<void>
  onCreateGroup: (
    context: DatabaseObjectCategoryActionContext,
    name: string,
  ) => void
  onShowInFolder: (
    context: DatabaseObjectCategoryActionContext,
  ) => void | Promise<void>
  onRefresh: (
    context: DatabaseObjectCategoryActionContext,
  ) => void | Promise<void>
}

const ACTION_LABELS: Record<DatabaseObjectCategoryActionId, string> = {
  create: '新建对象',
  import: '导入向导',
  export: '导出向导',
  runSqlFile: '运行 SQL 文件',
  search: '在数据库中查找',
  createGroup: '新建组',
  paste: '粘贴',
  refresh: '刷新',
  openArchive: '打开存档',
  restore: '还原备份',
  extractSql: '提取 SQL',
  showInFolder: '在文件夹中显示',
}

function promptObjectGroupName(
  context: DatabaseObjectCategoryActionContext,
  onCreateGroup: DatabaseObjectCategoryActionOptions['onCreateGroup'],
  trace: DatabaseObjectActionTrace,
): void {
  let groupName = ''
  trace.info('等待用户输入', '路由=onCreateGroup')
  Modal.confirm({
    title: '新建对象分组',
    content: (
      <Input
        autoFocus
        maxLength={60}
        placeholder="输入分组名称"
        onChange={event => {
          groupName = event.target.value
        }}
        onPressEnter={event => {
          event.currentTarget.closest('.ant-modal-confirm')
            ?.querySelector<HTMLButtonElement>('.ant-btn-primary')
            ?.click()
        }}
      />
    ),
    okText: '创建',
    cancelText: '取消',
    onOk: () => {
      try {
        onCreateGroup(context, groupName)
        trace.complete(
          'onCreateGroup',
          `分组名称=${groupName.trim()}`,
        )
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        trace.error(`路由=onCreateGroup, 原因=${detail}`)
        message.error(detail)
        return Promise.reject(error)
      }
    },
    onCancel: () => {
      trace.info('用户取消', '路由=onCreateGroup')
    },
  })
}

export async function runDatabaseObjectCategoryAction(
  context: DatabaseObjectCategoryActionContext,
  action: DatabaseObjectCategoryActionId,
  options: DatabaseObjectCategoryActionOptions,
): Promise<void> {
  const trace = createCategoryActionTrace(context, action)

  try {
    options.onFocus(context)
    trace.info('上下文同步完成', '路由=onFocus')

    if (action === 'create') {
      if (context.category === 'tables') {
        await options.onCreateTable(context)
        trace.complete('onCreateTable')
        return
      }
      if (context.category === 'backups') {
        options.onOpenBackup(context)
        trace.complete('onOpenBackup')
        return
      }
      const document = buildDatabaseObjectCreateDocument(
        context.connection.type,
        context.category,
      )
      if (document) {
        options.onOpenQueryDocument(context, document)
        trace.complete(
          'onOpenQueryDocument',
          `文档=${document.name}, SQL长度=${document.sql.length}`,
        )
      } else {
        trace.warn(
          '路由失败',
          `原因=未生成创建文档, 数据库类型=${context.connection.type}`,
        )
      }
      return
    }

    if (action === 'import' || action === 'export') {
      await options.onSelectTransferTarget(context, action)
      trace.complete('onSelectTransferTarget', `传输模式=${action}`)
      return
    }
    if (
      action === 'runSqlFile'
      || action === 'openArchive'
    ) {
      await options.onOpenSqlFiles(context)
      trace.complete('onOpenSqlFiles', `文件动作=${action}`)
      return
    }
    if (action === 'restore') {
      await options.onRestoreBackup(context)
      trace.complete('onRestoreBackup')
      return
    }
    if (action === 'extractSql') {
      await options.onExtractBackupSql(context)
      trace.complete('onExtractBackupSql')
      return
    }
    if (action === 'search') {
      options.onSearch(context)
      trace.complete('onSearch')
      return
    }
    if (action === 'createGroup') {
      promptObjectGroupName(context, options.onCreateGroup, trace)
      return
    }
    if (action === 'showInFolder') {
      await options.onShowInFolder(context)
      trace.complete('onShowInFolder')
      return
    }
    if (action === 'refresh') {
      await options.onRefresh(context)
      trace.complete('onRefresh')
      return
    }

    trace.warn(
      '忽略',
      `操作=${ACTION_LABELS[action]} 当前不可用`,
    )
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    trace.error(`原因=${detail}`)
    message.error(`${ACTION_LABELS[action]}失败：${detail}`)
  }
}
