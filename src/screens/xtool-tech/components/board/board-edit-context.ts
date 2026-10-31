import { createContext, useContext } from 'react'
import type { TechBoardKey, TechBoardMeta } from '../../data/tech-boards'

export interface BoardEditState {
  boardKey: TechBoardKey
  meta: TechBoardMeta
  /** 편집 패널 열기 — itemId가 null이면 새로 만들기. */
  openEditor: (itemId: string | null) => void
}

/** 보드 화면(BoardPage)이 주는 편집 도구 — 상세 패널의 "수정", 표의 "새로 만들기"가 쓴다. */
export const BoardEditContext = createContext<BoardEditState | null>(null)

export const useBoardEdit = (): BoardEditState | null => useContext(BoardEditContext)
