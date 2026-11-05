import type { FieldServiceRecord, InquiryRecord, RepairRecord } from './tech-boards'
import { isDone, isNew, splitNames } from './tech-stage'
import { addDays, isoToKoreaDate, koreaToday } from './dates'

// 기술팀 왕 — xtool-lead-manager 통계 탭 "기술 통계"의 왕과 같은 기준(그쪽 utils/tech-stats.ts).
//   · AS왕(출장업무): 방문을 마친 출장 — 방문일(없으면 마지막 수정일)
//   · 수리왕(AS): 수리를 마친 AS — 완료일(없으면 마지막 수정일)
//   · 아톡처리왕(아톡문의): 손댄(신규 접수를 벗어난) 문의 — 접수일
// 담당자가 둘이면 둘 다 1건. 많은 순, 같으면 이름 순.

export type KingId = 'field' | 'repair' | 'inquiry'
export type KingSpan = 'week' | 'month'

export interface KingDef {
  id: KingId
  title: string
  board: string
  desc: string
  dateLabel: string
}

export const KINGS: readonly KingDef[] = [
  { id: 'field', title: 'AS왕', board: '출장업무', desc: '방문(설치·점검)을 마친 출장 · 방문일 기준', dateLabel: '방문' },
  { id: 'repair', title: '수리왕', board: 'AS', desc: '수리를 마친 AS · 완료일 기준', dateLabel: '완료' },
  { id: 'inquiry', title: '아톡처리왕', board: '아톡문의', desc: '처리한(신규 접수 아닌) 문의 · 접수일 기준', dateLabel: '접수' },
]

export interface KingPeriod {
  start: string
  end: string
}

const dayOfWeek = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

/** 이번 주(일~토)·이번 달 — 한국 날짜 기준 */
export function kingPeriod(span: KingSpan, today = koreaToday()): KingPeriod {
  if (span === 'week') {
    const start = addDays(today, -dayOfWeek(today))
    return { start, end: addDays(start, 6) }
  }
  const [y, m] = today.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}` }
}

/** 바로 앞 기간 — 지난주·지난달 */
export function previousKingPeriod(span: KingSpan, period: KingPeriod): KingPeriod {
  if (span === 'week') return { start: addDays(period.start, -7), end: addDays(period.start, -1) }
  return kingPeriod('month', addDays(period.start, -1))
}

export interface KingFact {
  itemId: string
  name: string
  date: string
  assignees: string[]
}

export interface KingSources {
  fieldService: FieldServiceRecord[] | null
  repair: RepairRecord[] | null
  techInquiry: InquiryRecord[] | null
}

/** 그 왕의 실적으로 세는 기록 — 기준 날짜와 담당자 */
export function kingFacts(id: KingId, sources: KingSources): KingFact[] | null {
  const fact = (r: { itemId: string; name: string; assignee: string | null }, date: string | null) =>
    date ? [{ itemId: r.itemId, name: r.name, date, assignees: splitNames(r.assignee) }] : []
  switch (id) {
    case 'field':
      return sources.fieldService?.filter(isDone).flatMap((r) => fact(r, r.visitAt ?? isoToKoreaDate(r.updatedAt))) ?? null
    case 'repair':
      return sources.repair?.filter(isDone).flatMap((r) => fact(r, r.completedAt ?? isoToKoreaDate(r.updatedAt))) ?? null
    case 'inquiry':
      return sources.techInquiry?.filter((r) => !isNew(r)).flatMap((r) => fact(r, r.receivedAt ?? isoToKoreaDate(r.createdAt))) ?? null
  }
}

export interface KingRow {
  name: string
  count: number
  facts: KingFact[]
}

export interface KingResult {
  /** 기록 수(둘이 같이 한 건도 1건) */
  total: number
  /** 담당자가 비어 있는 기록 — 누구의 실적에도 안 들어간다 */
  unassigned: number
  rows: KingRow[]
}

const within = (date: string, period: KingPeriod) => date >= period.start && date <= period.end

/** 기간 안의 실적을 담당자별로 */
export function rankKing(facts: KingFact[], period: KingPeriod): KingResult {
  const byName = new Map<string, KingRow>()
  let total = 0
  let unassigned = 0
  for (const fact of facts) {
    if (!within(fact.date, period)) continue
    total += 1
    if (fact.assignees.length === 0) unassigned += 1
    for (const name of fact.assignees) {
      const row = byName.get(name) ?? { name, count: 0, facts: [] }
      row.count += 1
      row.facts.push(fact)
      byName.set(name, row)
    }
  }
  const rows = [...byName.values()]
    .map((row) => ({ ...row, facts: [...row.facts].sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'))
  return { total, unassigned, rows }
}
