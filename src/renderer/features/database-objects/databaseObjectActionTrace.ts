import type {
  DatabaseObjectCategoryActionId,
} from './databaseObjectContextMenu'
import type { DatabaseObjectCategory } from './databaseObjectModel'

export interface DatabaseObjectActionTrace {
  info: (stage: string, detail?: string) => void
  complete: (route: string, detail?: string) => void
  warn: (stage: string, detail: string) => void
  error: (detail: string) => void
}

export function createCategoryActionTrace(
  context: {
    connection: { id: string }
    database: string
    category: DatabaseObjectCategory
  },
  action: DatabaseObjectCategoryActionId,
): DatabaseObjectActionTrace {
  const traceId = crypto.randomUUID()
  const startedAt = Date.now()
  const write = (
    level: 'info' | 'warn' | 'error',
    stage: string,
    detail = '',
  ) => {
    void window.logger.write(
      level,
      'ObjectCategoryMenu',
      `分类菜单操作: 追踪=${traceId}, 阶段=${stage}, 动作=${action}, 分类=${context.category}, 连接=${context.connection.id}, 数据库=${context.database}, 耗时=${Date.now() - startedAt}ms${detail ? `, ${detail}` : ''}`,
    )
  }

  write('info', '开始')
  return {
    info: (stage, detail) => write('info', stage, detail),
    complete: (route, detail) => {
      write('info', '完成', `路由=${route}${detail ? `, ${detail}` : ''}`)
    },
    warn: (stage, detail) => write('warn', stage, detail),
    error: detail => write('error', '失败', detail),
  }
}
