const layoutStates = new Map<string, string>()

export function writeLayoutOverflowLog(
  module: string,
  key: string,
  element: HTMLElement | null,
): void {
  if (!element) return

  const verticalOverflow = element.scrollHeight > element.clientHeight + 1
  const horizontalOverflow = element.scrollWidth > element.clientWidth + 1
  const treeRow = element.querySelector<HTMLElement>('.ant-tree-treenode')
  const treeIndent = element.querySelector<HTMLElement>('.ant-tree-indent-unit')
  const treeRowHeight = treeRow?.getBoundingClientRect().height || 0
  const treeIndentWidth = treeIndent?.getBoundingClientRect().width || 0
  const state = [
    element.clientWidth,
    element.clientHeight,
    verticalOverflow,
    horizontalOverflow,
    treeRowHeight,
    treeIndentWidth,
  ].join(':')

  // 只记录尺寸或溢出状态变化，避免树节点反复展开时产生重复日志。
  if (layoutStates.get(key) === state) return
  layoutStates.set(key, state)

  const message = [
    `布局状态: 区域=${key}`,
    `可视=${element.clientWidth}x${element.clientHeight}`,
    `内容=${element.scrollWidth}x${element.scrollHeight}`,
    `垂直滚动=${verticalOverflow ? '需要' : '不需要'}`,
    `水平滚动=${horizontalOverflow ? '需要' : '不需要'}`,
    treeRowHeight ? `树行高=${treeRowHeight}px` : '',
    treeIndentWidth ? `层级缩进=${treeIndentWidth}px` : '',
  ].filter(Boolean).join(', ')

  void window.logger.write('info', module, message).catch(error => {
    console.warn(`${module}布局日志写入失败:`, error)
  })
}
