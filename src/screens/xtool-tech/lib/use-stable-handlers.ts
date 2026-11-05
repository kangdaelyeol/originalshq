import { useLayoutEffect, useMemo, useRef } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 인자 모양은 넘긴 핸들러 그대로 둔다
type Handler = (...args: any[]) => unknown

/**
 * 늘 같은 함수로 최신 핸들러를 부른다 — memo로 감싼 줄(Monday 표 ItemRow)에 넘겨도, 렌더마다 새로 만든 핸들러
 * 때문에 모든 줄이 다시 그려지지 않게. 부르는 때(클릭 등)에는 마지막 렌더의 핸들러가 불린다. null인 핸들러는
 * null로 둔다(줄이 단추를 그릴지 본다) — 있고 없음이 바뀌면 새 묶음을 준다.
 */
export function useStableHandlers<T extends Record<string, Handler | null | undefined>>(handlers: T): T {
  const latest = useRef(handlers)
  useLayoutEffect(() => {
    latest.current = handlers
  })
  const present = Object.keys(handlers)
    .filter((key) => handlers[key])
    .join(',')
  return useMemo(() => {
    const stable: Record<string, Handler | null> = {}
    for (const key of present.split(',')) {
      if (key) stable[key] = (...args: unknown[]) => latest.current[key]?.(...args)
    }
    for (const key of Object.keys(handlers)) if (!(key in stable)) stable[key] = null
    return stable as T
    // 있는 핸들러 목록(present)이 같으면 같은 묶음 — 핸들러 자체는 latest로 부른다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present])
}
