import {
  AdsetSummary,
  CampaignSummary,
  DateSummary,
  DayOfWeekSummary,
  GroupedInsightSeries,
  MetricsSummary,
  NaverInsight,
  NaverInsightRow,
  WeekSummary,
} from './types'
import { buildWeekRanges, formatMD, sumRows } from './utils'

// Meta(channel/meta/helper.ts)와 도출 방식이 완전히 동일 — 원본 행 배열
// 하나(NaverInsight)로부터 total/byDate/byDayOfWeek/byGroupedWeek/byCampaign을
// 같은 규칙으로 뽑아낸다. 채널마다 이 규칙이 다르면 "종합(전체)" 합산·주차
// 경계가 어긋나므로, 세 채널(Meta/Google/Naver) 모두 이 구조를 그대로 따른다.

const DAY_NAMES_BY_INDEX = ['일', '월', '화', '수', '목', '금', '토']
const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일']

// 전체 합계
export const summarizeTotal = (data: NaverInsight): MetricsSummary => {
  return sumRows(data)
}

// 기간(일자)별 합계
export const summarizeByDate = (data: NaverInsight): DateSummary[] => {
  const grouped = new Map<string, NaverInsightRow[]>()

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
  data: NaverInsight,
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
export const summarizeByDayOfWeek = (data: NaverInsight): DayOfWeekSummary[] => {
  const grouped = new Map<string, NaverInsightRow[]>()

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
  rows: NaverInsightRow[],
  keyOf: (row: NaverInsightRow) => string,
): Map<string, NaverInsightRow[]> => {
  const grouped = new Map<string, NaverInsightRow[]>()
  for (const row of rows) {
    const key = keyOf(row)
    const bucket = grouped.get(key)
    if (bucket) bucket.push(row)
    else grouped.set(key, [row])
  }
  return grouped
}

/** byDate/byDayOfWeek/byGroupedWeek 3종을 total과 같은 방식으로, 넘겨받은 rows
 * 부분집합 기준으로 도출한다 — 캠페인/adgroup 단위 요약이 이 함수를 공유한다. */
const summarizeSeries = (
  rows: NaverInsightRow[],
  startDate: string,
  endDate: string,
): GroupedInsightSeries => ({
  byDate: summarizeByDate(rows),
  byDayOfWeek: summarizeByDayOfWeek(rows),
  byGroupedWeek: summarizeByWeek(rows, startDate, endDate),
})

// 캠페인별(그 안의 adgroup별 포함) byDate/byDayOfWeek/byGroupedWeek
export const summarizeByCampaign = (
  data: NaverInsight,
  startDate: string,
  endDate: string,
): CampaignSummary[] => {
  const campaignGroups = groupBy(data, (row) => row.campaign_name)

  return Array.from(campaignGroups.entries())
    .map(([campaignName, campaignRows]): CampaignSummary => {
      const adgroupGroups = groupBy(campaignRows, (row) => row.adgroup_name)
      const adsets: AdsetSummary[] = Array.from(adgroupGroups.entries())
        .map(
          ([adgroupName, adgroupRows]): AdsetSummary => ({
            adsetName: adgroupName,
            ...summarizeSeries(adgroupRows, startDate, endDate),
          }),
        )
        .sort((a, b) => a.adsetName.localeCompare(b.adsetName))

      return {
        campaignName,
        ...summarizeSeries(campaignRows, startDate, endDate),
        adsets,
      }
    })
    .sort((a, b) => a.campaignName.localeCompare(b.campaignName))
}
