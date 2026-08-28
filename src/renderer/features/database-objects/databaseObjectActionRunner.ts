import { message, Modal } from 'antd'
import type { ConnectionData } from '../../types'
import {
  buildDatabaseObjectCreateDocument,
} from './databaseObjectCreateTemplate'
import type { DatabaseObjectCategory } from './databaseObjectModel'
import type {
  DatabaseObjectAction,
  DatabaseObjectActionId,
} from './databaseObjectPresentation'
import type { DatabaseObjectSelection } from './databaseObjectModel'

/**
 * 对象操作执行上下文，包含连接、数据库与分类信息。
 */
export interface DatabaseObjectActionContext {
  connection: ConnectionData
  database: string
  category: DatabaseObjectCategory
}

/**
 * 对象操作执行器所需的外部依赖。
 * 由 App.tsx 注入，避免执行器直接依赖全局状态。
 */
export interface DatabaseObjectActionOptions {
  /** 打开视图的数据浏览面板（与表数据浏览复用同一入口） */
  onOpenViewData: (context: DatabaseObjectActionContext, viewName: string) => void
  /** 创建查询文档并加载指定 SQL 内容 */
  onOpenQueryDocument: (
    context: DatabaseObjectActionContext,
    input: { name: string; sql: string },
  ) => void
  /** 打开导出向导（单对象） */
  onOpenExport: (
    connId: string,
    database: string,
    objectType: 'table' | 'view',
    names: string[],
  ) => Promise<void>
  /** 操作完成后刷新对象列表 */
  onRefresh: (context: DatabaseObjectActionContext) => Promise<void>
  /** 清除当前选中对象（删除后调用） */
  onClearSelection: () => void
}

/**
 * 将对象分类映射到对应的可删除对象类型。
 * 查询和报表属于文件类对象，不通过 DROP 语句删除。
 */
function resolveDroppableKind(
  category: DatabaseObjectCategory,
  selection?: DatabaseObjectSelection,
): 'view' | 'function' | 'procedure' | 'event' | undefined {
  if (category === 'views') return 'view'
  if (category === 'events') return 'event'
  if (category === 'functions') {
    return selection?.kind === 'procedure' ? 'procedure' : 'function'
  }
  return undefined
}

/**
 * 删除数据库对象（视图、函数、存储过程、事件）。
 * 调用后端 dropDatabaseObject 接口，并处理 PostgreSQL 例程无法自动删除的情况。
 */
async function dropDatabaseObject(
  context: DatabaseObjectActionContext,
  kind: 'view' | 'function' | 'procedure' | 'event',
  objectName: string,
  options: DatabaseObjectActionOptions,
): Promise<void> {
  const label = kind === 'view'
    ? '视图'
    : kind === 'function'
      ? '函数'
      : kind === 'procedure'
        ? '存储过程'
        : '事件'
  void window.logger.write(
    'info',
    'ObjectAction',
    `开始删除${label}: 连接=${context.connection.id}, 数据库=${context.database}, 对象=${objectName}`,
  )
  try {
    const result = await window.database.dropDatabaseObject(
      context.connection.id,
      context.database,
      kind,
      objectName,
    )
    if (!result.success) {
      throw new Error(result.error?.message || `删除${label}失败`)
    }
    if (result.data?.skipped) {
      message.warning(
        `PostgreSQL ${label}“${objectName}”可能存在重载，请通过查询窗口手动编写 DROP 语句指定参数签名。`,
      )
      void window.logger.write(
        'warn',
        'ObjectAction',
        `跳过删除${label}: 对象=${objectName}（PostgreSQL 需手动指定参数签名）`,
      )
      return
    }
    options.onClearSelection()
    await options.onRefresh(context)
    void window.logger.write(
      'info',
      'ObjectAction',
      `删除${label}完成: 数据库=${context.database}, 对象=${objectName}`,
    )
    message.success(`${label}“${objectName}”已删除`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    void window.logger.write(
      'error',
      'ObjectAction',
      `删除${label}失败: 数据库=${context.database}, 对象=${objectName}, 原因=${detail}`,
    )
    message.error(`删除${label}失败：${detail}`)
  }
}

/**
 * 切换事件启用状态（仅 MySQL）。
 */
async function toggleDatabaseEventState(
  context: DatabaseObjectActionContext,
  eventName: string,
  enable: boolean,
  options: DatabaseObjectActionOptions,
): Promise<void> {
  const action = enable ? '启用' : '停用'
  void window.logger.write(
    'info',
    'ObjectAction',
    `开始${action}事件: 连接=${context.connection.id}, 数据库=${context.database}, 事件=${eventName}`,
  )
  try {
    const result = await window.database.toggleDatabaseEvent(
      context.connection.id,
      context.database,
      eventName,
      enable,
    )
    if (!result.success) {
      throw new Error(result.error?.message || `${action}事件失败`)
    }
    await options.onRefresh(context)
    void window.logger.write(
      'info',
      'ObjectAction',
      `${action}事件完成: 数据库=${context.database}, 事件=${eventName}`,
    )
    message.success(`事件“${eventName}”已${action}`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    void window.logger.write(
      'error',
      'ObjectAction',
      `${action}事件失败: 数据库=${context.database}, 事件=${eventName}, 原因=${detail}`,
    )
    message.error(`${action}事件失败：${detail}`)
  }
}

/**
 * 运行函数或存储过程，并将结果以查询文档形式展示。
 */
async function executeDatabaseRoutine(
  context: DatabaseObjectActionContext,
  kind: 'function' | 'procedure',
  routineName: string,
): Promise<void> {
  const label = kind === 'function' ? '函数' : '存储过程'
  void window.logger.write(
    'info',
    'ObjectAction',
    `开始运行${label}: 连接=${context.connection.id}, 数据库=${context.database}, 对象=${routineName}`,
  )
  try {
    const result = await window.database.executeDatabaseRoutine(
      context.connection.id,
      context.database,
      kind,
      routineName,
    )
    if (!result.success) {
      throw new Error(result.error?.message || `运行${label}失败`)
    }
    void window.logger.write(
      'info',
      'ObjectAction',
      `运行${label}完成: 数据库=${context.database}, 对象=${routineName}`,
    )
    message.success(`${label}“${routineName}”已执行`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    void window.logger.write(
      'error',
      'ObjectAction',
      `运行${label}失败: 数据库=${context.database}, 对象=${routineName}, 原因=${detail}`,
    )
    message.error(`运行${label}失败：${detail}`)
  }
}

/**
 * 确认删除对话框，参考 deleteTable 的确认模式。
 */
function confirmDelete(
  category: DatabaseObjectCategory,
  objectName: string,
  onOk: () => Promise<void>,
): void {
  const labelMap: Record<DatabaseObjectCategory, string> = {
    tables: '表',
    views: '视图',
    functions: '函数或存储过程',
    events: '事件',
    queries: '查询',
    reports: '报表',
    backups: '备份',
  }
  const label = labelMap[category]
  Modal.confirm({
    title: `删除${label}`,
    content: `确定删除${label}“${objectName}”吗？此操作无法撤销。`,
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk,
  })
}

/**
 * 执行数据库对象操作。
 * 根据分类和动作ID路由到具体处理逻辑：
 * - open：视图打开数据浏览；查询/报表打开查询文档
 * - design：创建查询文档供用户编辑SQL
 * - create：创建查询文档并加载模板SQL
 * - delete：调用后端删除对象
 * - export：打开导出向导
 * - execute：运行函数/存储过程
 * - enable / disable：启用/停用事件
 */
export async function runDatabaseObjectAction(
  context: DatabaseObjectActionContext,
  action: DatabaseObjectAction,
  selection: DatabaseObjectSelection | undefined,
  options: DatabaseObjectActionOptions,
): Promise<void> {
  const { category } = context
  const actionId: DatabaseObjectActionId = action.id
  const objectName = selection?.name

  void window.logger.write(
    'info',
    'ObjectAction',
    `触发对象操作: 动作=${actionId}, 分类=${category}, 数据库=${context.database}, 对象=${objectName || '未选择'}`,
  )

  // 通用：新建对象 - 创建查询文档加载模板SQL
  if (actionId === 'create') {
    const document = buildDatabaseObjectCreateDocument(
      context.connection.type,
      category,
    )
    if (document) {
      options.onOpenQueryDocument(context, document)
    } else {
      message.warning(`当前分类不支持新建: ${category}`)
    }
    return
  }

  // 通用：刷新
  if (actionId === 'refresh') {
    await options.onRefresh(context)
    return
  }

  // 以下操作需要选中对象
  if (!objectName) {
    message.warning('请先选择一个对象')
    return
  }

  // 视图：打开数据浏览
  if (category === 'views' && actionId === 'open') {
    options.onOpenViewData(context, objectName)
    return
  }

  // 视图：设计 - 创建查询文档（用户可编写 CREATE OR REPLACE VIEW）
  if (category === 'views' && actionId === 'design') {
    options.onOpenQueryDocument(context, {
      name: `${objectName}.sql`,
      sql: `-- 编辑视图 ${objectName} 的定义\nCREATE OR REPLACE VIEW ${objectName} AS\nSELECT *\nFROM target_table;\n`,
    })
    return
  }

  // 视图：导出
  if (category === 'views' && actionId === 'export') {
    try {
      await options.onOpenExport(
        context.connection.id,
        context.database,
        'view',
        [objectName],
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`打开导出向导失败：${detail}`)
    }
    return
  }

  // 函数/存储过程：设计 - 创建查询文档
  if (category === 'functions' && actionId === 'design') {
    options.onOpenQueryDocument(context, {
      name: `${objectName}.sql`,
      sql: `-- 编辑 ${selection?.kind || '函数'} ${objectName}\n-- 请在此编写 CREATE OR REPLACE 语句\n`,
    })
    return
  }

  // 函数/存储过程：运行
  if (category === 'functions' && actionId === 'execute') {
    const kind = selection?.kind === 'procedure' ? 'procedure' : 'function'
    await executeDatabaseRoutine(context, kind, objectName)
    return
  }

  // 事件：设计 - 创建查询文档
  if (category === 'events' && actionId === 'design') {
    options.onOpenQueryDocument(context, {
      name: `${objectName}.sql`,
      sql: `-- 编辑事件 ${objectName}\n-- 请在此编写 ALTER EVENT 语句\n`,
    })
    return
  }

  // 事件：启用
  if (category === 'events' && actionId === 'enable') {
    await toggleDatabaseEventState(context, objectName, true, options)
    return
  }

  // 事件：停用
  if (category === 'events' && actionId === 'disable') {
    await toggleDatabaseEventState(context, objectName, false, options)
    return
  }

  // 查询/报表：打开 - 创建查询文档（文件内容由用户后续加载）
  if (
    (category === 'queries' || category === 'reports')
    && actionId === 'open'
  ) {
    options.onOpenQueryDocument(context, {
      name: `${objectName}.sql`,
      sql: `-- ${category === 'queries' ? '查询' : '报表'}: ${objectName}\n`,
    })
    return
  }

  // 查询/报表：设计 - 创建查询文档
  if (
    (category === 'queries' || category === 'reports')
    && actionId === 'design'
  ) {
    options.onOpenQueryDocument(context, {
      name: `${objectName}.sql`,
      sql: `-- 设计${category === 'queries' ? '查询' : '报表'}: ${objectName}\n`,
    })
    return
  }

  // 报表：导出
  if (category === 'reports' && actionId === 'export') {
    message.info('报表导出功能请通过报表设计中的导出按钮操作')
    return
  }

  // 通用：删除对象
  if (actionId === 'delete') {
    const droppableKind = resolveDroppableKind(category, selection)
    if (!droppableKind) {
      // 查询/报表属于文件类对象，删除通过文件系统
      if (category === 'queries' || category === 'reports') {
        confirmDelete(category, objectName, async () => {
          message.info(`请通过文件管理器删除${category === 'queries' ? '查询' : '报表'}文件`)
        })
        return
      }
      message.warning(`当前分类不支持删除: ${category}`)
      return
    }
    confirmDelete(category, objectName, () => (
      dropDatabaseObject(context, droppableKind, objectName, options)
    ))
    return
  }

  // 未识别的操作
  void window.logger.write(
    'warn',
    'ObjectAction',
    `对象操作未处理: 动作=${actionId}, 分类=${category}`,
  )
  message.info(`${action.label}功能暂不适用于「${category}」分类`)
}
