import { Modal, message } from 'antd'
import type {
  CloseDatabaseResult,
  ConnectionData,
  DatabaseDumpMode,
  DatabaseDumpResult,
  DatabasePrintResult,
  DropDatabaseResult,
  IPCResponse,
} from '../../types'

export interface DatabaseActionContext {
  connection: ConnectionData
  database: string
}

export function responseError(
  response: { error?: { message?: string; detail?: string } },
  fallback: string,
): Error {
  return new Error(response.error?.detail || response.error?.message || fallback)
}

export function writeActionLog(
  level: 'info' | 'warn' | 'error',
  action: string,
  context: DatabaseActionContext,
  detail = '',
): void {
  void window.logger.write(
    level,
    'DatabaseWorkspace',
    `${action}: 连接=${context.connection.id}, 数据库=${context.database}${detail ? `, ${detail}` : ''}`,
  )
}

export async function closeDatabaseContext(
  context: DatabaseActionContext,
  closeDocuments: (context: DatabaseActionContext) => Promise<boolean>,
  onDisconnect: (connection: ConnectionData) => Promise<void>,
  onUnload: (context: DatabaseActionContext) => void,
): Promise<void> {
  writeActionLog('info', '开始关闭数据库', context)
  if (!await closeDocuments(context)) return
  if (context.connection.type === 'SQLite') {
    await onDisconnect(context.connection)
    writeActionLog('info', 'SQLite 数据库连接已关闭', context)
    return
  }

  try {
    const result: IPCResponse<CloseDatabaseResult> = await window.database.closeDatabase(
      context.connection.id,
      context.database,
    )
    if (!result.success) throw responseError(result, '关闭数据库失败')
    onUnload(context)
    writeActionLog('info', '数据库已关闭', context)
    message.success(`数据库“${context.database}”已关闭`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    writeActionLog('error', '关闭数据库失败', context, `原因=${detail}`)
    message.error(`关闭数据库失败: ${detail}`)
  }
}

export function confirmDatabaseDeletion(
  context: DatabaseActionContext,
  closeDocuments: (context: DatabaseActionContext) => Promise<boolean>,
  onDeleted: (context: DatabaseActionContext) => Promise<void>,
): void {
  writeActionLog('info', '请求删除数据库', context)
  Modal.confirm({
    title: '删除数据库',
    content: `确定永久删除数据库“${context.database}”吗？该操作无法撤销。`,
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        if (!await closeDocuments(context)) return
        writeActionLog('info', '开始删除数据库', context)
        const result: IPCResponse<DropDatabaseResult> = await window.database.dropDatabase(
          context.connection.id,
          context.database,
        )
        if (!result.success) throw responseError(result, '删除数据库失败')
        await onDeleted(context)
        writeActionLog('info', '数据库删除完成', context)
        message.success(`数据库“${context.database}”已删除`)
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        writeActionLog('error', '删除数据库失败', context, `原因=${detail}`)
        throw error
      }
    },
    onCancel: () => writeActionLog('info', '取消删除数据库', context),
  })
}

export async function dumpDatabaseToFile(
  context: DatabaseActionContext,
  mode: DatabaseDumpMode,
): Promise<void> {
  writeActionLog('info', '开始转储数据库', context, `模式=${mode}`)
  try {
    const result: IPCResponse<DatabaseDumpResult> = await window.database.dumpDatabase(
      context.connection.id,
      context.database,
      mode,
    )
    if (!result.success || !result.data) {
      throw responseError(result, '数据库转储失败')
    }
    if (result.data.cancelled) {
      writeActionLog('info', '取消数据库转储', context, `模式=${mode}`)
      return
    }
    writeActionLog(
      'info',
      '数据库转储完成',
      context,
      `模式=${mode}, 表=${result.data.tableCount}, 行=${result.data.rowCount}`,
    )
    message.success(`转储完成：${result.data.tableCount} 个表，${result.data.rowCount} 行数据`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    writeActionLog('error', '数据库转储失败', context, `原因=${detail}`)
    throw error
  }
}

export async function printDatabaseStructure(
  context: DatabaseActionContext,
): Promise<void> {
  writeActionLog('info', '开始生成数据库打印内容', context)
  const hide = message.loading('正在生成数据库打印内容...', 0)
  try {
    const result: IPCResponse<DatabasePrintResult> = await window.database.printDatabase(
      context.connection.id,
      context.database,
    )
    if (!result.success || !result.data) {
      throw responseError(result, '打印数据库失败')
    }
    if (result.data.cancelled) {
      writeActionLog('info', '取消数据库打印', context)
      return
    }
    writeActionLog(
      'info',
      '数据库打印任务已提交',
      context,
      `表=${result.data.tableCount}`,
    )
    message.success('数据库打印任务已提交')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    writeActionLog('error', '数据库打印失败', context, `原因=${detail}`)
    message.error(`打印数据库失败: ${detail}`)
  } finally {
    hide()
  }
}
