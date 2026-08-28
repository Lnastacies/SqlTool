import {
  type RefObject,
  useLayoutEffect,
  useState,
} from 'react'
import { writeLayoutOverflowLog } from '../layoutDiagnostics'

const MIN_BODY_HEIGHT = 96
const INITIAL_BODY_HEIGHT = 240

export function useDataGridBodyHeight(
  containerRef: RefObject<HTMLDivElement>,
  measurementKey: string,
  diagnosticKey: string,
): number {
  const [bodyHeight, setBodyHeight] = useState(INITIAL_BODY_HEIGHT)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const measure = () => {
      const header = container.querySelector<HTMLElement>('.ant-table-header')
      const nextHeight = Math.max(
        MIN_BODY_HEIGHT,
        Math.floor(
          container.clientHeight
          - (header?.getBoundingClientRect().height || 0)
          - 2,
        ),
      )
      setBodyHeight(current => current === nextHeight ? current : nextHeight)
      writeLayoutOverflowLog(
        'DataWorkspaceLayout',
        `data-grid:${diagnosticKey}`,
        container,
      )
    }

    measure()
    const frame = window.requestAnimationFrame(measure)
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [containerRef, diagnosticKey, measurementKey])

  return bodyHeight
}
