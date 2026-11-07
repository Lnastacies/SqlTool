/**
 * Monaco 编辑器实例注册表。
 *
 * 设计背景：
 * - 查询工作区（QueryWorkspace）承载 Monaco Editor 实例，而「撤销/重做/查找/替换」
 *   等编辑器命令由顶层命令系统（useAppCommands / commandCatalog）集中管理，
 *   二者不共享 React state，直接通过 prop 传 editor 引用会破坏现有分层。
 * - 使用模块级 Map 作为跨组件注册表：QueryWorkspace 在编辑器挂载时注册，
 *   卸载时注销；命令系统通过当前活动查询文档 ID 取出对应实例执行动作。
 * - 关键点埋点：注册、注销、触发动作的成功/失败均写入 logger，
 *   便于后续排查命令无法生效的问题。
 */
import type { editor } from 'monaco-editor'

/** 编辑器内置动作标识，用于菜单命令分发。 */
export type EditorActionId =
  | 'undo'
  | 'redo'
  | 'find'
  | 'replace'

/** 注册表允许外部以文档 ID 为维度保存 editor 引用。 */
const editors = new Map<string, editor.IStandaloneCodeEditor>()
/** 为每一次注册生成唯一序号，便于排查重复注册/注销的顺序问题。 */
let registerSequence = 0

async function writeRegistryLog(
  level: 'info' | 'warn' | 'error',
  message: string,
): Promise<void> {
  try {
    await (window as any).logger?.write?.(level, 'MonacoRegistry', message)
  } catch {
    // logger 尚未挂载时忽略，避免影响主流程
  }
}

/**
 * 注册 Monaco Editor 实例。
 * 若同一 documentId 已存在旧实例，则先执行注销，避免内存泄漏。
 */
export function registerEditor(
  documentId: string,
  editorInstance: editor.IStandaloneCodeEditor,
): void {
  const seq = ++registerSequence
  void writeRegistryLog(
    'info',
    `注册编辑器实例: 文档=${documentId}, 序号=${seq}, 已有=${editors.has(documentId) ? '覆盖旧实例' : '全新实例'}`,
  )
  if (editors.has(documentId)) {
    // 防御性清理：当同一个文档因 React 重挂载触发重新 mount 时先释放旧引用
    editors.delete(documentId)
  }
  editors.set(documentId, editorInstance)
}

/**
 * 注销 Monaco Editor 实例。
 * 仅在传入的 editor 与当前注册一致时才删除，避免误删新挂载的实例。
 */
export function unregisterEditor(
  documentId: string,
  editorInstance?: editor.IStandaloneCodeEditor,
): void {
  const current = editors.get(documentId)
  if (editorInstance && current && current !== editorInstance) {
    void writeRegistryLog(
      'warn',
      `注销请求与当前注册表实例不一致，忽略: 文档=${documentId}`,
    )
    return
  }
  if (!current) {
    void writeRegistryLog(
      'warn',
      `注销编辑器实例时未找到对应记录: 文档=${documentId}`,
    )
    return
  }
  editors.delete(documentId)
  void writeRegistryLog('info', `注销编辑器实例: 文档=${documentId}`)
}

/**
 * 根据 documentId 获取已注册的编辑器实例。
 * 外部使用方（命令系统）应优先通过 getActiveEditor() 传入活动文档。
 */
export function getEditor(
  documentId?: string,
): editor.IStandaloneCodeEditor | undefined {
  if (!documentId) return undefined
  return editors.get(documentId)
}

/**
 * 执行编辑器内置动作，并将执行结果写入日志便于排查。
 *
 * @returns 动作是否成功执行（未找到编辑器或动作未支持时返回 false）
 */
export async function executeEditorAction(
  documentId: string | undefined,
  action: EditorActionId,
): Promise<boolean> {
  const editorInstance = getEditor(documentId)
  if (!editorInstance) {
    void writeRegistryLog(
      'warn',
      `编辑器命令未生效：未找到活动编辑器实例，动作=${action}, 文档=${documentId || '未指定'}`,
    )
    return false
  }
  try {
    // Monaco 内置动作名称与 Command Palette 一致
    const actionMap: Record<EditorActionId, string> = {
      undo: 'undo',
      redo: 'redo',
      find: 'actions.find',
      replace: 'editor.action.startFindReplaceAction',
    }
    const internalId = actionMap[action]
    const triggered = editorInstance.getAction(internalId)?.run()
    void writeRegistryLog(
      'info',
      `编辑器命令已分发: 文档=${documentId}, 动作=${action}, 内置Id=${internalId}`,
    )
    if (triggered && typeof (triggered as any).then === 'function') {
      await triggered
    }
    return true
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    void writeRegistryLog(
      'error',
      `编辑器命令执行失败: 文档=${documentId}, 动作=${action}, 原因=${detail}`,
    )
    return false
  }
}
