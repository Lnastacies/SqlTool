/** 工作区日志写入：scope 默认为数据工作区，标签栏等场景可传入独立作用域 */
export async function writeWorkspaceLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  scope = 'DataWorkspace',
): Promise<void> {
  try {
    await (window as any).logger?.write(level, scope, message)
  } catch (error) {
    console.warn('数据工作区日志写入失败:', error)
  }
}
