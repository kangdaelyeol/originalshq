/**
 * 기간 추출 (날짜 컬럼 없는 집계형) — functions-cmip `src/csv/period-range.ts` 이관.
 */
import type { ISODate } from '../types'
import { FN_RANGE_RE, TXT_RANGE_RE } from '../types'
import { parseDate } from '../utils'

export type DateSpan = readonly [ISODate, ISODate]

export const rangeFromFilename = (name: string): DateSpan | null => {
  const m = FN_RANGE_RE.exec(name)
  if (!m) return null
  const s = parseDate(m[1])
  const e = parseDate(m[2])
  return s && e ? [s, e] : null
}

export const rangeFromText = (txt: string): DateSpan | null => {
  const m = TXT_RANGE_RE.exec(txt)
  if (!m) return null
  const s = parseDate(`${m[1]}-${m[2]}-${m[3]}`)
  const e = parseDate(`${m[4]}-${m[5]}-${m[6]}`)
  return s && e ? [s, e] : null
}
