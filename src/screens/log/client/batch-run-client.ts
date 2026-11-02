import { getIncremental } from './http'

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
  /** 함수가 돌려준 결과를 JSON 문자열로 저장한 것. */
  resultJson: string | null
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
