/**
 * 주(週) 구간 유틸 — Python `src/reports/week_utils.py` 이관.
 *
 * MIP 전반의 규칙대로 날짜는 타임존 없는 "달력상의 날"이고 표준형은 ISO 문자열
 * "YYYY-MM-DD"다. 주는 월요일 시작(월~일)으로 본다.
 *
 * NOTE: 원본 Python `week_utils.py`가 현재 저장소에 없어 analyzer의 사용처(라벨 문자열,
 * `(label, ws, we)` 튜플, weekly/monthly 분기)로부터 동작을 복원했다. 라벨은 "M/D~M/D"
 * 형식으로 통일했다 — 원본과 표기가 다르면 이 파일만 맞추면 된다.
 */
import { addDays, fromISO } from '../utils/dates'
import type { ISODate } from '../types'

export interface WeekSpan {
  label: string
  start: ISODate
  end: ISODate
}

/** iso가 속한 주(월요일 시작)의 월요일 ISO. */
export const weekStartMonday = (iso: ISODate): ISODate => {
  const jsDay = fromISO(iso).getUTCDay() // 일=0 … 토=6
  const backToMonday = (jsDay + 6) % 7
  return addDays(iso, -backToMonday)
}

const mmdd = (iso: ISODate): string => {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

const rangeLabel = (s: ISODate, e: ISODate): string => `${mmdd(s)}~${mmdd(e)}`

/**
 * endISO가 속한 주까지 포함해 최근 n주. 오래된 주 → 최신 주 순.
 * Python `trailing_month_weeks(date_end, n=4)`.
 */
export const trailingMonthWeeks = (endISO: ISODate, n = 4): WeekSpan[] => {
  const lastMonday = weekStartMonday(endISO)
  const out: WeekSpan[] = []
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(lastMonday, -7 * i)
    const end = addDays(start, 6)
    out.push({ label: rangeLabel(start, end), start, end })
  }
  return out
}

/**
 * [startISO, endISO]를 덮는 주(월~일) 목록. 양 끝 주는 범위 안으로 클립한다.
 * Python `weeks_covering_range(date_start, date_end)`.
 */
export const weeksCoveringRange = (
  startISO: ISODate,
  endISO: ISODate,
): WeekSpan[] => {
  const out: WeekSpan[] = []
  for (
    let monday = weekStartMonday(startISO);
    monday <= endISO;
    monday = addDays(monday, 7)
  ) {
    const sunday = addDays(monday, 6)
    const clipStart = monday < startISO ? startISO : monday
    const clipEnd = sunday > endISO ? endISO : sunday
    out.push({
      label: rangeLabel(clipStart, clipEnd),
      start: clipStart,
      end: clipEnd,
    })
  }
  return out
}
