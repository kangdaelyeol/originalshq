import type { BatchRun, RunStatus } from '../client/batch-run-client'
import { BATCH_JOBS, SCHEDULE_HOURS, type BatchJob } from '../constants'

// ── 상태 ────────────────────────────────────────────────────────────────

/** 화면에 보이는 실행 상태 — 기록의 status에 "시간 초과"를 더한 것. 함수가
 * 제한 시간에 걸려 강제로 끝나면 기록이 running인 채로 남기 때문에, 제한
 * 시간이 지났는데도 running이면 timeout으로 본다. */
export type DisplayStatus = RunStatus | 'timeout'

/** 표의 한 칸(예약 시각 하나)의 상태 — 실행 기록이 없는 칸은
 *   · pending  아직 그 시각이 안 됐다
 *   · missing  시각이 지났는데 기록이 없다(실행되지 않았다)
 *   · no-data  기록을 남기기 시작하기 전이라 알 수 없다 */
export type SlotState = DisplayStatus | 'pending' | 'missing' | 'no-data'

export const STATUS_LABEL: Record<SlotState, string> = {
  success: '성공',
  partial: '일부 실패',
  failed: '실패',
  running: '실행 중',
  timeout: '시간 초과 의심',
  pending: '예정',
  missing: '누락',
  'no-data': '기록 전',
}

/** 상태마다 붙는 기호 — 색만으로 구분하지 않게 칸·배지에 같이 쓴다. */
export const STATUS_ICON: Record<SlotState, string> = {
  success: '✓',
  partial: '!',
  failed: '✕',
  running: '…',
  timeout: '⌛',
  pending: '',
  missing: '?',
  'no-data': '',
}

const jobById = new Map(BATCH_JOBS.map((job) => [job.id, job]))
export const findJob = (id: string): BatchJob | undefined => jobById.get(id)

// 제한 시간이 지나고도 이만큼 더 기다린 뒤에 시간 초과로 본다(기록 저장 지연).
const TIMEOUT_GRACE_MS = 60_000

export const displayStatus = (run: BatchRun, now: number): DisplayStatus => {
  if (run.status !== 'running') return run.status
  const timeoutMs = (findJob(run.job)?.timeoutSeconds ?? 540) * 1000
  return now - run.startedAt > timeoutMs + TIMEOUT_GRACE_MS
    ? 'timeout'
    : 'running'
}

// ── 시각(KST) ───────────────────────────────────────────────────────────

const DAY_MS = 86_400_000
const KST_OFFSET_MS = 9 * 3_600_000

/** ms → 한국 날짜(YYYY-MM-DD). */
export const kstDate = (ms: number): string =>
  new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10)

/** 한국 날짜 + 시 → ms. */
export const kstTime = (date: string, hour: number): number =>
  Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00+09:00`)

/** 오늘부터 거꾸로 count일(오늘이 먼저). */
export const recentDates = (now: number, count: number): string[] =>
  Array.from({ length: count }, (_, i) => kstDate(now - i * DAY_MS))

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "10/20 (화)" */
export const formatDay = (date: string): string => {
  const [, month, day] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]
  return `${month}/${day} (${weekday})`
}

/** "10/20 14:03:21" — 초까지(실행 시각을 정확히 보려고). */
export const formatDateTime = (ms: number): string => {
  const iso = new Date(ms + KST_OFFSET_MS).toISOString()
  const [month, day] = [Number(iso.slice(5, 7)), Number(iso.slice(8, 10))]
  return `${month}/${day} ${iso.slice(11, 19)}`
}

/** 몇 분 전 / 몇 시간 전. */
export const formatAgo = (ms: number, now: number): string => {
  const minutes = Math.round((now - ms) / 60_000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

/** 소요 시간 — 1분 미만은 초(소수 첫째 자리), 그 이상은 분·초. */
export const formatDuration = (ms: number | null): string => {
  if (ms === null) return '-'
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}초`
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`
}

/** 다음 예약 시각 — 오늘 남은 시각이 없으면 내일 첫 시각. */
export const nextScheduledAt = (now: number): number => {
  const today = kstDate(now)
  for (const hour of SCHEDULE_HOURS) {
    const at = kstTime(today, hour)
    if (at > now) return at
  }
  return kstTime(kstDate(now + DAY_MS), SCHEDULE_HOURS[0])
}

// ── 예약 시각별 칸 ──────────────────────────────────────────────────────

// 예약 시각과 이만큼 안에 시작한 실행을 그 칸의 실행으로 본다.
const SLOT_MATCH_MS = 30 * 60_000
// 예약 시각이 지나고 이만큼은 기다린 뒤에 "누락"으로 본다(스케줄러 지연).
const MISSING_GRACE_MS = 10 * 60_000

/** 그 칸(예약 시각)의 실행 — 스케줄러가 준 scheduledAt이 있으면 그걸로, 없으면
 * 시작 시각으로 찾는다. 같은 칸에 여럿이면(재시도 등) 가장 최근 것. */
export const runForSlot = (
  runs: readonly BatchRun[],
  slotAt: number,
): BatchRun | undefined =>
  runs.find((run) => {
    if (run.trigger !== 'scheduled') return false
    const at = run.scheduledAt ? Date.parse(run.scheduledAt) : run.startedAt
    return at >= slotAt - SLOT_MATCH_MS && at < slotAt + SLOT_MATCH_MS
  })

export interface Slot {
  at: number
  hour: number
  state: SlotState
  run?: BatchRun
}

/** 작업 하나의 하루치 칸들(예약 시각마다 하나). recordingSince 전의 칸은
 * 기록이 없어도 누락이 아니라 "기록 전"이다. */
export const slotsForDay = (
  runs: readonly BatchRun[],
  date: string,
  now: number,
  recordingSince: number | null,
): Slot[] =>
  SCHEDULE_HOURS.map((hour) => {
    const at = kstTime(date, hour)
    const run = runForSlot(runs, at)
    if (run) return { at, hour, state: displayStatus(run, now), run }
    if (at > now - MISSING_GRACE_MS) return { at, hour, state: 'pending' }
    if (recordingSince === null || at + SLOT_MATCH_MS < recordingSince) {
      return { at, hour, state: 'no-data' }
    }
    return { at, hour, state: 'missing' }
  })

// ── 결과 요약 ───────────────────────────────────────────────────────────

export const parseResult = (run: BatchRun): unknown => {
  if (!run.resultJson) return null
  try {
    return JSON.parse(run.resultJson)
  } catch {
    return run.resultJson
  }
}

const num = (value: unknown): string =>
  typeof value === 'number' ? value.toLocaleString('ko-KR') : '-'

/** 결과에서 핵심 숫자만 한 줄로 — 작업마다 결과 모양이 달라 작업별로 고른다. */
export const summarizeRun = (run: BatchRun): string => {
  if (run.error) return run.error.message
  const result = parseResult(run) as Record<string, unknown> | null
  if (!result || typeof result !== 'object') return '-'
  switch (run.job) {
    case 'monday-sync': {
      const ok = result.okCount as number
      const failed = result.failedCount as number
      const customers = result.customers as Record<string, unknown> | null
      return [
        `보드 ${num(ok)}/${num(ok + failed)} 성공`,
        customers
          ? `고객 ${num(customers.customerCount)}명 (변경 ${num(customers.writtenCount)}·삭제 ${num(customers.deletedCount)})`
          : '고객 통합 실패',
        // 오프라인 매출 원장 — 10/21 이후 기록에만 있다.
        ...(customers?.offlineSaleLines
          ? [
              `오프라인 매출 ${num((customers.offlineSaleLines as Record<string, unknown>).written)}줄`,
            ]
          : []),
      ].join(' · ')
    }
    case 'offline-sales':
      return `저장 ${num(result.inserted)}줄 · 삭제 ${num(result.deleted)}줄`
    case 'cafe24-orders':
      return `주문 ${num(result.upsertedOrders)} · 환불 ${num(result.upsertedRefunds)} · 고객 ${num(result.upsertedOrderCustomers)}`
    case 'google-insights': {
      const campaign = result.campaignResult as Record<string, unknown>
      const adGroup = result.adGroupResult as Record<string, unknown>
      return `캠페인 ${num(campaign?.upserted)}행 · 광고그룹 ${num(adGroup?.upserted)}행`
    }
    default:
      return 'upserted' in result ? `저장 ${num(result.upserted)}행` : '-'
  }
}

// ── 기간 집계 ───────────────────────────────────────────────────────────

export interface StatusCounts {
  total: number
  success: number
  partial: number
  failed: number
  running: number
  timeout: number
}

export const countStatuses = (
  runs: readonly BatchRun[],
  now: number,
): StatusCounts => {
  const counts: StatusCounts = {
    total: runs.length,
    success: 0,
    partial: 0,
    failed: 0,
    running: 0,
    timeout: 0,
  }
  for (const run of runs) counts[displayStatus(run, now)] += 1
  return counts
}
