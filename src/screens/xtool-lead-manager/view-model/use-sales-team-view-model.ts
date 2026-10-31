import { useCallback, useMemo, useState } from 'react'
import { oneOf, usePersistentState } from '@/hooks/use-persistent-state'
import type { MondayKpiFacts } from '@/screens/xtool-lead-manager/entity'
import {
  SALES_KINGS,
  buildBoardTrends,
  buildSalesAssignees,
  buildSalesKing,
  inflowSeries,
  previousTechPeriod,
  salesTeamDays,
  summarizeInflow,
  summarizeSalesRange,
  thisTechMonth,
  thisTechWeek,
  toSaleFacts,
  topSales,
  type InflowUnit,
  type SaleFact,
  type SalesMetric,
  type TechPeriod,
} from '@/screens/xtool-lead-manager/utils'

const SALES_METRICS: readonly SalesMetric[] = ['amount', 'count']

/** 왕 카드 묶음 — 이번 주(일~토)·이번 달, 그리고 바로 앞 기간의 1위. */
const kingsOf = (
  sales: SaleFact[],
  period: TechPeriod,
  span: 'week' | 'month',
) => {
  const previous = previousTechPeriod(period, span)
  return SALES_KINGS.map((def) => ({
    ...buildSalesKing(sales, def, period),
    previousTop: buildSalesKing(sales, def, previous).rows[0] ?? null,
  }))
}

/**
 * 통계 탭의 영업통계 — 오프라인 결제를 담당자별로(영업왕·기간 요약·추이·
 * 담당자별 표·큰 결제). 재료는 통계 탭이 이미 받아 둔 개인 KPI 재료
 * (kpiFacts.sales)라 따로 받지 않는다. 기간과 묶는 단위는 통계 탭의 공용 값,
 * 영업왕만 이번 주·이번 달로 고정이다.
 */
export const useSalesTeamViewModel = (
  facts: MondayKpiFacts,
  range: TechPeriod,
  unit: InflowUnit,
) => {
  // 추이 그래프를 매출로 볼지 건수로 볼지 — 이 브라우저에 남긴다.
  const [metric, setMetric] = usePersistentState<SalesMetric>(
    'xtool.salesTeam.metric',
    'amount',
    oneOf(SALES_METRICS),
  )
  // 펼쳐 둔 줄 — "카드:담당자".
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(() => new Set())

  const sales = useMemo(() => toSaleFacts(facts), [facts])
  // 품목·재구매 등은 서버가 새로 만든 재료에만 있다(배포 뒤 첫 동기화 전에는 없다).
  const detailed = useMemo(
    () => sales.length === 0 || sales.some((sale) => sale.repeat !== null),
    [sales],
  )
  const kings = useMemo(
    () => ({
      week: kingsOf(sales, thisTechWeek(), 'week'),
      month: kingsOf(sales, thisTechMonth(), 'month'),
    }),
    [sales],
  )
  const summary = useMemo(
    () => summarizeSalesRange(sales, range),
    [sales, range],
  )
  const points = useMemo(
    () =>
      inflowSeries(salesTeamDays(sales, metric), range.start, range.end, unit),
    [sales, metric, range, unit],
  )
  const pointSummary = useMemo(() => summarizeInflow(points), [points])
  const trends = useMemo(
    () => buildBoardTrends(points, pointSummary).boards,
    [points, pointSummary],
  )
  const assignees = useMemo(
    () => buildSalesAssignees(sales, range),
    [sales, range],
  )
  const top = useMemo(() => topSales(sales, range), [sales, range])

  const toggleRow = useCallback((key: string) => {
    setOpenRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  return {
    state: {
      metric,
      detailed,
      kings,
      summary,
      points,
      pointSummary,
      trends,
      assignees,
      top,
      openRows,
    },
    actions: { changeMetric: setMetric, toggleRow },
  }
}
