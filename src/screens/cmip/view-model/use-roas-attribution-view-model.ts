import { useMemo } from 'react'
import type {
  AttributionChannel,
  AttributionRow,
  CombinedInsight,
} from '../client'
import type { ISODate } from '../types'
import { addDays, todayISO } from '../utils'

/** 광고 채널(광고비가 있는 쪽) — 순서가 곧 표의 줄 순서다. */
export const AD_CHANNELS = ['meta', 'google', 'naver'] as const
export type AdChannel = (typeof AD_CHANNELS)[number]

export const CHANNEL_LABEL: Record<AttributionChannel, string> = {
  meta: 'Meta',
  google: 'Google',
  naver: 'Naver',
  other: 'UTM 있음 · 광고 아님 (chatgpt·당근 등)',
  unknown: 'UTM 없음',
}

/** 코호트 ROAS의 기간(일) — 처음 나타난 날부터 이만큼 안에 산 금액. */
export const COHORT_WINDOWS = [30, 60, 90] as const

const isAd = (channel: AttributionChannel): channel is AdChannel =>
  (AD_CHANNELS as readonly string[]).includes(channel)

const pct = (revenue: number, spend: number): number =>
  spend > 0 ? (revenue / spend) * 100 : 0

/** 고객의 첫 구매 — 가장 이른 결제일과 그날의 금액(같은 날 여러 건이면 합).
 * 재구매(신규 고객 ROAS)와 같은 기준이다. */
const firstPurchaseOf = (row: AttributionRow): [ISODate, number] | null =>
  row[3][0] ?? null

export interface AttributionChannelRow {
  channel: AttributionChannel
  /** 광고 채널만 — 그 채널의 조회 기간 광고비. */
  spend: number | null
  /** 조회 기간에 첫 구매를 한 고객 수와 그 첫 구매 금액. */
  buyers: number
  revenue: number
  /** 신규 고객 매출 중 이 채널의 비중(0~1). */
  share: number
  /** 광고 채널만 — revenue ÷ spend(퍼센트). */
  roas: number | null
}

export interface AttributionRange {
  rows: AttributionChannelRow[]
  /** 광고로 확인된 신규 고객 매출 ÷ 전체 광고비 — ROAS 하한. */
  lowerBound: number
  adRevenue: number
  totalSpend: number
  /** 신규 고객 매출(고객 통합 기준) 전체. */
  newRevenue: number
  /** 경로를 모르는 신규 고객 매출의 비중 — 하한과 상한이 벌어지는 이유. */
  unknownShare: number
}

/**
 * 조회 기간의 광고 기여 ROAS(하한) — 그 기간에 첫 구매를 한 고객을 처음 유입
 * 경로로 채널에 나누고, 광고 채널로 확인된 고객의 첫 구매 금액만 광고 성과로
 * 센다. 경로가 비었거나 광고가 아닌 고객은 빼므로 실제 광고 기여보다 작거나
 * 같다(하한). 금액은 xtool 고객 통합 기준(계약 금액)이다.
 */
export function computeAttributionRange(
  combinedInsight: CombinedInsight,
  rows: readonly AttributionRow[],
): AttributionRange {
  const dates = combinedInsight.series.combined.byDate.map((d) => d.date)
  const start = dates[0] ?? ''
  const end = dates[dates.length - 1] ?? ''
  const spendOf = (channel: AdChannel) =>
    combinedInsight.series[channel].byDate
      .filter((d) => d.date >= start && d.date <= end)
      .reduce((sum, d) => sum + d.spend, 0)

  const totals = new Map<
    AttributionChannel,
    { buyers: number; revenue: number }
  >()
  for (const row of rows) {
    const first = firstPurchaseOf(row)
    if (!first || first[0] < start || first[0] > end) continue
    const entry = totals.get(row[1]) ?? { buyers: 0, revenue: 0 }
    entry.buyers += 1
    entry.revenue += first[1]
    totals.set(row[1], entry)
  }
  const newRevenue = [...totals.values()].reduce((s, e) => s + e.revenue, 0)
  const channels: AttributionChannel[] = [...AD_CHANNELS, 'other', 'unknown']
  const channelRows = channels.map((channel): AttributionChannelRow => {
    const { buyers, revenue } = totals.get(channel) ?? { buyers: 0, revenue: 0 }
    const spend = isAd(channel) ? spendOf(channel) : null
    return {
      channel,
      spend,
      buyers,
      revenue,
      share: newRevenue > 0 ? revenue / newRevenue : 0,
      roas: spend === null ? null : pct(revenue, spend),
    }
  })
  const adRevenue = channelRows
    .filter((row) => isAd(row.channel))
    .reduce((s, row) => s + row.revenue, 0)
  const totalSpend = combinedInsight.total.combined.spend
  return {
    rows: channelRows,
    lowerBound: pct(adRevenue, totalSpend),
    adRevenue,
    totalSpend,
    newRevenue,
    unknownShare:
      newRevenue > 0 ? (totals.get('unknown')?.revenue ?? 0) / newRevenue : 0,
  }
}

export interface CohortCell {
  revenue: number
  roas: number
  adRevenue: number
  adRoas: number
  /** 기간(30·60·90일)이 얼마나 지났는지.
   *   · complete — 이 달의 마지막 고객까지 다 지났다(값이 확정).
   *   · partial  — 일부 고객만 지났다(값이 아직 오른다).
   *   · pending  — 이 달의 첫 고객도 아직 안 지났다. 값이 "오늘까지 산 금액"
   *                이라 더 짧은 기간 칸과 똑같아서 화면에는 '-'로 둔다. */
  status: 'complete' | 'partial' | 'pending'
}

export interface CohortRow {
  /** YYYY-MM */
  month: string
  /** 조회 기간과 겹치는 이 달의 날짜 범위. */
  start: ISODate
  end: ISODate
  customers: number
  adCustomers: number
  spend: number
  cells: Record<(typeof COHORT_WINDOWS)[number], CohortCell>
}

/**
 * 고객 유입 월 코호트 ROAS — 조회 기간에 처음 나타난 고객을 그 달별로 묶고,
 * 각 고객이 처음 나타난 날부터 30·60·90일 안에 산 금액 ÷ 그 달(조회 기간과
 * 겹치는 날만)의 광고비. "이번 달 광고비 vs 이번 달 매출"과 달리 같은
 * 고객끼리 비교해서, 문의 뒤 몇 주 지나 사는 시차가 값을 흔들지 않는다.
 */
export function computeCohorts(
  combinedInsight: CombinedInsight,
  rows: readonly AttributionRow[],
): CohortRow[] {
  const byDate = combinedInsight.series.combined.byDate
  const start = byDate[0]?.date
  const end = byDate[byDate.length - 1]?.date
  if (!start || !end) return []
  const today = todayISO()

  const cohorts = new Map<string, CohortRow>()
  const cohortOf = (date: ISODate) => {
    const month = date.slice(0, 7)
    let cohort = cohorts.get(month)
    if (!cohort) {
      const blank = (): CohortCell => ({
        revenue: 0,
        roas: 0,
        adRevenue: 0,
        adRoas: 0,
        status: 'pending',
      })
      cohort = {
        month,
        start: date,
        end: date,
        customers: 0,
        adCustomers: 0,
        spend: 0,
        cells: { 30: blank(), 60: blank(), 90: blank() },
      }
      cohorts.set(month, cohort)
    }
    if (date < cohort.start) cohort.start = date
    if (date > cohort.end) cohort.end = date
    return cohort
  }

  // 광고비 — 조회 기간의 날짜만(달이 기간 중간에서 잘리면 그 부분만).
  for (const day of byDate) cohortOf(day.date).spend += day.spend

  for (const [firstSeen, channel, , purchases] of rows) {
    if (firstSeen < start || firstSeen > end) continue
    const cohort = cohortOf(firstSeen)
    cohort.customers += 1
    if (isAd(channel)) cohort.adCustomers += 1
    for (const window of COHORT_WINDOWS) {
      const limit = addDays(firstSeen, window - 1)
      const revenue = purchases
        .filter(([date]) => date >= firstSeen && date <= limit)
        .reduce((sum, [, amount]) => sum + amount, 0)
      cohort.cells[window].revenue += revenue
      if (isAd(channel)) cohort.cells[window].adRevenue += revenue
    }
  }

  return [...cohorts.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((cohort) => {
      for (const window of COHORT_WINDOWS) {
        const cell = cohort.cells[window]
        cell.roas = pct(cell.revenue, cohort.spend)
        cell.adRoas = pct(cell.adRevenue, cohort.spend)
        // 기간이 다 찬 고객이 있는지 — 이 달 첫 고객(start)과 마지막 고객(end)
        // 기준. 마지막 고객까지 찼으면 확정, 첫 고객도 안 찼으면 집계 전.
        cell.status =
          addDays(cohort.end, window - 1) < today
            ? 'complete'
            : addDays(cohort.start, window - 1) < today
              ? 'partial'
              : 'pending'
      }
      return cohort
    })
}

/** ROAS 탭의 광고 기여 섹션 — 재료(rows)를 못 불러왔으면 null. */
export const useRoasAttributionViewModel = (
  combinedInsight: CombinedInsight | null,
  rows: readonly AttributionRow[] | null,
) =>
  useMemo(() => {
    if (!combinedInsight || !rows) return null
    return {
      range: computeAttributionRange(combinedInsight, rows),
      cohorts: computeCohorts(combinedInsight, rows),
    }
  }, [combinedInsight, rows])
