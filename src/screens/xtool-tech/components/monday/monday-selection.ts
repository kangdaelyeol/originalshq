import { createContext, useContext } from 'react'
import type { TechBoardKey } from '@xtool-core/tech-boards'

// Monday 표의 줄 선택(체크박스) — 보드 화면과 내 업무(여러 보드)가 같이 쓴다. 열쇠는
// "보드:항목 id". 선택 막대(monday-selection-bar.tsx)가 이걸 보고 이동·삭제를 한다.

export const selectionKey = (boardKey: TechBoardKey, itemId: string): string => `${boardKey}:${itemId}`

export interface SelectionState {
  selected: ReadonlySet<string>
  /** 켜거나 끄기 — 여러 개를 한 번에(그룹 전체 선택) */
  set: (boardKey: TechBoardKey, itemIds: string[], on: boolean) => void
  /** 빼기 — 지운 뒤 */
  remove: (keys: string[]) => void
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
