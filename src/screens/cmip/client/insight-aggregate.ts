/**
 * 여러 채널(Meta/Google 목업, 향후 당근·네이버)의 인사이트 응답을 다루는 공용
 * 집계 도구.
 * - 원본 카운트(impressions/clicks/spend/conversions)를 합산하고 비율(ctr 등)은
 *   그 합계에서 다시 계산한다 — 비율의 평균이 아니라 합계 기준 비율이어야 맞다.
 * - byDate → byDayOfWeek/byGroupedWeek로 묶는 "표준" 그룹핑을 여기 한 곳에 둔다.
 *   주차 경계는 functions-cmip(Meta capi)의 buildWeekRanges와 정확히 같은 방식
 *   (조회 시작일부터 7일씩, 나머지는 앞에 먼저) — 캘린더 월요일 기준 등 다른
 *   방식을 쓰면 채널마다(혹은 종합과 Meta 단독 사이에도) 주차 경계가 어긋난다.
 */
import { addDays, dateRange, formatMD, fromISO } from '../utils'
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
    revenue: 0,
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
  /** 전환매출액 — 다른 카운트와 마찬가지로 그냥 합산한다(가중치 필요 없음). */
  revenue: number
  /** frequency는 단순 합산 대상이 아니라 impressions 가중 평균으로 근사한다. */
  weightedFrequency: number
}

/** 원본 카운트 합계에서 비율 지표를 다시 계산한다. */
export function deriveMetrics(counts: RawCounts): MetricsSummary {
  const { impressions, clicks, spend, conversions, revenue, weightedFrequency } =
    counts
  return {
    impressions,
    clicks,
    spend,
    conversions,
    revenue,
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
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
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

/**
 * 채널을 합칠 때 전용 — 네이버처럼 frequency 지표 자체를 제공하지 않는 채널은
 * (그 채널의 frequency가 진짜 0이 아니라 "측정 안 됨"인데도) impressions/clicks/
 * spend/conversions처럼 그냥 합산해버리면, frequency 가중평균(노출수 기준)의
 * 분모에는 그 채널 노출수가 그대로 들어가면서 분자 기여분(frequency×노출수)만
 * 0이 되어 "종합" frequency가 실제보다 낮게 나온다. hasFrequency: false인 소스는
 * frequency 가중평균 계산(분자·분모 둘 다)에서 완전히 제외하고, 나머지 지표는
 * 소스 구분 없이 그대로 합산한다.
 */
export function sumMetricsWeighted(
  entries: readonly { metrics: MetricsSummary; hasFrequency: boolean }[],
): MetricsSummary {
  const impressions = entries.reduce((s, e) => s + e.metrics.impressions, 0)
  const clicks = entries.reduce((s, e) => s + e.metrics.clicks, 0)
  const spend = entries.reduce((s, e) => s + e.metrics.spend, 0)
  const conversions = entries.reduce((s, e) => s + e.metrics.conversions, 0)
  const revenue = entries.reduce((s, e) => s + e.metrics.revenue, 0)
  const weightedFrequency = entries.reduce(
    (s, e) =>
      s + (e.hasFrequency ? e.metrics.frequency * e.metrics.impressions : 0),
    0,
  )
  const frequencyWeight = entries.reduce(
    (s, e) => s + (e.hasFrequency ? e.metrics.impressions : 0),
    0,
  )
  return {
    impressions,
    clicks,
    spend,
    conversions,
    revenue,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    frequency: frequencyWeight > 0 ? weightedFrequency / frequencyWeight : 0,
  }
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

/** mergeByDate의 다중 소스·채널 인지 버전 — sumMetricsWeighted와 같은 이유로,
 * hasFrequency: false인 소스는 날짜별로 합칠 때도 frequency 가중평균에서 제외한다. */
export function mergeByDateWeighted(
  entries: readonly {
    byDate: readonly DateSummary[]
    hasFrequency: boolean
  }[],
): DateSummary[] {
  const byDate = new Map<
    ISODate,
    { metrics: MetricsSummary; hasFrequency: boolean }[]
  >()
  for (const entry of entries) {
    for (const row of entry.byDate) {
      const list = byDate.get(row.date) ?? []
      list.push({ metrics: row, hasFrequency: entry.hasFrequency })
      byDate.set(row.date, list)
    }
  }
  return Array.from(byDate.entries())
    .map(([date, list]) => ({ date, ...sumMetricsWeighted(list) }))
    .sort((x, y) => x.date.localeCompare(y.date))
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

/** functions-cmip의 buildWeekRanges와 동일 — 조회 시작일부터 7일씩 자르고,
 * 전체 일수가 7의 배수가 아니면 그 나머지를 맨 앞 구간으로 먼저 둔다. */
function buildWeekRanges(
  startDate: ISODate,
  endDate: ISODate,
): { start: ISODate; end: ISODate }[] {
  const totalDays = dateRange(startDate, endDate).length
  const remDays = totalDays % 7

  const ranges: { start: ISODate; end: ISODate }[] = []
  let cursor = startDate

  if (remDays > 0) {
    const rangeEnd = addDays(cursor, remDays - 1)
    ranges.push({ start: cursor, end: rangeEnd })
    cursor = addDays(cursor, remDays)
  }

  while (cursor <= endDate) {
    const rangeEnd = addDays(cursor, 6)
    ranges.push({ start: cursor, end: rangeEnd })
    cursor = addDays(cursor, 7)
  }

  return ranges
}

/** byDate → byGroupedWeek. 주차 경계는 조회 범위(startDate~endDate) 전체를
 * 기준으로 자른다 — 특정 채널의 실제 데이터 범위가 그보다 좁아도(예: 목업 보유
 * 기간 제한) 항상 같은 경계를 쓰도록. 데이터가 없는 구간은 0으로 채워진다. */
export function groupByWeek(
  byDate: readonly DateSummary[],
  startDate: ISODate,
  endDate: ISODate,
): WeekSummary[] {
  return buildWeekRanges(startDate, endDate).map((range) => {
    const rows = byDate.filter(
      (row) => row.date >= range.start && row.date <= range.end,
    )
    return {
      period: `${formatMD(range.start)}~${formatMD(range.end)}`,
      startDate: range.start,
      endDate: range.end,
      ...aggregateMetrics(rows),
    }
  })
}

/** byDate 하나로부터 byDayOfWeek/byGroupedWeek까지 표준 방식으로 다시 묶는다.
 * startDate/endDate는 주차 경계의 기준이 되는 조회 범위 — byDate 자체의 실제
 * 커버리지가 아니라 항상 이 범위로 잘라야 채널 간 경계가 일치한다. */
export function seriesFromByDate(
  byDate: readonly DateSummary[],
  startDate: ISODate,
  endDate: ISODate,
): GroupedInsightSeries {
  return {
    byDate: [...byDate].sort((a, b) => a.date.localeCompare(b.date)),
    byDayOfWeek: groupByDayOfWeek(byDate),
    byGroupedWeek: groupByWeek(byDate, startDate, endDate),
  }
}
