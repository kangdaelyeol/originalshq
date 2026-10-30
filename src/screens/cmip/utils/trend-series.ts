import type { TrendSeries } from '@/components/glass'
import type { ISODate } from '../types'
import { buildWeekRanges } from '../client/insight-aggregate'
import { formatMD } from './dates'

// utils/index.ts(묶음)에는 넣지 않는다 — client/insight-aggregate가 그 묶음을
// 불러와서, 넣으면 서로 불러오는 고리가 된다. 쓰는 쪽이 이 파일을 바로 부른다.

/**
 * 추이 자세히 보기의 보기들 — 날짜별 줄(오래된 것부터)을 일별·주별·월별로
 * 묶는다. 값은 묶은 줄들로 combine이 계산한다(합계 지표는 더하고, 비율 지표는
 * 합계로 다시 나눈다 — 날짜별 비율의 평균이 아니라).
 *
 * 주는 표의 "주차별"과 같은 경계(조회 시작일부터 7일씩, 나머지는 맨 앞 —
 * buildWeekRanges), 달은 달력 달(그 달에 걸친 날만).
 */
export function trendSeriesOf<T extends { date: ISODate }>(
  rows: readonly T[],
  combine: (group: readonly T[]) => number,
): TrendSeries[] {
  if (rows.length === 0) return []
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const start = sorted[0].date
  const end = sorted[sorted.length - 1].date

  // 7일이 안 되는 주(조회 기간 맨 앞의 나머지)는 이름에 날 수를 붙인다 — 그
  // 칸만 값이 작게 나와도 왜인지 보이게.
  const weeks = buildWeekRanges(start, end).map((range) => {
    const group = sorted.filter(
      (row) => row.date >= range.start && row.date <= range.end,
    )
    const name =
      range.start === range.end
        ? formatMD(range.start)
        : `${formatMD(range.start)}~${formatMD(range.end)}`
    return {
      label: group.length < 7 ? `${name} (${group.length}일)` : name,
      rows: group,
    }
  })
  const months = new Map<string, T[]>()
  for (const row of sorted) {
    const key = row.date.slice(0, 7)
    months.set(key, [...(months.get(key) ?? []), row])
  }

  return [
    {
      key: 'day',
      label: '일별',
      unit: '일',
      labels: sorted.map((row) => formatMD(row.date)),
      values: sorted.map((row) => combine([row])),
    },
    {
      key: 'week',
      label: '주별',
      unit: '주',
      labels: weeks.map((week) => week.label),
      values: weeks.map((week) => combine(week.rows)),
    },
    {
      key: 'month',
      label: '월별',
      unit: '월',
      labels: [...months.keys()].map((key) => key.replace('-', '.')),
      values: [...months.values()].map((group) => combine(group)),
    },
  ]
}
