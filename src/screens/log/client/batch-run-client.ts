import { getIncremental, requestJson } from './http'

export type RunStatus = 'running' | 'success' | 'partial' | 'failed'

/** batchRuns 기록 1건 — functions-xtool/src/batch-log.ts가 쓴다. */
export interface BatchRun {
  id: string
  job: string
  codebase: 'xtool' | 'cmip'
  trigger: 'scheduled' | 'manual'
  /** Cloud Scheduler가 정한 실행 시각(ISO) — 없을 수 있다. */
  scheduledAt: string | null
  params: Record<string, string | number | boolean | null> | null
  status: RunStatus
  startedAt: number
  finishedAt: number | null
  durationMs: number | null
  /** 함수가 돌려준 결과를 JSON 문자열로 저장한 것. 목록에서는 큰 칸이
   * { omitted, length }로 줄어 있을 수 있다(resultCompacted). */
  resultJson: string | null
  /** 목록용으로 결과를 줄였는지 — 그러면 펼칠 때 getBatchRun으로 원본을 받는다. */
  resultCompacted?: boolean
  /** 일부 실패일 때 무엇이 실패했는지. */
  note: string | null
  error: { message: string; stack: string | null } | null
}

/** 최근 days일의 실행 기록 — 최근 것부터. since(지난 응답의 fetchedAt)를 주면
 * 그 뒤에 바뀌었을 수 있는 것만 온다(가진 목록에 합친다). */
export const getBatchRuns = (days: number, since?: number) =>
  getIncremental<BatchRun>(
    'getBatchRuns',
    'runs',
    days,
    since,
    '실행 기록을 불러오지 못했습니다',
  )

/** 실행 1건 원본 — 목록에서 결과가 줄어 있는 실행을 펼칠 때. */
export const getBatchRun = (id: string) =>
  requestJson<{ run: BatchRun }>(
    `getBatchRun?id=${encodeURIComponent(id)}`,
    '실행 결과를 불러오지 못했습니다',
  )
