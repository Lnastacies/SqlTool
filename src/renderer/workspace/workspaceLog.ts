export async function writeWorkspaceLog(
  level: 'info' | 'warn' | 'error',
  message: string,
): Promise<void> {
  try {
    await (window as any).logger?.write(level, 'DataWorkspace', message)
  } catch (error) {
    console.warn('数据工作区日志写入失败:', error)
  }
}
