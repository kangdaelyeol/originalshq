import { CloudOff, LoaderCircle } from 'lucide-react'
import { Navigate, useParams } from 'react-router-dom'
import { MondayBoard } from '../components/monday/monday-board'
import { MondayNumbers } from '../components/monday/monday-numbers'
import { MondayBoardSkeleton } from '../components/monday/monday-skeleton'
import { GlassCard } from '../components/layout-parts'
import { usePeriod } from '../context/period-context'
import { BOARD_TABS, type TechBoardDoc } from '../data/tech-boards'
import { useTechBoard } from '../data/tech-boards-store'
import { koreaToday } from '../lib/dates'
import { XT_BASE } from '../paths'
import { useAppearance } from '@/ohq-ui/appearance/appearance'
import { AsRequestsBoard } from './boards/as-requests-board'
import { BoardEditHost } from './boards/board-host'
import { FieldServiceBoard } from './boards/field-service-board'
import { InquiryBoard } from './boards/inquiry-board'
import { PartsBoard } from './boards/parts-board'
import { RecordsBoard } from './boards/records-board'
import { boardDef } from './boards/registry'
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
  const { theme } = useAppearance()
  const { period } = usePeriod()

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
  if (!state.board || !state.meta) {
    // Monday 표는 표 모양 그대로 블록을 그려 둔다(스켈레톤).
    if (theme === 'monday') {
      return (
        <MondayBoardSkeleton
          boardKey={tabKey}
          meta={state.meta}
          summary={<MondayNumbers boardKey={tabKey} cards={[]} loading />}
        />
      )
    }
    return (
      <GlassCard className="empty">
        <LoaderCircle size={22} className="is-spinning" aria-hidden />
        <p className="empty__text">{label} 보드를 불러오는 중…</p>
      </GlassCard>
    )
  }

  const doc = state.board
  // 설정 > 레이아웃 "Monday 표" — 보드 칸·그룹을 Monday 그대로 늘어놓고 칸을 눌러 바로 고친다
  // (편집 패널 없이 — 파일은 파일 칸 모달, 업데이트는 말풍선 패널). 숫자 카드는 대시보드와 같은 정의를
  // 보기 탭 아래 요약 줄로 — 기간도 그 줄에서 고른다.
  if (theme === 'monday') {
    return (
      <MondayBoard
        boardKey={tabKey}
        meta={state.meta}
        items={state.items ?? []}
        summary={<MondayNumbers boardKey={tabKey} cards={boardDef(tabKey).kpis(doc, period, koreaToday())} />}
      />
    )
  }
  // 편집 도구(상세 서랍의 수정·삭제, 표의 새로 만들기)와 편집 패널은 BoardEditHost가 준다 — 내 업무 서랍과 같다.
  return (
    <BoardEditHost boardKey={tabKey} meta={state.meta} itemsById={state.itemsById}>
      {tabKey === 'fieldService' && <FieldServiceBoard doc={doc as TechBoardDoc<'fieldService'>} />}
      {tabKey === 'repair' && <RepairBoard doc={doc as TechBoardDoc<'repair'>} />}
      {tabKey === 'records' && <RecordsBoard doc={doc as TechBoardDoc<'records'>} />}
      {tabKey === 'techInquiry' && <InquiryBoard doc={doc as TechBoardDoc<'techInquiry'>} />}
      {tabKey === 'techTask' && <TaskBoard doc={doc as TechBoardDoc<'techTask'>} />}
      {tabKey === 'asRequests' && <AsRequestsBoard doc={doc as TechBoardDoc<'asRequests'>} />}
      {tabKey === 'parts' && <PartsBoard doc={doc as TechBoardDoc<'parts'>} />}
      {tabKey === 'rentals' && <RentalsBoard doc={doc as TechBoardDoc<'rentals'>} />}
      {tabKey === 'serials' && <SerialsBoard doc={doc as TechBoardDoc<'serials'>} />}
    </BoardEditHost>
  )
}
