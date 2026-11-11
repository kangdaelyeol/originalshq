import { squash } from '../monday/fields'
import { TechCellValue } from './types'

// 아톡문의 10분 지연 — "10분을 넘는 시각" 계산(inquiry-delay.ts가 쓰는 순수 함수만).
// 항목을 캐시에 쓸 때(items.ts) 같이 적는다 — 웍스·Firestore를 모르는 작은 파일로 둔다.

/** 지연으로 보는 시간 */
export const DELAY_SECONDS = 600
const STATUS_TITLE = '상담 상태'
const NEW_LABELS = new Set(['신규문의'])

export interface TimeTracking {
  running: boolean
  startedAt: number | null
  duration: number
}

const parseJson = (value: string | null | undefined) => {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ?
      (parsed as Record<string, unknown>) :
      null
  } catch {
    return null
  }
}

const toMs = (start: unknown): number | null => {
  if (typeof start === 'number') return start * 1000
  if (typeof start !== 'string' || !start) return null
  const ms = /^\d+$/.test(start) ? Number(start) * 1000 : Date.parse(start)
  return Number.isFinite(ms) ? ms : null
}

/** 시간추적 칸 값 → 켜져 있는지·켠 시각(ms)·그 전까지 쌓인 초 */
export function timeTracking(
  cell: TechCellValue | undefined,
): TimeTracking | null {
  const json = parseJson(cell?.value)
  if (!json) return null
  return {
    running: json.running === true || json.running === 'true',
    startedAt: toMs(json.startDate ?? json.started_at),
    duration: Math.max(0, Number(json.duration) || 0),
  }
}

/** 지금까지 쌓인 초 */
export const elapsedSeconds = (t: TimeTracking, now: number) =>
  Math.floor(
    t.duration +
      (t.running && t.startedAt !== null ?
        Math.max(0, now - t.startedAt) / 1000 :
        0),
  )

/** 칸 — 시간추적은 종류로(여럿이면 제목에 "시간"이 든 것), 상담 상태는 제목으로 */
export function inquiryColumns(
  columns: Array<{ id: string; title: string; type: string }>,
) {
  const timers = columns.filter((c) => c.type === 'time_tracking')
  const timer =
    timers.find((c) => squash(c.title).includes('시간')) ?? timers[0]
  const status = columns.find(
    (c) => c.type === 'status' && squash(c.title) === squash(STATUS_TITLE),
  )
  return { timerId: timer?.id ?? null, statusId: status?.id ?? null }
}

/**
 * 10분을 넘는 시각(ms) — 신규 문의가 아니거나 완료 그룹이거나 타이머가 없으면
 * null. 켜져 있으면 켠 시각 + 남은 초, 멈춘 채 이미 넘었으면 1(지난 시각), 멈춘 채
 * 아직이면 null(다시 켜면 그때 계산한다). 캐시에 쓸 때(items.ts) 부른다.
 */
export function inquiryDelayDue(
  columns: Array<{ id: string; title: string; type: string }>,
  values: Record<string, TechCellValue>,
  groupTitle: string | null,
): number | null {
  const { timerId, statusId } = inquiryColumns(columns)
  if (!timerId || !statusId) return null
  if (/완료/.test(groupTitle ?? '')) return null
  if (!NEW_LABELS.has(squash(values[statusId]?.text ?? ''))) return null
  const t = timeTracking(values[timerId])
  if (!t) return null
  if (t.running && t.startedAt !== null) {
    return t.startedAt + Math.max(0, DELAY_SECONDS - t.duration) * 1000
  }
  return t.duration >= DELAY_SECONDS ? 1 : null
}
