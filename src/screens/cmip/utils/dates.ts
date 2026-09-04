/**
 * 날짜 파싱/연산 — functions-cmip `src/utils/dates.ts`에서 CSV 파싱에 필요한 부분만 이관.
 * 날짜는 타임존 없는 "달력상의 날", 표준형은 ISO 문자열 "YYYY-MM-DD", 연산은 UTC 기준.
 */
import type { ISODate } from '../types'

export const toISO = (d: Date): ISODate => {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const fromISO = (s: ISODate): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export const addDays = (iso: ISODate, days: number): ISODate => {
  const dt = fromISO(iso)
  dt.setUTCDate(dt.getUTCDate() + days)
  return toISO(dt)
}

interface DatePattern {
  re: RegExp
  order: readonly [number, number, number] // [연, 월, 일]이 매치 그룹 중 몇 번째인지
}

const DATE_PATTERNS: readonly DatePattern[] = [
  { re: /^(\d{4})\.(\d{1,2})\.(\d{1,2})\.?$/, order: [1, 2, 3] },
  { re: /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/, order: [1, 2, 3] },
  { re: /^(\d{4})(\d{2})(\d{2})$/, order: [1, 2, 3] },
  { re: /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/, order: [3, 1, 2] },
]

/**
 * 다양한 매체 CSV 날짜 표기를 "YYYY-MM-DD"로. 못 읽으면 null.
 * 문자열/Date/엑셀 시리얼 숫자 등 CSV 셀에서 나올 수 있는 값을 폭넓게 받는다.
 */
export const parseDate = (v: unknown): ISODate | null => {
  if (v == null) return null
  if (v instanceof Date)
    return toISO(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())))
  const s = String(v).trim()
  if (!s) return null

  // 엑셀 시리얼 (1899-12-30 기준)
  if (/^\d{4,6}(\.0+)?$/.test(s)) {
    const n = Math.trunc(Number(s))
    if (n >= 20000 && n <= 80000) {
      const base = Date.UTC(1899, 11, 30)
      return toISO(new Date(base + n * 86400000))
    }
  }

  for (const { re, order } of DATE_PATTERNS) {
    const m = re.exec(s)
    if (!m) continue
    const [yi, mi, di] = order
    const y = Number(m[yi])
    const mo = Number(m[mi])
    const d = Number(m[di])
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
    const dt = new Date(Date.UTC(y, mo - 1, d))
    // 롤오버 방지 (예: 2월 30일)
    if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
    return toISO(dt)
  }
  return null
}

/** 시작~끝(포함) ISO 날짜 배열. */
export const dateRange = (startISO: ISODate, endISO: ISODate): ISODate[] => {
  let s = startISO
  let e = endISO
  if (fromISO(e) < fromISO(s)) [s, e] = [e, s]
  const out: ISODate[] = []
  for (let cur = s; fromISO(cur) <= fromISO(e); cur = addDays(cur, 1))
    out.push(cur)
  return out
}

/** 오늘(로컬 달력 기준) ISO. */
export const todayISO = (): ISODate => {
  const now = new Date()
  return toISO(
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
  )
}
