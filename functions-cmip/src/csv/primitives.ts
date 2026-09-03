/**
 * 값 정제 원시 유틸 — Python `_clean_num`/`_to_int`/`_to_float`/`_is_summary_label` 이관.
 */
import { SUMMARY_RE } from './aliases.js'

// inner util
const cleanNum = (v: unknown): string => {
  if (v == null) return ''
  let s = String(v).trim().replace(/₩/g, '').replace(/\$/g, '')
  s = s.replace(/,/g, '').replace(/ /g, '')
  if (['-', '--', '—', '?'].includes(s)) return ''
  return s
}

/** 문자열 내 특정 문자 개수. repairHeader/detectDelimiter가 공용으로 씀. */
export const count = (str: string, ch: string): number => {
  let n = 0
  for (const c of str) if (c === ch) n += 1
  return n
}

export const toInt = (v: unknown): number => {
  const s = cleanNum(v)
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n) : 0
}

export const toFloat = (v: unknown): number => {
  const s = cleanNum(v)
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/** '전체'/'total' 등 집계 라벨 여부. Python `_is_summary_label`. */
export const isSummaryLabel = (s: string | null | undefined): boolean => {
  const t = (s || '').trim().toLowerCase()
  if (!t) return false
  return (
    SUMMARY_RE.test(t) ||
    ['전체', '전체 캠페인', '전체광고세트', '전체 광고세트'].includes(t)
  )
}
