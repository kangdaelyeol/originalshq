import { weekdayKo } from '../channel/utils'
import { buildWeekRanges, formatMD } from './utils'
import type {
  Cafe24DateSummary,
  Cafe24DayOfWeekSummary,
  Cafe24MetricsSummary,
  Cafe24MonthSummary,
  Cafe24OrderRow,
  Cafe24WeekSummary,
} from './types'

const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일']

/** 매출로 셀 주문만 남긴다 — 결제 완료(paid) + 전체 취소 아님(canceled).
 * 부분취소는 paymentAmount 자체가 이미 줄어든 값이라 별도 처리가 필요 없다. */
const revenueRows = (rows: readonly Cafe24OrderRow[]): Cafe24OrderRow[] =>
  rows.filter((r) => r.paid && !r.canceled)

const sumRows = (rows: readonly Cafe24OrderRow[]): Cafe24MetricsSummary => {
  const counted = revenueRows(rows)
  return {
    paymentAmount: counted.reduce((s, r) => s + r.paymentAmount, 0),
    orderCount: counted.length,
  }
}

export const summarizeTotal = (
  rows: readonly Cafe24OrderRow[],
): Cafe24MetricsSummary => sumRows(rows)

export const summarizeByDate = (
  rows: readonly Cafe24OrderRow[],
): Cafe24DateSummary[] => {
  const grouped = new Map<string, Cafe24OrderRow[]>()
  for (const row of rows) {
    if (!grouped.has(row.orderDate)) grouped.set(row.orderDate, [])
    grouped.get(row.orderDate)!.push(row)
  }
  return Array.from(grouped.entries())
    .map(([date, rs]) => ({ date, ...sumRows(rs) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const summarizeByDayOfWeek = (
  rows: readonly Cafe24OrderRow[],
): Cafe24DayOfWeekSummary[] => {
  const grouped = new Map<string, Cafe24OrderRow[]>()
  for (const row of rows) {
    const dayOfWeek = weekdayKo(row.orderDate)
    if (!grouped.has(dayOfWeek)) grouped.set(dayOfWeek, [])
    grouped.get(dayOfWeek)!.push(row)
  }
  return Array.from(grouped.entries())
    .map(([dayOfWeek, rs]) => ({ dayOfWeek, ...sumRows(rs) }))
    .sort(
      (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
    )
}

export const summarizeByWeek = (
  rows: readonly Cafe24OrderRow[],
  startDate: string,
  endDate: string,
): Cafe24WeekSummary[] => {
  const ranges = buildWeekRanges(startDate, endDate)

  return ranges.map((range) => {
    const rs = rows.filter(
      (r) => r.orderDate >= range.start && r.orderDate <= range.end,
    )
    return {
      period: `${formatMD(range.start)}~${formatMD(range.end)}`,
      startDate: range.start,
      endDate: range.end,
      ...sumRows(rs),
    }
  })
}

export const summarizeByMonth = (
  rows: readonly Cafe24OrderRow[],
): Cafe24MonthSummary[] => {
  const grouped = new Map<string, Cafe24OrderRow[]>()
  for (const row of rows) {
    const monthKey = row.orderDate.slice(0, 7) // "YYYY-MM"
    if (!grouped.has(monthKey)) grouped.set(monthKey, [])
    grouped.get(monthKey)!.push(row)
  }

  return Array.from(grouped.keys())
    .sort()
    .map((monthKey) => {
      const rs = grouped
        .get(monthKey)!
        .slice()
        .sort((a, b) => a.orderDate.localeCompare(b.orderDate))
      return {
        period: monthKey.replace('-', '.'),
        startDate: rs[0].orderDate,
        endDate: rs[rs.length - 1].orderDate,
        ...sumRows(rs),
      }
    })
}
