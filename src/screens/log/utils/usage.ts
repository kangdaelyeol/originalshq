import type { UsageSegment } from '../client/usage-client'
import { kstDate } from './batch-run'

// ── 이름 ────────────────────────────────────────────────────────────────

export type UsageApp = UsageSegment['app']

export const APP_LABEL: Record<UsageApp, string> = {
  xtool: 'xtool-lead-manager',
  cmip: 'cmip',
}

/** 탭 이름 — 화면이 보내는 값(useUsageTracking의 view)을 사람이 읽는 이름으로.
 * 목록에 없는 값은 그대로 보여 준다. */
const VIEW_LABEL: Record<UsageApp, Record<string, string>> = {
  xtool: {
    leads: '리드',
    monday: 'Monday 고객',
    stats: '퍼널 통계',
    'trend/inflow': '통계 · 인입통계',
    'trend/sales': '통계 · 판매통계',
    'trend/kpi': '통계 · 개인 KPI',
    tracking: '오기입 추적',
  },
  cmip: {
    total: '전체 요약',
    campaignAdset: '캠페인·광고셋',
    // 캠페인·광고셋 탭으로 합치기 전(2026-10)에 쌓인 기록.
    campaign: '캠페인',
    adset: '광고셋',
    periodTest: '매체별 테스트',
    roas: 'ROAS',
    adPerformance: '광고 성과',
  },
}

export const viewLabel = (app: UsageApp, view: string): string =>
  VIEW_LABEL[app][view] ?? view

/** 방문자 id를 짧게 — 같은 방문자를 눈으로 구분할 정도만. */
export const shortVisitor = (visitorId: string): string => visitorId.slice(0, 6)

/** 사용 시간 — 1분 미만은 초, 1시간 미만은 분·초, 그 이상은 시간·분. */
export const formatSpan = (ms: number): string => {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}초`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}분 ${seconds % 60}초`
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`
}

// ── 세션 ────────────────────────────────────────────────────────────────

export interface UsageSession {
  sessionId: string
  app: UsageApp
  visitorId: string
  startedAt: number
  /** 마지막으로 기록이 갱신된 시각. */
  endedAt: number
  /** 탭들을 실제로 본 시간의 합. */
  visibleMs: number
  /** 방문한 탭 — 시간순. */
  segments: UsageSegment[]
}

export const buildSessions = (
  segments: readonly UsageSegment[],
): UsageSession[] => {
  const bySession = new Map<string, UsageSegment[]>()
  for (const segment of segments) {
    const list = bySession.get(segment.sessionId) ?? []
    list.push(segment)
    bySession.set(segment.sessionId, list)
  }
  return [...bySession.entries()]
    .map(([sessionId, list]) => {
      const sorted = [...list].sort((a, b) => a.startedAt - b.startedAt)
      return {
        sessionId,
        app: sorted[0].app,
        visitorId: sorted[0].visitorId,
        startedAt: sorted[0].startedAt,
        endedAt: Math.max(...sorted.map((s) => s.updatedAt)),
        visibleMs: sorted.reduce((sum, s) => sum + s.visibleMs, 0),
        segments: sorted,
      }
    })
    .sort((a, b) => b.startedAt - a.startedAt)
}

// ── 집계 ────────────────────────────────────────────────────────────────

export interface UsageSummary {
  visitors: number
  sessions: number
  visibleMs: number
  /** 세션당 평균 사용 시간. */
  averageSessionMs: number
}

export const summarize = (sessions: readonly UsageSession[]): UsageSummary => {
  const visibleMs = sessions.reduce((sum, s) => sum + s.visibleMs, 0)
  return {
    visitors: new Set(sessions.map((s) => s.visitorId)).size,
    sessions: sessions.length,
    visibleMs,
    averageSessionMs: sessions.length ? visibleMs / sessions.length : 0,
  }
}

export interface ViewUsage {
  app: UsageApp
  view: string
  /** 탭에 들어온 횟수. */
  visits: number
  /** 그 탭을 본 방문자 수. */
  visitors: number
  visibleMs: number
  averageMs: number
  /** 전체 사용 시간 중 이 탭의 비중(0~1). */
  share: number
}

export const usageByView = (sessions: readonly UsageSession[]): ViewUsage[] => {
  const byKey = new Map<
    string,
    {
      app: UsageApp
      view: string
      visits: number
      visitors: Set<string>
      visibleMs: number
    }
  >()
  for (const session of sessions) {
    for (const segment of session.segments) {
      const key = `${segment.app}|${segment.view}`
      const entry = byKey.get(key) ?? {
        app: segment.app,
        view: segment.view,
        visits: 0,
        visitors: new Set<string>(),
        visibleMs: 0,
      }
      entry.visits += 1
      entry.visitors.add(segment.visitorId)
      entry.visibleMs += segment.visibleMs
      byKey.set(key, entry)
    }
  }
  const total = [...byKey.values()].reduce((sum, e) => sum + e.visibleMs, 0)
  return [...byKey.values()]
    .map((e) => ({
      app: e.app,
      view: e.view,
      visits: e.visits,
      visitors: e.visitors.size,
      visibleMs: e.visibleMs,
      averageMs: e.visits ? e.visibleMs / e.visits : 0,
      share: total ? e.visibleMs / total : 0,
    }))
    .sort((a, b) => b.visibleMs - a.visibleMs)
}

export interface DailyUsage {
  /** YYYY-MM-DD(KST). */
  date: string
  visitors: number
  sessions: number
  visibleMs: number
}

/** 날짜별(세션이 시작한 날, KST) — 최근 날짜가 위. */
export const usageByDate = (
  sessions: readonly UsageSession[],
): DailyUsage[] => {
  const byDate = new Map<string, UsageSession[]>()
  for (const session of sessions) {
    const date = kstDate(session.startedAt)
    byDate.set(date, [...(byDate.get(date) ?? []), session])
  }
  return [...byDate.entries()]
    .map(([date, list]) => ({
      date,
      visitors: new Set(list.map((s) => s.visitorId)).size,
      sessions: list.length,
      visibleMs: list.reduce((sum, s) => sum + s.visibleMs, 0),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export interface Transition {
  app: UsageApp
  from: string
  to: string
  count: number
}

/** 탭 이동 흐름 — 한 세션 안에서 A 탭 다음에 B 탭으로 간 횟수. 같은 탭이
 * 이어지면(새로고침 등) 세지 않는다. 많은 순. */
export const transitions = (
  sessions: readonly UsageSession[],
): Transition[] => {
  const byKey = new Map<string, Transition>()
  for (const session of sessions) {
    const views = session.segments.map((s) => s.view)
    for (let i = 1; i < views.length; i++) {
      if (views[i] === views[i - 1]) continue
      const key = `${session.app}|${views[i - 1]}|${views[i]}`
      const entry = byKey.get(key) ?? {
        app: session.app,
        from: views[i - 1],
        to: views[i],
        count: 0,
      }
      entry.count += 1
      byKey.set(key, entry)
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count)
}

/** 첫 화면 — 세션이 어느 탭에서 시작했는지(들어오자마자 본 탭). */
export const entryViews = (
  sessions: readonly UsageSession[],
): { app: UsageApp; view: string; count: number }[] => {
  const byKey = new Map<
    string,
    { app: UsageApp; view: string; count: number }
  >()
  for (const session of sessions) {
    const first = session.segments[0]
    const key = `${first.app}|${first.view}`
    const entry = byKey.get(key) ?? {
      app: first.app,
      view: first.view,
      count: 0,
    }
    entry.count += 1
    byKey.set(key, entry)
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count)
}
