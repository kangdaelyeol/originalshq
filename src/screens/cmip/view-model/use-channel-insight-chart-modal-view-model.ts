import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChannelSplitSeries,
  DateSummary,
  DayOfWeekSummary,
  MetricsSummary,
  WeekSummary,
} from '../client'
import type { ISODate } from '../types'
import { METRIC_FIELDS, type MetricField } from '../components/metric-fields'
import type {
  IndexSeries,
  CompareMode,
} from '../components/index-line-chart-types'
import {
  CHANNEL_ORDER,
  CHANNEL_STYLE,
  seriesColor,
  type ChannelKey,
} from '../components/chart-colors'
import { formatMD } from '../utils'

export type InsightView = 'byDate' | 'byDayOfWeek' | 'byGroupedWeek'
export type MetricKey = keyof MetricsSummary
export type SeriesKind = 'line' | 'bar'
export type MetricMode = SeriesKind | 'off'
export type MenuKey = 'view' | 'metric' | 'group' | 'compare'

/** 모달이 그릴 수 있는 하나의 "그룹" — 전체 요약 탭에서는 계정 전체 하나뿐이고,
 * 캠페인/adset 탭에서는 페이지에서 다중 선택된 캠페인(또는 adset)마다 하나씩
 * 생긴다. CombinedCampaign/CombinedAdset이 이미 ChannelSplitSeries 모양(combined/
 * meta/google)을 그대로 갖고 있어 별도 변환 없이 넘길 수 있다. */
export interface ChartGroup {
  key: string
  label: string
  series: ChannelSplitSeries
}

function labelOf(view: InsightView, row: MetricsSummary): string {
  switch (view) {
    case 'byDate':
      return formatMD((row as DateSummary).date)
    case 'byDayOfWeek':
      return (row as DayOfWeekSummary).dayOfWeek
    case 'byGroupedWeek':
      return (row as WeekSummary).period
  }
}

/** labelOf와 달리 표시용으로 다듬지 않은 원본 키 — 채널마다 다른 rows 배열에서
 * "같은 지점"을 찾아 값을 맞춰 끼울 때 쓴다(날짜는 그대로, 요일/주차는 표시
 * 라벨과 동일). */
function rawKeyOf(view: InsightView, row: MetricsSummary): string {
  switch (view) {
    case 'byDate':
      return (row as DateSummary).date
    case 'byDayOfWeek':
      return (row as DayOfWeekSummary).dayOfWeek
    case 'byGroupedWeek':
      return (row as WeekSummary).period
  }
}

/** channel-insight-chart-modal 전용 상태 — 축(view)/채널·그룹 다중 선택/대비 표시/
 * 확대·테마/드롭다운 열림/일별 부분 기간 축소를 다루고, 이들로부터 그래프에 넘길
 * categories/series까지 계산해서 돌려준다. */
export const useChannelInsightChartModalViewModel = (
  groups: readonly ChartGroup[],
  defaultActiveGroupKeys: readonly string[] | undefined,
  metricMode: ReadonlyMap<MetricKey, SeriesKind>,
  onClose: () => void,
) => {
  const [view, setView] = useState<InsightView>('byDate')
  // 채널은 다중 선택 — 켠 채널마다 지표 하나당 시리즈 하나씩 겹쳐 그린다(지표 10개
  // × 채널 최대 3개 = 최대 30개). 최소 하나는 항상 켜져 있어야 한다.
  const [channels, setChannels] = useState<ReadonlySet<ChannelKey>>(
    () => new Set(['combined']),
  )
  // 그룹(캠페인/adset)도 채널과 같은 방식의 다중 선택 — 기본값은 페이지에서
  // 이미 체크된 항목들(defaultActiveGroupKeys), 없으면 첫 후보 하나.
  const [activeGroupKeys, setActiveGroupKeys] = useState<ReadonlySet<string>>(
    () => {
      const defaults = (defaultActiveGroupKeys ?? []).filter((key) =>
        groups.some((g) => g.key === key),
      )
      return new Set(
        defaults.length > 0 ? defaults : groups[0] ? [groups[0].key] : [],
      )
    },
  )
  // "대비 표시" — 포커스된(호버/범례) 지표에 한해 그래프 위 추가 증감 라벨을
  // 켠다. 기본은 끄기.
  const [compareMode, setCompareMode] = useState<CompareMode>('off')
  const [expanded, setExpanded] = useState(false)
  // 색이 같은 계열로 겹쳐 보일 때(채널별 명도 차이) 배경에 따라 가독성이 갈려서
  // 차트만 라이트로 바꿔 볼 수 있게 둔다 — 모달 나머지 크롬은 다크 유지.
  const [chartTheme, setChartTheme] = useState<'dark' | 'light'>('dark')
  // 집계 기준 / 지표 선택을 드롭다운 한 줄로 압축 — 차트가 쓸 세로 공간을 최대한
  // 남겨두기 위해서다. 한 번에 하나만 열린다.
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null)
  const controlsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // 드롭다운이 열려 있으면 그것부터 닫는다 — 모달까지 한번에 닫히지 않도록.
      if (openMenu) {
        setOpenMenu(null)
        return
      }
      onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, openMenu])

  useEffect(() => {
    if (!openMenu) return
    const handlePointerDown = (e: PointerEvent) => {
      if (!controlsRef.current?.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openMenu])

  const toggleChannel = (key: ChannelKey) => {
    setChannels((prev) => {
      if (prev.has(key)) {
        if (prev.size === 1) return prev // 최소 하나는 켜져 있어야 한다.
        const next = new Set(prev)
        next.delete(key)
        return next
      }
      return new Set(prev).add(key)
    })
  }

  const toggleGroup = (key: string) => {
    setActiveGroupKeys((prev) => {
      if (prev.has(key)) {
        if (prev.size === 1) return prev // 최소 하나는 켜져 있어야 한다.
        const next = new Set(prev)
        next.delete(key)
        return next
      }
      return new Set(prev).add(key)
    })
  }

  const selectedGroups = groups.filter((g) => activeGroupKeys.has(g.key))
  const groupTriggerLabel =
    selectedGroups.length === 0
      ? '선택 없음'
      : selectedGroups.length === 1
        ? selectedGroups[0].label
        : `${selectedGroups.length}개 선택`

  // 날짜축·기간 축소는 채널/그룹 선택과 무관하게 항상 "전체"(합집합) 기준 —
  // 특정 채널/그룹만 켰다고 그 커버리지로 축이 줄어들면 안 된다(값이 없는
  // 지점은 0으로 채워 그리면 된다). 모든 그룹이 같은 조회 범위로 만들어져
  // byGroupedWeek 경계가 이미 동일하므로, 첫 번째 그룹 것을 기준으로 삼는다.
  const combinedSeries = groups[0]?.series.combined

  // "일별" 보기에서만 실제 날짜 단위 데이터라 부분 기간 축소가 가능하다 — 요일별/
  // 주차별은 이미 집계된 값이라 원본 일자로 되짚어 재집계할 수 없다.
  const dateBounds = useMemo(() => {
    const byDate = combinedSeries?.byDate ?? []
    if (byDate.length === 0) return null
    let min = byDate[0].date
    let max = byDate[0].date
    for (const row of byDate) {
      if (row.date < min) min = row.date
      if (row.date > max) max = row.date
    }
    return { min, max }
  }, [combinedSeries])

  const [dateNarrow, setDateNarrow] = useState<{
    start: ISODate
    end: ISODate
  } | null>(null)
  // dateBounds가 바뀌면(모달을 열어둔 채 다시 조회한 경우 포함) 축소 범위를 그
  // 전체 기간으로 리셋한다 — 이전 조회의 축소값이 남아있지 않도록. 렌더 중
  // 비교해서 바뀐 시점에만 반영한다("prop 변화에 맞춰 state 조정하기" 패턴).
  const [syncedBoundsKey, setSyncedBoundsKey] = useState<string | null>(null)
  const boundsKey = dateBounds ? `${dateBounds.min}_${dateBounds.max}` : null
  if (boundsKey !== syncedBoundsKey) {
    setSyncedBoundsKey(boundsKey)
    setDateNarrow(
      dateBounds ? { start: dateBounds.min, end: dateBounds.max } : null,
    )
  }

  const rows: readonly MetricsSummary[] = useMemo(() => {
    const base = combinedSeries?.[view] ?? []
    if (view !== 'byDate' || !dateNarrow) return base
    return (base as readonly DateSummary[]).filter(
      (row) => row.date >= dateNarrow.start && row.date <= dateNarrow.end,
    )
  }, [combinedSeries, view, dateNarrow])

  const categories = useMemo(
    () => rows.map((row) => labelOf(view, row)),
    [rows, view],
  )

  const series: IndexSeries[] = useMemo(() => {
    // 축(rows)이 가리키는 지점들의 원본 키(날짜/요일/기간) — 그룹×채널별 rows에서
    // 같은 지점을 찾아 값을 맞춰 끼우는 데 쓴다. 그 지점이 없으면 0.
    const rowKeys = rows.map((row) => rawKeyOf(view, row))
    const selectedChannels = CHANNEL_ORDER.filter((c) => channels.has(c))
    // 그룹 색은 "지금 선택된 것 중 몇 번째"가 아니라 "전체 후보 중 몇 번째"로
    // 고정한다 — 다른 그룹을 껐다 켰다 해도 이 그룹의 색은 항상 같아야 한다.
    const groupIndex = new Map(groups.map((g, i) => [g.key, i]))

    const build = (
      f: MetricField,
      type: SeriesKind,
      group: ChartGroup,
      channelKey: ChannelKey,
    ): IndexSeries => {
      const channelRows = group.series[channelKey][view]
      const byKey = new Map(
        channelRows.map((row) => [rawKeyOf(view, row), row]),
      )
      const channelStyle = CHANNEL_STYLE[channelKey]
      const labelParts = [f.label]
      if (selectedGroups.length > 1) labelParts.push(group.label)
      if (channels.size > 1) labelParts.push(channelStyle.label)
      return {
        key: `${f.key}:${group.key}:${channelKey}`,
        label: labelParts.join(' · '),
        color: seriesColor(f.color, groupIndex.get(group.key) ?? 0, channelKey),
        type,
        unit: f.unit,
        raw: rowKeys.map((k) => byKey.get(k)?.[f.key] ?? 0),
        format: f.format,
        formatCompact: f.formatCompact,
      }
    }
    const buildAllGroupsAndChannels = (f: MetricField, type: SeriesKind) =>
      selectedGroups.flatMap((g) =>
        selectedChannels.map((ck) => build(f, type, g, ck)),
      )

    // 막대를 먼저 — 차트가 라인/마커를 그 위에 얹는다.
    const bars = METRIC_FIELDS.filter(
      (f) => metricMode.get(f.key) === 'bar',
    ).flatMap((f) => buildAllGroupsAndChannels(f, 'bar'))
    const lines = METRIC_FIELDS.filter(
      (f) => metricMode.get(f.key) === 'line',
    ).flatMap((f) => buildAllGroupsAndChannels(f, 'line'))
    return [...bars, ...lines]
  }, [rows, view, metricMode, channels, groups, selectedGroups])

  return {
    // 진행 상태
    view,
    channels,
    activeGroupKeys,
    compareMode,
    expanded,
    chartTheme,
    openMenu,
    controlsRef,
    selectedGroups,
    groupTriggerLabel,
    dateBounds,
    dateNarrow,
    categories,
    series,
    // 액션
    setView,
    toggleChannel,
    toggleGroup,
    setCompareMode,
    setExpanded,
    setChartTheme,
    setOpenMenu,
    setDateNarrow,
  }
}
