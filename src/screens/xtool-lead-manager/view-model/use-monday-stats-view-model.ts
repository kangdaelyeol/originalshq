import { useCallback, useMemo, useState } from 'react'
import type { MondayCustomerListItem } from '@/screens/xtool-lead-manager/entity'
import {
  computeFunnelStats,
  contactMonths,
  type StatsPeriod,
} from '@/screens/xtool-lead-manager/utils'

/** 퍼널 통계 탭의 상태 — 조회 기간(최초 인입 월 범위)과, 그 기간으로 집계한
 * 통계. 고객 목록은 Monday 고객 탭이 받아온 것을 그대로 넘겨받는다(같은
 * 데이터를 두 번 받지 않는다). */
export const useMondayStatsViewModel = (
  customers: MondayCustomerListItem[],
) => {
  const [period, setPeriod] = useState<StatsPeriod>({ from: null, to: null })

  const months = useMemo(() => contactMonths(customers), [customers])
  const stats = useMemo(
    () => computeFunnelStats(customers, period),
    [customers, period],
  )

  const changeFrom = useCallback(
    (from: string | null) =>
      // 시작이 끝보다 뒤로 가면 끝을 시작에 맞춘다.
      setPeriod((prev) => ({
        from,
        to: from && prev.to && prev.to < from ? from : prev.to,
      })),
    [],
  )

  const changeTo = useCallback(
    (to: string | null) =>
      setPeriod((prev) => ({
        from: to && prev.from && prev.from > to ? to : prev.from,
        to,
      })),
    [],
  )

  const resetPeriod = useCallback(() => setPeriod({ from: null, to: null }), [])

  return {
    state: { period, months, stats },
    actions: { changeFrom, changeTo, resetPeriod },
  }
}
