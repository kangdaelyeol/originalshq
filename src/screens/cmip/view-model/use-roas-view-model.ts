import { useState } from 'react'
import {
  groupByMonth,
  type Cafe24RevenueSummary,
  type CombinedInsight,
  type OfflineRevenueSummary,
} from '../client'
import { formatMD } from '../utils'

export const RoasGrouping = {
  DATE: 'byDate',
  DAY_OF_WEEK: 'byDayOfWeek',
  WEEK: 'byGroupedWeek',
  MONTH: 'byMonth',
} as const

export type RoasGrouping = (typeof RoasGrouping)[keyof typeof RoasGrouping]

export interface RoasMetrics {
  spend: number
  offlineRevenue: number
  onlineRevenue: number
  /** offlineRevenue + onlineRevenue. */
  totalRevenue: number
  /** 광고비 대비 (오프라인+온라인) 매출 — 퍼센트(예: 250은 250%, 광고비의
   * 2.5배). 광고비가 0이면 나눌 수 없어 0으로 둔다. */
  roas: number
}

export interface RoasRow {
  key: string
  label: string
  metrics: RoasMetrics
}

const calcRoas = (
  offlineRevenue: number,
  onlineRevenue: number,
  spend: number,
): number => (spend > 0 ? ((offlineRevenue + onlineRevenue) / spend) * 100 : 0)

const toMetrics = (
  offlineRevenue: number,
  onlineRevenue: number,
  spend: number,
): RoasMetrics => ({
  spend,
  offlineRevenue,
  onlineRevenue,
  totalRevenue: offlineRevenue + onlineRevenue,
  roas: calcRoas(offlineRevenue, onlineRevenue, spend),
})

/**
 * ROAS(광고비 대비 오프라인+온라인 매출) 탭 — combinedInsight(광고비,
 * Meta+Google+Naver 이미 합산됨), offlineRevenue(Monday CRM 오프라인 매출)와
 * onlineRevenue(Cafe24 온라인 매출, 둘 다 별도 조회)를 날짜/요일/주차/월
 * 키로 짝지어 ROAS를 계산한다. 세 데이터 모두 이미 useChannelInsightViewModel이
 * 같은 dateStart/dateEnd로 조회해 갖고 있어(period-test 탭처럼) 이 훅 자체는
 * 새 네트워크 호출을 하지 않고 순수 파생만 한다.
 *
 * 키(날짜/요일/주차)는 항상 combinedInsight.series.combined 쪽(seriesFromByDate가
 * 조회 범위 전체를 0으로 채워 만든 완전한 시리즈)을 기준으로 순회하고,
 * 오프라인/온라인 매출은 그 키로 Map 조회해 없으면 0으로 둔다 — 광고 집행이
 * 없던 날에도 매출이 있을 수 있고, 반대로 매출이 0인 날도 표에서 빠지면 안
 * 되기 때문에 어느 한쪽 매출 배열을 기준으로 순회하지 않는다(월별 집계는
 * combinedInsight.series에 자체 필드가 없어 원래도 groupByMonth로 광고비 쪽을
 * 직접 파생시켜 기준으로 썼다 — 나머지 grouping도 그와 같은 방식으로 통일한다).
 */
export const useRoasViewModel = (
  combinedInsight: CombinedInsight | null,
  offlineRevenue: OfflineRevenueSummary | null,
  onlineRevenue: Cafe24RevenueSummary | null,
) => {
  const [grouping, setGrouping] = useState<RoasGrouping>(RoasGrouping.DATE)

  const total: RoasMetrics = toMetrics(
    offlineRevenue?.total.totalPaid ?? 0,
    onlineRevenue?.total.paymentAmount ?? 0,
    combinedInsight?.total.combined.spend ?? 0,
  )

  const rows: RoasRow[] = (() => {
    if (!combinedInsight) return []

    if (grouping === RoasGrouping.MONTH) {
      const spendByMonth = groupByMonth(combinedInsight.series.combined.byDate)
      const offlineByPeriod = new Map(
        (offlineRevenue?.byMonth ?? []).map((m) => [m.period, m.totalPaid]),
      )
      const onlineByPeriod = new Map(
        (onlineRevenue?.byMonth ?? []).map((m) => [m.period, m.paymentAmount]),
      )
      return spendByMonth.map(
        (m): RoasRow => ({
          key: m.period,
          label: m.period,
          metrics: toMetrics(
            offlineByPeriod.get(m.period) ?? 0,
            onlineByPeriod.get(m.period) ?? 0,
            m.spend,
          ),
        }),
      )
    }

    if (grouping === RoasGrouping.DAY_OF_WEEK) {
      const offlineByDay = new Map(
        (offlineRevenue?.byDayOfWeek ?? []).map((d) => [d.dayOfWeek, d.totalPaid]),
      )
      const onlineByDay = new Map(
        (onlineRevenue?.byDayOfWeek ?? []).map((d) => [
          d.dayOfWeek,
          d.paymentAmount,
        ]),
      )
      return combinedInsight.series.combined.byDayOfWeek.map(
        (d): RoasRow => ({
          key: d.dayOfWeek,
          label: d.dayOfWeek,
          metrics: toMetrics(
            offlineByDay.get(d.dayOfWeek) ?? 0,
            onlineByDay.get(d.dayOfWeek) ?? 0,
            d.spend,
          ),
        }),
      )
    }

    if (grouping === RoasGrouping.WEEK) {
      const offlineByPeriod = new Map(
        (offlineRevenue?.byGroupedWeek ?? []).map((w) => [w.period, w.totalPaid]),
      )
      const onlineByPeriod = new Map(
        (onlineRevenue?.byGroupedWeek ?? []).map((w) => [
          w.period,
          w.paymentAmount,
        ]),
      )
      return combinedInsight.series.combined.byGroupedWeek.map(
        (w): RoasRow => ({
          key: w.period,
          label: w.period,
          metrics: toMetrics(
            offlineByPeriod.get(w.period) ?? 0,
            onlineByPeriod.get(w.period) ?? 0,
            w.spend,
          ),
        }),
      )
    }

    // byDate
    const offlineByDate = new Map(
      (offlineRevenue?.byDate ?? []).map((d) => [d.date, d.totalPaid]),
    )
    const onlineByDate = new Map(
      (onlineRevenue?.byDate ?? []).map((d) => [d.date, d.paymentAmount]),
    )
    return combinedInsight.series.combined.byDate.map(
      (d): RoasRow => ({
        key: d.date,
        label: formatMD(d.date),
        metrics: toMetrics(
          offlineByDate.get(d.date) ?? 0,
          onlineByDate.get(d.date) ?? 0,
          d.spend,
        ),
      }),
    )
  })()

  // 평균 행 — "합계"(total, 조회 기간 전체 기준이라 grouping과 무관하게 항상
  // 같음)를 지금 표에 보이는 행 수로 나눈다. spend/offlineRevenue/onlineRevenue는
  // 그렇게 나누고, roas는 그 평균값들에서 다시 계산한다(비율을 그대로 평균
  // 내지 않는다 — 어차피 total.roas와 같은 값이 나오지만, 코드 상으로도
  // "합계 기준으로 비율을 다시 계산한다"는 원칙을 그대로 따른다).
  const average: RoasMetrics =
    rows.length > 0
      ? toMetrics(
          total.offlineRevenue / rows.length,
          total.onlineRevenue / rows.length,
          total.spend / rows.length,
        )
      : toMetrics(0, 0, 0)

  return { grouping, setGrouping, total, average, rows }
}
