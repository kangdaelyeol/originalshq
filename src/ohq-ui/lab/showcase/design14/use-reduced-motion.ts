import { useSyncExternalStore } from 'react'

const REDUCE = '(prefers-reduced-motion: reduce)'
const subscribe = (cb: () => void) => {
  const mq = matchMedia(REDUCE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const snapshot = () => matchMedia(REDUCE).matches

/** "동작 줄이기"면 true — 장면이 돌지 않고 신호가 멈추고, 자동 둘러보기가 꺼진 채 시작한다 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
