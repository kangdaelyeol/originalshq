import { describe, expect, it } from 'vitest'
import { formatKoreaTime } from './calc'

describe('formatKoreaTime', () => {
  it('KST 월/일 시:분 — 초는 고를 때만', () => {
    const ms = Date.parse('2026-11-06T05:03:21Z')
    expect(formatKoreaTime(ms)).toBe('11/6 14:03')
    expect(formatKoreaTime(ms, true)).toBe('11/6 14:03:21')
  })

  it('없거나 못 읽는 값은 오류 없이 -', () => {
    expect(formatKoreaTime(null)).toBe('-')
    expect(formatKoreaTime(NaN)).toBe('-')
    expect(formatKoreaTime(Date.parse('잘못된 값'))).toBe('-')
    expect(formatKoreaTime(Infinity)).toBe('-')
  })
})
