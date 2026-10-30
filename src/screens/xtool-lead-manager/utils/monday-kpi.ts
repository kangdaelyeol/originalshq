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
    // 날짜가 없는 기록(확정·결제 전, 조회 기간 밖이라 지운 날짜)은 건너뛴다 —
    // 주 단위 키(월요일 찾기)는 빈 날짜에서 계산할 수 없다.
    if (!event.date) continue
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
 * 개인 KPI 전부를 계산한다. 전환(방문체험 확정·결제)은 시작한 날 기준이다 —
 * 상담은 접수일, 방문체험 결제 전환은 체험일. 예를 들어 10/10 접수 → 10/20
 * 방문체험 확정이면 10/10이 든 칸에 접수 1·확정 1로 센다(확정·결제가 기간
 * 뒤에 일어나도 센다). 그래서 어느 칸도 100%를 넘지 않는다. 대신 최근 접수분은
 * 아직 전환될 시간이 없어 낮게 나온다 — 한 달은 지나야 거의 다 잡힌다.
 * 매출은 돈이 들어온 날(결제일) 기준이다.
 *
 * 상담은 처리된 것만 센다 — 아직 "신규 상담 유입"인 상담은 뺀다(CS팀 인입
 * 성과와 같다).
 */
export const computeKpis = (
  facts: MondayKpiFacts,
  unit: KpiUnit,
  range: KpiRange,
  /** false면 삭제된 팀원·담당자 없음 기록을 빼고 센다(합계에서도). */
  includeInactive: boolean,
): { periods: string[]; kpis: KpiResult[] } => {
  const periods = periodsBetween(unit, range)
  const { visits, sales } = facts
  const consultations = facts.consultations.filter(
    ([, , , , isNew]) => isNew !== 1,
  )
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

  // 접수일 칸에 — 분모는 상담 하나하나, 분자는 그중 전환된 것.
  const byReceived = (
    converted: (row: MondayKpiFacts['consultations'][number]) => boolean,
    as: 'rate' | 'count',
  ): KpiEvent[] =>
    consultations.flatMap((row): KpiEvent[] => {
      const [assignee, receivedAt] = row
      const hit = converted(row)
      if (as === 'count')
        return hit ? [{ assignee, date: receivedAt, value: 1 }] : []
      return [{ assignee, date: receivedAt, den: 1, num: hit ? 1 : 0 }]
    })
  const confirmed = ([
    ,
    ,
    confirmedAt,
  ]: MondayKpiFacts['consultations'][number]) => Boolean(confirmedAt)
  const paid = ([, , , paidAt]: MondayKpiFacts['consultations'][number]) =>
    Boolean(paidAt)
  const directPaid = ([
    ,
    ,
    confirmedAt,
    paidAt,
  ]: MondayKpiFacts['consultations'][number]) => Boolean(paidAt && !confirmedAt)

  return {
    periods,
    kpis: [
      build(
        {
          id: 'confirm-count',
          title: '방문체험 확정 건수',
          description:
            '그 기간에 접수된 상담 중 방문체험이 확정된 건수 — 접수일 기준, 확정은 지금까지.',
          format: 'count',
        },
        byReceived(confirmed, 'count'),
      ),
      build(
        {
          id: 'confirm-rate',
          title: '방문체험 확정율',
          description:
            '그 기간에 접수된 상담 중 방문체험이 확정된 비율 — 접수일 기준. 최근 접수분은 아직 확정 전이라 낮게 나온다(한 달은 지나야 정확).',
          format: 'percent',
        },
        byReceived(confirmed, 'rate'),
      ),
      build(
        {
          id: 'paid-rate',
          title: '결제 전환율 (인바운드)',
          description:
            '그 기간에 접수된 상담 중 결제된 비율 — 접수일 기준, 상담 담당자 기준. 최근 접수분은 아직 결제 전이라 낮게 나온다(한 달은 지나야 정확).',
          format: 'percent',
        },
        byReceived(paid, 'rate'),
      ),
      build(
        {
          id: 'direct-paid',
          title: '리드 직접 결제 건수',
          description:
            '그 기간에 접수된 상담 중 방문체험 확정 없이 바로 결제된 건수 — 접수일 기준.',
          format: 'count',
        },
        byReceived(directPaid, 'count'),
      ),
      build(
        {
          id: 'visit-paid-rate',
          title: '결제 전환율 (방문체험)',
          description:
            '그 기간에 체험을 마친 방문 중 결제된 비율 — 체험일 기준, 방문체험 담당자 기준. 최근 체험분은 아직 결제 전이라 낮게 나온다.',
          format: 'percent',
        },
        visits
          .filter(([, , completed]) => completed)
          .map(([assignee, visitAt, , paidAt]) => ({
            assignee,
            date: visitAt,
            den: 1,
            num: paidAt ? 1 : 0,
          })),
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
