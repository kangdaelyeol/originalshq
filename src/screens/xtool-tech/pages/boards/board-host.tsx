import { ArrowUpRight } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BoardEditContext, type BoardEditState } from '../../components/board/board-edit-context'
import { ItemEditor } from '../../components/board/item-editor'
import { BOARD_TABS, type TechBoardKey, type TechBoardMeta, type TechItemDoc } from '@xtool-core/tech-boards'
import { useTechBoard } from '@xtool-core/tech-boards-store'
import { xtPath } from '../../paths'
import { boardDef } from './registry'

interface BoardEditHostProps {
  boardKey: TechBoardKey
  meta: TechBoardMeta
  /** 캐시의 항목 원본(칸 값·파일 목록) — 서랍의 파일·업데이트 수, 편집 패널의 처음 값 */
  itemsById: ReadonlyMap<string, TechItemDoc>
  children: ReactNode
}

/**
 * 보드 하나의 편집 도구 — 아래에 BoardEditContext(보드 키·칸 정보·편집 패널 열기·항목 원본)를 주고 편집 패널
 * (ItemEditor)을 그린다. 상세 서랍의 "수정"과 표의 "새로 만들기"가 이 패널을 연다. 보드 화면(BoardScreen)과
 * 내 업무의 상세 서랍(BoardItemHost)이 같이 쓴다.
 */
export function BoardEditHost({ boardKey, meta, itemsById, children }: BoardEditHostProps) {
  // 편집 패널 — itemId가 null이면 새로 만들기, editing 자체가 null이면 닫힘.
  const [editing, setEditing] = useState<{ itemId: string | null } | null>(null)
  const openEditor = useCallback((itemId: string | null) => setEditing({ itemId }), [])
  const closeEditor = useCallback(() => setEditing(null), [])
  const itemOf = useCallback((itemId: string) => itemsById.get(itemId), [itemsById])
  const value = useMemo<BoardEditState>(() => ({ boardKey, meta, openEditor, itemOf }), [boardKey, meta, openEditor, itemOf])
  const editingItem = editing?.itemId ? (itemsById.get(editing.itemId) ?? null) : null
  return (
    <BoardEditContext.Provider value={value}>
      {children}
      <ItemEditor open={editing !== null} boardKey={boardKey} meta={meta} item={editingItem} onClose={closeEditor} />
    </BoardEditContext.Provider>
  )
}

interface BoardItemHostProps {
  boardKey: TechBoardKey
  /** 열 항목 — null이면 서랍이 닫힌다(닫히는 움직임이 끝나게 이 자리는 그대로 둔다). */
  itemId: string | null
  onClose: () => void
}

/**
 * 보드 화면 밖(내 업무)에서 항목 하나를 그 자리에서 연다 — 그 보드를 구독해 보드 화면과 같은 상세 서랍(정보·업데이트
 * 탭·파일·수정·삭제)을 그리고, 이름 위 보드 이름을 그 보드로 가는 링크로 바꾼다(어느 탭에서나 보인다). 서랍·편집
 * 패널은 레이아웃 부품이라 물이면 물로 나온다.
 */
export function BoardItemHost({ boardKey, itemId, onClose }: BoardItemHostProps) {
  const state = useTechBoard(boardKey)
  if (!state.board || !state.meta) return null
  const { Drawer } = boardDef(boardKey)
  return (
    <BoardEditHost boardKey={boardKey} meta={state.meta} itemsById={state.itemsById}>
      <Drawer
        doc={state.board}
        selectedId={itemId}
        onClose={onClose}
        eyebrow={itemId ? <BoardLink boardKey={boardKey} itemId={itemId} name={state.board.name} /> : undefined}
      />
    </BoardEditHost>
  )
}

/** 서랍 이름 위 보드 이름 — 누르면 그 보드 화면으로, 같은 항목의 서랍이 열린 채로 간다(뒤로 가면 내 업무). */
function BoardLink({ boardKey, itemId, name }: { boardKey: TechBoardKey; itemId: string; name: string }) {
  const tab = BOARD_TABS.find((t) => t.key === boardKey)
  if (!tab) return name
  const to = `${xtPath(`/boards/${tab.slug}`)}?item=${encodeURIComponent(itemId)}`
  return (
    <Link to={to} className="drawer-board-link" title={`${tab.label} 보드에서 보기`}>
      {name}
      <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden />
    </Link>
  )
}
