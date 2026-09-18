import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type {
  ChannelSplitSeries,
  DateSummary,
  DayOfWeekSummary,
  MetricsSummary,
  WeekSummary,
} from '../client'
import type { ISODate } from '../types'
import { METRIC_FIELDS, type MetricField } from './metric-fields'
import {
  IndexLineChart,
  type ChartTheme,
  type CompareMode,
  type IndexSeries,
} from './index-line-chart'
import { DateRangeNarrow } from './date-range-narrow'
import { formatMD } from '../utils'
import '../styles/meta-insight-chart-modal.scss'

type InsightView = 'byDate' | 'byDayOfWeek' | 'byGroupedWeek'
type MetricKey = keyof MetricsSummary

const VIEW_OPTIONS: readonly { value: InsightView; label: string }[] = [
  { value: 'byDate', label: '일별' },
  { value: 'byDayOfWeek', label: '요일별' },
  { value: 'byGroupedWeek', label: '주차별' },
]

// "대비 표시" — 포커스(호버/범례)된 지표에 한해 그래프 위에 추가 증감 라벨을
// 얹는다(IndexLineChart의 CompareMode 참고).
const COMPARE_OPTIONS: readonly { value: CompareMode; label: string }[] = [
  { value: 'off', label: '끄기' },
  { value: 'minmax', label: '최저·최고 값 표시' },
  { value: 'all', label: '모든 지표값 표시' },
]

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

const X_AXIS_LABEL: Record<InsightView, string> = {
  byDate: '날짜',
  byDayOfWeek: '요일',
  byGroupedWeek: '기간',
}

export type SeriesKind = 'line' | 'bar'
export type MetricMode = SeriesKind | 'off'

const MODE_OPTIONS: readonly MetricMode[] = ['off', 'line', 'bar']

const MODE_LABEL: Record<MetricMode, string> = {
  off: '끄기',
  line: '꺾은선',
  bar: '막대',
}

type MenuKey = 'view' | 'metric' | 'group' | 'compare'

type ChannelKey = 'combined' | 'meta' | 'google' | 'naver'

// 지금은 Meta/Google/Naver — 당근이 붙으면 이 목록만 늘리면 된다
// (CombinedInsight.series가 그 채널 키를 갖게 되는 시점에 맞춰).
const CHANNEL_STYLE: Record<ChannelKey, { label: string }> = {
  combined: { label: '전체' },
  meta: { label: 'Meta' },
  google: { label: 'Google' },
  naver: { label: 'Naver' },
}
const CHANNEL_ORDER: readonly ChannelKey[] = [
  'combined',
  'meta',
  'google',
  'naver',
]

// 지표 10개 × 채널 최대 4개 = 최대 40색. dash·투명도로 채널을 구분해봤더니 오히려
// 헷갈려서, 지표 고유 색상(hue)은 유지한 채 채널마다 명도/채도만 다르게 바꿔서
// "같은 지표 계열, 다른 채널"이 색으로 바로 구별되게 한다(전체=원색, Meta=밝게,
// Google=어둡고 살짝 다른 색조, Naver=그와 또 다른 색조). 채널이 늘어나면
// CHANNEL_SHIFT에 한 줄만 추가하면 됨.
const CHANNEL_SHIFT: Record<
  ChannelKey,
  { hue: number; saturation: number; lightness: number }
> = {
  combined: { hue: 0, saturation: 0, lightness: 0 },
  meta: { hue: 0, saturation: 4, lightness: 16 },
  google: { hue: 10, saturation: -6, lightness: -15 },
  naver: { hue: -20, saturation: 8, lightness: -5 },
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = (((g - b) / d) % 6) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
    if (h < 0) h += 360
  }
  return [h, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100
  const lN = l / 100
  const c = (1 - Math.abs(2 * lN - 1)) * sN
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lN - c / 2
  const [r0, g0, b0] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r0)}${toHex(g0)}${toHex(b0)}`
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v))

// 캠페인/adset처럼 "그룹"을 여러 개 동시에 켰을 때도 채널과 같은 방식으로
// 구분한다 — 그룹 인덱스(선택 여부와 무관하게 항상 같은 그룹은 같은 인덱스라
// 색이 고정됨)에 따라 색조/명도를 추가로 틀고, 채널 시프트와 더한다. 그룹×채널
// 조합이 늘어날수록 색이 촘촘해지지만, 채널 30색 팔레트와 같은 트레이드오프로
// 받아들인다(둘 다 동시에 여러 개 켜는 일은 실제로 드물다).
const GROUP_HUE_STEP = 47 // 360과 서로소에 가까워, 그룹을 몇 개 켜도 색상이 금방 반복되지 않는다.
const GROUP_LIGHTNESS_CYCLE = [0, -14, 12, -26, 22]

function groupShift(index: number): {
  hue: number
  saturation: number
  lightness: number
} {
  return {
    hue: (index * GROUP_HUE_STEP) % 360,
    saturation: 0,
    lightness: GROUP_LIGHTNESS_CYCLE[index % GROUP_LIGHTNESS_CYCLE.length],
  }
}

/** 지표 기본색을 채널×그룹 조합별로 살짝 다른 색조/명도의 같은 색 계열로 바꾼다. */
function seriesColor(
  baseColor: string,
  groupIndex: number,
  channelKey: ChannelKey,
): string {
  const c = CHANNEL_SHIFT[channelKey]
  const g = groupShift(groupIndex)
  const hue = c.hue + g.hue
  const saturation = c.saturation + g.saturation
  const lightness = c.lightness + g.lightness
  if (hue === 0 && saturation === 0 && lightness === 0) return baseColor
  const [h, s, l] = hexToHsl(baseColor)
  return hslToHex(
    (h + hue + 360) % 360,
    clamp(s + saturation, 15, 100),
    clamp(l + lightness, 15, 85),
  )
}

function ChevronIcon() {
  return (
    <svg
      className="meta-insight-chart-modal__chevron"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 캠페인/adset 다중 선택 드롭다운의 체크 표시 — 네이티브 input은 시각적으로만
 * 숨기고(sr-only) 이 아이콘 + 박스로 대신 그린다. */
function CheckIcon() {
  return (
    <svg
      className="meta-insight-chart-modal__group-check"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 모달이 그릴 수 있는 하나의 "그룹" — 전체 요약 탭에서는 계정 전체 하나뿐이고,
 * 캠페인/adset 탭에서는 페이지에서 다중 선택된 캠페인(또는 adset)마다 하나씩
 * 생긴다. CombinedCampaign/CombinedAdset이 이미 ChannelSplitSeries 모양(combined/
 * meta/google)을 그대로 갖고 있어 별도 변환 없이 넘길 수 있다. */
export interface ChartGroup {
  key: string
  label: string
  series: ChannelSplitSeries
}

interface MetaInsightChartModalProps {
  /** 그릴 수 있는 전체 후보 — 페이지에서 체크된 것만이 아니라 항상 전체
   * 캠페인/adset(또는 전체 요약 하나) 목록이다. 어떤 걸 볼지는 이 모달 안의
   * 그룹 드롭다운이 따로 고른다. */
  groups: readonly ChartGroup[]
  /** 모달을 처음 열었을 때 기본으로 켜둘 그룹 — 보통 페이지에서 이미 체크해둔
   * 항목들(그래야 표에서 보던 것과 같은 화면으로 시작한다). groups에 없는 키는
   * 무시된다. */
  defaultActiveGroupKeys?: readonly string[]
  // 지표 선택(꺾은선/막대/끄기)은 캠페인/adset 교차표의 지표 선택과 같은
  // 상태를 페이지(meta-insight.tsx)에서 그대로 물려받는다 — 그래프에서 지표를
  // 바꾸면 표도 즉시 같이 바뀐다(반대도 마찬가지).
  metricMode: ReadonlyMap<MetricKey, SeriesKind>
  setMode: (key: MetricKey, mode: MetricMode) => void
  clearAllMetrics: () => void
  onClose: () => void
}

export const MetaInsightChartModal = ({
  groups,
  defaultActiveGroupKeys,
  metricMode,
  setMode,
  clearAllMetrics,
  onClose,
}: MetaInsightChartModalProps) => {
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
  const [chartTheme, setChartTheme] = useState<ChartTheme>('dark')
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

  return (
    <div className="meta-insight-chart-modal" onClick={onClose}>
      <div
        className={`meta-insight-chart-modal__panel${
          expanded ? ' is-expanded' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="meta-insight-chart-modal__header">
          <div
            className="meta-insight-chart-modal__channel-tabs"
            role="group"
            aria-label="채널(다중 선택)"
          >
            {CHANNEL_ORDER.map((key) => {
              const active = channels.has(key)
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  className={`meta-insight-chart-modal__channel-tab${
                    active ? ' is-active' : ''
                  }`}
                  onClick={() => toggleChannel(key)}
                >
                  {CHANNEL_STYLE[key].label}
                </button>
              )
            })}
          </div>
          <div className="meta-insight-chart-modal__header-actions">
            <button
              type="button"
              className="meta-insight-chart-modal__expand"
              onClick={() =>
                setChartTheme((t) => (t === 'dark' ? 'light' : 'dark'))
              }
              aria-pressed={chartTheme === 'light'}
            >
              {chartTheme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </button>
            <button
              type="button"
              className="meta-insight-chart-modal__expand"
              onClick={() => setExpanded((v) => !v)}
              aria-pressed={expanded}
            >
              {expanded ? '작게 보기' : '크게 보기'}
            </button>
            <button
              type="button"
              className="meta-insight-chart-modal__close"
              onClick={onClose}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="meta-insight-chart-modal__controls" ref={controlsRef}>
          {/* 캠페인/adset 탭에서만(그룹이 2개 이상일 때만) 뜬다 — 전체 요약
              탭은 그룹이 하나뿐이라 고를 이유가 없다. */}
          {groups.length > 1 && (
            <div className="meta-insight-chart-modal__dropdown">
              <button
                type="button"
                className={`meta-insight-chart-modal__dropdown-trigger${
                  openMenu === 'group' ? ' is-open' : ''
                }`}
                aria-haspopup="true"
                aria-expanded={openMenu === 'group'}
                onClick={() =>
                  setOpenMenu((m) => (m === 'group' ? null : 'group'))
                }
              >
                {groupTriggerLabel}
                <ChevronIcon />
              </button>
              {openMenu === 'group' && (
                <div className="meta-insight-chart-modal__dropdown-menu meta-insight-chart-modal__group-menu">
                  {groups.map((g) => (
                    <label
                      key={g.key}
                      className="meta-insight-chart-modal__group-item"
                    >
                      <input
                        type="checkbox"
                        className="meta-insight-chart-modal__group-input"
                        checked={activeGroupKeys.has(g.key)}
                        onChange={() => toggleGroup(g.key)}
                      />
                      <span className="meta-insight-chart-modal__group-box">
                        <span className="meta-insight-chart-modal__group-fill" />
                        <CheckIcon />
                      </span>
                      <span className="meta-insight-chart-modal__group-label">
                        {g.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="meta-insight-chart-modal__dropdown">
            <button
              type="button"
              className={`meta-insight-chart-modal__dropdown-trigger${
                openMenu === 'view' ? ' is-open' : ''
              }`}
              aria-haspopup="listbox"
              aria-expanded={openMenu === 'view'}
              onClick={() => setOpenMenu((m) => (m === 'view' ? null : 'view'))}
            >
              {VIEW_OPTIONS.find((o) => o.value === view)?.label}
              <ChevronIcon />
            </button>
            {openMenu === 'view' && (
              <div
                className="meta-insight-chart-modal__dropdown-menu"
                role="listbox"
              >
                {VIEW_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={view === o.value}
                    className={`meta-insight-chart-modal__dropdown-item${
                      view === o.value ? ' is-selected' : ''
                    }`}
                    onClick={() => {
                      setView(o.value)
                      setOpenMenu(null)
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="meta-insight-chart-modal__dropdown">
            <button
              type="button"
              className={`meta-insight-chart-modal__dropdown-trigger${
                openMenu === 'metric' ? ' is-open' : ''
              }`}
              aria-haspopup="true"
              aria-expanded={openMenu === 'metric'}
              onClick={() =>
                setOpenMenu((m) => (m === 'metric' ? null : 'metric'))
              }
            >
              지표선택
              <ChevronIcon />
            </button>
            {openMenu === 'metric' && (
              <div className="meta-insight-chart-modal__dropdown-menu meta-insight-chart-modal__metric-menu">
                {METRIC_FIELDS.map((f) => {
                  const mode: MetricMode = metricMode.get(f.key) ?? 'off'
                  return (
                    <div
                      key={f.key}
                      className="meta-insight-chart-modal__metric-row"
                    >
                      <span
                        className="meta-insight-chart-modal__metric-row-dot"
                        style={{ background: f.color }}
                      />
                      <span className="meta-insight-chart-modal__metric-row-label">
                        {f.label}
                      </span>
                      <div
                        className="meta-insight-chart-modal__metric-row-toggle"
                        role="group"
                        aria-label={f.label}
                      >
                        {MODE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className={`meta-insight-chart-modal__metric-toggle-btn${
                              mode === opt ? ' is-active' : ''
                            }${opt !== 'off' ? ' is-colorable' : ''}`}
                            style={{ '--chip-color': f.color } as CSSProperties}
                            aria-pressed={mode === opt}
                            onClick={() => setMode(f.key, opt)}
                          >
                            {MODE_LABEL[opt]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                <div className="meta-insight-chart-modal__metric-menu-actions">
                  <button
                    type="button"
                    className="meta-insight-chart-modal__metric-menu-action"
                    disabled={metricMode.size === 0}
                    onClick={clearAllMetrics}
                  >
                    모두 끄기
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* "일별" 보기에서만 — 이미 조회된 전체 기간 안에서 부분 구간만 잘라 본다. */}
          {view === 'byDate' && dateBounds && dateNarrow && (
            <DateRangeNarrow
              minDate={dateBounds.min}
              maxDate={dateBounds.max}
              dateStart={dateNarrow.start}
              dateEnd={dateNarrow.end}
              onChange={(start, end) => setDateNarrow({ start, end })}
            />
          )}

          {/* 대비 표시 — 컨트롤 행 맨 오른쪽에 고정(margin-left:auto). 그래프에서
              특정 지표를 호버(또는 범례 호버)하면, 여기서 고른 방식대로 그 지표
              위에 추가 증감 라벨이 뜬다(IndexLineChart 참고). */}
          <div className="meta-insight-chart-modal__dropdown meta-insight-chart-modal__dropdown--compare">
            <button
              type="button"
              className={`meta-insight-chart-modal__dropdown-trigger${
                openMenu === 'compare' ? ' is-open' : ''
              }`}
              aria-haspopup="listbox"
              aria-expanded={openMenu === 'compare'}
              onClick={() =>
                setOpenMenu((m) => (m === 'compare' ? null : 'compare'))
              }
            >
              대비 표시:{' '}
              {COMPARE_OPTIONS.find((o) => o.value === compareMode)?.label}
              <ChevronIcon />
            </button>
            {openMenu === 'compare' && (
              <div
                className="meta-insight-chart-modal__dropdown-menu"
                role="listbox"
              >
                {COMPARE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={compareMode === o.value}
                    className={`meta-insight-chart-modal__dropdown-item${
                      compareMode === o.value ? ' is-selected' : ''
                    }`}
                    onClick={() => {
                      setCompareMode(o.value)
                      setOpenMenu(null)
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className={`meta-insight-chart-modal__chart-single${
            chartTheme === 'light' ? ' is-light' : ''
          }`}
        >
          <IndexLineChart
            categories={categories}
            series={series}
            xAxisLabel={X_AXIS_LABEL[view]}
            theme={chartTheme}
            compareMode={compareMode}
          />
        </div>
      </div>
    </div>
  )
}
