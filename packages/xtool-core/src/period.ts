/** 숫자 카드·차트의 기간 — 차트 칸(periodBuckets)은 웹 화면(data/period.ts)에 있다. */
export type Period = 'today' | '7d' | '30d' | '1y'

/** 기간 고르는 단추 — 웹 상단바와 앱이 같이 쓴다. */
export const PERIOD_OPTIONS: readonly { value: Period; label: string }[] = [
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
