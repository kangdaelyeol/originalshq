import { API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ClientResponse } from './batch-run-client'

/** 탭 방문 1건 — functions-xtool/src/usage.ts의 UsageSegment. */
export interface UsageSegment {
  id: string
  app: 'xtool' | 'cmip'
  visitorId: string
  sessionId: string
  view: string
  startedAt: number
  /** 그 탭을 실제로 보고 있던 시간(ms). */
  visibleMs: number
  closed: boolean
  updatedAt: number
}

/** 최근 days일에 시작한 탭 방문 — 최근 것부터. */
export const getUsageSegments = async (
  days: number,
): Promise<ClientResponse<{ segments: UsageSegment[]; fetchedAt: number }>> => {
  try {
    const response = await fetch(`${API_BASE}/getUsageSegments?days=${days}`)
    const body = (await response.json().catch(() => ({}))) as {
      segments?: UsageSegment[]
      fetchedAt?: number
      error?: string
    }
    if (!response.ok) {
      return {
        ok: false,
        error:
          body.error ??
          `사용 기록을 불러오지 못했습니다 (HTTP ${response.status})`,
      }
    }
    return {
      ok: true,
      data: {
        segments: body.segments ?? [],
        fetchedAt: body.fetchedAt ?? Date.now(),
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '네트워크 오류',
    }
  }
}
