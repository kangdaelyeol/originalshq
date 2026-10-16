import { useCallback, useEffect, useMemo, useState } from 'react'
import { mondayClient } from '@/screens/xtool-lead-manager/client'
import type {
  MondayDailyInflow,
  MondayDailySale,
  MondayFollowUp,
  MondayKpiFacts,
} from '@/screens/xtool-lead-manager/entity'
import type { SortDirection } from '@/screens/xtool-lead-manager/types'
import {
  aggregateSales,
  computeKpis,
  isInactiveAssignee,
  sortKpiRows,
  sortNeglectRows,
  defaultKpiRange,
  firstKpiDate,
  inflowSeries,
  neglectByAssignee,
  salesAsDays,
  sortInflowRows,
  summarizeInflow,
  summarizeSales,
  todayInKorea,
  type InflowSortKey,
  type InflowUnit,
  type KpiRange,
  type TableSort,
  type KpiUnit,
  type PurchaseScope,
} from '@/screens/xtool-lead-manager/utils'
// 날짜 계산은 cmip과 같은 함수를 쓴다 — 기간 선택기(DateRangePicker)도 cmip
// 것이라, "오늘"·"지난 7일"의 기준이 두 화면에서 어긋나지 않게 한다.
import { addDays, todayISO } from '@/screens/cmip/utils'

/** 처음 열었을 때의 기간 — 오늘을 뺀 직전 7일(어제까지). 오늘은 아직 하루가
 * 끝나지 않아 건수가 덜 쌓였다. cmip 기간 선택기의 "지난 7일"과 같다. */
const defaultRange = (): { start: string; end: string } => {
  const end = addDays(todayISO(), -1)
  return { start: addDays(end, -6), end }
}

/** 통계 탭의 소주제. */
export type TrendSection = 'inflow' | 'sales' | 'neglect' | 'kpi'

export const TREND_SECTION_LABEL: Record<TrendSection, string> = {
  inflow: '인입통계',
  sales: '판매통계',
  neglect: '방치 현황',
  kpi: '개인 KPI',
}

/** 통계 탭의 상태 — 소주제 둘(인입통계 / 판매통계)의 원본 데이터(한 번 받아
 * 둔다)와 조회 기간, 그 기간의 그래프·표용 데이터. `active`가 처음 true가 될 때 받아온다. */
export const useMondayTrendViewModel = (active: boolean) => {
  const [days, setDays] = useState<MondayDailyInflow[]>([])
  const [syncedAt, setSyncedAt] = useState<number | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )
  const [salesRows, setSalesRows] = useState<MondayDailySale[]>([])
  const [followUps, setFollowUps] = useState<MondayFollowUp[]>([])
  const [kpiFacts, setKpiFacts] = useState<MondayKpiFacts>({
    consultations: [],
    visits: [],
    sales: [],
  })
  // 방치·개인 KPI에 삭제된 팀원·담당자 없음 줄을 보일지 — 기본은 숨김.
  const [includeInactive, setIncludeInactive] = useState(false)
  // 방치·개인 KPI 표의 정렬 — 표마다 따로(표 이름 → 정렬 상태).
  const [tableSorts, setTableSorts] = useState<Record<string, TableSort>>({})
  // 개인 KPI — 단위와, 단위마다 따로 기억하는 기간.
  const [kpiUnit, setKpiUnit] = useState<KpiUnit>('month')
  const [kpiRanges, setKpiRanges] = useState<Record<KpiUnit, KpiRange>>(() => ({
    day: defaultKpiRange('day'),
    week: defaultKpiRange('week'),
    month: defaultKpiRange('month'),
  }))
  // 방치 현황에서 펼쳐 둔 담당자들 — "종류:담당자" 문자열.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [section, setSection] = useState<TrendSection>('inflow')
  // 기간은 두 소주제가 같이 쓴다 — 오가며 같은 기간을 비교하기 쉽게.
  const [range, setRange] = useState(defaultRange)
  // 판매통계 — 채널(통합/오프라인/온라인)과 표의 정렬(처음엔 최근 날짜가 위).
  const [salesScope, setSalesScope] = useState<PurchaseScope>('all')
  const [salesSortKey, setSalesSortKey] = useState<InflowSortKey>('date')
  const [salesSortDirection, setSalesSortDirection] =
    useState<SortDirection>('desc')
  // 묶는 단위 — 일별 / 주차별 / 월별.
  const [unit, setUnit] = useState<InflowUnit>('day')
  // 표의 정렬 — 처음에는 최근 날짜가 위로.
  const [sortKey, setSortKey] = useState<InflowSortKey>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const load = useCallback(async () => {
    setStatus('loading')
    const [res, salesRes, followUpsRes, kpiRes] = await Promise.all([
      mondayClient.getDailyInflow(),
      mondayClient.getDailySales(),
      mondayClient.getFollowUps(),
      mondayClient.getKpiFacts(),
    ])
    if (!res.ok || !salesRes.ok || !followUpsRes.ok || !kpiRes.ok) {
      console.error('통계 실패:', res, salesRes, followUpsRes, kpiRes)
      setStatus('error')
      return
    }
    setDays(res.data.days)
    setSalesRows(salesRes.data.rows)
    setFollowUps(followUpsRes.data.followUps)
    setKpiFacts(kpiRes.data)
    setSyncedAt(res.data.syncedAt)
    setStatus('ready')
  }, [])

  useEffect(() => {
    if (!active || status !== 'idle') return
    ;(async () => {
      await load()
    })()
  }, [active, status, load])

  const points = useMemo(
    () => inflowSeries(days, range.start, range.end, unit),
    [days, range, unit],
  )
  const summary = useMemo(() => summarizeInflow(points), [points])

  // 그래프는 늘 시간순이고, 정렬은 표에만 적용한다.
  const tableRows = useMemo(
    () => sortInflowRows(points, sortKey, sortDirection),
    [points, sortKey, sortDirection],
  )

  /** 같은 컬럼을 다시 누르면 방향을 뒤집고, 다른 컬럼을 누르면 그 컬럼의
   * 내림차순(큰 값·최근 날짜가 위)부터 시작한다 — 리드 표와 같은 동작. */
  const toggleSort = useCallback(
    (key: InflowSortKey) => {
      if (key === sortKey) {
        setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
        return
      }
      setSortKey(key)
      setSortDirection('desc')
    },
    [sortKey],
  )

  // ── 판매통계 ────────────────────────────────────────────────────────
  const salesProducts = useMemo(
    () => aggregateSales(salesRows, range.start, range.end, salesScope),
    [salesRows, range, salesScope],
  )
  const salesSummary = useMemo(
    () => summarizeSales(salesProducts),
    [salesProducts],
  )
  // 표는 기간(일/주/월)이 줄, 제품이 칸이다 — 인입 통계와 같은 모양으로 바꿔
  // 같은 함수로 묶고 정렬한다. 묶는 단위는 인입통계와 같이 쓴다.
  const salesPoints = useMemo(
    () =>
      inflowSeries(
        salesAsDays(salesRows, salesScope),
        range.start,
        range.end,
        unit,
      ),
    [salesRows, salesScope, range, unit],
  )
  const salesColumns = useMemo(
    () => summarizeInflow(salesPoints).boards,
    [salesPoints],
  )
  const salesTableRows = useMemo(
    () => sortInflowRows(salesPoints, salesSortKey, salesSortDirection),
    [salesPoints, salesSortKey, salesSortDirection],
  )

  const toggleSalesSort = useCallback(
    (key: InflowSortKey) => {
      if (key === salesSortKey) {
        setSalesSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
        return
      }
      setSalesSortKey(key)
      setSalesSortDirection('desc')
    },
    [salesSortKey],
  )

  // ── 방치 현황 ───────────────────────────────────────────────────────
  // 기간과 무관한 "지금" 현황이다 — 오늘 기준으로 기한이 지난 것을 센다.
  const neglect = useMemo(() => {
    const today = todayInKorea()
    return {
      today,
      callback: sortNeglectRows(
        neglectByAssignee(followUps, 'callback', today).filter(
          (row) => includeInactive || !isInactiveAssignee(row.assignee),
        ),
        tableSorts['neglect:callback'],
      ),
      visit: sortNeglectRows(
        neglectByAssignee(followUps, 'visit', today).filter(
          (row) => includeInactive || !isInactiveAssignee(row.assignee),
        ),
        tableSorts['neglect:visit'],
      ),
    }
  }, [followUps, tableSorts, includeInactive])

  // ── 개인 KPI ────────────────────────────────────────────────────────
  const kpiRange = kpiRanges[kpiUnit]
  const kpiComputed = useMemo(
    () => computeKpis(kpiFacts, kpiUnit, kpiRange, includeInactive),
    [kpiFacts, kpiUnit, kpiRange, includeInactive],
  )
  const kpi = useMemo(
    () => ({
      ...kpiComputed,
      kpis: kpiComputed.kpis.map((each) => ({
        ...each,
        rows: sortKpiRows(
          each.rows,
          tableSorts[`kpi:${each.id}`],
          kpiComputed.periods,
        ),
      })),
    }),
    [kpiComputed, tableSorts],
  )

  /** 표 하나의 정렬을 바꾼다 — 같은 칸을 다시 누르면 방향을 뒤집고, 다른
   * 칸이면 내림차순부터(인입·판매 표와 같은 동작). */
  const toggleTableSort = useCallback((table: string, key: string) => {
    setTableSorts((prev) => {
      const current = prev[table]
      const direction =
        current?.key === key && current.direction === 'desc' ? 'asc' : 'desc'
      return { ...prev, [table]: { key, direction } }
    })
  }, [])
  const kpiFirstDate = useMemo(() => firstKpiDate(kpiFacts), [kpiFacts])

  /** 지금 단위의 기간을 바꾼다 — 시작이 끝보다 늦으면 둘을 맞춘다. */
  const changeKpiRange = useCallback(
    (next: Partial<KpiRange>) =>
      setKpiRanges((prev) => {
        const merged = { ...prev[kpiUnit], ...next }
        if (merged.from > merged.to) {
          if (next.from) merged.to = merged.from
          else merged.from = merged.to
        }
        return { ...prev, [kpiUnit]: merged }
      }),
    [kpiUnit],
  )

  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // 전체 기간을 한 번에 받아 두었으므로 기간을 바꿔도 다시 받지 않는다.
  const changeRange = useCallback(
    (start: string, end: string) => setRange({ start, end }),
    [],
  )

  return {
    state: {
      status,
      range,
      unit,
      points,
      summary,
      tableRows,
      sortKey,
      sortDirection,
      syncedAt,
      section,
      neglect: { ...neglect, expanded },
      tableSorts,
      includeInactive,
      kpi: {
        unit: kpiUnit,
        range: kpiRange,
        firstDate: kpiFirstDate,
        ...kpi,
      },
      sales: {
        scope: salesScope,
        summary: salesSummary,
        /** 표의 칸 — 이 기간에 팔린 제품들(수량 많은 순)과 각 합계. */
        columns: salesColumns,
        /** 표의 줄 수(기간 수) — 평균을 낼 때 나누는 값. */
        periodCount: salesPoints.length,
        tableRows: salesTableRows,
        sortKey: salesSortKey,
        sortDirection: salesSortDirection,
      },
    },
    actions: {
      changeRange,
      changeUnit: setUnit,
      toggleSort,
      reload: load,
      changeSection: setSection,
      changeSalesScope: setSalesScope,
      toggleSalesSort,
      toggleExpanded,
      changeKpiUnit: setKpiUnit,
      changeKpiRange,
      toggleIncludeInactive: () => setIncludeInactive((prev) => !prev),
      toggleTableSort,
    },
  }
}
