import { useMemo } from 'react'
import { KingCard } from '../components/overview/king-card'
import type { FieldServiceRecord, InquiryRecord, RepairRecord } from '../data/tech-boards'
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
import { shortDate } from '../lib/dates'

const SPANS: readonly { span: KingSpan; label: string; previous: string }[] = [
  { span: 'week', label: '이번 주', previous: '지난주' },
  { span: 'month', label: '이번 달', previous: '지난달' },
]

/**
 * 개요 — 기술팀 왕(xtool-lead-manager 통계 탭 "기술 통계"와 같은 기준). 이번 주(일~토)·이번 달
 * 두 줄에 AS왕·수리왕·아톡처리왕. 상단 기간 선택과는 무관하다.
 */
export function OverviewPage() {
  const field = useTechBoard('fieldService')
  const repair = useTechBoard('repair')
  const inquiry = useTechBoard('techInquiry')

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

  return (
    <>
      {SPANS.map(({ span, label, previous }) => {
        const period = kingPeriod(span)
        const before = previousKingPeriod(span, period)
        return (
          <section key={span} className="king-section" aria-label={`${label} 기술팀 왕`}>
            <h2 className="king-section__title">
              {label} 기술팀 왕
              <span>
                {shortDate(period.start)} ~ {shortDate(period.end)} · 담당자가 둘이면 둘 다 1건 · 줄을 누르면 센 기록
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
    </>
  )
}
