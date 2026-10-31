import type { MondayDailyInflow, MondayKpiFacts } from '../entity'
import type { TechPeriod } from './tech-stats'

// 영업통계(통계 탭) — 오프라인 결제(Monday 결제 보드, 계약 기준·취소 제외)를
// 담당자별로 묶는다. 재료는 개인 KPI와 같은 kpiFacts.sales라 숫자도 개인 KPI의
// "담당자별 매출"·"방문체험 매출"과 같다. 담당자가 여럿인 결제는 각자에게 전액을
// 더하고(개인 KPI와 같은 기준), 팀 합계만 실제 매출(중복 없이)로 낸다. 온라인
// (Cafe24) 주문은 담당자가 없어 들어가지 않는다.

/** 결제 1건 — kpiFacts.sales 한 줄을 화면에서 쓰기 좋게. */
export interface SaleFact {
  key: string
  assignees: string[]
  paidAt: string
  amount: number
  /** 결제 전에 마지막으로 체험을 맡은 담당자(없으면 ''). */
  visitAssignee: string
  name: string
  url: string | null
  boardName: string
  products: string[]
  /** 같은 번호로 그 전에 오프라인 결제가 있던 건 — 예전 데이터면 null. */
  repeat: boolean | null
}

export const toSaleFacts = (facts: MondayKpiFacts): SaleFact[] =>
  facts.sales.map(
    (
      [
        assignees,
        paidAt,
        amount,
        visitAssignee,
        itemId = '',
        name = '',
        boardId = '',
        products = '',
        repeat,
      ],
      index,
    ) => {
      const board = facts.boards?.[boardId]
      return {
        key: itemId || `${paidAt}:${index}`,
        assignees: assignees
          .split(',')
          .map((each) => each.trim())
          .filter(Boolean),
        paidAt,
        amount,
        visitAssignee,
        name: name || '이름 없음',
        url: board?.url && itemId ? `${board.url}/pulses/${itemId}` : null,
        boardName: board?.name ?? '오프라인 결제',
        products: products ? products.split(',') : [],
        repeat: repeat === undefined ? null : repeat === 1,
      }
    },
  )

const inPeriod = (date: string, period: TechPeriod) =>
  date >= period.start && date <= period.end

/** 만원 단위(반올림) — 그래프 눈금에 원 단위를 그대로 쓰면 자릿수가 너무 길다. */
export const toManwon = (amount: number) => Math.round(amount / 10_000)

/** 금액을 짧게 — 1억 2,300만원 / 4,560만원 / 9,800원. */
export const formatWonShort = (amount: number): string => {
  if (Math.abs(amount) < 10_000) return `${amount.toLocaleString('ko-KR')}원`
  const man = Math.round(amount / 10_000)
  const eok = Math.floor(man / 10_000)
  const rest = man % 10_000
  if (eok === 0) return `${man.toLocaleString('ko-KR')}만원`
  return rest === 0
    ? `${eok.toLocaleString('ko-KR')}억원`
    : `${eok.toLocaleString('ko-KR')}억 ${rest.toLocaleString('ko-KR')}만원`
}

// ── 영업왕 ───────────────────────────────────────────────────────────────

export type SalesKingId = 'amount' | 'count' | 'visit'

export interface SalesKingDef {
  id: SalesKingId
  title: string
  desc: string
  /** 순위 값이 금액인지 건수인지. */
  unit: 'won' | 'count'
}

export const SALES_KINGS: SalesKingDef[] = [
  {
    id: 'amount',
    title: '매출왕',
    desc: '오프라인 결제 금액 합계 · 결제일 기준',
    unit: 'won',
  },
  {
    id: 'count',
    title: '계약왕',
    desc: '오프라인 결제 건수 · 결제일 기준',
    unit: 'count',
  },
  {
    id: 'visit',
    title: '체험매출왕',
    desc: '방문체험을 맡았던 고객의 결제 금액 · 결제 전 마지막 체험 담당자',
    unit: 'won',
  },
]

export interface SalesRankRow {
  name: string
  /** 순위 값 — 금액 또는 건수. */
  value: number
  count: number
  sales: SaleFact[]
}

export interface SalesKing {
  def: SalesKingDef
  period: TechPeriod
  /** 팀 합계 — 실제 매출(중복 없이) 또는 결제 건수. */
  total: number
  /** 담당자가 비어 있는 결제 수(체험매출왕은 체험 담당자가 없는 결제). */
  unassigned: number
  rows: SalesRankRow[]
}

/** 그 왕의 실적으로 세는 담당자들. */
const creditedTo = (id: SalesKingId, sale: SaleFact): string[] =>
  id === 'visit'
    ? sale.visitAssignee
      ? [sale.visitAssignee]
      : []
    : sale.assignees

export const buildSalesKing = (
  sales: SaleFact[],
  def: SalesKingDef,
  period: TechPeriod,
): SalesKing => {
  const byName = new Map<string, SalesRankRow>()
  let total = 0
  let unassigned = 0
  for (const sale of sales) {
    if (!inPeriod(sale.paidAt, period)) continue
    const names = creditedTo(def.id, sale)
    // 체험매출왕의 팀 합계는 체험을 거친 결제만.
    if (def.id !== 'visit' || names.length > 0)
      total += def.unit === 'won' ? sale.amount : 1
    if (names.length === 0) unassigned += 1
    for (const name of names) {
      const row = byName.get(name) ?? { name, value: 0, count: 0, sales: [] }
      row.value += def.unit === 'won' ? sale.amount : 1
      row.count += 1
      row.sales.push(sale)
      byName.set(name, row)
    }
  }
  const rows = [...byName.values()]
    .map((row) => ({
      ...row,
      sales: row.sales.sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'ko'))
  return { def, period, total, unassigned, rows }
}

// ── 기간 요약 ────────────────────────────────────────────────────────────

export interface SalesRangeSummary {
  /** 실제 매출(중복 없이)과 결제 건수. */
  amount: number
  count: number
  /** 객단가 — 평균과 중앙값. */
  average: number
  median: number
  /** 재구매 결제의 금액·건수(재구매 여부를 아는 결제만). */
  repeatAmount: number
  repeatCount: number
  /** 방문체험을 거친 결제의 금액·건수. */
  visitAmount: number
  visitCount: number
  /** 결제를 맡은 담당자 수. */
  sellers: number
  /** 기간의 가장 큰 결제. */
  top: SaleFact | null
}

export const summarizeSalesRange = (
  sales: SaleFact[],
  period: TechPeriod,
): SalesRangeSummary => {
  const list = sales.filter((sale) => inPeriod(sale.paidAt, period))
  const amounts = list.map((sale) => sale.amount).sort((a, b) => a - b)
  const amount = amounts.reduce((sum, value) => sum + value, 0)
  const mid = Math.floor(amounts.length / 2)
  const repeat = list.filter((sale) => sale.repeat === true)
  const visit = list.filter((sale) => sale.visitAssignee)
  return {
    amount,
    count: list.length,
    average: list.length ? Math.round(amount / list.length) : 0,
    median:
      amounts.length === 0
        ? 0
        : amounts.length % 2
          ? amounts[mid]
          : Math.round((amounts[mid - 1] + amounts[mid]) / 2),
    repeatAmount: repeat.reduce((sum, sale) => sum + sale.amount, 0),
    repeatCount: repeat.length,
    visitAmount: visit.reduce((sum, sale) => sum + sale.amount, 0),
    visitCount: visit.length,
    sellers: new Set(list.flatMap((sale) => sale.assignees)).size,
    top: list.reduce<SaleFact | null>(
      (best, sale) => (!best || sale.amount > best.amount ? sale : best),
      null,
    ),
  }
}

// ── 기간별 추이 ──────────────────────────────────────────────────────────

/** 추이를 무엇으로 볼지 — 매출(만원) / 결제 건수. */
export type SalesMetric = 'amount' | 'count'

export const SALES_METRIC_LABEL: Record<SalesMetric, string> = {
  amount: '매출',
  count: '건수',
}

/** 날짜별 매출(만원)·건수 — 인입통계와 같은 모양으로 만들어 그 그래프·추이
 * 목록을 그대로 쓴다. 항목은 담당자(각자 전액), total은 실제 매출(중복 없이). */
export const salesTeamDays = (
  sales: SaleFact[],
  metric: SalesMetric,
): MondayDailyInflow[] => {
  const byDate = new Map<string, MondayDailyInflow>()
  for (const sale of sales) {
    const value = metric === 'amount' ? sale.amount : 1
    const day = byDate.get(sale.paidAt) ?? {
      date: sale.paidAt,
      total: 0,
      misentry: 0,
      boards: {},
    }
    day.total += value
    for (const name of sale.assignees.length > 0
      ? sale.assignees
      : ['담당자 없음']) {
      day.boards[name] = (day.boards[name] ?? 0) + value
    }
    byDate.set(sale.paidAt, day)
  }
  const days = [...byDate.values()]
  if (metric === 'count') return days
  // 만원으로 — 날마다 반올림하면 합이 어긋나므로 원으로 모은 뒤 바꾼다.
  return days.map((day) => ({
    ...day,
    total: toManwon(day.total),
    boards: Object.fromEntries(
      Object.entries(day.boards).map(([name, value]) => [
        name,
        toManwon(value),
      ]),
    ),
  }))
}

// ── 담당자별 ─────────────────────────────────────────────────────────────

export interface SalesAssigneeRow {
  name: string
  count: number
  amount: number
  average: number
  /** 재구매 결제 건수. */
  repeat: number
  /** 방문체험 담당으로 이끈 결제 금액(체험매출왕과 같은 값). */
  visitAmount: number
  /** 가장 큰 결제. */
  top: number
  /** 많이 판 품목 — 건수 많은 순 셋. */
  products: string[]
}

export type SalesAssigneeKey = Exclude<
  keyof SalesAssigneeRow,
  'name' | 'products'
>

export const buildSalesAssignees = (
  sales: SaleFact[],
  period: TechPeriod,
): SalesAssigneeRow[] => {
  const rows = new Map<
    string,
    SalesAssigneeRow & { productCounts: Map<string, number> }
  >()
  const rowOf = (name: string) => {
    const row = rows.get(name) ?? {
      name,
      count: 0,
      amount: 0,
      average: 0,
      repeat: 0,
      visitAmount: 0,
      top: 0,
      products: [],
      productCounts: new Map<string, number>(),
    }
    rows.set(name, row)
    return row
  }
  for (const sale of sales) {
    if (!inPeriod(sale.paidAt, period)) continue
    for (const name of sale.assignees.length > 0
      ? sale.assignees
      : ['담당자 없음']) {
      const row = rowOf(name)
      row.count += 1
      row.amount += sale.amount
      row.top = Math.max(row.top, sale.amount)
      if (sale.repeat) row.repeat += 1
      for (const product of sale.products)
        row.productCounts.set(
          product,
          (row.productCounts.get(product) ?? 0) + 1,
        )
    }
    if (sale.visitAssignee) rowOf(sale.visitAssignee).visitAmount += sale.amount
  }
  return [...rows.values()]
    .map(({ productCounts, ...row }) => ({
      ...row,
      average: row.count ? Math.round(row.amount / row.count) : 0,
      products: [...productCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
        .slice(0, 3)
        .map(([product]) => product),
    }))
    .sort(
      (a, b) =>
        Number(a.name === '담당자 없음') - Number(b.name === '담당자 없음') ||
        b.amount - a.amount ||
        b.visitAmount - a.visitAmount ||
        a.name.localeCompare(b.name, 'ko'),
    )
}

/** 기간의 큰 결제 — 금액 큰 순으로 limit건. */
export const topSales = (
  sales: SaleFact[],
  period: TechPeriod,
  limit = 10,
): SaleFact[] =>
  sales
    .filter((sale) => inPeriod(sale.paidAt, period))
    .sort((a, b) => b.amount - a.amount || b.paidAt.localeCompare(a.paidAt))
    .slice(0, limit)
