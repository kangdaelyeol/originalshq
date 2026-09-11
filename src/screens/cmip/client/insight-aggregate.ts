/**
 * 여러 채널(Meta/Google 목업, 향후 당근·네이버)의 인사이트 응답을 다루는 공용
 * 집계 도구.
 * - 원본 카운트(impressions/clicks/spend/conversions)를 합산하고 비율(ctr 등)은
 *   그 합계에서 다시 계산한다 — 비율의 평균이 아니라 합계 기준 비율이어야 맞다.
 * - byDate → byDayOfWeek/byGroupedWeek로 묶는 "표준" 그룹핑을 여기 한 곳에 둔다.
 *   채널마다 자체 집계 방식이 조금씩 달라도(예: functions-cmip의 주차 경계 방식은
 *   조회 시작일부터 7일씩 자르고, 여기 표준 방식은 캘린더 월요일 기준) 여러 채널을
 *   합칠 때는 이 표준 방식으로 다시 묶어서 경계가 서로 어긋나지 않게 한다.
 */
import { addDays, formatMD, fromISO } from '../utils'
import type { ISODate } from '../types'
import type {
  DateSummary,
  DayOfWeekSummary,
  GroupedInsightSeries,
  MetricsSummary,
  WeekSummary,
} from './insight-client'

const WEEKDAY_LABELS_MON_FIRST = ['월', '화', '수', '목', '금', '토', '일']

export function emptyMetrics(): MetricsSummary {
  return {
    impressions: 0,
    clicks: 0,
    spend: 0,
    conversions: 0,
    ctr: 0,
    cpc: 0,
    cpa: 0,
    cvr: 0,
    cpm: 0,
    frequency: 0,
  }
}

export function emptySeries(): GroupedInsightSeries {
  return { byDate: [], byDayOfWeek: [], byGroupedWeek: [] }
}

interface RawCounts {
  impressions: number
  clicks: number
  spend: number
  conversions: number
  /** frequency는 단순 합산 대상이 아니라 impressions 가중 평균으로 근사한다. */
  weightedFrequency: number
}

/** 원본 카운트 합계에서 비율 지표를 다시 계산한다. */
export function deriveMetrics(counts: RawCounts): MetricsSummary {
  const { impressions, clicks, spend, conversions, weightedFrequency } = counts
  return {
    impressions,
    clicks,
    spend,
    conversions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    frequency: impressions > 0 ? weightedFrequency / impressions : 0,
  }
}

/** 지표 행 여러 개를 하나로 합친다(합계 기준 비율 재계산). */
export function aggregateMetrics(
  rows: readonly MetricsSummary[],
): MetricsSummary {
  return deriveMetrics({
    impressions: rows.reduce((s, r) => s + r.impressions, 0),
    clicks: rows.reduce((s, r) => s + r.clicks, 0),
    spend: rows.reduce((s, r) => s + r.spend, 0),
    conversions: rows.reduce((s, r) => s + r.conversions, 0),
    weightedFrequency: rows.reduce(
      (s, r) => s + r.frequency * r.impressions,
      0,
    ),
  })
}

/** 두 지표를 합친다 — 원본 카운트는 더하고 비율은 그 합계에서 다시 계산. */
export function sumMetrics(
  a: MetricsSummary,
  b: MetricsSummary,
): MetricsSummary {
  return aggregateMetrics([a, b])
}

/** 날짜별 데이터 두 묶음을 날짜 기준으로 합친다 — 겹치는 날짜는 두 채널 값을
 * 합산하고, 한쪽에만 있는 날짜는 그대로 가져간다. */
export function mergeByDate(
  a: readonly DateSummary[],
  b: readonly DateSummary[],
): DateSummary[] {
  const byDate = new Map<ISODate, MetricsSummary>()
  for (const row of a) byDate.set(row.date, row)
  for (const row of b) {
    const existing = byDate.get(row.date)
    byDate.set(row.date, existing ? sumMetrics(existing, row) : row)
  }
  return Array.from(byDate.entries())
    .map(([date, metrics]) => ({ date, ...metrics }))
    .sort((x, y) => x.date.localeCompare(y.date))
}

/** 해당 날짜가 속한 캘린더 주의 월요일. */
function mondayOf(date: ISODate): ISODate {
  const dow = fromISO(date).getUTCDay() // 0=일 ~ 6=토
  const offset = dow === 0 ? -6 : 1 - dow
  return addDays(date, offset)
}

/** 날짜 → 요일 라벨(월요일 시작). groupByDayOfWeek와, 특정 요일 행에 대응하는
 * 채널별 부분합을 되짚어 구할 때(예: 표의 "채널별 자세히 보기") 함께 쓴다. */
export function weekdayLabelOf(date: ISODate): string {
  return WEEKDAY_LABELS_MON_FIRST[(fromISO(date).getUTCDay() + 6) % 7]
}

/** byDate → byDayOfWeek(월요일부터 순서대로, 데이터에 있는 요일만). */
export function groupByDayOfWeek(
  byDate: readonly DateSummary[],
): DayOfWeekSummary[] {
  const groups = new Map<string, DateSummary[]>()
  for (const row of byDate) {
    const label = weekdayLabelOf(row.date)
    const g = groups.get(label)
    if (g) g.push(row)
    else groups.set(label, [row])
  }
  return WEEKDAY_LABELS_MON_FIRST.flatMap((label) => {
    const g = groups.get(label)
    return g ? [{ dayOfWeek: label, ...aggregateMetrics(g) }] : []
  })
}

/** byDate 중 predicate를 만족하는 날짜들만 골라 합친 지표 — 표의 한 행(날짜/요일/
 * 주차)이 가리키는 날짜 구간에 대해 다른 채널의 값을 그대로 되짚어 구할 때 쓴다.
 * 채널마다 요일별/주차별 집계 경계가 달라도(예: functions-cmip의 주차 구간과
 * 표준 그룹핑이 다름) 항상 원본 날짜 단위로 다시 걸러서 더하므로 정확히 맞는다. */
export function metricsForDateSubset(
  byDate: readonly DateSummary[],
  predicate: (date: ISODate) => boolean,
): MetricsSummary {
  return aggregateMetrics(byDate.filter((row) => predicate(row.date)))
}

/** byDate → byGroupedWeek(캘린더 월요일 시작 주 단위). */
export function groupByWeek(byDate: readonly DateSummary[]): WeekSummary[] {
  const groups = new Map<ISODate, DateSummary[]>()
  for (const row of byDate) {
    const weekStart = mondayOf(row.date)
    const g = groups.get(weekStart)
    if (g) g.push(row)
    else groups.set(weekStart, [row])
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => {
      const startDate = group[0].date
      const endDate = group[group.length - 1].date
      return {
        period: `${formatMD(startDate)}~${formatMD(endDate)}`,
        startDate,
        endDate,
        ...aggregateMetrics(group),
      }
    })
}

/** byDate 하나로부터 byDayOfWeek/byGroupedWeek까지 표준 방식으로 다시 묶는다. */
export function seriesFromByDate(
  byDate: readonly DateSummary[],
): GroupedInsightSeries {
  return {
    byDate: [...byDate].sort((a, b) => a.date.localeCompare(b.date)),
    byDayOfWeek: groupByDayOfWeek(byDate),
    byGroupedWeek: groupByWeek(byDate),
  }
}
