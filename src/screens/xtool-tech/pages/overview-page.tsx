import { useMemo } from 'react'
import { AttentionRow, KingCard, TeamCard } from '../components/layout-parts'
import { MyWorkCard } from '../components/overview/my-work-card'
import { ScheduleCard } from '../components/overview/schedule-card'
import { buildAttention } from '../data/attention'
import { buildTeamStatus } from '../data/team-status'
import type {
  AsRequestRecord,
  DocTaskRecord,
  FieldServiceRecord,
  InquiryRecord,
  PartRecord,
  RentalRecord,
  RepairRecord,
  TaskRecord,
} from '../data/tech-boards'
import { useTechBoard } from '../data/tech-boards-store'
import {
  kingFacts,
  kingPeriod,
  KINGS,
  previousKingPeriod,
  rankKing,
  type KingSources,
  type KingSpan,
} from '../data/tech-kings'
import { useTechMembers } from '../data/tech-members'
import { useMyIdentity } from '../data/use-my-work'
import { koreaToday, shortDate } from '../lib/dates'

const SPANS: readonly { span: KingSpan; label: string; previous: string }[] = [
  { span: 'week', label: '이번 주', previous: '지난주' },
  { span: 'month', label: '이번 달', previous: '지난달' },
]

/**
 * 개요 — 위에서부터 나의 진행 중 업무 · 오늘·이번 주 일정(나란히), 챙겨야 할 것, 기술팀 왕, 팀 현황.
 * 기술팀 왕(xtool-lead-manager 통계 탭 "기술 통계"와 같은
 * 기준: 이번 주(일~토)·이번 달 두 줄에 AS왕·수리왕·아톡처리왕).
 */
export function OverviewPage() {
  const field = useTechBoard('fieldService')
  const repair = useTechBoard('repair')
  const inquiry = useTechBoard('techInquiry')
  const task = useTechBoard('techTask')
  const docs = useTechBoard('records')
  const rentals = useTechBoard('rentals')
  const parts = useTechBoard('parts')
  const requests = useTechBoard('asRequests')
  const { names: myNames } = useMyIdentity()

  const sources: KingSources = {
    fieldService: (field.board?.records as FieldServiceRecord[] | undefined) ?? null,
    repair: (repair.board?.records as RepairRecord[] | undefined) ?? null,
    techInquiry: (inquiry.board?.records as InquiryRecord[] | undefined) ?? null,
  }
  const factsById = useMemo(
    () => Object.fromEntries(KINGS.map((def) => [def.id, kingFacts(def.id, sources)])),
    // 보드 기록이 바뀔 때만 다시 센다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [field.board, repair.board, inquiry.board],
  )

  const today = koreaToday()
  const taskRecords = (task.board?.records as TaskRecord[] | undefined) ?? null
  const docRecords = (docs.board?.records as DocTaskRecord[] | undefined) ?? null
  const rentalRecords = (rentals.board?.records as RentalRecord[] | undefined) ?? null
  const attention = buildAttention(
    {
      ...sources,
      techTask: taskRecords,
      rentals: rentalRecords,
      parts: (parts.board?.records as PartRecord[] | undefined) ?? null,
      asRequests: (requests.board?.records as AsRequestRecord[] | undefined) ?? null,
    },
    today,
  )
  // 팀 현황은 기술팀으로 등록한 사람만(명단을 못 읽었으면 최근 담당자로)
  const roster = useTechMembers()
  const team = buildTeamStatus(
    { ...sources, techTask: taskRecords, records: docRecords },
    today,
    roster?.map((m) => m.name).filter(Boolean) ?? null,
  )
  const loadingAll = [field, repair, inquiry, task, docs, rentals, parts, requests].some((b) => !b.board && !b.error)

  return (
    <div className="overview-layout">
      <div className="grid overview-top">
        <MyWorkCard
          names={myNames}
          loading={[field, repair, inquiry, task, docs].some((b) => !b.board && !b.error)}
          sources={{
            fieldService: sources.fieldService,
            repair: sources.repair,
            techInquiry: sources.techInquiry,
            techTask: (task.board?.records as TaskRecord[] | undefined) ?? null,
            records: (docs.board?.records as DocTaskRecord[] | undefined) ?? null,
          }}
        />
        <ScheduleCard
          myNames={myNames}
          loading={[field, task, rentals].some((b) => !b.board && !b.error)}
          sources={{
            fieldService: sources.fieldService,
            techTask: (task.board?.records as TaskRecord[] | undefined) ?? null,
            rentals: (rentals.board?.records as RentalRecord[] | undefined) ?? null,
          }}
        />
      </div>

      <div className="overview-main">
        <AttentionRow tiles={attention} loading={loadingAll} />

        {SPANS.map(({ span, label, previous }) => {
          const period = kingPeriod(span)
          const before = previousKingPeriod(span, period)
          return (
            <section key={span} className="king-section" aria-label={`${label} 기술팀 왕`}>
              <h2 className="king-section__title">
                {label} 기술팀 왕
                <span>
                  {shortDate(period.start)} ~ {shortDate(period.end)}
                </span>
              </h2>
              <div className="grid king-grid">
                {KINGS.map((def) => {
                  const facts = factsById[def.id]
                  return (
                    <KingCard
                      key={def.id}
                      def={def}
                      spanLabel={label}
                      previousLabel={previous}
                      period={period}
                      result={facts ? rankKing(facts, period) : null}
                      previousTop={facts ? (rankKing(facts, before).rows[0] ?? null) : null}
                    />
                  )
                })}
              </div>
            </section>
          )
        })}

        <TeamCard members={team} me={myNames} loading={loadingAll} />
      </div>
    </div>
  )
}
