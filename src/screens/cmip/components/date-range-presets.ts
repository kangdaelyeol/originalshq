import { addDays, fromISO, startOfMonth, todayISO } from '../utils'
import type { ISODate } from '../types'

export interface Preset {
  key: string
  label: string
  range: () => [ISODate, ISODate]
}

export const CUSTOM_KEY = 'custom'

/** "지난 N일"의 기준일 — 오늘은 아직 데이터가 다 안 쌓였을 수 있어 어제까지로 센다. */
function lastNDaysEndingYesterday(n: number): [ISODate, ISODate] {
  const end = addDays(todayISO(), -1)
  return [addDays(end, -(n - 1)), end]
}

/** GA 스타일 날짜 프리셋. */
export const PRESETS: readonly Preset[] = [
  {
    key: 'today',
    label: '오늘',
    range: () => [todayISO(), todayISO()],
  },
  {
    key: 'yesterday',
    label: '어제',
    range: () => {
      const y = addDays(todayISO(), -1)
      return [y, y]
    },
  },
  {
    key: 'today_yesterday',
    label: '오늘과 어제',
    range: () => [addDays(todayISO(), -1), todayISO()],
  },
  {
    key: 'last7',
    label: '지난 7일',
    range: () => lastNDaysEndingYesterday(7),
  },
  {
    key: 'last14',
    label: '지난 14일',
    range: () => lastNDaysEndingYesterday(14),
  },
  {
    key: 'last28',
    label: '지난 28일',
    range: () => lastNDaysEndingYesterday(28),
  },
  {
    key: 'last30',
    label: '지난 30일',
    range: () => lastNDaysEndingYesterday(30),
  },
  {
    key: 'this_week',
    label: '이번 주',
    range: () => {
      const t = todayISO()
      const dow = fromISO(t).getUTCDay()
      return [addDays(t, -dow), t]
    },
  },
  {
    key: 'last_week',
    label: '지난 주',
    range: () => {
      const t = todayISO()
      const dow = fromISO(t).getUTCDay()
      const thisWeekStart = addDays(t, -dow)
      const end = addDays(thisWeekStart, -1)
      return [addDays(end, -6), end]
    },
  },
  {
    key: 'this_month',
    label: '이번 달',
    range: () => [startOfMonth(todayISO()), todayISO()],
  },
  {
    key: 'last_month',
    label: '지난 달',
    range: () => {
      const end = addDays(startOfMonth(todayISO()), -1)
      return [startOfMonth(end), end]
    },
  },
]

export function matchPreset(start: ISODate, end: ISODate): string {
  const found = PRESETS.find((p) => {
    const [s, e] = p.range()
    return s === start && e === end
  })
  return found?.key ?? CUSTOM_KEY
}
