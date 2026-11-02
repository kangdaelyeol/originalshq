import { useCallback, useMemo, useState } from 'react'
import { useAutoRefresh } from './use-auto-refresh'
import { getUsageSegments, type UsageSegment } from '../client/usage-client'
import {
  buildSessions,
  entryViews,
  summarize,
  transitions,
  usageByDate,
  usageByView,
  type UsageApp,
} from '../utils/usage'
import { keptDays, useIncrementalList } from './use-incremental-list'

export type UsageAppFilter = UsageApp | 'all'

/** 사용 분석의 기간 선택지(일) — 기록은 90일까지 남는다. */
export const USAGE_PERIOD_OPTIONS = [
  { days: 1, label: '오늘' },
  { days: 7, label: '최근 7일' },
  { days: 30, label: '최근 30일' },
  { days: 90, label: '최근 90일' },
] as const

// 최근 세션 목록을 한 번에 몇 개씩 보여 줄지.
const SESSION_PAGE_SIZE = 30

const KEEP_KEY = 'usage'
const segmentIdOf = (segment: UsageSegment) => segment.id
const segmentTimeOf = (segment: UsageSegment) => segment.startedAt

/**
 * /log의 "사용 분석" 탭 — usageSegments(탭 방문 기록)를 받아 세션으로 묶고,
 * 기간 요약·탭별 사용량·날짜별 추이·탭 이동 흐름·최근 세션으로 나눈다. 화면을
 * 켜 두면 1분마다 다시 받아 온다.
 */
export const useUsageViewModel = () => {
  const [days, setDays] = useState(() => keptDays(KEEP_KEY) ?? 7)
  const [app, setApp] = useState<UsageAppFilter>('all')
  const [openSessionId, setOpenSessionId] = useState<string | null>(null)
  const [visibleSessions, setVisibleSessions] = useState(SESSION_PAGE_SIZE)

  // 받기·이어 받기·탭을 오갈 때 보관은 공용 훅이 맡는다.
  const {
    items: segments,
    status,
    error,
    fetchedAt,
    now,
    load,
  } = useIncrementalList({
    keepKey: KEEP_KEY,
    days,
    fetchPage: getUsageSegments,
    idOf: segmentIdOf,
    timeOf: segmentTimeOf,
  })

  // 1분마다 다시 받는다(탭이 숨겨져 있으면 건너뛴다).
  useAutoRefresh(load)

  const sessions = useMemo(
    () =>
      buildSessions(
        app === 'all' ? segments : segments.filter((s) => s.app === app),
      ),
    [segments, app],
  )

  const derived = useMemo(
    () => ({
      summary: summarize(sessions),
      byView: usageByView(sessions),
      byDate: usageByDate(sessions),
      flows: transitions(sessions).slice(0, 15),
      // 탭 이동 전부 — 탭 노드 상세 패널의 "들어온 곳·나간 곳"이 쓴다.
      allFlows: transitions(sessions),
      entries: entryViews(sessions),
    }),
    [sessions],
  )

  const changeApp = useCallback((next: UsageAppFilter) => {
    setApp(next)
    setVisibleSessions(SESSION_PAGE_SIZE)
  }, [])

  return {
    state: {
      days,
      app,
      status,
      error,
      fetchedAt,
      now,
      ...derived,
      sessions: sessions.slice(0, visibleSessions),
      sessionCount: sessions.length,
      openSessionId,
    },
    actions: {
      changeDays: setDays,
      changeApp,
      reload: () => load({ full: true }),
      toggleSession: (id: string) =>
        setOpenSessionId((prev) => (prev === id ? null : id)),
      showMoreSessions: () =>
        setVisibleSessions((prev) => prev + SESSION_PAGE_SIZE),
    },
  }
}
