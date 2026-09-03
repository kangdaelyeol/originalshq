/**
 * 기간 추출 (날짜 컬럼 없는 집계형) — Python `_range_from_filename`, `_range_from_text` 이관.
 */
import { ISODate } from '../types'
import { parseDate } from '../utils'
import { FN_RANGE_RE, TXT_RANGE_RE } from './aliases'

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
