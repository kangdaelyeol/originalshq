import { useSyncExternalStore } from 'react'

// 저장이 끝나기 전에 먼저 보여 줄 것 — 지우는 중인 항목(표에서 숨김)과 그룹을 옮기는 중인 항목(새
// 그룹에 보임). 선택 막대·표·내 업무가 같이 본다. 열쇠는 "보드:항목 id"(selectionKey).
// 실패하면 바로 떼서 원래대로 돌아가고, 성공하면 실시간 구독으로 같은 모양이 오니 잠시 뒤 뗀다.

// 성공한 뒤 먼저 보여 준 모양을 지키는 시간 — 그 사이 캐시가 바뀐 값으로 온다.
const KEEP_MS = 4000

interface Optimistic {
  hidden: ReadonlySet<string>
  moved: ReadonlyMap<string, string>
}

let state: Optimistic = { hidden: new Set(), moved: new Map() }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 숨기기(지우는 중) 켜고 끄기 */
export function setHidden(keys: string[], on: boolean): void {
  const hidden = new Set(state.hidden)
  for (const key of keys) {
    if (on) hidden.add(key)
    else hidden.delete(key)
  }
  state = { ...state, hidden }
  emit()
}

/** 그룹 옮기기(옮기는 중) — groupId가 null이면 뗀다. */
export function setMoved(keys: string[], groupId: string | null): void {
  const moved = new Map(state.moved)
  for (const key of keys) {
    if (groupId) moved.set(key, groupId)
    else moved.delete(key)
  }
  state = { ...state, moved }
  emit()
}

/** 성공한 것은 잠시 뒤에 뗀다(캐시가 바뀐 값으로 올 시간). */
export const releaseLater = (release: () => void): void => {
  setTimeout(release, KEEP_MS)
}

export const useOptimistic = (): Optimistic => useSyncExternalStore(subscribe, () => state)
