import type { MondayKpiFacts } from '../entity'
import { isInactiveAssignee, todayInKorea } from './monday-neglect'

// ── 기간 ────────────────────────────────────────────────────────────────
// 개인 KPI는 일별·주별·월별로 나눠 보고, 단위마다 기간을 따로 고른다.
//   · 일 — YYYY-MM-DD
//   · 주 — 월요일 시작 달력 주. 그 주 월요일 날짜(YYYY-MM-DD)로 부른다.
//   · 월 — YYYY-MM

export type KpiUnit = 'day' | 'week' | 'month'

export const KPI_UNIT_LABEL: Record<KpiUnit, string> = {
  day: '일별',
  week: '주별',
  month: '월별',
}

export interface KpiRange {
  from: string
  to: string
}

const DAY_MS = 86_400_000
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const toISO = (time: number): string =>
  new Date(time).toISOString().slice(0, 10)
const shiftDays = (date: string, days: number): string =>
  toISO(Date.parse(date) + days * DAY_MS)

/** 그 날이 속한 주의 월요일. */
export const mondayOf = (date: string): string => {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return shiftDays(date, -((weekday + 6) % 7))
}

const shiftMonths = (month: string, months: number): string => {
  const [year, mon] = month.split('-').map(Number)
  const index = year * 12 + (mon - 1) + months
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** 그 날짜가 속한 기간의 이름(키). */
export const periodKeyOf = (date: string, unit: KpiUnit): string =>
  unit === 'day' ? date : unit === 'week' ? mondayOf(date) : date.slice(0, 7)

/** 기간 키를 화면용 이름으로. */
export const periodLabel = (key: string, unit: KpiUnit): string => {
  if (unit === 'month') return key.replace('-', '.')
  const md = (date: string) => {
    const [, month, day] = date.split('-')
    return `${Number(month)}/${Number(day)}`
  }
  if (unit === 'week') return `${md(key)}~${md(shiftDays(key, 6))}`
  return `${md(key)} (${WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()]})`
}

/** 처음 열었을 때의 기간 — 월: 이번 달 포함 7개월, 주: 이번 주 포함 8주,
 * 일: 오늘을 뺀 직전 7일. */
export const defaultKpiRange = (unit: KpiUnit): KpiRange => {
  const today = todayInKorea()
  if (unit === 'month') {
    const thisMonth = today.slice(0, 7)
    return { from: shiftMonths(thisMonth, -6), to: thisMonth }
  }
  if (unit === 'week') {
    const thisWeek = mondayOf(today)
    return { from: shiftDays(thisWeek, -7 * 7), to: thisWeek }
  }
  return { from: shiftDays(today, -7), to: shiftDays(today, -1) }
}

/** 월 단위 최근 n개월(이번 달 포함) — 인입통계 CS팀 섹션의 처음 기간. */
export const recentMonthsRange = (count: number): KpiRange => {
  const thisMonth = todayInKorea().slice(0, 7)
  return { from: shiftMonths(thisMonth, -(count - 1)), to: thisMonth }
}

/** 기간 키 범위를 날짜 범위(YYYY-MM-DD, 양 끝 포함)로 — 월은 그 달 1일~말일,
 * 주는 월요일~일요일. */
export const kpiRangeDates = (
  unit: KpiUnit,
  range: KpiRange,
): { start: string; end: string } => {
  if (unit === 'month') {
    return {
      start: `${range.from}-01`,
      end: shiftDays(`${shiftMonths(range.to, 1)}-01`, -1),
    }
  }
  if (unit === 'week') return { start: range.from, end: shiftDays(range.to, 6) }
  return { start: range.from, end: range.to }
}

/** 기간 범위 안의 모든 기간 키(오름차순). */
export const periodsBetween = (unit: KpiUnit, range: KpiRange): string[] => {
  const keys: string[] = []
  if (unit === 'month') {
    for (let key = range.from; key <= range.to; key = shiftMonths(key, 1)) {
      keys.push(key)
    }
    return keys
  }
  const step = unit === 'week' ? 7 : 1
  for (let key = range.from; key <= range.to; key = shiftDays(key, step)) {
    keys.push(key)
  }
  return keys
}

/** 월·주 선택지 — 데이터가 있는 첫 날부터 이번 달(주)까지. 최근 것이 위. */
export const periodOptions = (
  unit: 'week' | 'month',
  firstDate: string,
): string[] => {
  const today = todayInKorea()
  return periodsBetween(unit, {
    from: periodKeyOf(firstDate, unit),
    to: periodKeyOf(today, unit),
  }).reverse()
}

// ── 지표 ────────────────────────────────────────────────────────────────

export type KpiFormat = 'count' | 'won' | 'percent'

/** 담당자 한 명의 값 — 비율 지표는 num/den, 나머지는 value만 쓴다. */
export interface KpiCell {
  value: number
  num?: number
  den?: number
}

export interface KpiRow {
  assignee: string
  /** 조회 기간 전체의 값. */
  total: KpiCell
  /** 기간별 값 — periods와 같은 순서. */
  byPeriod: KpiCell[]
}

export interface KpiResult {
  id: string
  title: string
  description: string
  format: KpiFormat
  rows: KpiRow[]
  /** 모든 담당자를 합친 값. */
  sum: { total: KpiCell; byPeriod: KpiCell[] }
}

const NO_ASSIGNEE = '(담당자 없음)'

/** 사건 하나 — 누가, 언제, 분자(num)·분모(den)·값(value)에 얼마를 더하는지. */
interface KpiEvent {
  assignee: string
  date: string
  num?: number
  den?: number
  value?: number
}

/** 사건들을 담당자 × 기간으로 모은다. 비율 지표는 num/den을 합친 뒤에 나눈다
 * (기간별 비율의 평균이 아니라). */
const aggregate = (
  events: KpiEvent[],
  unit: KpiUnit,
  periods: string[],
  ratio: boolean,
): { rows: KpiRow[]; sum: KpiResult['sum'] } => {
  const index = new Map(periods.map((key, i) => [key, i]))
  const blank = () => ({ value: 0, num: 0, den: 0 })
  const byAssignee = new Map<string, { total: KpiCell; byPeriod: KpiCell[] }>()
  const sum = { total: blank(), byPeriod: periods.map(blank) }

  const add = (cell: KpiCell, event: KpiEvent) => {
    cell.value += event.value ?? 0
    cell.num = (cell.num ?? 0) + (event.num ?? 0)
    cell.den = (cell.den ?? 0) + (event.den ?? 0)
  }

  for (const event of events) {
    const at = index.get(periodKeyOf(event.date, unit))
    if (at === undefined) continue
    const assignee = event.assignee || NO_ASSIGNEE
    const row = byAssignee.get(assignee) ?? {
      total: blank(),
      byPeriod: periods.map(blank),
    }
    add(row.total, event)
    add(row.byPeriod[at], event)
    add(sum.total, event)
    add(sum.byPeriod[at], event)
    byAssignee.set(assignee, row)
  }

  const finish = (cell: KpiCell): KpiCell =>
    ratio ? { ...cell, value: cell.den ? (cell.num ?? 0) / cell.den : 0 } : cell
  const rows = [...byAssignee.entries()]
    .map(([assignee, row]) => ({
      assignee,
      total: finish(row.total),
      byPeriod: row.byPeriod.map(finish),
    }))
    // 비율은 모수가 작은 담당자가 위로 튀지 않게 모수(건수)가 큰 순으로.
    .sort((a, b) =>
      ratio
        ? (b.total.den ?? 0) - (a.total.den ?? 0)
        : b.total.value - a.total.value,
    )
  return {
    rows,
    sum: { total: finish(sum.total), byPeriod: sum.byPeriod.map(finish) },
  }
}

/**
 * 개인 KPI 전부를 계산한다. 모두 "그 기간에 일어난 일" 기준이다 — 예를 들어
 * 결제 전환율은 그 기간에 들어온 상담 수 대비 그 기간에 일어난 결제 수다
 * (퍼널 통계처럼 "그 기간에 들어온 고객이 나중에라도 결제했나"가 아니다).
 */
export const computeKpis = (
  facts: MondayKpiFacts,
  unit: KpiUnit,
  range: KpiRange,
  /** false면 삭제된 팀원·담당자 없음 기록을 빼고 센다(합계에서도). */
  includeInactive: boolean,
): { periods: string[]; kpis: KpiResult[] } => {
  const periods = periodsBetween(unit, range)
  const { consultations, visits, sales } = facts
  const build = (
    meta: Omit<KpiResult, 'rows' | 'sum'>,
    events: KpiEvent[],
  ): KpiResult => ({
    ...meta,
    ...aggregate(
      includeInactive
        ? events
        : events.filter((event) => !isInactiveAssignee(event.assignee)),
      unit,
      periods,
      meta.format === 'percent',
    ),
  })

  const received = consultations.map(([assignee, receivedAt]) => ({
    assignee,
    date: receivedAt,
    den: 1,
  }))

  return {
    periods,
    kpis: [
      build(
        {
          id: 'confirm-count',
          title: '방문체험 확정 건수',
          description:
            '상담에서 방문체험이 확정된 건수 — 방문체험 확정일 기준.',
          format: 'count',
        },
        consultations
          .filter(([, , confirmedAt]) => confirmedAt)
          .map(([assignee, , confirmedAt]) => ({
            assignee,
            date: confirmedAt,
            value: 1,
          })),
      ),
      build(
        {
          id: 'confirm-rate',
          title: '방문체험 확정율',
          description:
            '그 기간에 들어온 상담 수 대비 그 기간에 확정된 방문체험 수(오기입 제외).',
          format: 'percent',
        },
        [
          ...received,
          ...consultations
            .filter(([, , confirmedAt]) => confirmedAt)
            .map(([assignee, , confirmedAt]) => ({
              assignee,
              date: confirmedAt,
              num: 1,
            })),
        ],
      ),
      build(
        {
          id: 'paid-rate',
          title: '결제 전환율 (인바운드)',
          description:
            '그 기간에 들어온 상담 수 대비 그 기간에 결제된 상담 수 — 상담 담당자 기준.',
          format: 'percent',
        },
        [
          ...received,
          ...consultations
            .filter(([, , , paidAt]) => paidAt)
            .map(([assignee, , , paidAt]) => ({
              assignee,
              date: paidAt,
              num: 1,
            })),
        ],
      ),
      build(
        {
          id: 'direct-paid',
          title: '리드 직접 결제 건수',
          description:
            '방문체험 확정 없이 상담에서 바로 결제된 건수 — 결제일 기준.',
          format: 'count',
        },
        consultations
          .filter(([, , confirmedAt, paidAt]) => paidAt && !confirmedAt)
          .map(([assignee, , , paidAt]) => ({
            assignee,
            date: paidAt,
            value: 1,
          })),
      ),
      build(
        {
          id: 'visit-paid-rate',
          title: '결제 전환율 (방문체험)',
          description:
            '그 기간에 체험을 마친 방문 수 대비 그 기간에 결제된 방문 수 — 방문체험 담당자 기준.',
          format: 'percent',
        },
        [
          ...visits
            .filter(([, , completed]) => completed)
            .map(([assignee, visitAt]) => ({
              assignee,
              date: visitAt,
              den: 1,
            })),
          ...visits
            .filter(([, , completed, paidAt]) => completed && paidAt)
            .map(([assignee, , , paidAt]) => ({
              assignee,
              date: paidAt,
              num: 1,
            })),
        ],
      ),
      build(
        {
          id: 'visit-sales',
          title: '방문체험 매출',
          description:
            '방문체험을 마친 고객의 오프라인 결제 금액 — 결제 전에 마지막으로 체험을 맡은 담당자에게 돌린다. 결제일 기준.',
          format: 'won',
        },
        sales
          .filter(([, , , visitAssignee]) => visitAssignee)
          .map(([, paidAt, amount, visitAssignee]) => ({
            assignee: visitAssignee,
            date: paidAt,
            value: amount,
          })),
      ),
      build(
        {
          id: 'sales',
          title: '담당자별 매출',
          description:
            '오프라인 결제 금액(계약 기준, 취소 제외) — 결제 보드의 담당자 기준. 담당자가 여럿이면 각자에게 전액을 더해서, 담당자 합은 실제 매출보다 클 수 있다.',
          format: 'won',
        },
        sales.flatMap(([assignees, paidAt, amount]) =>
          (assignees ? assignees.split(',') : ['']).map((assignee) => ({
            assignee,
            date: paidAt,
            value: amount,
          })),
        ),
      ),
    ],
  }
}

/** 지표 값을 화면용 글자로. */
export const formatKpi = (cell: KpiCell, format: KpiFormat): string => {
  if (format === 'percent') {
    return cell.den ? `${(cell.value * 100).toFixed(1)}%` : '-'
  }
  if (format === 'won')
    return `${Math.round(cell.value).toLocaleString('ko-KR')}원`
  return cell.value.toLocaleString('ko-KR')
}

/** 데이터의 첫 날짜 — 월·주 선택지의 시작점. */
export const firstKpiDate = (facts: MondayKpiFacts): string =>
  [
    ...facts.consultations.map((row) => row[1]),
    ...facts.visits.map((row) => row[1]),
    ...facts.sales.map((row) => row[1]),
  ]
    .filter(Boolean)
    .sort()[0] ?? todayInKorea()
