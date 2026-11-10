import type { MondayDailyInflow, MondayDailySale } from '../entity'
import type { PurchaseScope } from './monday-stats'
import { toManwon } from './sales-team'

/** 판매통계 그래프를 무엇으로 볼지 — 판매 수량 / 판매 금액(만원). 아래 제품
 * 현황(추이·표)은 늘 수량이다. */
export type SalesChartMetric = 'quantity' | 'amount'

export const SALES_CHART_METRIC_LABEL: Record<SalesChartMetric, string> = {
  quantity: '수량',
  amount: '금액',
}

/** 제품 하나의 판매 합계 — 조회 기간 안에서. */
export interface SalesProduct {
  name: string
  /** 판매 수량 — 선택한 채널 기준. */
  quantity: number
  offlineQuantity: number
  onlineQuantity: number
  /** 판매 금액 — 선택한 채널 기준. */
  amount: number
}

export interface SalesSummary {
  quantity: number
  amount: number
  /** 팔린 제품의 가짓수. */
  productCount: number
  /** 가장 많이 팔린 제품(수량 기준) — 없으면 null. */
  top: SalesProduct | null
}

/** 조회 기간·채널의 판매 줄을 제품별로 합친다. 제품명이 같으면 한 제품으로
 * 본다 — 오프라인과 온라인이 같은 제품을 다른 이름으로 적은 경우는 서로
 * 다른 줄로 남는다. 결과는 수량이 많은 순. */
export const aggregateSales = (
  rows: MondayDailySale[],
  start: string,
  end: string,
  scope: PurchaseScope,
): SalesProduct[] => {
  const byName = new Map<string, SalesProduct>()

  for (const row of rows) {
    if (row.date < start || row.date > end) continue
    if (scope !== 'all' && row.origin !== scope) continue

    const product = byName.get(row.name) ?? {
      name: row.name,
      quantity: 0,
      offlineQuantity: 0,
      onlineQuantity: 0,
      amount: 0,
    }
    product.quantity += row.quantity
    product.amount += row.amount
    if (row.origin === 'offline') product.offlineQuantity += row.quantity
    else product.onlineQuantity += row.quantity
    byName.set(row.name, product)
  }

  return [...byName.values()].sort(
    (a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name),
  )
}

export const summarizeSales = (products: SalesProduct[]): SalesSummary => ({
  quantity: products.reduce((sum, product) => sum + product.quantity, 0),
  amount: products.reduce((sum, product) => sum + product.amount, 0),
  productCount: products.length,
  top: products[0] ?? null,
})

export type SalesChannel = MondayDailySale['origin']

/** 판매 채널 이름 — 그래프 툴팁에 적는 순서대로. */
export const SALES_CHANNEL_LABEL: Record<SalesChannel, string> = {
  offline: '오프라인',
  online: '온라인',
}

// 채널과 제품명 사이 구분자 — 제품명에 나올 일이 없는 제어 문자.
const CHANNEL_SEP = '\u001f'

const salesChannelKey = (channel: SalesChannel, name: string): string =>
  `${channel}${CHANNEL_SEP}${name}`

/** salesAsDays(…, byChannel)의 칸 이름을 채널과 제품명으로 되돌린다. */
export const splitSalesKey = (
  key: string,
): { channel: SalesChannel; name: string } => {
  const at = key.indexOf(CHANNEL_SEP)
  return {
    channel: key.slice(0, at) as SalesChannel,
    name: key.slice(at + 1),
  }
}

/** 판매 줄을 "날짜별 · 제품별 수량"으로 바꾼다 — 인입 통계의 "날짜별 ·
 * 보드별 건수"와 같은 모양이라, 일/주/월로 묶기·정렬·합계 계산을 인입
 * 통계의 함수(inflowSeries, summarizeInflow, sortInflowRows)로 그대로 한다.
 * 여기서 total은 그날 팔린 전체 수량, boards는 제품명별 수량이다. metric이
 * 'amount'면 수량 대신 금액(만원)이다 — 그래프만 쓴다. byChannel이면 제품명
 * 대신 "채널 + 제품명"(salesChannelKey)으로 나눠 담는다 — 그래프 툴팁이 온라인·
 * 오프라인을 가르려고 쓴다(splitSalesKey로 되돌린다). */
export const salesAsDays = (
  rows: MondayDailySale[],
  scope: PurchaseScope,
  metric: SalesChartMetric = 'quantity',
  byChannel = false,
): MondayDailyInflow[] => {
  const byDate = new Map<string, MondayDailyInflow>()
  for (const row of rows) {
    if (scope !== 'all' && row.origin !== scope) continue
    const value = metric === 'amount' ? row.amount : row.quantity
    const day = byDate.get(row.date) ?? {
      date: row.date,
      total: 0,
      misentry: 0,
      boards: {},
    }
    const key = byChannel ? salesChannelKey(row.origin, row.name) : row.name
    day.total += value
    day.boards[key] = (day.boards[key] ?? 0) + value
    byDate.set(row.date, day)
  }
  const days = [...byDate.values()]
  if (metric === 'quantity') return days
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
