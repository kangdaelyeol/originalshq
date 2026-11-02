import { useCallback, useMemo, useRef, useState } from 'react'
import { getApiCosts, type ApiCostReport } from '../client/api-cost-client'
import { costByDate, withCosts } from '../utils/api-cost'
import { useAutoRefresh } from './use-auto-refresh'

/** 조회 기간 선택지(일). */
export const API_COST_PERIOD_OPTIONS = [
  { days: 1, label: '오늘' },
  { days: 7, label: '최근 7일' },
  { days: 30, label: '최근 30일' },
] as const

// 마지막으로 받은 보고서 — 탭을 오가도 바로 보여 주고(뒤에서 다시 받는다),
// 그 기간으로 연다. 페이지를 새로 열면 비어서 처음부터 받는다.
let kept: { days: number; report: ApiCostReport } | null = null

/**
 * /log의 "비용 분석" 탭 — 함수별 어림 비용(api-cost.ts의 가정 단가). 서버가
 * BigQuery 조회를 몇 분 받아 두므로 1분마다 다시 받아도 조회는 가끔이다.
 */
export const useApiCostViewModel = () => {
  const [days, setDays] = useState(() => kept?.days ?? 7)
  const [report, setReport] = useState<ApiCostReport | null>(
    () => kept?.report ?? null,
  )
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(() =>
    kept ? 'ready' : 'loading',
  )
  const [error, setError] = useState<string | null>(null)
  // "마지막 집계 n분 전"의 기준 — 받아 올 때마다 갱신(1분마다).
  const [now, setNow] = useState(() => Date.now())
  // 늦게 온 응답(바꾸기 전 기간)이 새 응답을 덮지 않게.
  const latest = useRef(0)

  const load = useCallback(async () => {
    const request = ++latest.current
    const res = await getApiCosts(days)
    if (request !== latest.current) return
    setNow(Date.now())
    if (!res.ok) {
      setError(res.error)
      setStatus('error')
      return
    }
    kept = { days, report: res.data }
    setReport(res.data)
    setError(null)
    setStatus('ready')
  }, [days])

  useAutoRefresh(load)

  const fns = useMemo(() => withCosts(report?.byFn ?? []), [report])
  const daily = useMemo(() => costByDate(report?.byDay ?? []), [report])
  const totals = useMemo(() => {
    const sum = (pick: (row: (typeof fns)[number]) => number) =>
      fns.reduce((total, row) => total + pick(row), 0)
    return {
      cost: sum((row) => row.cost),
      calls: sum((row) => row.calls),
      reads: sum((row) => row.reads),
      writes: sum((row) => row.writes),
      deletes: sum((row) => row.deletes),
      seconds: sum((row) => row.seconds),
      errors: sum((row) => row.errors),
      responseBytes: sum((row) => row.responseBytes),
    }
  }, [fns])

  return {
    state: { days, report, status, error, fns, daily, totals, now },
    actions: {
      changeDays: (next: number) => {
        setStatus('loading')
        setDays(next)
      },
      reload: load,
    },
  }
}
