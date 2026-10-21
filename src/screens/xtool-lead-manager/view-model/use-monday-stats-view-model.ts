import { useCallback, useMemo, useState } from 'react'
import type { MondayCustomerListItem } from '@/screens/xtool-lead-manager/entity'
import {
  computeFunnelStats,
  contactMonths,
  type PurchaseScope,
  type StatsPeriod,
} from '@/screens/xtool-lead-manager/utils'

const toMonth = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

/** 처음 열었을 때의 조회 기간 — 지난달부터 이번 달까지. 최근 흐름을 먼저
 * 보고, 더 긴 기간은 드롭다운이나 "전체 기간"으로 넓힌다. */
const defaultPeriod = (): StatsPeriod => {
  const now = new Date()
  return {
    from: toMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    to: toMonth(now),
  }
}

/** 퍼널 통계 탭의 상태 — 조회 기간(최초 인입 월 범위), 구매 기준(통합/
 * 오프라인/온라인)과, 그 조건으로 집계한 통계. 고객 목록은 Monday 고객 탭이 받아온 것을 그대로 넘겨받는다(같은
 * 데이터를 두 번 받지 않는다). */
export const useMondayStatsViewModel = (
  customers: MondayCustomerListItem[],
) => {
  const [period, setPeriod] = useState<StatsPeriod>(defaultPeriod)

  // 무엇을 구매로 볼지 — 통합 / 오프라인 / 온라인.
  const [scope, setScope] = useState<PurchaseScope>('all')

  // "자세히 보기"로 펼친 경로(경로별 전환) — 하나만 펼친다.
  const [openPathId, setOpenPathId] = useState<string | null>(null)

  // 선택지는 데이터에 있는 달들 — 거기에 지금 고른 달도 넣는다. 기본 기간의
  // 달(이번 달 등)에 아직 고객이 없어도 드롭다운에 그 달이 보이게 하기 위해서다.
  const months = useMemo(
    () =>
      [
        ...new Set([
          ...contactMonths(customers),
          ...[period.from, period.to].filter(
            (month): month is string => month !== null,
          ),
        ]),
      ].sort(),
    [customers, period],
  )
  const stats = useMemo(
    () => computeFunnelStats(customers, period, scope),
    [customers, period, scope],
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

  const togglePath = useCallback(
    (id: string) => setOpenPathId((prev) => (prev === id ? null : id)),
    [],
  )
  const closePath = useCallback(() => setOpenPathId(null), [])

  return {
    state: { period, scope, months, stats, openPathId },
    actions: {
      changeFrom,
      changeTo,
      resetPeriod,
      changeScope: setScope,
      togglePath,
      closePath,
    },
  }
}
