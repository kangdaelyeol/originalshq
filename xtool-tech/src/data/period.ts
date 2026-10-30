import type { Option } from './types'

export type Period = 'today' | '7d' | '30d' | '1y'

export const PERIOD_OPTIONS: readonly Option<Period>[] = [
  { value: 'today', label: '오늘' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: '1y', label: '1년' },
]

/** 직전 기간과 비교할 때 쓰는 이름 — 차트 범례와 KPI 캡션에 들어간다. */
export const PERIOD_COMPARE: Record<Period, { current: string; previous: string }> = {
  today: { current: '오늘', previous: '어제' },
  '7d': { current: '이번 주', previous: '지난주' },
  '30d': { current: '최근 30일', previous: '직전 30일' },
  '1y': { current: '최근 1년', previous: '직전 1년' },
}

const TODAY = new Date()

const daysAgo = (n: number): Date => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  return d
}

const monthDay = (d: Date): string => `${d.getMonth() + 1}/${d.getDate()}`

/** 기간별 x축 칸 — 오늘은 2시간, 7일은 하루, 30일은 3일, 1년은 한 달 단위. */
export function periodBuckets(period: Period): string[] {
  switch (period) {
    case 'today':
      return Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, '0')}시`)
    case '7d':
      return Array.from({ length: 7 }, (_, i) => monthDay(daysAgo(6 - i)))
    case '30d':
      return Array.from({ length: 10 }, (_, i) => monthDay(daysAgo(29 - i * 3)))
    case '1y':
      return Array.from({ length: 12 }, (_, i) => `${((TODAY.getMonth() + 1 + i) % 12) + 1}월`)
  }
}
