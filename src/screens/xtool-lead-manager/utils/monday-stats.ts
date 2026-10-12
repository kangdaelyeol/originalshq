import type { MondayCustomerListItem } from '../entity'

// 퍼널 통계 — 고객 목록(요약)만으로 집계한다. 단위는 전부 "고객"(전화번호
// 하나)이고, 기간은 그 고객의 최초 인입 월 기준(코호트)이다: 9월에 처음
// 문의하고 10월에 구매한 고객은 9월 고객의 전환으로 센다.

/** 조회 기간 — 최초 인입 월(YYYY-MM)의 범위. null이면 그쪽 끝은 제한 없음. */
export interface StatsPeriod {
  from: string | null
  to: string | null
}

export interface RateRow {
  label: string
  /** 이 줄의 고객 수(모수). */
  customers: number
  visitRate: number
  purchaseRate: number
  purchases: number
  /** 구매 금액 합계. */
  amount: number
  /** 인입→구매 소요 일수의 중앙값 — 구매 고객이 없으면 null. */
  medianDays: number | null
}

export interface FunnelStats {
  /** 기간 안의 전체 고객(오기입 포함). */
  totalCustomers: number
  /** 그중 오기입이라 모수에서 뺀 고객. */
  misentryCustomers: number
  /** 퍼널 단계 — 첫 줄(유효 고객)이 모수다. */
  steps: { label: string; count: number; rate: number }[]
  /** 방문체험을 한 고객 / 안 한 고객의 구매 전환. */
  visitSplit: { visited: RateRow; notVisited: RateRow }
  /** 최초 인입 → 첫 구매 소요 일수(문의 기록이 있는 구매 고객만). */
  days: {
    customers: number
    median: number | null
    mean: number | null
    buckets: { label: string; count: number; rate: number }[]
  }
  /** 콜백 최종 도달 단계별 — 문의 기록(상담·방문체험)이 있는 고객만. */
  callback: (RateRow & { stage: number; reached: number })[]
  sources: RateRow[]
  assignees: RateRow[]
}

const DAY_MS = 86_400_000

const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)

const median = (values: number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

const ratio = (part: number, whole: number): number =>
  whole === 0 ? 0 : part / whole

const purchased = (customer: MondayCustomerListItem): boolean =>
  customer.summary.purchaseCount > 0

/** 구매 전에 문의(상담·방문체험·샘플테스트) 기록이 있는 고객인지 — 결제
 * 보드에만 있는 고객은 인입과 구매가 같은 날이라 소요 일수가 의미 없다. */
const hasInquiry = (customer: MondayCustomerListItem): boolean =>
  customer.summary.consultationCount +
    customer.summary.visitCount +
    customer.summary.sampleTestCount >
  0

/** 인입 → 첫 구매 소요 일수. 구매하지 않았거나 날짜를 모르면 null. */
const daysToPurchase = (customer: MondayCustomerListItem): number | null => {
  const { firstContactAt, firstPurchaseAt } = customer.summary.funnel
  if (!firstContactAt || !firstPurchaseAt) return null
  return Math.max(0, daysBetween(firstContactAt, firstPurchaseAt))
}

const toRateRow = (
  label: string,
  customers: MondayCustomerListItem[],
): RateRow => {
  const buyers = customers.filter(purchased)
  return {
    label,
    customers: customers.length,
    visitRate: ratio(
      customers.filter((c) => c.summary.funnel.visitCompleted).length,
      customers.length,
    ),
    purchaseRate: ratio(buyers.length, customers.length),
    purchases: buyers.length,
    amount: customers.reduce((sum, c) => sum + c.summary.purchaseAmount, 0),
    medianDays: median(
      buyers
        .filter(hasInquiry)
        .map(daysToPurchase)
        .filter((days): days is number => days !== null),
    ),
  }
}

const groupBy = (
  customers: MondayCustomerListItem[],
  keyOf: (customer: MondayCustomerListItem) => string,
): Map<string, MondayCustomerListItem[]> => {
  const groups = new Map<string, MondayCustomerListItem[]>()
  for (const customer of customers) {
    const key = keyOf(customer)
    groups.set(key, [...(groups.get(key) ?? []), customer])
  }
  return groups
}

/** 고객 수가 많은 순으로 `limit`줄까지 보여주고 나머지는 "기타" 한 줄로
 * 합친다 — 한두 명짜리 줄의 전환율(0%나 100%)이 표를 어지럽히지 않게. */
const topRows = (
  groups: Map<string, MondayCustomerListItem[]>,
  limit: number,
): RateRow[] => {
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
  const rows = sorted
    .slice(0, limit)
    .map(([label, customers]) => toRateRow(label, customers))
  const rest = sorted.slice(limit).flatMap(([, customers]) => customers)
  return rest.length > 0 ? [...rows, toRateRow('기타', rest)] : rows
}

const DAY_BUCKETS: { label: string; max: number }[] = [
  { label: '당일', max: 0 },
  { label: '1~7일', max: 7 },
  { label: '8~30일', max: 30 },
  { label: '31~90일', max: 90 },
  { label: '91일 이상', max: Infinity },
]

/** 고객 목록에 실제로 있는 인입 월들(오름차순) — 기간 선택지로 쓴다. */
export const contactMonths = (customers: MondayCustomerListItem[]): string[] =>
  [
    ...new Set(
      customers
        .map((customer) => customer.summary.funnel?.firstContactAt?.slice(0, 7))
        .filter((month): month is string => Boolean(month)),
    ),
  ].sort()

export const computeFunnelStats = (
  allCustomers: MondayCustomerListItem[],
  period: StatsPeriod,
): FunnelStats => {
  // 인입일을 모르는 고객(기록에 날짜가 하나도 없음)은 어느 기간에도 넣을 수
  // 없어 뺀다.
  const inPeriod = allCustomers.filter((customer) => {
    // funnel은 서버가 통합 고객을 다시 만들 때 채운다 — 그 전에 만들어진
    // 문서에는 없을 수 있어, 있는 고객만 집계한다(없다고 화면이 죽지 않게).
    const month = customer.summary.funnel?.firstContactAt?.slice(0, 7)
    if (!month) return false
    if (period.from && month < period.from) return false
    if (period.to && month > period.to) return false
    return true
  })
  const valid = inPeriod.filter((c) => !c.summary.funnel.misentry)

  const booked = valid.filter((c) => c.summary.funnel.visitBooked)
  const visited = valid.filter((c) => c.summary.funnel.visitCompleted)
  const notVisited = valid.filter((c) => !c.summary.funnel.visitCompleted)
  const buyers = valid.filter(purchased)

  const days = buyers
    .filter(hasInquiry)
    .map(daysToPurchase)
    .filter((value): value is number => value !== null)

  // 콜백은 문의 기록이 있는 고객에게만 해당한다(결제 보드에만 있는 고객은
  // 콜백을 할 일이 없었다).
  const inquirers = valid.filter(
    (c) => c.summary.consultationCount + c.summary.visitCount > 0,
  )

  return {
    totalCustomers: inPeriod.length,
    misentryCustomers: inPeriod.length - valid.length,
    steps: [
      { label: '유효 고객', count: valid.length },
      { label: '방문체험 예약', count: booked.length },
      { label: '방문체험 완료', count: visited.length },
      { label: '구매', count: buyers.length },
    ].map((step) => ({ ...step, rate: ratio(step.count, valid.length) })),
    visitSplit: {
      visited: toRateRow('방문체험 함', visited),
      notVisited: toRateRow('방문체험 안 함', notVisited),
    },
    days: {
      customers: days.length,
      median: median(days),
      mean:
        days.length === 0
          ? null
          : days.reduce((sum, value) => sum + value, 0) / days.length,
      buckets: DAY_BUCKETS.map((bucket, index) => {
        const min = index === 0 ? -1 : DAY_BUCKETS[index - 1].max
        const count = days.filter(
          (value) => value > min && value <= bucket.max,
        ).length
        return { label: bucket.label, count, rate: ratio(count, days.length) }
      }),
    },
    callback: [0, 1, 2, 3, 4].map((stage) => ({
      ...toRateRow(
        stage === 0 ? '콜백 없음' : `${stage}단계`,
        inquirers.filter((c) => c.summary.funnel.callbackStage === stage),
      ),
      stage,
      // 이 단계까지(또는 그 이상) 간 고객 — 높은 단계에 도달했으면 그 아래
      // 단계는 거친 것으로 본다.
      reached: inquirers.filter((c) => c.summary.funnel.callbackStage >= stage)
        .length,
    })),
    sources: topRows(
      groupBy(valid, (c) => c.summary.funnel.source ?? '(미기록)'),
      8,
    ),
    assignees: topRows(
      groupBy(valid, (c) => c.summary.assignees[0] ?? '(담당자 없음)'),
      12,
    ),
  }
}
