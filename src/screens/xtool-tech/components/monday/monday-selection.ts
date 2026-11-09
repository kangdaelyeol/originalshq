import { createContext, useContext } from 'react'
import type { TechBoardKey } from '@xtool-core/tech-boards'

// Monday 표의 줄 선택(체크박스) — 보드 화면과 내 업무(여러 보드)가 같이 쓴다. 열쇠는
// "보드:항목 id". 선택 막대(monday-selection-bar.tsx)가 이걸 보고 이동·삭제를 한다. 하위 아이템도 고를 수 있다
// (열쇠 "보드:항목 id:하위 아이템 id" — 지우기만).

export const selectionKey = (boardKey: TechBoardKey, itemId: string): string => `${boardKey}:${itemId}`

/** 하위 아이템 선택 열쇠 — itemId는 Monday 항목 id(지울 때 editItem에 넘긴다) */
export const subSelectionKey = (boardKey: TechBoardKey, itemId: string, subId: string): string =>
  `${boardKey}:${itemId}:${subId}`

export interface SelectionState {
  selected: ReadonlySet<string>
  /** 켜거나 끄기 — 여러 개를 한 번에(그룹 전체 선택) */
  set: (boardKey: TechBoardKey, itemIds: string[], on: boolean) => void
  /** 빼기 — 지운 뒤 */
  remove: (keys: string[]) => void
  /** 고른 하위 아이템(subSelectionKey) */
  subSelected: ReadonlySet<string>
  /** 하위 아이템 켜거나 끄기 — 한 항목 안의 여러 줄을 한 번에(하위 표 머리글 체크) */
  setSubs: (boardKey: TechBoardKey, itemId: string, subIds: string[], on: boolean) => void
  /** 그 항목의 고른 하위 아이템 중 live에 없는 것을 뺀다 — 지워졌거나 하위 표를 접었을 때(live = []) */
  keepSubs: (boardKey: TechBoardKey, itemId: string, live: readonly string[]) => void
  /** 모두 풀기(항목·하위 아이템) */
  clear: () => void
}

export const SelectionContext = createContext<SelectionState | null>(null)

export const useSelection = (): SelectionState | null => useContext(SelectionContext)

/** 선택된 것을 보드별로 — { boardKey: [itemId…] } */
export function selectedByBoard(selected: ReadonlySet<string>): Map<TechBoardKey, string[]> {
  const byBoard = new Map<TechBoardKey, string[]>()
  for (const key of selected) {
    const [board, itemId] = key.split(':') as [TechBoardKey, string]
    byBoard.set(board, [...(byBoard.get(board) ?? []), itemId])
  }
  return byBoard
}

/** 고른 하위 아이템을 항목별로 — "보드:항목 id" → { boardKey, itemId, subIds } */
export function subSelectedByItem(
  subSelected: ReadonlySet<string>,
): Map<string, { boardKey: TechBoardKey; itemId: string; subIds: string[] }> {
  const byItem = new Map<string, { boardKey: TechBoardKey; itemId: string; subIds: string[] }>()
  for (const key of subSelected) {
    const first = key.indexOf(':')
    const second = key.indexOf(':', first + 1)
    const boardKey = key.slice(0, first) as TechBoardKey
    const itemId = key.slice(first + 1, second)
    const parent = selectionKey(boardKey, itemId)
    const entry = byItem.get(parent) ?? { boardKey, itemId, subIds: [] }
    entry.subIds.push(key.slice(second + 1))
    byItem.set(parent, entry)
  }
  return byItem
}
