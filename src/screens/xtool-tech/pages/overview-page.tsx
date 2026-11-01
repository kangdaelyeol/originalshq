import { useMemo } from 'react'
import { AttentionRow } from '../components/overview/attention-row'
import { KingCard } from '../components/overview/king-card'
import { MyWorkCard } from '../components/overview/my-work-card'
import { ScheduleCard } from '../components/overview/schedule-card'
import { TeamCard } from '../components/overview/team-card'
import { useCurrentMember } from '../context/member-context'
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
import { useMondayUsers, useTechBoard } from '../data/tech-boards-store'
import {
  kingFacts,
  kingPeriod,
  KINGS,
  previousKingPeriod,
  rankKing,
  type KingSources,
  type KingSpan,
} from '../data/tech-kings'
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
  const member = useCurrentMember()
  const users = useMondayUsers()

  // 나 — Monday 담당자 칸의 이름으로 찾는다. 구성원 이메일로 Monday 사용자를 찾아 그 이름을 쓰고,
  // 못 찾으면 구성원 이름으로 대신한다.
  const mondayMe = member ? users?.find((u) => u.email.toLowerCase() === member.email.toLowerCase()) : undefined
  const myNames = useMemo(
    () => new Set([mondayMe?.name, member?.name].filter((n): n is string => !!n)),
    [mondayMe?.name, member?.name],
  )

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
  const team = buildTeamStatus({ ...sources, techTask: taskRecords, records: docRecords }, today)
  const loadingAll = [field, repair, inquiry, task, docs, rentals, parts, requests].some((b) => !b.board && !b.error)

  return (
    <>
      <div className="grid overview-top">
        <MyWorkCard
          names={myNames}
            linked={!!mondayMe}
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
    </>
  )
}
