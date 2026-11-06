import { useSyncExternalStore } from 'react'

const REDUCE = '(prefers-reduced-motion: reduce)'
const subscribe = (cb: () => void) => {
  const mq = matchMedia(REDUCE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const snapshot = () => matchMedia(REDUCE).matches

/** 움직임 줄이기 설정이면 true — 둘러보기가 꺼진 채 시작하고 앱은 움직임 없이 끝 모습으로 놓인다 */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
