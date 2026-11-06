import { getIncremental } from './http'

/** 탭 방문 1건 — functions-xtool/src/usage.ts의 UsageSegment. */
export interface UsageSegment {
  id: string
  app: 'xtool' | 'cmip' | 'tech'
  visitorId: string
  sessionId: string
  view: string
  startedAt: number
  /** 그 탭을 실제로 보고 있던 시간(ms). */
  visibleMs: number
  closed: boolean
  updatedAt: number
  /** 로그인한 계정(서버가 토큰으로 확인한 메일) — 계정을 남기기 전 기록엔 없다. */
  email?: string
  /** 그 계정의 구성원 이름(서버가 지금 명단으로 붙인다). */
  name?: string
}

/** 최근 days일에 시작한 탭 방문 — 최근 것부터. since(지난 응답의 fetchedAt)를
 * 주면 그 뒤에 저장된 것만 온다(가진 목록에 합친다). */
export const getUsageSegments = (days: number, since?: number) =>
  getIncremental<UsageSegment>(
    'getUsageSegments',
    'segments',
    days,
    since,
    '사용 기록을 불러오지 못했습니다',
  )
