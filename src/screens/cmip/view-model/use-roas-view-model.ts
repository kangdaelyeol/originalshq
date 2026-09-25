import { useState } from 'react'
import {
  groupByMonth,
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
  /** 광고비 대비 오프라인 매출 — 퍼센트(예: 250은 250%, 광고비의 2.5배).
   * 광고비가 0이면 나눌 수 없어 0으로 둔다. */
  roas: number
}

export interface RoasRow {
  key: string
  label: string
  metrics: RoasMetrics
}

const calcRoas = (offlineRevenue: number, spend: number): number =>
  spend > 0 ? (offlineRevenue / spend) * 100 : 0

const toMetrics = (offlineRevenue: number, spend: number): RoasMetrics => ({
  spend,
  offlineRevenue,
  roas: calcRoas(offlineRevenue, spend),
})

/**
 * ROAS(광고비 대비 오프라인 매출) 탭 — combinedInsight(광고비, Meta+Google+Naver
 * 이미 합산됨)와 offlineRevenue(Monday CRM 오프라인 매출, 별도 조회)를 날짜/
 * 요일/주차/월 키로 짝지어 ROAS를 계산한다. 두 데이터 모두 이미
 * useChannelInsightViewModel이 같은 dateStart/dateEnd로 조회해 갖고 있어(period-test
 * 탭처럼) 이 훅 자체는 새 네트워크 호출을 하지 않고 순수 파생만 한다.
 *
 * byDate/byDayOfWeek/byGroupedWeek는 광고비 쪽 buildWeekRanges(=functions-cmip와
 * 같은 주차 경계)와 오프라인 매출 쪽(같은 알고리즘을 백엔드에 별도 구현)이
 * 이미 같은 방식으로 잘려 있어 period 문자열이 그대로 일치한다. byMonth만
 * combinedInsight.series에 없어 groupByMonth로 광고비 쪽을 직접 파생시킨 뒤
 * 오프라인 매출의 byMonth와 맞춘다.
 */
export const useRoasViewModel = (
  combinedInsight: CombinedInsight | null,
  offlineRevenue: OfflineRevenueSummary | null,
) => {
  const [grouping, setGrouping] = useState<RoasGrouping>(RoasGrouping.DATE)

  const total: RoasMetrics = toMetrics(
    offlineRevenue?.total.totalPaid ?? 0,
    combinedInsight?.total.combined.spend ?? 0,
  )

  const rows: RoasRow[] = (() => {
    if (!combinedInsight || !offlineRevenue) return []

    if (grouping === RoasGrouping.MONTH) {
      const spendByMonth = groupByMonth(combinedInsight.series.combined.byDate)
      const spendByPeriod = new Map(spendByMonth.map((m) => [m.period, m.spend]))
      return offlineRevenue.byMonth.map(
        (m): RoasRow => ({
          key: m.period,
          label: m.period,
          metrics: toMetrics(m.totalPaid, spendByPeriod.get(m.period) ?? 0),
        }),
      )
    }

    if (grouping === RoasGrouping.DAY_OF_WEEK) {
      const spendByDay = new Map(
        combinedInsight.series.combined.byDayOfWeek.map((d) => [
          d.dayOfWeek,
          d.spend,
        ]),
      )
      return offlineRevenue.byDayOfWeek.map(
        (d): RoasRow => ({
          key: d.dayOfWeek,
          label: d.dayOfWeek,
          metrics: toMetrics(d.totalPaid, spendByDay.get(d.dayOfWeek) ?? 0),
        }),
      )
    }

    if (grouping === RoasGrouping.WEEK) {
      const spendByPeriod = new Map(
        combinedInsight.series.combined.byGroupedWeek.map((w) => [
          w.period,
          w.spend,
        ]),
      )
      return offlineRevenue.byGroupedWeek.map(
        (w): RoasRow => ({
          key: w.period,
          label: w.period,
          metrics: toMetrics(w.totalPaid, spendByPeriod.get(w.period) ?? 0),
        }),
      )
    }

    // byDate
    const spendByDate = new Map(
      combinedInsight.series.combined.byDate.map((d) => [d.date, d.spend]),
    )
    return offlineRevenue.byDate.map(
      (d): RoasRow => ({
        key: d.date,
        label: formatMD(d.date),
        metrics: toMetrics(d.totalPaid, spendByDate.get(d.date) ?? 0),
      }),
    )
  })()

  // 평균 행 — "합계"(total, 조회 기간 전체 기준이라 grouping과 무관하게 항상
  // 같음)를 지금 표에 보이는 행 수로 나눈다. spend/offlineRevenue는 그렇게
  // 나누고, roas는 그 평균 spend/offlineRevenue에서 다시 계산한다(비율을
  // 그대로 평균 내지 않는다 — 어차피 total.roas와 같은 값이 나오지만, 코드
  // 상으로도 "합계 기준으로 비율을 다시 계산한다"는 원칙을 그대로 따른다).
  const average: RoasMetrics =
    rows.length > 0
      ? toMetrics(total.offlineRevenue / rows.length, total.spend / rows.length)
      : toMetrics(0, 0)

  return { grouping, setGrouping, total, average, rows }
}
