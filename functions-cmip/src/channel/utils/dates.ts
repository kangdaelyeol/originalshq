/**
 * 날짜 연산 — 예전 Python 구현(`_daterange`, `weekday_ko`)에서 옮겨 온 것.
 *
 * MIP 전반에서 날짜는 타임존 없는 "달력상의 날"이다. JS Date의 타임존 함정을 피하려고
 * 표준형을 ISO 문자열 "YYYY-MM-DD"로 고정하고, 연산은 UTC 기준으로만 한다.
 */

import { ISODate } from '../../types'

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

/**
 * 두 ISO 날짜 사이 일수 (b - a).
 * NOTE: 기존 구현이 getMilliseconds()(0~999 밀리초 성분)를 써서 항상 잘못된 값을
 * 반환하던 버그를 getTime()(에포크 타임스탬프)으로 수정했다.
 */
export const diffDays = (a: ISODate, b: ISODate): number => {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000)
}

/** 시작~끝(포함) ISO 날짜 배열. Python `_daterange`. */
export const dateRange = (startISO: ISODate, endISO: ISODate): ISODate[] => {
  let s = startISO
  let e = endISO
  if (fromISO(e) < fromISO(s)) [s, e] = [e, s]
  const out: ISODate[] = []
  for (let cur = s; fromISO(cur) <= fromISO(e); cur = addDays(cur, 1))
    out.push(cur)
  return out
}

const WEEKDAY_KO = '월화수목금토일' as const
type WeekdayKo = (typeof WEEKDAY_KO)[number]

/**
 * ISO 날짜의 한글 요일. Python `weekday_ko` (월=0).
 * NOTE: 기존 구현이 파라미터를 Date로 선언해놓고 내부에서 fromISO(문자열 전용)에
 * 그대로 넘기던 타입 불일치 버그를 ISODate(string)로 수정했다.
 */
export const weekdayKo = (iso: ISODate): WeekdayKo => {
  // JS getUTCDay: 일=0 → 월=0 으로 변환
  const jsDay = fromISO(iso).getUTCDay()
  const monFirst = (jsDay + 6) % 7
  return WEEKDAY_KO[monFirst] as WeekdayKo
}

/** 오늘(로컬 달력 기준) ISO. 대시보드 등 "지금" 화면 기본값용. */
export const todayISO = (): ISODate => {
  const now = new Date()
  return toISO(
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
  )
}
