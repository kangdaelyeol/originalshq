import { weekdayKo } from '../channel/utils'
import { buildWeekRanges, formatMD } from './utils'
import type {
  OfflineSaleDateSummary,
  OfflineSaleDayOfWeekSummary,
  OfflineSaleMetricsSummary,
  OfflineSaleMonthSummary,
  OfflineSaleRow,
  OfflineSaleWeekSummary,
} from './types'

const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일']

// 할부 이자 라인은 매출이 아니라 매출 집계(revenue/discount/totalPaid/
// lineCount)에서 빼고 installmentInterest로만 따로 더한다 — cafe24/helper.ts가
// 취소/미결제 건을 revenueRows로 걸러내는 것과 같은 패턴.
const sumRows = (rows: OfflineSaleRow[]): OfflineSaleMetricsSummary => {
  const revenueRows = rows.filter((r) => !r.isInstallmentInterest)
  const interestRows = rows.filter((r) => r.isInstallmentInterest)
  return {
    totalPaid: revenueRows.reduce((s, r) => s + r.totalPaid, 0),
    revenue: revenueRows.reduce((s, r) => s + r.revenue, 0),
    discount: revenueRows.reduce((s, r) => s + r.discount, 0),
    lineCount: revenueRows.length,
    installmentInterest: interestRows.reduce((s, r) => s + r.totalPaid, 0),
  }
}

// 전체 합계
export const summarizeTotal = (rows: OfflineSaleRow[]): OfflineSaleMetricsSummary =>
  sumRows(rows)

// 일별 합계
export const summarizeByDate = (
  rows: OfflineSaleRow[],
): OfflineSaleDateSummary[] => {
  const grouped = new Map<string, OfflineSaleRow[]>()
  for (const row of rows) {
    if (!grouped.has(row.date)) grouped.set(row.date, [])
    grouped.get(row.date)!.push(row)
  }
  return Array.from(grouped.entries())
    .map(([date, rs]) => ({ date, ...sumRows(rs) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// 요일별 합계 — 월요일부터.
export const summarizeByDayOfWeek = (
  rows: OfflineSaleRow[],
): OfflineSaleDayOfWeekSummary[] => {
  const grouped = new Map<string, OfflineSaleRow[]>()
  for (const row of rows) {
    const dayOfWeek = weekdayKo(row.date)
    if (!grouped.has(dayOfWeek)) grouped.set(dayOfWeek, [])
    grouped.get(dayOfWeek)!.push(row)
  }
  return Array.from(grouped.entries())
    .map(([dayOfWeek, rs]) => ({ dayOfWeek, ...sumRows(rs) }))
    .sort(
      (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
    )
}

// 주차별 추이 — buildWeekRanges(조회 구간을 7일씩, 나머지는 첫 구간에)로 자른다.
export const summarizeByWeek = (
  rows: OfflineSaleRow[],
  startDate: string,
  endDate: string,
): OfflineSaleWeekSummary[] => {
  const ranges = buildWeekRanges(startDate, endDate)

  return ranges.map((range) => {
    const rs = rows.filter((r) => r.date >= range.start && r.date <= range.end)
    return {
      period: `${formatMD(range.start)}~${formatMD(range.end)}`,
      startDate: range.start,
      endDate: range.end,
      ...sumRows(rs),
    }
  })
}

// 월별 추이 — 달력월 기준. 데이터가 실제로 있는 달만 구간으로 낸다(조회
// 구간이 월 중간부터 시작해도 startDate/endDate는 그 달의 실제 첫/마지막
// 데이터 날짜다, 1일/말일이 아니라).
export const summarizeByMonth = (
  rows: OfflineSaleRow[],
): OfflineSaleMonthSummary[] => {
  const grouped = new Map<string, OfflineSaleRow[]>()
  for (const row of rows) {
    const monthKey = row.date.slice(0, 7) // "YYYY-MM"
    if (!grouped.has(monthKey)) grouped.set(monthKey, [])
    grouped.get(monthKey)!.push(row)
  }

  return Array.from(grouped.keys())
    .sort()
    .map((monthKey) => {
      const rs = grouped
        .get(monthKey)!
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
      return {
        period: monthKey.replace('-', '.'),
        startDate: rs[0].date,
        endDate: rs[rs.length - 1].date,
        ...sumRows(rs),
      }
    })
}
