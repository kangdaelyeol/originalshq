import { useState } from 'react'
import type { TechBoardKey } from '@xtool-core/tech-boards'
import { deleteItems, moveItems } from '@xtool-core/tech-outbox'

// 고른 줄 옮기기·지우기 — 대시보드·물 고르기 막대와 Monday 표 선택 막대가 같이 쓴다. 막대마다 모양만 다르고
// 하는 일은 여기 하나: 진행 단계(그룹) 옮기기(한 보드만 골랐을 때), 확인을 받고 Monday 휴지통으로 지우기, 그 뒤
// 선택 풀기(세 레이아웃 모두 옮기거나 지우면 푼다). 옮기기·지우기는 표에 바로 보이고 Monday에는
// 뒤에서 쓴다(저장 대기열 — 실패하면 토스트, 지운 줄은 다시 보인다). 확인 문구는 DELETE_CONFIRM_MESSAGE(record-selection.ts).

interface SelectionActionsOptions {
  /** 고른 항목을 보드별로 — { boardKey: [itemId…] }. 표 하나(대시보드·물)면 그 보드 하나 */
  byBoard: ReadonlyMap<TechBoardKey, string[]>
  /** 선택 풀기 */
  clear: () => void
}

export interface SelectionActions {
  /** 고른 수 */
  count: number
  /** 옮길 보드 — 한 보드에서만 골랐을 때. 여러 보드면 null(옮기기 없음) */
  moveBoard: TechBoardKey | null
  /** 이동 메뉴를 연 단추 — null이면 닫혀 있다 */
  moveAnchor: HTMLElement | null
  /** 이동 메뉴 열고 닫기 — 누른 단추에 붙인다 */
  toggleMove: (anchor: HTMLElement) => void
  closeMove: () => void
  /** 고른 것을 모두 그 그룹(진행 단계)으로 옮긴다 */
  move: (groupId: string) => void
  /** 지울지 묻는 중 */
  confirming: boolean
  askDelete: () => void
  cancelDelete: () => void
  /** 확인 — 고른 것을 모두 지우고 선택을 푼다 */
  confirmDelete: () => void
}

export function useSelectionActions({ byBoard, clear }: SelectionActionsOptions): SelectionActions {
  const [moveAnchor, setMoveAnchor] = useState<HTMLElement | null>(null)
  const [confirming, setConfirming] = useState(false)
  const boards = [...byBoard.keys()]
  const moveBoard = boards.length === 1 ? boards[0] : null
  let count = 0
  for (const ids of byBoard.values()) count += ids.length

  return {
    count,
    moveBoard,
    moveAnchor,
    toggleMove: (anchor) => setMoveAnchor(moveAnchor ? null : anchor),
    closeMove: () => setMoveAnchor(null),
    move: (groupId) => {
      setMoveAnchor(null)
      if (!moveBoard) return
      // 새 그룹에 바로 보이고, 실패한 것은 원래 그룹으로 돌아간다.
      moveItems(moveBoard, byBoard.get(moveBoard) ?? [], groupId)
      clear()
    },
    confirming,
    askDelete: () => setConfirming(true),
    cancelDelete: () => setConfirming(false),
    confirmDelete: () => {
      setConfirming(false)
      // 표에서 바로 빠진다 — 실패한 것은 다시 보인다(선택은 풀린 채로).
      for (const [boardKey, ids] of byBoard) deleteItems(boardKey, ids)
      clear()
    },
  }
}
