import { CloudOff, LoaderCircle } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { BoardEditContext, type BoardEditState } from '../components/board/board-edit-context'
import { BoardHeader } from '../components/board/board-header'
import { ItemEditor } from '../components/board/item-editor'
import { GlassCard } from '../components/ui/glass-card'
import { BOARD_TABS, type TechBoardDoc } from '../data/tech-boards'
import { useTechBoard } from '../data/tech-boards-store'
import { XT_BASE } from '../paths'
import { AsRequestsBoard } from './boards/as-requests-board'
import { FieldServiceBoard } from './boards/field-service-board'
import { InquiryBoard } from './boards/inquiry-board'
import { PartsBoard } from './boards/parts-board'
import { RecordsBoard } from './boards/records-board'
import { RentalsBoard } from './boards/rentals-board'
import { SerialsBoard } from './boards/serials-board'
import { RepairBoard } from './boards/repair-board'
import { TaskBoard } from './boards/task-board'

/** /xtool-tech/boards/:board — 사이드바 메뉴(개요 아래)로 오는 기술지원팀 보드 화면. */
export function BoardPage() {
  const { board: slug } = useParams()
  const tab = BOARD_TABS.find((t) => t.slug === slug)
  if (!tab) return <Navigate to={XT_BASE} replace />
  return <BoardScreen tabKey={tab.key} label={tab.label} />
}

function BoardScreen({ tabKey, label }: { tabKey: (typeof BOARD_TABS)[number]['key']; label: string }) {
  const state = useTechBoard(tabKey)
  // 편집 패널 — itemId가 null이면 새로 만들기, editing 자체가 null이면 닫힘.
  const [editing, setEditing] = useState<{ itemId: string | null } | null>(null)
  const openEditor = useCallback((itemId: string | null) => setEditing({ itemId }), [])
  const closeEditor = useCallback(() => setEditing(null), [])
  const meta = state.meta
  const itemsById = state.itemsById
  const itemOf = useCallback((itemId: string) => itemsById.get(itemId), [itemsById])
  const editContext = useMemo<BoardEditState | null>(
    () => (meta ? { boardKey: tabKey, meta, openEditor, itemOf } : null),
    [meta, tabKey, openEditor, itemOf],
  )

  if (state.error && !state.board) {
    return (
      <GlassCard className="empty">
        <span className="empty__icon" aria-hidden>
          <CloudOff size={22} />
        </span>
        <h1 className="empty__title">보드를 불러오지 못했어요</h1>
        <p className="empty__text">{state.error}</p>
      </GlassCard>
    )
  }
  if (state.metaLoaded && !state.meta) {
    return (
      <GlassCard className="empty">
        <h1 className="empty__title">{label} 보드가 아직 동기화되지 않았어요</h1>
        <p className="empty__text">관리자 화면의 "지금 동기화"나 정기 동기화(하루 여섯 번)가 한 번 돌고 나면 여기에 보여요.</p>
      </GlassCard>
    )
  }
  if (!state.board || !editContext) {
    return (
      <GlassCard className="empty">
        <LoaderCircle size={22} className="is-spinning" aria-hidden />
        <p className="empty__text">{label} 보드를 불러오는 중…</p>
      </GlassCard>
    )
  }

  const doc = state.board
  const editingItem = editing?.itemId ? (state.itemsById.get(editing.itemId) ?? null) : null
  return (
    <BoardEditContext.Provider value={editContext}>
      <BoardHeader doc={doc} />
      {tabKey === 'fieldService' && <FieldServiceBoard doc={doc as TechBoardDoc<'fieldService'>} />}
      {tabKey === 'repair' && <RepairBoard doc={doc as TechBoardDoc<'repair'>} />}
      {tabKey === 'records' && <RecordsBoard doc={doc as TechBoardDoc<'records'>} />}
      {tabKey === 'techInquiry' && <InquiryBoard doc={doc as TechBoardDoc<'techInquiry'>} />}
      {tabKey === 'techTask' && <TaskBoard doc={doc as TechBoardDoc<'techTask'>} />}
      {tabKey === 'asRequests' && <AsRequestsBoard doc={doc as TechBoardDoc<'asRequests'>} />}
      {tabKey === 'parts' && <PartsBoard doc={doc as TechBoardDoc<'parts'>} />}
      {tabKey === 'rentals' && <RentalsBoard doc={doc as TechBoardDoc<'rentals'>} />}
      {tabKey === 'serials' && <SerialsBoard doc={doc as TechBoardDoc<'serials'>} />}
      <ItemEditor
        open={editing !== null}
        boardKey={tabKey}
        meta={editContext.meta}
        item={editingItem}
        onClose={closeEditor}
      />
    </BoardEditContext.Provider>
  )
}
