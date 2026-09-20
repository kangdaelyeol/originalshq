import {
  AdsetSummary,
  CampaignSummary,
  DataSetInsight,
  DateSummary,
  DayOfWeekSummary,
  GroupedInsightSeries,
  MetaInsight,
  MetricsSummary,
  WeekSummary,
} from './types'
import { buildWeekRanges, formatMD, getResultType, sumRows } from './utils'

const DAY_NAMES_BY_INDEX = ['일', '월', '화', '수', '목', '금', '토']
const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일']

// 전체 합계
export const summarizeTotal = (data: MetaInsight): MetricsSummary => {
  return sumRows(data)
}

// 기간(일자)별 합계
export const summarizeByDate = (data: MetaInsight): DateSummary[] => {
  const grouped = new Map<string, DataSetInsight[]>()

  for (const row of data) {
    const key = row.date_start
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  }

  return Array.from(grouped.entries())
    .map(([date, rows]) => ({ date, ...sumRows(rows) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// 주차별 성과 추이
export const summarizeByWeek = (
  data: MetaInsight,
  startDate: string,
  endDate: string,
): WeekSummary[] => {
  const ranges = buildWeekRanges(startDate, endDate)

  return ranges.map((range) => {
    const rows = data.filter(
      (row) => row.date_start >= range.start && row.date_start <= range.end,
    )

    return {
      period: `${formatMD(range.start)}~${formatMD(range.end)}`,
      startDate: range.start,
      endDate: range.end,
      ...sumRows(rows),
    }
  })
}

// 요일별 합계
export const summarizeByDayOfWeek = (data: MetaInsight): DayOfWeekSummary[] => {
  const grouped = new Map<string, DataSetInsight[]>()

  for (const row of data) {
    const dayIndex = new Date(row.date_start).getDay()
    const dayName = DAY_NAMES_BY_INDEX[dayIndex]
    if (!grouped.has(dayName)) grouped.set(dayName, [])
    grouped.get(dayName)!.push(row)
  }

  return Array.from(grouped.entries())
    .map(([dayOfWeek, rows]) => ({ dayOfWeek, ...sumRows(rows) }))
    .sort(
      (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
    )
}

const groupBy = (
  rows: DataSetInsight[],
  keyOf: (row: DataSetInsight) => string,
): Map<string, DataSetInsight[]> => {
  const grouped = new Map<string, DataSetInsight[]>()
  for (const row of rows) {
    const key = keyOf(row)
    const bucket = grouped.get(key)
    if (bucket) bucket.push(row)
    else grouped.set(key, [row])
  }
  return grouped
}

/** byDate/byDayOfWeek/byGroupedWeek 3종을 total과 같은 방식으로, 넘겨받은 rows
 * 부분집합 기준으로 도출한다 — 캠페인/adset 단위 요약이 이 함수를 공유한다. */
const summarizeSeries = (
  rows: DataSetInsight[],
  startDate: string,
  endDate: string,
): GroupedInsightSeries => ({
  byDate: summarizeByDate(rows),
  byDayOfWeek: summarizeByDayOfWeek(rows),
  byGroupedWeek: summarizeByWeek(rows, startDate, endDate),
})

// 캠페인별(그 안의 adset별 포함) byDate/byDayOfWeek/byGroupedWeek
export const summarizeByCampaign = (
  data: MetaInsight,
  startDate: string,
  endDate: string,
): CampaignSummary[] => {
  const campaignGroups = groupBy(data, (row) => row.campaign_name)

  return Array.from(campaignGroups.entries())
    .map(([campaignName, campaignRows]): CampaignSummary => {
      const adsetGroups = groupBy(campaignRows, (row) => row.adset_name)
      const adsets: AdsetSummary[] = Array.from(adsetGroups.entries())
        .map(
          ([adsetName, adsetRows]): AdsetSummary => ({
            adsetName,
            ...summarizeSeries(adsetRows, startDate, endDate),
          }),
        )
        .sort((a, b) => a.adsetName.localeCompare(b.adsetName))

      // 결과 유형 — 캠페인은 보통 하나의 결과 목표로 운영되므로, 그 기간 안에서
      // 결과 데이터가 있는 첫 행의 indicator를 대표값으로 쓴다.
      const resultType =
        campaignRows.map(getResultType).find((t) => t != null) ?? null

      return {
        campaignName,
        ...summarizeSeries(campaignRows, startDate, endDate),
        adsets,
        resultType,
      }
    })
    .sort((a, b) => a.campaignName.localeCompare(b.campaignName))
}
