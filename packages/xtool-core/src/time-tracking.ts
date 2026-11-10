import { useEffect, useState } from 'react'
import { parseJson } from './monday-values'
import type { TechCellValue } from './tech-boards'

// 시간 추적 칸(Monday time_tracking) — 타이머라 1초마다 올라가지만, Monday는 켜고 끌 때만 값을 바꾼다. 값은
// running(켜져 있는지)·startDate(켠 시각, 초 — 새 API는 started_at ISO)·duration(그 전까지 쌓인 초). 그래서 1초마다
// 동기화하지 않고, 캐시에 있는 이 값으로 화면이 지금 시간을 계산해 켜져 있는 동안 1초마다 다시 그린다(Monday 화면과
// 같은 방법). 켜고 끄면 Monday가 webhook을 보내 캐시가 바뀐다. Monday API로는 이 칸을 쓸 수 없다(보기만).

export interface TimeTracking {
  running: boolean
  /** 마지막으로 켠 시각(ms) — 꺼져 있으면 쓰지 않는다 */
  startedAt: number | null
  /** 마지막으로 켜기 전까지 쌓인 초 */
  duration: number
}

const toMs = (start: unknown): number | null => {
  if (typeof start === 'number') return start * 1000
  if (typeof start !== 'string' || !start) return null
  const ms = /^\d+$/.test(start) ? Number(start) * 1000 : Date.parse(start)
  return Number.isFinite(ms) ? ms : null
}

/** 칸 값 → 타이머 상태 — 값이 없으면(한 번도 안 켰거나 지웠다) null */
export function timeTracking(cell: TechCellValue | undefined): TimeTracking | null {
  const json = parseJson(cell?.value)
  if (!json) return null
  return {
    running: json.running === true || json.running === 'true',
    startedAt: toMs(json.startDate ?? json.started_at),
    duration: Math.max(0, Number(json.duration) || 0),
  }
}

/** 지금까지 쌓인 초 — 켜져 있으면 켠 뒤로 지난 시간을 더한다(시계가 켠 시각보다 늦게 와도 줄지 않게 0 아래는 뗀다) */
export const elapsedSeconds = (t: TimeTracking, now = Date.now()): number =>
  Math.floor(t.duration + (t.running && t.startedAt !== null ? Math.max(0, now - t.startedAt) / 1000 : 0))

/** 시:분:초(Monday처럼 00:12:34 — 하루가 넘으면 시가 24를 넘는다) */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

/** 타이머에 쌓인 시간이 있는지(켜져 있거나 0초보다 많다) */
export const hasTime = (t: TimeTracking | null): boolean => !!t && (t.running || t.duration > 0)

/** 켜져 있는 동안 1초마다 바뀌는 지금 시각(ms) — 꺼져 있으면 다시 그리지 않는다(웹·앱 같이 쓴다). 켜진 뒤 첫 1초는
 * 그려 둔 시각이라 쌓인 시간만 보일 수 있다. */
export function useTickingNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])
  return now
}
