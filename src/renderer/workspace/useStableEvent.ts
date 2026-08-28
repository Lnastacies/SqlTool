import { useCallback, useRef } from 'react'

/**
 * 返回引用稳定的事件函数，同时始终调用最新处理器。
 * 用于避免父组件渲染时产生的新回调破坏子组件记忆化。
 */
export function useStableEvent<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  return useCallback(
    (...args: TArgs) => handlerRef.current(...args),
    [],
  )
}
