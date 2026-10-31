import type { Period } from '../data/period'

// 보드 날짜는 한국 날짜 문자열(YYYY-MM-DD)이라 문자열 그대로 비교한다.

const DAY_MS = 24 * 60 * 60 * 1000
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 오늘(한국 날짜) */
export const koreaToday = (): string => new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10)

/** date에서 days일 더한 날(음수면 뺀 날). */
export const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

/** a → b 사이 날 수(같은 날이면 0). */
export const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)

const PERIOD_DAYS: Record<Period, number> = { today: 1, '7d': 7, '30d': 30, '1y': 365 }

export interface DateRange {
  from: string
  to: string
}

/** 조회 기간 — 오늘을 포함해 거슬러 올라간 날들. previous는 바로 앞 같은 길이. */
export function periodRange(period: Period, today = koreaToday()): { current: DateRange; previous: DateRange } {
  const days = PERIOD_DAYS[period]
  const from = addDays(today, -(days - 1))
  return {
    current: { from, to: today },
    previous: { from: addDays(from, -days), to: addDays(from, -1) },
  }
}

export const inRange = (date: string | null | undefined, range: DateRange): boolean =>
  !!date && date >= range.from && date <= range.to

/** 10/31 — 올해가 아니면 25/10/31 */
export function shortDate(date: string | null | undefined, today = koreaToday()): string {
  if (!date) return '—'
  const [y, m, d] = date.slice(0, 10).split('-')
  const md = `${Number(m)}/${Number(d)}`
  return y === today.slice(0, 4) ? md : `${y.slice(2)}/${md}`
}

/** 남은·지난 날 — 오늘 · 내일 · 3일 후 · 2일 전 */
export function relativeDay(date: string, today = koreaToday()): string {
  const diff = daysBetween(today, date)
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === -1) return '어제'
  return diff > 0 ? `${diff}일 후` : `${-diff}일 전`
}

/** 마지막 동기화 — 방금 · 5분 전 · 3시간 전 · 2일 전 */
export function sinceTime(ms: number, now = Date.now()): string {
  const minutes = Math.floor((now - ms) / 60_000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

/** Monday 시각(ISO, UTC) → 한국 날짜 */
export const isoToKoreaDate = (iso: string | null | undefined): string | null => {
  if (!iso) return null
  const time = Date.parse(iso)
  return Number.isNaN(time) ? iso.slice(0, 10) : new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** 날짜 오름차순(빈 값은 뒤로) — 정렬 비교 함수 */
export const byDateAsc = (a: string | null | undefined, b: string | null | undefined): number =>
  a && b ? a.localeCompare(b) : a ? -1 : b ? 1 : 0

/** 날짜 내림차순(빈 값은 뒤로) */
export const byDateDesc = (a: string | null | undefined, b: string | null | undefined): number =>
  a && b ? b.localeCompare(a) : a ? -1 : b ? 1 : 0
