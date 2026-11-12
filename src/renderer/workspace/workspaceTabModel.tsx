import type { ReactNode } from 'react'
import CodeOutlined from '@ant-design/icons/CodeOutlined'
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined'
import TableOutlined from '@ant-design/icons/TableOutlined'
import {
  getDatabaseObjectCategoryDefinition,
  type DatabaseObjectCategory,
} from '../features/database-objects/databaseObjectModel'
import type { WorkspaceDocument } from './workspaceTypes'

/**
 * 表清单（对象浏览）常驻标签的固定 ID。
 * 该标签不属于 WorkspaceDocument，始终排在标签栏第一位且不可关闭。
 */
export const OBJECTS_TAB_ID = 'workspace:objects'

/** 文档标签图标：与既有工作区视觉保持一致 */
export function getDocumentIcon(document: WorkspaceDocument): ReactNode {
  if (document.kind === 'query') return <CodeOutlined />
  if (document.kind === 'data') return <TableOutlined />
  return <DatabaseOutlined />
}

/** 数据标签标题带上库名，便于区分不同库下的同名表 */
export function getDocumentTabTitle(document: WorkspaceDocument): string {
  if (document.kind === 'data') {
    return `${document.database}.${document.objectName || document.name}`
  }
  return document.name
}

/** 常驻表清单标签标题：库名 + 当前对象分类，未选库时显示对象浏览 */
export function getObjectsTabTitle(
  database: string | null,
  category: DatabaseObjectCategory,
): string {
  if (!database) return '对象浏览'
  const categoryLabel = category === 'tables'
    ? '表清单'
    : getDatabaseObjectCategoryDefinition(category).label
  return `${database} · ${categoryLabel}`
}

/**
 * 计算关闭标签后的激活目标。
 * 规则：仅当关闭的是当前激活标签时才需要回落，优先左侧相邻标签，
 * 其次右侧相邻标签，最后回落到常驻表清单标签。
 */
export function resolveActiveTabAfterClose(
  tabIds: string[],
  closingId: string,
  activeTabId: string,
): string {
  if (closingId !== activeTabId) return activeTabId
  const closingIndex = tabIds.indexOf(closingId)
  if (closingIndex < 0) return activeTabId
  return tabIds[closingIndex - 1]
    || tabIds[closingIndex + 1]
    || OBJECTS_TAB_ID
}
