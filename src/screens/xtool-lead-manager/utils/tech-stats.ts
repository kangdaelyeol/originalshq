import type {
  MondayDailyInflow,
  MondayTechFact,
  MondayTechKind,
} from '../entity'
import { daysBetween, median } from './calc'

// 기술 통계(통계 탭) — 기술지원팀 기록(출장·AS·기술 문의·기타업무)을 기간·
// 담당자별로 묶는다. 재료는 서버가 기록마다 한 줄씩 만들어 둔 것(getMondayTechFacts)
// 이고, 번호가 없어 고객에 묶이지 못한 기록도 들어 있다 — 일한 것은 일한 것이라.

/** 보드 종류를 화면에서 부르는 이름 — 그래프·표의 항목 이름이기도 하다. */
export const TECH_BOARD_LABEL: Record<MondayTechKind, string> = {
  fieldService: '출장',
  repair: 'AS',
  techInquiry: '아톡문의',
  techTask: '기타업무',
}

const TECH_KINDS = Object.keys(TECH_BOARD_LABEL) as MondayTechKind[]

/** 브라우저 날짜(한국 시간)를 YYYY-MM-DD로. */
const localISO = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface TechPeriod {
  start: string
  end: string
}

/** 이번 주 — 월요일부터 일요일까지(개인 KPI·CS팀 표의 주와 같다). */
export const thisTechWeek = (today = new Date()): TechPeriod => {
  const start = new Date(today)
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: localISO(start), end: localISO(end) }
}

/** 이번 달 — 1일부터 말일까지. */
export const thisTechMonth = (today = new Date()): TechPeriod => {
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return { start: localISO(start), end: localISO(end) }
}

/** 바로 앞 기간 — 지난주(월~일)·지난달. 이번 주·달이 막 시작해 비어 있을 때
 * 견줘 볼 1위를 보여 준다. */
export const previousTechPeriod = (
  period: TechPeriod,
  span: 'week' | 'month',
): TechPeriod => {
  const start = new Date(`${period.start}T00:00:00`)
  if (span === 'week') {
    start.setDate(start.getDate() - 7)
    return thisTechWeek(start)
  }
  start.setMonth(start.getMonth() - 1)
  return thisTechMonth(start)
}

const inPeriod = (date: string, period: TechPeriod) =>
  date !== '' && date >= period.start && date <= period.end

// ── 왕(담당자 순위) ──────────────────────────────────────────────────────

export type TechKingId = 'field' | 'repair' | 'inquiry'

export interface TechKingDef {
  id: TechKingId
  kind: MondayTechKind
  title: string
  desc: string
  /** 펼친 목록에서 굵게 보일 날짜의 이름. */
  dateLabel: string
}

/** 기술팀의 세 왕 — 출장(방문 AS)·AS(입고 수리)·아톡(기술 문의). */
export const TECH_KINGS: TechKingDef[] = [
  {
    id: 'field',
    kind: 'fieldService',
    title: 'AS왕',
    desc: '방문(설치·점검)을 마친 출장 · 방문일 기준',
    dateLabel: '방문',
  },
  {
    id: 'repair',
    kind: 'repair',
    title: '수리왕',
    desc: '수리를 마친 AS · 완료일 기준',
    dateLabel: '완료',
  },
  {
    id: 'inquiry',
    kind: 'techInquiry',
    title: '아톡처리왕',
    desc: '접수된 기술 문의 중 처리한(신규 접수 아닌) 건 · 접수일 기준',
    dateLabel: '접수',
  },
]

/** 그 왕의 실적으로 세는 기록이면 기준 날짜, 아니면 null. 출장·AS는 끝난
 * 것을 끝난 날에, 아톡은 손댄(신규 접수를 벗어난) 문의를 접수일에 센다 —
 * 인입통계 CS팀의 "인입 처리 수"와 같은 기준이다. */
const creditDate = (id: TechKingId, fact: MondayTechFact): string | null => {
  switch (id) {
    case 'field':
      return fact.kind === 'fieldService' && fact.done ? fact.doneAt : null
    case 'repair':
      return fact.kind === 'repair' && fact.done ? fact.doneAt : null
    case 'inquiry':
      return fact.kind === 'techInquiry' && !fact.isNew ? fact.receivedAt : null
  }
}

/** 순위 한 줄 — 담당자와 그 사람이 센 기록들(최근 순). */
export interface TechRankRow {
  name: string
  count: number
  facts: { fact: MondayTechFact; date: string }[]
}

export interface TechKing {
  def: TechKingDef
  period: TechPeriod
  /** 기록 수(둘이 같이 한 건도 1건). */
  total: number
  /** 담당자가 비어 있는 기록 수 — 누구의 실적에도 안 들어간다. */
  unassigned: number
  rows: TechRankRow[]
}

/** 기간 안의 실적을 담당자별로 — 담당자가 둘이면 둘 다 1건씩. 많은 순,
 * 같으면 이름 순. */
export const buildTechKing = (
  facts: MondayTechFact[],
  def: TechKingDef,
  period: TechPeriod,
): TechKing => {
  const byName = new Map<string, TechRankRow>()
  let total = 0
  let unassigned = 0
  for (const fact of facts) {
    const date = creditDate(def.id, fact)
    if (!date || !inPeriod(date, period)) continue
    total += 1
    if (fact.assignees.length === 0) unassigned += 1
    for (const name of fact.assignees) {
      const row = byName.get(name) ?? { name, count: 0, facts: [] }
      row.count += 1
      row.facts.push({ fact, date })
      byName.set(name, row)
    }
  }
  const rows = [...byName.values()]
    .map((row) => ({
      ...row,
      facts: row.facts.sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'))
  return { def, period, total, unassigned, rows }
}

// ── 기간 요약 ────────────────────────────────────────────────────────────

const zeroByKind = (): Record<MondayTechKind, number> => ({
  fieldService: 0,
  repair: 0,
  techInquiry: 0,
  techTask: 0,
})

export interface TechRangeSummary {
  /** 기간에 접수된 건수(기타업무는 요청일). */
  received: Record<MondayTechKind, number>
  /** 기간에 끝난 건수(끝난 날 기준). 아톡은 끝난 날을 적는 칸이 없어 마지막
   * 수정일이다. */
  done: Record<MondayTechKind, number>
  /** 기간에 접수된 기술 문의 중 처리한 것(아톡처리왕과 같은 기준). */
  inquiryHandled: number
  /** 기간에 끝난 AS의 부품·공임 청구액. */
  repairAmount: number
  /** 기간에 끝난 AS의 접수 → 완료 일수(중앙값) — 완료일이 비어 마지막
   * 수정일로 대신한 건은 뺀다. */
  repairDays: number | null
  /** 기간에 방문한 출장의 접수 → 방문 일수(중앙값). */
  fieldLeadDays: number | null
  /** 기간에 접수됐는데 번호가 없어 고객에 묶이지 못한 건(기타업무 제외 —
   * 내부 업무가 대부분이다). */
  unlinked: number
  /** 기간에 끝났는데 끝난 날이 비어 마지막 수정일로 센 건(아톡 제외). */
  guessed: number
}

export const summarizeTechRange = (
  facts: MondayTechFact[],
  period: TechPeriod,
): TechRangeSummary => {
  const received = zeroByKind()
  const done = zeroByKind()
  let inquiryHandled = 0
  let repairAmount = 0
  let unlinked = 0
  let guessed = 0
  const repairDays: number[] = []
  const fieldLeadDays: number[] = []

  for (const fact of facts) {
    if (inPeriod(fact.receivedAt, period)) {
      received[fact.kind] += 1
      if (fact.kind === 'techInquiry' && !fact.isNew) inquiryHandled += 1
      if (!fact.linked && fact.kind !== 'techTask') unlinked += 1
    }
    if (!fact.done || !inPeriod(fact.doneAt, period)) continue
    done[fact.kind] += 1
    if (fact.doneAtGuessed && fact.kind !== 'techInquiry') guessed += 1
    if (fact.kind === 'repair') {
      repairAmount += fact.amount
      if (fact.receivedAt && !fact.doneAtGuessed)
        repairDays.push(daysBetween(fact.receivedAt, fact.doneAt))
    }
    if (fact.kind === 'fieldService' && fact.receivedAt && fact.visitAt)
      fieldLeadDays.push(daysBetween(fact.receivedAt, fact.visitAt))
  }

  return {
    received,
    done,
    inquiryHandled,
    repairAmount,
    // 날짜를 거꾸로 적은 건(음수)은 오기입이라 뺀다.
    // 중앙값은 소수 첫째 자리까지.
    repairDays: median(
      repairDays.filter((days) => days >= 0),
      1,
    ),
    fieldLeadDays: median(
      fieldLeadDays.filter((days) => days >= 0),
      1,
    ),
    unlinked,
    guessed,
  }
}

// ── 기간별 추이 ──────────────────────────────────────────────────────────

/** 추이를 무엇으로 셀지 — 접수일 / 끝난 날. */
export type TechBasis = 'received' | 'done'

export const TECH_BASIS_LABEL: Record<TechBasis, string> = {
  received: '접수',
  done: '완료',
}

/** 날짜별 건수 — 인입통계와 같은 모양(MondayDailyInflow)으로 만들어 그
 * 그래프·추이 목록(inflowSeries 등)을 그대로 쓴다. 항목은 보드 종류. */
export const techDays = (
  facts: MondayTechFact[],
  basis: TechBasis,
): MondayDailyInflow[] => {
  const byDate = new Map<string, MondayDailyInflow>()
  for (const fact of facts) {
    const date =
      basis === 'received' ? fact.receivedAt : fact.done ? fact.doneAt : ''
    if (!date) continue
    const day = byDate.get(date) ?? {
      date,
      total: 0,
      misentry: 0,
      boards: {},
    }
    const label = TECH_BOARD_LABEL[fact.kind]
    day.total += 1
    day.boards[label] = (day.boards[label] ?? 0) + 1
    byDate.set(date, day)
  }
  return [...byDate.values()]
}

// ── 담당자별 ─────────────────────────────────────────────────────────────

export interface TechAssigneeRow {
  name: string
  /** 기간에 마친 출장·수리, 처리한 아톡 문의, 마친 기타업무. */
  field: number
  repair: number
  inquiry: number
  task: number
  total: number
}

export type TechAssigneeKey = Exclude<keyof TechAssigneeRow, 'name'>

/** 담당자별 기간 실적 — 세 왕과 같은 기준에 기타업무(완료일 기준)를 더한다.
 * 담당자가 없는 기록은 "담당자 없음" 한 줄로. */
export const buildTechAssignees = (
  facts: MondayTechFact[],
  period: TechPeriod,
): TechAssigneeRow[] => {
  const byName = new Map<string, TechAssigneeRow>()
  const add = (names: string[], key: Exclude<TechAssigneeKey, 'total'>) => {
    for (const name of names.length > 0 ? names : ['담당자 없음']) {
      const row = byName.get(name) ?? {
        name,
        field: 0,
        repair: 0,
        inquiry: 0,
        task: 0,
        total: 0,
      }
      row[key] += 1
      row.total += 1
      byName.set(name, row)
    }
  }
  for (const fact of facts) {
    for (const def of TECH_KINGS) {
      const date = creditDate(def.id, fact)
      if (date && inPeriod(date, period)) add(fact.assignees, def.id)
    }
    if (fact.kind === 'techTask' && fact.done && inPeriod(fact.doneAt, period))
      add(fact.assignees, 'task')
  }
  return [...byName.values()].sort(
    (a, b) =>
      Number(a.name === '담당자 없음') - Number(b.name === '담당자 없음') ||
      b.total - a.total ||
      a.name.localeCompare(b.name, 'ko'),
  )
}

// ── 지금 진행 현황 ───────────────────────────────────────────────────────

/** 진행 중인 기록의 단계 — 보드마다 그룹 이름이 달라 셋으로 묶는다. */
export type TechPhase = 'new' | 'doing' | 'waiting'

export const TECH_PHASE_LABEL: Record<TechPhase, string> = {
  new: '신규 접수',
  doing: '진행 중',
  waiting: '보류·대기',
}

const phaseOf = (fact: MondayTechFact): TechPhase =>
  fact.isNew
    ? 'new'
    : /보류|막힘|장기|대기/.test(`${fact.stage ?? ''} ${fact.status ?? ''}`)
      ? 'waiting'
      : 'doing'

/** 이만큼 지나도 안 끝나면 오래 걸리는 건 — 접수일부터. AS는 입고 수리라
 * 2주, 아톡은 답을 주는 일이라 1주, 출장·기타업무는 일정을 잡는 일이라 한 달. */
export const TECH_STALE_DAYS: Record<MondayTechKind, number> = {
  fieldService: 30,
  repair: 14,
  techInquiry: 7,
  techTask: 30,
}

export interface TechBacklogRow {
  kind: MondayTechKind
  counts: Record<TechPhase, number>
  total: number
  /** 기준 일수를 넘긴 건수와 가장 오래된 건의 경과일. */
  stale: number
  oldestDays: number | null
}

export interface TechStaleItem {
  fact: MondayTechFact
  days: number
}

/** 지금 안 끝난 기록 — 보드별 단계 건수와, 기준 일수를 넘긴 건(오래된 순).
 * 기간 선택과 무관한 오늘 기준이다. */
export const buildTechBacklog = (
  facts: MondayTechFact[],
  today: string,
): { rows: TechBacklogRow[]; stale: TechStaleItem[] } => {
  const rows = new Map<MondayTechKind, TechBacklogRow>(
    TECH_KINDS.map((kind) => [
      kind,
      {
        kind,
        counts: { new: 0, doing: 0, waiting: 0 },
        total: 0,
        stale: 0,
        oldestDays: null,
      },
    ]),
  )
  const stale: TechStaleItem[] = []
  for (const fact of facts) {
    if (fact.done) continue
    const row = rows.get(fact.kind)!
    row.counts[phaseOf(fact)] += 1
    row.total += 1
    if (!fact.receivedAt) continue
    const days = daysBetween(fact.receivedAt, today)
    row.oldestDays = Math.max(row.oldestDays ?? 0, days)
    if (days >= TECH_STALE_DAYS[fact.kind]) {
      row.stale += 1
      stale.push({ fact, days })
    }
  }
  return {
    rows: [...rows.values()],
    stale: stale.sort((a, b) => b.days - a.days),
  }
}

// ── 무엇이 들어오나 ──────────────────────────────────────────────────────

export interface TechBreakdown {
  id: string
  title: string
  desc: string
  total: number
  rows: { name: string; count: number }[]
}

/** 기간에 접수된 기록을 한 값(기기·문의 종류 등)으로 센다. 한 칸에 여러 값이
 * 쉼표로 적혀 있으면(드롭다운 여러 개) 각각 1건. */
const breakdown = (
  facts: MondayTechFact[],
  period: TechPeriod,
  kind: MondayTechKind,
  valueOf: (fact: MondayTechFact) => string | null,
  meta: Pick<TechBreakdown, 'id' | 'title' | 'desc'>,
): TechBreakdown => {
  const counts = new Map<string, number>()
  let total = 0
  for (const fact of facts) {
    if (fact.kind !== kind || !inPeriod(fact.receivedAt, period)) continue
    total += 1
    const values = (valueOf(fact) ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    for (const value of values.length > 0 ? values : ['미입력']) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }
  return {
    ...meta,
    total,
    rows: [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort(
        (a, b) =>
          Number(a.name === '미입력') - Number(b.name === '미입력') ||
          b.count - a.count ||
          a.name.localeCompare(b.name, 'ko'),
      ),
  }
}

/** 기간에 들어온 일의 내용 — 어떤 기기가 고장 나고, 무엇을 묻고, 어디로
 * 가는지. */
export const buildTechBreakdowns = (
  facts: MondayTechFact[],
  period: TechPeriod,
): TechBreakdown[] => [
  breakdown(facts, period, 'repair', (fact) => fact.device, {
    id: 'repair-device',
    title: 'AS 기기',
    desc: '접수된 AS의 기기',
  }),
  breakdown(facts, period, 'techInquiry', (fact) => fact.type, {
    id: 'inquiry-type',
    title: '기술 문의 종류',
    desc: '접수된 아톡 문의의 종류',
  }),
  // 기기는 "F 시리즈 · F1"처럼 계열과 이름이 같이 온다 — 이름 쪽만 센다.
  breakdown(
    facts,
    period,
    'techInquiry',
    (fact) => fact.device?.split(' · ').pop()?.replace(/,/g, ' ') ?? null,
    {
      id: 'inquiry-device',
      title: '기술 문의 기기',
      desc: '접수된 아톡 문의의 기기(고객이 적은 이름)',
    },
  ),
  breakdown(facts, period, 'fieldService', (fact) => fact.type, {
    id: 'field-type',
    title: '출장 종류',
    desc: '접수된 출장의 종류',
  }),
  breakdown(facts, period, 'fieldService', (fact) => fact.region, {
    id: 'field-region',
    title: '출장 지역',
    desc: '접수된 출장의 지역',
  }),
]
