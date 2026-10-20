import { useCallback, useEffect, useMemo, useState } from 'react'
import { getBatchRuns, type BatchRun } from '../client/batch-run-client'
import { AUTO_REFRESH_MS, BATCH_JOBS } from '../constants'
import {
  countStatuses,
  displayStatus,
  recentDates,
  slotsForDay,
  type DisplayStatus,
} from '../utils/batch-run'

// 실행 내역 표를 한 번에 몇 줄씩 보여 줄지 — 30일이면 천 줄이 넘는다.
const PAGE_SIZE = 50

// 작업 카드의 칸 표에 보여 줄 최대 일수 — 30일을 다 그리면 카드가 너무 길다.
const MAX_GRID_DAYS = 7

/**
 * 배치 실행 로그 화면(/log) — batchRuns 기록을 받아 와 작업별 현황(카드)과
 * 실행 목록(표)으로 나눈다. 화면을 켜 두면 1분마다 다시 받아 온다.
 */
export const useBatchLogViewModel = () => {
  const [days, setDays] = useState(7)
  const [runs, setRuns] = useState<BatchRun[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  // "지금" — 받아 올 때마다 갱신한다(실행 중·누락 판단의 기준).
  const [now, setNow] = useState(() => Date.now())
  const [jobFilter, setJobFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | 'all'>('all')
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // 다시 받아 오는 동안에도 이전 목록을 그대로 보여 준다(1분마다 깜빡이지
  // 않게) — 그래서 시작할 때 상태를 loading으로 되돌리지 않는다.
  const load = useCallback(async () => {
    const res = await getBatchRuns(days)
    setNow(Date.now())
    if (!res.ok) {
      setError(res.error)
      setStatus('error')
      return
    }
    setRuns(res.data.runs)
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

  // 코드베이스마다 기록을 남기기 시작한 때 — 그 전의 예약 시각은 "누락"이
  // 아니라 "기록 전"이다(두 코드베이스는 따로 배포되어 시작 시각이 다르다).
  const recordingSince = useMemo(() => {
    const since: Record<string, number> = {}
    for (const run of runs) {
      since[run.codebase] = Math.min(
        since[run.codebase] ?? Infinity,
        run.startedAt,
      )
    }
    return since
  }, [runs])

  const gridDates = useMemo(
    () => recentDates(now, Math.min(days, MAX_GRID_DAYS)),
    [now, days],
  )

  const jobs = useMemo(
    () =>
      BATCH_JOBS.map((job) => {
        const jobRuns = runs.filter((run) => run.job === job.id)
        const latest = jobRuns[0]
        const grid = gridDates.map((date) => ({
          date,
          slots: slotsForDay(
            jobRuns,
            date,
            now,
            recordingSince[job.codebase] ?? null,
          ),
        }))
        const missing = grid
          .flatMap((day) => day.slots)
          .filter((slot) => slot.state === 'missing').length
        return {
          job,
          latest,
          latestStatus: latest ? displayStatus(latest, now) : null,
          counts: countStatuses(jobRuns, now),
          missing,
          grid,
        }
      }),
    [runs, gridDates, now, recordingSince],
  )

  const totals = useMemo(
    () => ({
      ...countStatuses(runs, now),
      missing: jobs.reduce((sum, each) => sum + each.missing, 0),
    }),
    [runs, now, jobs],
  )

  const filteredRuns = useMemo(
    () =>
      runs.filter(
        (run) =>
          (jobFilter === 'all' || run.job === jobFilter) &&
          (statusFilter === 'all' || displayStatus(run, now) === statusFilter),
      ),
    [runs, jobFilter, statusFilter, now],
  )

  const visibleRuns = useMemo(
    () => filteredRuns.slice(0, visibleCount),
    [filteredRuns, visibleCount],
  )

  /** 거르는 조건이 바뀌면 처음 50줄부터 다시 보여 준다. */
  const changeJobFilter = useCallback((job: string) => {
    setJobFilter(job)
    setVisibleCount(PAGE_SIZE)
  }, [])
  const changeStatusFilter = useCallback((next: DisplayStatus | 'all') => {
    setStatusFilter(next)
    setVisibleCount(PAGE_SIZE)
  }, [])

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  )

  /** 표의 줄을 누르면 펼치고, 다시 누르면 접는다. */
  const toggleRun = useCallback(
    (id: string) => setSelectedRunId((prev) => (prev === id ? null : id)),
    [],
  )

  /** 작업 카드의 칸을 누르면 그 실행을 표에서 펼쳐 보여 준다 — 표가 다른
   * 작업·상태로 걸러져 있으면 보이도록 그 작업으로 맞춘다. */
  const openRun = useCallback((run: BatchRun) => {
    setJobFilter(run.job)
    setStatusFilter('all')
    setSelectedRunId(run.id)
    // 그 작업의 기록 중 몇 번째인지 몰라서, 펼칠 줄이 보이도록 넉넉히 연다.
    setVisibleCount(Infinity)
    requestAnimationFrame(() =>
      document
        .getElementById(`run-${run.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    )
  }, [])

  return {
    state: {
      days,
      status,
      error,
      fetchedAt,
      now,
      jobs,
      totals,
      gridDates,
      filteredRuns,
      visibleRuns,
      totalRuns: runs.length,
      jobFilter,
      statusFilter,
      selectedRun,
    },
    actions: {
      changeDays: setDays,
      reload: load,
      changeJobFilter,
      changeStatusFilter,
      showMore: () => setVisibleCount((prev) => prev + PAGE_SIZE),
      toggleRun,
      openRun,
    },
  }
}
