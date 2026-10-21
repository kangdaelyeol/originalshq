import { useCallback, useEffect, useMemo, useState } from 'react'
import { getUsageSegments, type UsageSegment } from '../client/usage-client'
import { AUTO_REFRESH_MS } from '../constants'
import {
  buildSessions,
  entryViews,
  summarize,
  transitions,
  usageByDate,
  usageByView,
  type UsageApp,
} from '../utils/usage'

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

/**
 * /log의 "사용 분석" 탭 — usageSegments(탭 방문 기록)를 받아 세션으로 묶고,
 * 기간 요약·탭별 사용량·날짜별 추이·탭 이동 흐름·최근 세션으로 나눈다. 화면을
 * 켜 두면 1분마다 다시 받아 온다.
 */
export const useUsageViewModel = () => {
  const [days, setDays] = useState(7)
  const [app, setApp] = useState<UsageAppFilter>('all')
  const [segments, setSegments] = useState<UsageSegment[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  // "지금" — 받아 올 때마다 갱신한다("몇 분 전" 표시의 기준).
  const [now, setNow] = useState(() => Date.now())
  const [openSessionId, setOpenSessionId] = useState<string | null>(null)
  const [visibleSessions, setVisibleSessions] = useState(SESSION_PAGE_SIZE)

  // 다시 받는 동안에도 이전 값을 보여 준다(1분마다 깜빡이지 않게).
  const load = useCallback(async () => {
    const res = await getUsageSegments(days)
    setNow(Date.now())
    if (!res.ok) {
      setError(res.error)
      setStatus('error')
      return
    }
    setSegments(res.data.segments)
    setFetchedAt(res.data.fetchedAt)
    setError(null)
    setStatus('ready')
  }, [days])

  useEffect(() => {
    ;(async () => {
      await load()
    })()
    const timer = setInterval(() => void load(), AUTO_REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

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
      reload: load,
      toggleSession: (id: string) =>
        setOpenSessionId((prev) => (prev === id ? null : id)),
      showMoreSessions: () =>
        setVisibleSessions((prev) => prev + SESSION_PAGE_SIZE),
    },
  }
}
