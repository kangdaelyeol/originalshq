import {
  DataSetInsight,
  DateSummary,
  DayOfWeekSummary,
  MetaInsight,
  MetricsSummary,
  WeekSummary,
} from './types'
import { buildWeekRanges, formatMD, sumRows } from './utils'

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
