import { useSyncExternalStore } from 'react'
import { useLayoutKind } from './layout-kind'

// Monday 표에서 개요 보드를 보일지(설정 > 레이아웃) — 이 브라우저에 기억하고, 처음엔 숨긴다. 숨기면 사이드바에서
// 빠지고 개요 주소(/xtool-tech)는 내 업무로 연다. 대시보드 구조에서는 늘 보인다.

const KEY = 'xtool-tech:monday-overview'

const read = (): boolean => {
  try {
    return window.localStorage.getItem(KEY) === 'show'
  } catch {
    return false
  }
}

let shown = read()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setMondayOverviewShown(next: boolean): void {
  shown = next
  try {
    window.localStorage.setItem(KEY, next ? 'show' : 'hide')
  } catch {
    /* 저장소를 못 쓰면 이번 방문 동안만 */
  }
  listeners.forEach((listener) => listener())
}

/** Monday 표에서 개요를 보이게 골랐는지 */
export function useMondayOverviewShown(): boolean {
  return useSyncExternalStore(subscribe, () => shown)
}

/** 지금 개요가 숨겨졌는지 — Monday 표이고 보이게 고르지 않았으면 */
export function useOverviewHidden(): boolean {
  const { structure } = useLayoutKind()
  const mondayShown = useMondayOverviewShown()
  return structure === 'table' && !mondayShown
}
