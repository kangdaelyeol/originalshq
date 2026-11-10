import { describe, expect, it } from 'vitest'
import { elapsedSeconds, formatDuration, hasTime, timeTracking } from '@xtool-core/time-tracking'

// 시간 추적 칸(xtool-core/time-tracking) — Monday 값(running·startDate·duration)으로 지금 시간을 계산한다.

const cell = (value: object | null, text = '') => ({ text, value: value ? JSON.stringify(value) : null })

describe('시간 추적', () => {
  it('멈춘 타이머는 쌓인 시간 그대로', () => {
    const t = timeTracking(cell({ running: 'false', duration: 754 }))
    expect(t).toEqual({ running: false, startedAt: null, duration: 754 })
    expect(formatDuration(elapsedSeconds(t!, Date.now()))).toBe('00:12:34')
  })

  it('켜진 타이머는 켠 뒤로 지난 시간을 더한다(startDate는 초, started_at은 ISO도 받는다)', () => {
    const start = Date.parse('2026-11-10T01:00:00Z')
    const fromSeconds = timeTracking(cell({ running: 'true', startDate: start / 1000, duration: 60 }))!
    expect(elapsedSeconds(fromSeconds, start + 90_000)).toBe(150)
    const fromIso = timeTracking(cell({ running: true, started_at: '2026-11-10T01:00:00Z', duration: 0 }))!
    expect(elapsedSeconds(fromIso, start + 3_725_000)).toBe(3725)
    expect(formatDuration(3725)).toBe('01:02:05')
  })

  it('시계가 켠 시각보다 늦게 와도 쌓인 시간보다 줄지 않는다', () => {
    const start = Date.parse('2026-11-10T01:00:00Z')
    const t = timeTracking(cell({ running: 'true', startDate: start / 1000, duration: 100 }))!
    expect(elapsedSeconds(t, start - 5000)).toBe(100)
  })

  it('값이 없으면 null, 하루가 넘으면 시가 24를 넘는다', () => {
    expect(timeTracking(cell(null, '00:00:00'))).toBeNull()
    expect(hasTime(timeTracking(cell({ running: 'false', duration: 0 })))).toBe(false)
    expect(formatDuration(26 * 3600 + 5)).toBe('26:00:05')
  })
})
