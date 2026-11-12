import { useEffect, useRef, type RefObject } from 'react'
import { writeWorkspaceLog } from './workspaceLog'

/** 行模式滚轮的单行像素换算值（Chromium 鼠标滚轮通常为像素模式，此行仅兜底） */
const LINE_HEIGHT_PX = 16
/** 边界判定容差，避免亚像素误差导致提前释放事件 */
const BOUNDARY_EPSILON = 0.5
/** 滚轮日志最小间隔，避免高频滚轮刷屏 */
const LOG_INTERVAL_MS = 800

/** 归一化滚轮位移：将行模式、页模式统一换算为像素 */
function normalizeWheelDelta(event: WheelEvent, wrap: HTMLElement): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * LINE_HEIGHT_PX
  }
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * wrap.clientWidth
  }
  return event.deltaY
}

/**
 * 读取 rc-tabs 当前的横向偏移。
 * antd 通过 transform: translateX(...) 移动 .ant-tabs-nav-list 实现标签滚动，
 * 这里只读不写，避免与其内部状态冲突。
 */
function readTransformOffset(navList: HTMLElement): number {
  const transform = getComputedStyle(navList).transform
  if (!transform || transform === 'none') return 0
  try {
    return -new DOMMatrixReadOnly(transform).m41
  } catch {
    return 0
  }
}

/** 计算标签栏最大可滚动距离；无溢出时返回 0 */
function readMaxOffset(wrap: HTMLElement, navList: HTMLElement): number {
  return Math.max(0, navList.getBoundingClientRect().width - wrap.clientWidth)
}

/**
 * 标签栏鼠标滚轮横向滚动。
 *
 * 行为约定：
 * - 垂直滚轮在标签栏内转为横向滚动（像素模式复用 antd 内置滚动，行/页模式换算后转发）；
 * - 触摸板横向滚动（deltaX 非零）不重复处理，沿用既有横向滚动；
 * - 滚到两端时释放事件，让页面按默认行为继续滚动，避免整页被吞掉；
 * - 保留 antd 现有「更多」下拉作为兜底入口。
 *
 * 监听挂在工作区容器上并使用捕获阶段，这样可以在 antd 的 wheel 处理器之前
 * 判断边界：边界处阻止事件继续传播即可跳过其 preventDefault，同时不影响页面默认滚动。
 */
export function useTabWheelScroll(containerRef: RefObject<HTMLElement | null>) {
  const lastLogRef = useRef({ key: '', time: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const logThrottled = (key: string, message: string) => {
      const now = Date.now()
      const last = lastLogRef.current
      if (last.key === key && now - last.time < LOG_INTERVAL_MS) return
      lastLogRef.current = { key, time: now }
      void writeWorkspaceLog('info', message, 'WorkspaceTabs')
    }

    const handleWheel = (event: WheelEvent) => {
      // 行/页模式转发出来的合成事件已由本 hook 处理，直接放行给 antd
      if ((event as WheelEvent & { __tabWheelNormalized?: boolean })
        .__tabWheelNormalized) {
        return
      }
      const target = event.target as HTMLElement | null
      const wrap = target?.closest('.ant-tabs-nav-wrap') as HTMLElement | null
      if (!wrap || !container.contains(wrap)) return
      const navList = wrap.querySelector('.ant-tabs-nav-list') as HTMLElement | null
      if (!navList) return

      // 触摸板横向滑动：不重复处理，沿用既有横向滚动
      if (Math.abs(event.deltaX) > 0) {
        logThrottled('native-x', `标签栏横向滚动沿用原生处理: deltaX=${event.deltaX}`)
        return
      }

      const delta = normalizeWheelDelta(event, wrap)
      if (!delta) return

      const maxOffset = readMaxOffset(wrap, navList)
      if (maxOffset <= 0) {
        logThrottled('no-overflow', '标签栏未溢出，滚轮事件保持默认传播')
        return
      }

      const currentOffset = readTransformOffset(navList)
      const atStart = currentOffset <= BOUNDARY_EPSILON
      const atEnd = currentOffset >= maxOffset - BOUNDARY_EPSILON
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) {
        // 已到边界：阻断 antd 的 preventDefault，让事件继续传播给页面
        event.stopPropagation()
        logThrottled(
          'release',
          `标签栏滚轮到达边界并释放事件: 方向=${delta < 0 ? '左' : '右'}, 偏移=${Math.round(currentOffset)}, 上限=${Math.round(maxOffset)}`,
        )
        return
      }

      logThrottled(
        'takeover',
        `标签栏滚轮接管横向滚动: deltaY=${event.deltaY}, 换算像素=${Math.round(delta)}, 模式=${event.deltaMode}`,
      )

      if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
        // 行/页模式：先按像素换算，再以像素事件转发给 antd 的滚动实现
        event.stopPropagation()
        event.preventDefault()
        const normalized = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
          deltaX: 0,
          deltaY: delta,
        })
        ;(normalized as WheelEvent & { __tabWheelNormalized?: boolean })
          .__tabWheelNormalized = true
        wrap.dispatchEvent(normalized)
      }
      // 像素模式：直接放行，由 antd 内置逻辑完成横向滚动
    }

    container.addEventListener('wheel', handleWheel, {
      capture: true,
      passive: false,
    })
    return () => {
      container.removeEventListener('wheel', handleWheel, { capture: true })
    }
  }, [containerRef])
}
