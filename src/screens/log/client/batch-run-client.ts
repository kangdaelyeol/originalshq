import { API_BASE } from '@/screens/xtool-lead-manager/constants'

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

export type ClientResponse<T> =
  { ok: true; data: T } | { ok: false; error: string }

/** 최근 days일의 실행 기록 — 최근 것부터. */
export const getBatchRuns = async (
  days: number,
): Promise<ClientResponse<{ runs: BatchRun[]; fetchedAt: number }>> => {
  try {
    const response = await fetch(`${API_BASE}/getBatchRuns?days=${days}`)
    const body = (await response.json().catch(() => ({}))) as {
      runs?: BatchRun[]
      fetchedAt?: number
      error?: string
    }
    if (!response.ok) {
      return {
        ok: false,
        error:
          body.error ??
          `실행 기록을 불러오지 못했습니다 (HTTP ${response.status})`,
      }
    }
    return {
      ok: true,
      data: { runs: body.runs ?? [], fetchedAt: body.fetchedAt ?? Date.now() },
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '네트워크 오류',
    }
  }
}
