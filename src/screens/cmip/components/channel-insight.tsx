import { Fragment, Suspense, lazy, useEffect } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import metaIconPng from '../assets/meta_icon.png'
import naverLogoPng from '../assets/naver_logo.png'
import { useChannelInsightViewModel } from '../view-model/use-channel-insight-view-model'
import {
  useChannelInsightPageViewModel,
  type ResultTab,
  type PivotView,
} from '../view-model/use-channel-insight-page-view-model'
import { useResultPanelViewModel } from '../view-model/use-result-panel-view-model'
import { useMetricsTableViewModel } from '../view-model/use-metrics-table-view-model'
import {
  useMultiSelectDropdownViewModel,
  type MultiSelectOption,
} from '../view-model/use-multi-select-dropdown-view-model'
import {
  useFullListTableViewModel,
  type FullListRow,
} from '../view-model/use-full-list-table-view-model'
import type {
  DateSummary,
  DayOfWeekSummary,
  GroupedInsightSeries,
  MetricsSummary,
  WeekSummary,
} from '../client'
import {
  aggregateMetrics,
  emptyMetrics,
  groupByDayOfWeek,
  groupByWeek,
  metricsForDateSubset,
  weekdayLabelOf,
} from '../client'
import { METRIC_FIELDS, type MetricField, type MetricKey } from './metric-fields'
import { CHANNELS, channelsOf, type ChannelKey } from './channels'
import { DateRangePicker } from './date-range-picker'
import { ChannelInsightChartModal } from './channel-insight-chart-modal'
import { PeriodTestPanel } from './period-test-panel'
import { dateRange } from '../utils'

// exceljs가 꽤 커서(~900KB) 실제로 모달을 열 때만 불러온다 — cmip 화면
// 진입 시 항상 받아지는 번들에 넣지 않는다.
const ExcelExportModal = lazy(() =>
  import('./excel-export-modal').then((m) => ({
    default: m.ExcelExportModal,
  })),
)
import type { ISODate } from '../types'
import '../styles/channel-insight.scss'

// "Meta" 옆 텍스트 색 — 실제 브랜드 워드마크는 검정 글자지만, 이 표는 배경이
// 어두워서 검정 그대로 쓰면 글자가 배경에 묻혀 안 보인다. 그래서 하양으로
// 바꾼다(로고 아이콘 자체는 브랜드 블루를 그대로 유지). Google/Naver는 로고가
// 이미 워드마크(전체 글자 이미지)라 텍스트를 따로 안 그리므로 이 값이 쓰이지
// 않는다.
const CHANNEL_TEXT_COLOR: Record<ChannelKey, string> = {
  meta: '#ffffff',
  google: '#4285f4',
  naver: '#03c75a',
}

// 전체 캠페인/adset 표의 채널 필터 버튼 chip 색 — 지표 토글 버튼과 같은
// --chip-color 방식(켜졌을 때만 이 색으로 옅게 물듦)을 그대로 재사용한다.
const CHANNEL_CHIP_COLOR: Record<ChannelKey, string> = {
  meta: '#1877f2',
  google: '#4285f4',
  naver: '#03c75a',
}

function MetaLogo() {
  return (
    <img className="channel-insight__channel-logo" src={metaIconPng} alt="" />
  )
}

// 작은 "G" 아이콘 대신 실제 구글 워드마크(전체 로고) 전체를 쓴다 — 그 자체로
// "Google"이라고 읽혀서 옆에 별도 텍스트를 안 붙여도 된다.
function GoogleLogo() {
  return (
    <svg
      className="channel-insight__channel-logo channel-insight__channel-logo--google"
      viewBox="0 0 272 92"
      aria-hidden
    >
      <path
        fill="#EA4335"
        d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"
      />
      <path
        fill="#FBBC05"
        d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C119.25 34.32 129.24 25 141.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"
      />
      <path
        fill="#4285F4"
        d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z"
      />
      <path fill="#34A853" d="M225 3v65h-9.5V3h9.5z" />
      <path
        fill="#EA4335"
        d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z"
      />
      <path
        fill="#4285F4"
        d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.49.01z"
      />
    </svg>
  )
}

// Google과 같은 이유로(로고 자체가 "NAVER" 워드마크) 옆에 텍스트를 따로 안 붙인다.
function NaverLogo() {
  return (
    <img
      className="channel-insight__channel-logo channel-insight__channel-logo--naver"
      src={naverLogoPng}
      alt=""
    />
  )
}

const CHANNEL_LOGO: Record<ChannelKey, () => ReactElement> = {
  meta: MetaLogo,
  google: GoogleLogo,
  naver: NaverLogo,
}

/** 채널 이름(Meta/Google/Naver)을 브랜드 색 + 로고와 함께 보여준다 — 표의 채널별
 * 펼침 행, Summary의 "자세히 보기" 채널 카드 둘 다 여기 하나로 통일. Google/Naver는
 * 로고가 이미 워드마크(전체 글자)라 옆에 텍스트를 또 안 붙인다. */
function ChannelLabel({
  channelKey,
  label,
}: {
  channelKey: ChannelKey
  label: string
}) {
  const Logo = CHANNEL_LOGO[channelKey]
  return (
    <span
      className="channel-insight__channel-label"
      style={{ color: CHANNEL_TEXT_COLOR[channelKey] }}
    >
      <Logo />
      {channelKey === 'meta' && label}
    </span>
  )
}

const RESULT_TABS: readonly { key: ResultTab; label: string }[] = [
  { key: 'total', label: '전체 요약' },
  { key: 'campaign', label: '캠페인' },
  { key: 'adset', label: '광고셋' },
  { key: 'periodTest', label: '매체별 테스트' },
]

function ChevronIcon() {
  return (
    <svg
      className="channel-insight__chevron"
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

/** 커스텀 체크박스(MultiSelectDropdown)의 체크 표시 — 네이티브 input은 시각적으로
 * 숨기고(sr-only) 이 아이콘 + 박스로 대신 그린다. */
function CheckIcon() {
  return (
    <svg
      className="channel-insight__multi-select-check"
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

function InfoIcon() {
  return (
    <svg
      className="channel-insight__info-icon"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth={1.3} />
      <path
        d="M8 7.2v4"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <circle cx="8" cy="4.8" r="0.9" fill="currentColor" />
    </svg>
  )
}

/** 지표 컬럼 헤더 라벨 — field.note가 있으면(현재 frequency만) 옆에 "?" 아이콘을
 * 달아, 호버(또는 포커스, 키보드 접근성)하면 설명이 뜬다. 채널마다 그 지표를
 * 지원하는 범위가 달라(예: 네이버는 frequency 자체가 없고, Google은 캠페인
 * 단위에만 있음) 값만 보고는 헷갈릴 수 있는 지표를 위한 것 — 표 헤더 여러 곳
 * (전체 요약/캠페인·adset 교차표/전체 목록)이 이 컴포넌트를 공유한다.
 * label을 넘기면 field.label 대신 그걸 쓴다(단위가 붙은 "Frequency(회)" 같은
 * 표시용 텍스트를 쓰면서 note는 그대로 field 기준으로 가져오는 경우). */
function MetricHeaderLabel({
  field,
  label,
}: {
  field: MetricField
  label?: string
}) {
  const text = label ?? field.label
  if (!field.note) return <>{text}</>
  return (
    <span className="channel-insight__metric-head">
      {text}
      <span className="channel-insight__info" tabIndex={0}>
        <InfoIcon />
        <span className="channel-insight__info-tooltip" role="tooltip">
          {field.note}
        </span>
      </span>
    </span>
  )
}

function KpiGrid({ metrics }: { metrics: MetricsSummary }) {
  return (
    <div className="channel-insight__summary-grid">
      {METRIC_FIELDS.map(({ key, label, format }) => (
        <div key={key} className="channel-insight__kpi">
          <span className="channel-insight__kpi-label">{label}</span>
          <span className="channel-insight__kpi-value">
            {format(metrics[key])}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 조회 중(로딩)일 때 KpiGrid 자리에 대신 깔아두는 스켈레톤 — 값이 들어올 자리를
 * 그대로 흉내 내서(라벨 폭 짧게, 값 폭 길게) 레이아웃이 흔들리지 않게 한다. */
function KpiSkeletonGrid() {
  return (
    <div className="channel-insight__summary-grid" aria-hidden>
      {METRIC_FIELDS.map(({ key }) => (
        <div key={key} className="channel-insight__kpi">
          <span className="channel-insight__skeleton-bar channel-insight__skeleton-bar--label" />
          <span className="channel-insight__skeleton-bar channel-insight__skeleton-bar--value" />
        </div>
      ))}
    </div>
  )
}

interface ChannelBreakdown {
  meta: MetricsSummary
  google: MetricsSummary
  naver: MetricsSummary
}

type DeltaDir = 'up' | 'down' | 'flat'

const DELTA_ARROW: Record<DeltaDir, string> = { up: '▲', down: '▼', flat: '—' }

/** 두 값 사이의 증감/등락률 — prev가 없으면(첫 행 등) null. 표에 나열된 순서상
 * "바로 앞 행"과 비교하는 데 쓴다 — 일별 표에선 전일대비, 주차별 표에선
 * 전주대비가 되고, 요일별 표는 월~일 나열 순서상 바로 앞 요일과 비교한다(그
 * 표들이 이미 나열하는 순서를 그대로 따르는 것이라 테이블 종류를 가리지 않는다).
 * 메인 행뿐 아니라 채널별 펼침 행(각 채널의 이전 행 값)에도 그대로 쓴다. */
function computeMetricDelta(
  now: number,
  prev: number | null,
): { delta: number; pct: number | null; dir: DeltaDir } | null {
  if (prev == null) return null
  const delta = now - prev
  const pct = prev !== 0 ? (delta / Math.abs(prev)) * 100 : null
  const dir: DeltaDir = delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
  return { delta, pct, dir }
}

/** 지표 한 칸의 내용 — 대비 표시가 꺼져 있거나 비교할 이전 값이 없으면 값만,
 * 켜져 있으면 왼쪽에 증감/등락률, 오른쪽에 값을 같이 보여준다. 메인 행과 채널별
 * 펼침 행이 이 렌더링을 공유한다. */
function MetricCell({
  value,
  prevValue,
  format,
  showCompare,
}: {
  value: number
  prevValue: number | null
  format: (v: number) => string
  showCompare: boolean
}) {
  const cmp = showCompare ? computeMetricDelta(value, prevValue) : null
  if (!cmp) return <>{format(value)}</>
  return (
    <span className="channel-insight__metric-cell">
      <span className={`channel-insight__metric-delta is-${cmp.dir}`}>
        {DELTA_ARROW[cmp.dir]} {format(Math.abs(cmp.delta))}
        {cmp.pct != null &&
          ` (${cmp.delta >= 0 ? '+' : '-'}${Math.abs(cmp.pct).toFixed(1)}%)`}
      </span>
      <span className="channel-insight__metric-value">{format(value)}</span>
    </span>
  )
}

type SortDir = 'asc' | 'desc'

/** 정렬 중인 컬럼에만 방향(▲/▼)을 강조 표시 — 정렬 대상이 아닌 컬럼은 둘 다 옅게
 * 둔다. 전체 요약 표(MetricsTable)와 전체 목록 표(FullListTable) 둘 다 공유. */
function SortArrows({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="channel-insight__sort-arrows">
      <span
        className={`channel-insight__sort-arrow${active && dir === 'asc' ? ' is-active' : ''}`}
      >
        ▲
      </span>
      <span
        className={`channel-insight__sort-arrow${active && dir === 'desc' ? ' is-active' : ''}`}
      >
        ▼
      </span>
    </span>
  )
}

/** 정렬 가능한 지표 컬럼 헤더 — 정렬 버튼(라벨+화살표) 옆에, note가 있으면(현재
 * frequency만) "?" 아이콘을 버튼 밖에 따로 둔다(버튼 안에 넣으면 "?" 클릭이
 * 정렬 토글까지 같이 눌러버린다). MetricsTable/FullListTable 둘 다 공유. */
function SortableMetricHeader({
  field,
  active,
  dir,
  onSort,
}: {
  field: MetricField
  active: boolean
  dir: SortDir
  onSort: () => void
}) {
  return (
    <>
      <button
        type="button"
        className="channel-insight__sort-head"
        onClick={onSort}
      >
        {field.label}
        <SortArrows active={active} dir={dir} />
      </button>
      {field.note && (
        <span className="channel-insight__info" tabIndex={0}>
          <InfoIcon />
          <span className="channel-insight__info-tooltip" role="tooltip">
            {field.note}
          </span>
        </span>
      )}
    </>
  )
}

function MetricsTable<T extends MetricsSummary>({
  rows,
  rowKey,
  headLabel,
  headValue,
  getChannelBreakdown,
  channels,
  showCompare,
  visibleKeys,
  onToggleMetric,
  channelFilter,
  onChannelFilterChange,
}: {
  rows: readonly T[]
  rowKey: (row: T) => string
  headLabel: string
  headValue: (row: T) => string
  /** 그 행(날짜/요일/주차)이 가리키는 기간의 채널별 total — 드롭다운으로 펼쳐 보여준다.
   * channelFilter가 'all'이 아니면(이미 그 채널 하나만 보는 중이라) 아예 안 쓰인다. */
  getChannelBreakdown: (row: T) => ChannelBreakdown
  /** 펼쳤을 때 보여줄 채널 — 이 캠페인/adset에 아예 데이터가 없는 채널(예: Meta
   * 전용 캠페인의 Google)은 모든 행이 0으로만 나와서 무의미하니 미리 제외하고 받는다.
   * channelFilter가 'all'이 아니면 호출부가 빈 배열을 넘겨 펼치기 자체를 끈다. */
  channels: readonly { key: ChannelKey; label: string }[]
  /** 켜면 각 지표 칸 왼쪽에 바로 앞 행 대비 증감·등락률을 같이 보여준다. */
  showCompare: boolean
  /** 표시할 지표 컬럼 — 재조회할 때마다 이 표(MetricsTable) 자체가 로딩
   * 스켈레톤과 자리를 바꿔치기(unmount/remount)해서, 상태를 여기 안에 두면
   * 조회할 때마다 필터가 풀려버린다. 그래서 호출부(ResultPanel)가 들고 있다가
   * 넘겨준다. */
  visibleKeys: ReadonlySet<MetricKey>
  onToggleMetric: (key: MetricKey) => void
  /** 채널 필터 — "전체"(combined 합계, 기본)이거나 특정 채널 하나. rows 자체를
   * 어느 걸 넘길지(combined.byDate 대 meta.byDate 등)는 호출부가 결정하고,
   * 여기서는 필터 버튼 상태만 그대로 받아 그리고 되돌려준다(값도 visibleKeys와
   * 같은 이유로 ResultPanel이 들고 있다). */
  channelFilter: 'all' | ChannelKey
  onChannelFilterChange: (value: 'all' | ChannelKey) => void
}) {
  const { expanded, sort, originalIndexByKey, displayRows, toggleSort, toggle } =
    useMetricsTableViewModel(rows, rowKey)

  const visibleFields = METRIC_FIELDS.filter((f) => visibleKeys.has(f.key))

  return (
    <div className="channel-insight__table-block">
      <div
        className="channel-insight__full-list-channel-filter"
        role="group"
        aria-label="채널 필터"
      >
        <button
          type="button"
          className={`channel-insight__full-list-toggle-btn${channelFilter === 'all' ? ' is-active' : ''}`}
          aria-pressed={channelFilter === 'all'}
          onClick={() => onChannelFilterChange('all')}
        >
          전체
        </button>
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`channel-insight__full-list-toggle-btn${channelFilter === c.key ? ' is-active' : ''}`}
            style={
              { '--chip-color': CHANNEL_CHIP_COLOR[c.key] } as CSSProperties
            }
            aria-pressed={channelFilter === c.key}
            onClick={() => onChannelFilterChange(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div
        className="channel-insight__full-list-toggles"
        role="group"
        aria-label="컬럼 표시"
      >
        {METRIC_FIELDS.map((f) => {
          const active = visibleKeys.has(f.key)
          return (
            <button
              key={f.key}
              type="button"
              className={`channel-insight__full-list-toggle-btn${active ? ' is-active' : ''}`}
              style={{ '--chip-color': f.color } as CSSProperties}
              aria-pressed={active}
              onClick={() => onToggleMetric(f.key)}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <div className="channel-insight__table-wrap">
        <table className="channel-insight__table">
          <thead>
            <tr>
              <th
                className="channel-insight__table-toggle-head"
                aria-hidden="true"
              />
              <th>
                <button
                  type="button"
                  className="channel-insight__sort-head"
                  onClick={() => toggleSort('label')}
                >
                  {headLabel}
                  <SortArrows active={sort.key === 'label'} dir={sort.dir} />
                </button>
              </th>
              {visibleFields.map((f) => (
                <th key={f.key}>
                  <SortableMetricHeader
                    field={f}
                    active={sort.key === f.key}
                    dir={sort.dir}
                    onSort={() => toggleSort(f.key)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={visibleFields.length + 2}>데이터 없음</td>
              </tr>
            ) : (
              displayRows.map((row) => {
                const key = rowKey(row)
                // 채널 필터가 걸려 있으면(이미 그 채널 하나만 보는 중이라)
                // channels가 빈 배열로 넘어온다 — 펼쳐봐야 보여줄 채널별
                // 분해가 없으므로 펼치기 자체를 끈다.
                const canExpand = channels.length > 0
                const isOpen = canExpand && expanded.has(key)
                const breakdown = isOpen ? getChannelBreakdown(row) : null
                const originalIndex = originalIndexByKey.get(key) ?? 0
                // 채널별 펼침 행도 메인 행과 같은 방식(원본 순서상 바로 앞 행)으로
                // 대비를 보여준다 — 그 채널의 "바로 앞 행" 값이 필요하니 이전
                // 행을 같은 방식으로 한 번 더 분해해둔다.
                const prevBreakdown =
                  isOpen && showCompare && originalIndex > 0
                    ? getChannelBreakdown(rows[originalIndex - 1])
                    : null
                return (
                  <Fragment key={key}>
                    <tr
                      className={
                        canExpand
                          ? 'channel-insight__table-row--clickable'
                          : undefined
                      }
                      role={canExpand ? 'button' : undefined}
                      tabIndex={canExpand ? 0 : undefined}
                      aria-expanded={canExpand ? isOpen : undefined}
                      onClick={canExpand ? () => toggle(key) : undefined}
                      onKeyDown={
                        canExpand
                          ? (e) => {
                              if (e.key !== 'Enter' && e.key !== ' ') return
                              e.preventDefault()
                              toggle(key)
                            }
                          : undefined
                      }
                    >
                      <td className="channel-insight__table-toggle-cell">
                        {canExpand && (
                          <span
                            className={`channel-insight__table-toggle${
                              isOpen ? ' is-open' : ''
                            }`}
                          >
                            <ChevronIcon />
                          </span>
                        )}
                      </td>
                      <td>{headValue(row)}</td>
                      {visibleFields.map((f) => (
                        <td key={f.key}>
                          <MetricCell
                            value={row[f.key]}
                            prevValue={
                              originalIndex > 0
                                ? rows[originalIndex - 1][f.key]
                                : null
                            }
                            format={f.formatCompact}
                            showCompare={showCompare}
                          />
                        </td>
                      ))}
                    </tr>
                    {breakdown &&
                      channels.map((channel) => (
                        <tr
                          key={`${key}-${channel.key}`}
                          className="channel-insight__table-row--channel"
                        >
                          <td />
                          <td className="channel-insight__table-channel-label">
                            <ChannelLabel
                              channelKey={channel.key}
                              label={channel.label}
                            />
                          </td>
                          {visibleFields.map((f) => (
                            <td key={f.key}>
                              <MetricCell
                                value={breakdown[channel.key][f.key]}
                                prevValue={
                                  prevBreakdown
                                    ? prevBreakdown[channel.key][f.key]
                                    : null
                                }
                                format={f.formatCompact}
                                showCompare={showCompare}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 조회 중일 때 MetricsTable 자리에 대신 까는 스켈레톤 — 같은 컬럼 구성(토글 칸 +
 * 라벨 칸 + 지표 10개)을 그대로 갖춰서 로딩이 끝나는 순간 표가 옆으로 벌어지거나
 * 좁아지지 않게 하고, 행 수(rowCount)만 새로 조회 중인 기간에 맞춰 잡아 표
 * 세로 크기도 실제와 비슷하게 보이도록 한다. */
function TableSkeleton({
  headLabel,
  rowCount,
}: {
  headLabel: string
  rowCount: number
}) {
  return (
    <div className="channel-insight__table-wrap" aria-hidden>
      <table className="channel-insight__table">
        <thead>
          <tr>
            <th
              className="channel-insight__table-toggle-head"
              aria-hidden="true"
            />
            <th>{headLabel}</th>
            {METRIC_FIELDS.map((f) => (
              <th key={f.key}>{f.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, i) => (
            <tr key={i}>
              <td className="channel-insight__table-toggle-cell" />
              <td>
                <span className="channel-insight__skeleton-bar channel-insight__skeleton-bar--cell" />
              </td>
              {METRIC_FIELDS.map((f) => (
                <td key={f.key}>
                  <span className="channel-insight__skeleton-bar channel-insight__skeleton-bar--cell" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 최초 조회 중(아직 combinedInsight 자체가 없어 ResultPanel이 렌더되지 않는
 * 시점)에 그 자리를 대신하는 전체 스켈레톤 — Summary 카드 + 일별/요일별/주차별
 * 표까지, ResultPanel이 조회 중 보여주는 모양을 그대로 미리 보여준다. */
function ResultSkeleton({
  periodLabel,
  dateStart,
  dateEnd,
}: {
  periodLabel: string
  dateStart: ISODate
  dateEnd: ISODate
}) {
  const dayCount = dateRange(dateStart, dateEnd).length

  return (
    <div className="channel-insight__result">
      <section className="channel-insight__summary">
        <div className="channel-insight__summary-head">
          <span className="channel-insight__summary-label">Summary</span>
          <span className="channel-insight__summary-period">{periodLabel}</span>
        </div>
        <KpiSkeletonGrid />
      </section>

      <section className="channel-insight__section">
        <h3 className="channel-insight__section-title">일별 성과</h3>
        <TableSkeleton headLabel="날짜" rowCount={dayCount} />
      </section>

      <section className="channel-insight__section">
        <h3 className="channel-insight__section-title">요일별 성과</h3>
        <TableSkeleton headLabel="요일" rowCount={Math.min(7, dayCount)} />
      </section>

      <section className="channel-insight__section">
        <h3 className="channel-insight__section-title">주차별 성과</h3>
        <TableSkeleton
          headLabel="기간"
          rowCount={Math.max(1, Math.ceil(dayCount / 7))}
        />
      </section>

      {/* ResultPanel의 bucketSize 기본값(7)과 맞춘다 — 실제 값은 ResultPanel이
          마운트된 뒤에나 알 수 있어(사용자가 바꿀 수 있는 상태), 최초 로딩
          스켈레톤은 기본값 기준으로만 행 수를 맞춘다. */}
      <section className="channel-insight__section">
        <h3 className="channel-insight__section-title">
          이전 일정 vs 지정 일정 비교분석
        </h3>
        <TableSkeleton headLabel="기간" rowCount={Math.floor(dayCount / 7)} />
      </section>
    </div>
  )
}

interface ResultPanelProps {
  periodLabel: string
  total: {
    combined: MetricsSummary
    meta: MetricsSummary
    google: MetricsSummary
    naver: MetricsSummary
  }
  series: {
    combined: GroupedInsightSeries
    meta: GroupedInsightSeries
    google: GroupedInsightSeries
    naver: GroupedInsightSeries
  }
  /** 재조회 중(날짜 범위 변경 등)엔 이전 결과가 그대로 남아있는 동안에도 Summary/
   * 표 칸을 스켈레톤으로 덮어서 "새로 불러오는 중"임을 보여준다. */
  loading: boolean
  /** 로딩 중 표 스켈레톤의 행 수를 "지금 조회 중인" 기간에 맞추기 위한 값 —
   * 실제 데이터가 아니라 dateStart/dateEnd(즉시 반영되는 입력값)만 있으면 된다. */
  dateStart: ISODate
  dateEnd: ISODate
}

/** 일별/요일별/주차별 성과 섹션 제목 + "대비 표시" 토글을 한 줄에 배치. */
function SectionHead({
  title,
  active,
  onToggle,
}: {
  title: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <div className="channel-insight__section-head">
      <h3 className="channel-insight__section-title">{title}</h3>
      <button
        type="button"
        className={`channel-insight__compare-toggle${active ? ' is-active' : ''}`}
        aria-pressed={active}
        onClick={onToggle}
      >
        대비 표시
      </button>
    </div>
  )
}

/** "이전 일정 vs 지정 일정" 비교표 전용 — 제목 + 구간 일수(N) 입력 + "대비
 * 표시" 토글을 한 줄에 배치. 구간 일수를 바꾸면 그 즉시 조회 기간을 그 값
 * 단위로 다시 나눠 표를 새로 그린다. */
function CustomPeriodSectionHead({
  title,
  bucketSize,
  onBucketSizeChange,
  active,
  onToggle,
}: {
  title: string
  /** null = 입력칸이 비어있는 중(값을 지우고 새로 입력하는 과정) — 이때 표는
   * "데이터 없음"으로 보여준다. 즉시 1로 되돌리면 backspace로 "1"을 지울 때
   * 리렌더가 바로 다시 "1"을 채워 넣어 지워지지 않는 것처럼 보이는 문제가
   * 있었다. */
  bucketSize: number | null
  onBucketSizeChange: (value: number | null) => void
  active: boolean
  onToggle: () => void
}) {
  return (
    <div className="channel-insight__section-head">
      <h3 className="channel-insight__section-title">{title}</h3>
      <div className="channel-insight__section-head-actions">
        <label className="channel-insight__period-size">
          <input
            type="number"
            min={1}
            step={1}
            value={bucketSize ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                onBucketSizeChange(null)
                return
              }
              const parsed = Math.trunc(Number(raw))
              onBucketSizeChange(
                Number.isFinite(parsed) && parsed > 0 ? parsed : null,
              )
            }}
          />
          일 단위
        </label>
        <button
          type="button"
          className={`channel-insight__compare-toggle${active ? ' is-active' : ''}`}
          aria-pressed={active}
          onClick={onToggle}
        >
          대비 표시
        </button>
      </div>
    </div>
  )
}

/** "전체 요약" 탭 전용 — Summary KPI 카드 + 일별/요일별/주차별/지정 기간 비교 표. */
function ResultPanel({
  periodLabel,
  total,
  series,
  loading,
  dateStart,
  dateEnd,
}: ResultPanelProps) {
  const {
    showChannelTotal,
    compareOn,
    visibleMetrics,
    channelFilter,
    bucketSize,
    customPeriodRows,
    setShowChannelTotal,
    toggleCompare,
    toggleMetricVisible,
    setChannelFilterFor,
    setBucketSize,
  } = useResultPanelViewModel(series, dateStart, dateEnd)

  const dayCount = dateRange(dateStart, dateEnd).length

  // 이 캠페인/adset에 데이터가 아예 없는 채널(예: Meta 전용 캠페인의 Google)은
  // 펼쳐봐야 모든 행이 0으로만 나와서 의미가 없으니 미리 걸러낸다.
  const applicableChannels = CHANNELS.filter(
    (c) => series[c.key].byDate.length > 0,
  )

  return (
    <div className="channel-insight__result">
      <section className="channel-insight__summary">
        <div className="channel-insight__summary-head">
          <span className="channel-insight__summary-label">Summary</span>
          <span className="channel-insight__summary-period">{periodLabel}</span>
        </div>
        {loading ? <KpiSkeletonGrid /> : <KpiGrid metrics={total.combined} />}

        {!loading && applicableChannels.length > 0 && (
          <>
            <button
              type="button"
              className={`channel-insight__summary-toggle${
                showChannelTotal ? ' is-open' : ''
              }`}
              aria-expanded={showChannelTotal}
              onClick={() => setShowChannelTotal((v) => !v)}
            >
              자세히 보기
              <ChevronIcon />
            </button>

            {showChannelTotal && (
              <div className="channel-insight__summary-channels">
                {applicableChannels.map((channel) => (
                  <div
                    key={channel.key}
                    className="channel-insight__summary-channel"
                  >
                    <span className="channel-insight__summary-channel-label">
                      <ChannelLabel
                        channelKey={channel.key}
                        label={channel.label}
                      />
                    </span>
                    <KpiGrid metrics={total[channel.key]} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="channel-insight__section">
        <SectionHead
          title="일별 성과"
          active={compareOn.byDate}
          onToggle={() => toggleCompare('byDate')}
        />
        {loading ? (
          <TableSkeleton headLabel="날짜" rowCount={dayCount} />
        ) : (
          <MetricsTable<DateSummary>
            rows={
              channelFilter.byDate === 'all'
                ? series.combined.byDate
                : series[channelFilter.byDate].byDate
            }
            rowKey={(row) => row.date}
            headLabel="날짜"
            headValue={(row) => row.date}
            channels={channelFilter.byDate === 'all' ? applicableChannels : []}
            showCompare={compareOn.byDate}
            visibleKeys={visibleMetrics.byDate}
            onToggleMetric={(key) => toggleMetricVisible('byDate', key)}
            channelFilter={channelFilter.byDate}
            onChannelFilterChange={(v) => setChannelFilterFor('byDate', v)}
            getChannelBreakdown={(row) => ({
              meta: metricsForDateSubset(
                series.meta.byDate,
                (d) => d === row.date,
              ),
              google: metricsForDateSubset(
                series.google.byDate,
                (d) => d === row.date,
              ),
              naver: metricsForDateSubset(
                series.naver.byDate,
                (d) => d === row.date,
              ),
            })}
          />
        )}
      </section>

      <section className="channel-insight__section">
        <SectionHead
          title="요일별 성과"
          active={compareOn.byDayOfWeek}
          onToggle={() => toggleCompare('byDayOfWeek')}
        />
        {loading ? (
          <TableSkeleton headLabel="요일" rowCount={Math.min(7, dayCount)} />
        ) : (
          <MetricsTable<DayOfWeekSummary>
            rows={
              channelFilter.byDayOfWeek === 'all'
                ? series.combined.byDayOfWeek
                : series[channelFilter.byDayOfWeek].byDayOfWeek
            }
            rowKey={(row) => row.dayOfWeek}
            headLabel="요일"
            headValue={(row) => row.dayOfWeek}
            channels={
              channelFilter.byDayOfWeek === 'all' ? applicableChannels : []
            }
            showCompare={compareOn.byDayOfWeek}
            visibleKeys={visibleMetrics.byDayOfWeek}
            onToggleMetric={(key) => toggleMetricVisible('byDayOfWeek', key)}
            channelFilter={channelFilter.byDayOfWeek}
            onChannelFilterChange={(v) => setChannelFilterFor('byDayOfWeek', v)}
            getChannelBreakdown={(row) => ({
              meta: metricsForDateSubset(
                series.meta.byDate,
                (d) => weekdayLabelOf(d) === row.dayOfWeek,
              ),
              google: metricsForDateSubset(
                series.google.byDate,
                (d) => weekdayLabelOf(d) === row.dayOfWeek,
              ),
              naver: metricsForDateSubset(
                series.naver.byDate,
                (d) => weekdayLabelOf(d) === row.dayOfWeek,
              ),
            })}
          />
        )}
      </section>

      <section className="channel-insight__section">
        <SectionHead
          title="주차별 성과"
          active={compareOn.byGroupedWeek}
          onToggle={() => toggleCompare('byGroupedWeek')}
        />
        {loading ? (
          <TableSkeleton
            headLabel="기간"
            rowCount={Math.max(1, Math.ceil(dayCount / 7))}
          />
        ) : (
          <MetricsTable<WeekSummary>
            rows={
              channelFilter.byGroupedWeek === 'all'
                ? series.combined.byGroupedWeek
                : series[channelFilter.byGroupedWeek].byGroupedWeek
            }
            rowKey={(row) => row.period}
            headLabel="기간"
            headValue={(row) => row.period}
            channels={
              channelFilter.byGroupedWeek === 'all' ? applicableChannels : []
            }
            showCompare={compareOn.byGroupedWeek}
            visibleKeys={visibleMetrics.byGroupedWeek}
            onToggleMetric={(key) => toggleMetricVisible('byGroupedWeek', key)}
            channelFilter={channelFilter.byGroupedWeek}
            onChannelFilterChange={(v) =>
              setChannelFilterFor('byGroupedWeek', v)
            }
            getChannelBreakdown={(row) => ({
              meta: metricsForDateSubset(
                series.meta.byDate,
                (d) => d >= row.startDate && d <= row.endDate,
              ),
              google: metricsForDateSubset(
                series.google.byDate,
                (d) => d >= row.startDate && d <= row.endDate,
              ),
              naver: metricsForDateSubset(
                series.naver.byDate,
                (d) => d >= row.startDate && d <= row.endDate,
              ),
            })}
          />
        )}
      </section>

      {/* 이전 일정 vs 지정 일정 비교분석 — 조회 기간을 최신일 기준으로
          bucketSize일씩 묶는다(자세한 규칙은 groupByCustomPeriod 주석 참고).
          위 세 표와 달리 구간 크기를 사용자가 직접 정한다. */}
      <section className="channel-insight__section">
        <CustomPeriodSectionHead
          title="이전 일정 vs 지정 일정 비교분석"
          bucketSize={bucketSize}
          onBucketSizeChange={setBucketSize}
          active={compareOn.byCustomPeriod}
          onToggle={() => toggleCompare('byCustomPeriod')}
        />
        {loading ? (
          <TableSkeleton
            headLabel="기간"
            rowCount={bucketSize ? Math.floor(dayCount / bucketSize) : 0}
          />
        ) : (
          <MetricsTable<WeekSummary>
            rows={customPeriodRows}
            rowKey={(row) => row.period}
            headLabel="기간"
            headValue={(row) => row.period}
            channels={
              channelFilter.byCustomPeriod === 'all' ? applicableChannels : []
            }
            showCompare={compareOn.byCustomPeriod}
            visibleKeys={visibleMetrics.byCustomPeriod}
            onToggleMetric={(key) => toggleMetricVisible('byCustomPeriod', key)}
            channelFilter={channelFilter.byCustomPeriod}
            onChannelFilterChange={(v) =>
              setChannelFilterFor('byCustomPeriod', v)
            }
            getChannelBreakdown={(row) => ({
              meta: metricsForDateSubset(
                series.meta.byDate,
                (d) => d >= row.startDate && d <= row.endDate,
              ),
              google: metricsForDateSubset(
                series.google.byDate,
                (d) => d >= row.startDate && d <= row.endDate,
              ),
              naver: metricsForDateSubset(
                series.naver.byDate,
                (d) => d >= row.startDate && d <= row.endDate,
              ),
            })}
          />
        )}
      </section>
    </div>
  )
}

// ------------------------------------------------------------------ 다중 선택 드롭다운
// 캠페인 탭의 캠페인 선택, adset 탭의 adset 선택, 지표 선택이 공유하는 체크박스
// 팝오버. 지표 선택엔 MetricKey를, 나머지엔 일반 string을 써서 제네릭으로 뒀다.
function MultiSelectDropdown<T extends string>({
  options,
  selected,
  onToggle,
  emptyLabel,
  countSuffix,
}: {
  options: readonly MultiSelectOption<T>[]
  selected: ReadonlySet<T>
  onToggle: (key: T) => void
  emptyLabel: string
  countSuffix: string
}) {
  const { open, ref, triggerLabel, toggleOpen } =
    useMultiSelectDropdownViewModel(options, selected, emptyLabel, countSuffix)

  return (
    <div className="channel-insight__multi-select" ref={ref}>
      <button
        type="button"
        className={`channel-insight__result-select channel-insight__multi-select-trigger${
          open ? ' is-open' : ''
        }`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        {triggerLabel}
        <ChevronIcon />
      </button>
      {open && (
        <div className="channel-insight__multi-select-menu">
          {options.map((o) => (
            <label key={o.key} className="channel-insight__multi-select-item">
              <input
                type="checkbox"
                className="channel-insight__multi-select-input"
                checked={selected.has(o.key)}
                onChange={() => onToggle(o.key)}
              />
              <span className="channel-insight__multi-select-box">
                <span className="channel-insight__multi-select-fill" />
                <CheckIcon />
              </span>
              <span className="channel-insight__multi-select-label">
                {o.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ 캠페인/adset 교차표
interface PivotGroup {
  key: string
  label: string
  byDate: readonly DateSummary[]
}

// 합산해서 의미 있는(더하면 되는) 지표 — 평균 행에서 일수로 나눈다. 나머지(ctr/cpc/
// cpa/cvr/cpm/frequency)는 이미 비율/도수라 aggregateMetrics가 원본 카운트 합계에서
// 다시 계산해준 값을 그대로 쓴다(다시 나누면 이중으로 평균 내는 꼴이 된다).
const SUM_METRIC_KEYS: ReadonlySet<MetricKey> = new Set([
  'impressions',
  'clicks',
  'spend',
  'conversions',
])

/** 평균 행의 표시값 — formatCompact(num())는 소수 자릿수를 강제하지 않아, 일수로
 * 나눈 값이 딱 안 떨어지면 toLocaleString 기본값(최대 3자리)이 그대로 노출돼
 * 다른 행(합계·일별, 전부 정수)과 자릿수가 들쭉날쭉해 보였다. spend(원)는 애초에
 * 소수 단위가 없는 지표라 정수로 반올림하고, 나머지 합산 지표(횟수·건수)는 소수
 * 1자리까지만 남긴다. 비율 지표(ctr/cpc 등)는 원래도 고정 2자리라 그대로 둔다. */
function averageValueOf(
  f: MetricField,
  agg: MetricsSummary,
  dayCount: number,
): number {
  if (!SUM_METRIC_KEYS.has(f.key)) return agg[f.key]
  const raw = agg[f.key] / dayCount
  return f.key === 'spend' ? Math.round(raw) : Math.round(raw * 10) / 10
}

/** 소수부가 있으면 그 부분만 작고 옅게 렌더링해서 정수부가 먼저 읽히도록 한다 —
 * 평균 행은 유일하게 소수가 섞여 나오는 행이라, 그 소수를 "부가 정보"처럼 덜
 * 도드라지게 보여주면 합계·일별 행과 나란히 봐도 자릿수 차이가 덜 거슬린다. */
function SplitDecimalValue({ text }: { text: string }) {
  const dot = text.lastIndexOf('.')
  if (dot === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, dot)}
      <span className="channel-insight__pivot-avg-decimal">
        {text.slice(dot)}
      </span>
    </>
  )
}

const PIVOT_VIEW_OPTIONS: readonly { value: PivotView; label: string }[] = [
  { value: 'byDate', label: '날짜별' },
  { value: 'byDayOfWeek', label: '요일별' },
  { value: 'byGroupedWeek', label: '주차별' },
]

/** 캠페인/adset 탭 전용 — 선택된 항목(캠페인 또는 adset) × 선택된 지표를 교차
 * 표시한다. 첫 두 행은 항상 합계/평균(조회 기간 전체 기준)이고, 그 아래는
 * view에 따라 날짜(최신순)/요일/주차 단위로 묶인다. 어느 축이든 각 셀은 그
 * 축이 가리키는 날짜 구간으로 그룹의 byDate를 다시 필터링해 합산하므로
 * (metricsForDateSubset), 세 모드가 같은 렌더 경로를 탄다. */
function PivotSummary({
  groups,
  metricKeys,
  dates,
  emptyLabel,
  showUnit,
  view,
}: {
  groups: readonly PivotGroup[]
  metricKeys: readonly MetricKey[]
  dates: readonly string[]
  emptyLabel: string
  /** 지표 헤더에 단위(원/%/회 등)를 같이 보여줄지. */
  showUnit: boolean
  view: PivotView
}) {
  const metricFields = METRIC_FIELDS.filter((f) => metricKeys.includes(f.key))

  if (groups.length === 0 || metricFields.length === 0) {
    return (
      <section className="channel-insight__summary">
        <p className="channel-insight__result-empty">
          {groups.length === 0 ? emptyLabel : '표시할 지표를 선택해주세요.'}
        </p>
      </section>
    )
  }

  // 합계/평균 행 — 조회 기간 전체 기준이라 view(날짜/요일/주차)와 무관하게 항상
  // 같다. sum 연산은 "0인 날"이 명시적으로 있든 아예 없든 결과가 같으므로,
  // g.byDate를 그대로 합치면 된다(과거처럼 dates 전체를 순회하며 emptyMetrics로
  // 채워 넣을 필요가 없다).
  const dayCount = dates.length || 1
  const groupAverages = groups.map((g) => ({
    key: g.key,
    agg: aggregateMetrics(g.byDate),
  }))

  // 행 축(첫 컬럼) — view에 따라 날짜/요일/주차로 갈라진다. 각 행은 "그 구간에
  // 속하는 날짜인지" predicate만 들고 있고, 실제 값은 렌더링 시 그룹별로
  // metricsForDateSubset을 태워 구한다.
  type PivotRow = {
    key: string
    label: string
    predicate: (d: string) => boolean
  }
  let pivotRows: PivotRow[] = []
  if (dates.length > 0) {
    if (view === 'byDate') {
      // 최신 날짜가 위로 오도록 — dates는 오름차순으로 들어오므로 뒤집기만.
      pivotRows = [...dates].reverse().map((date) => ({
        key: date,
        label: `${date} (${weekdayLabelOf(date)})`,
        predicate: (d) => d === date,
      }))
    } else if (view === 'byDayOfWeek') {
      // 실제 값 없이 날짜만으로 요일 라벨 집합을 구한다(월요일부터, 데이터에
      // 있는 요일만) — insight-aggregate의 표준 순서를 그대로 재사용.
      pivotRows = groupByDayOfWeek(
        dates.map((d) => ({ date: d, ...emptyMetrics() })),
      ).map((row) => ({
        key: row.dayOfWeek,
        label: row.dayOfWeek,
        predicate: (d) => weekdayLabelOf(d) === row.dayOfWeek,
      }))
    } else {
      // groupByWeek의 주차 경계는 rows 내용과 무관하게 startDate/endDate만으로
      // 정해지므로, 구간만 뽑아 쓰고 집계값(전부 0)은 버린다.
      pivotRows = groupByWeek([], dates[0], dates[dates.length - 1]).map(
        (week) => ({
          key: week.period,
          label: week.period,
          predicate: (d) => d >= week.startDate && d <= week.endDate,
        }),
      )
    }
  }

  return (
    <section className="channel-insight__summary channel-insight__pivot">
      <div className="channel-insight__table-wrap">
        <table className="channel-insight__table channel-insight__table--pivot">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="channel-insight__pivot-date-head channel-insight__pivot-sticky-col"
              >
                {PIVOT_VIEW_OPTIONS.find((o) => o.value === view)?.label ??
                  '날짜'}
              </th>
              {groups.map((g) => (
                <th
                  key={g.key}
                  colSpan={metricFields.length}
                  className="channel-insight__pivot-group-head"
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {groups.flatMap((g) =>
                metricFields.map((f) => (
                  <th
                    key={`${g.key}-${f.key}`}
                    className="channel-insight__pivot-metric-head"
                  >
                    <MetricHeaderLabel
                      field={f}
                      label={showUnit ? `${f.label}(${f.unit})` : undefined}
                    />
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {dates.length === 0 ? (
              <tr>
                <td colSpan={1 + groups.length * metricFields.length}>
                  데이터 없음
                </td>
              </tr>
            ) : (
              <>
                <tr className="channel-insight__table-row--total">
                  <td className="channel-insight__pivot-sticky-col">합계</td>
                  {groupAverages.flatMap(({ key, agg }) =>
                    metricFields.map((f) => (
                      <td key={`${key}-${f.key}`}>
                        {f.formatCompact(agg[f.key])}
                      </td>
                    )),
                  )}
                </tr>
                <tr className="channel-insight__table-row--average">
                  <td className="channel-insight__pivot-sticky-col">평균</td>
                  {groupAverages.flatMap(({ key, agg }) =>
                    metricFields.map((f) => (
                      <td key={`${key}-${f.key}`}>
                        <SplitDecimalValue
                          text={f.formatCompact(
                            averageValueOf(f, agg, dayCount),
                          )}
                        />
                      </td>
                    )),
                  )}
                </tr>
                {pivotRows.map((row) => (
                  <tr key={row.key}>
                    <td className="channel-insight__pivot-sticky-col">
                      {row.label}
                    </td>
                    {groups.flatMap((g) => {
                      const agg = metricsForDateSubset(g.byDate, row.predicate)
                      return metricFields.map((f) => (
                        <td key={`${g.key}-${f.key}`}>
                          {f.formatCompact(agg[f.key])}
                        </td>
                      ))
                    })}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ 캠페인/adset 전체 목록

/** 캠페인/adset 탭 전용 — PivotSummary(체크박스로 고른 항목만)와 달리, 선택 여부와
 * 무관하게 "전체" 캠페인(또는 전체 adset)을 조회 기간 전체 합계 기준(전체 요약
 * 탭과 같은 10개 지표 컬럼)으로 한 행씩 보여준다. 나열 순서 기준이 모호하지
 * 않도록, 컬럼 헤더를 눌러 그 지표 기준 오름차순/내림차순으로 정렬한다. */
function FullListTable({
  rows,
  headLabel,
  emptyLabel,
}: {
  rows: readonly FullListRow[]
  headLabel: string
  emptyLabel: string
}) {
  const {
    sort,
    channelFilter,
    visibleKeys,
    showResultType,
    hasResultType,
    sortedRows,
    setChannelFilter,
    toggleColumn,
    setShowResultType,
    toggleSort,
  } = useFullListTableViewModel(rows)
  const visibleFields = METRIC_FIELDS.filter((f) => visibleKeys.has(f.key))

  return (
    <div className="channel-insight__full-list">
      <div
        className="channel-insight__full-list-channel-filter"
        role="group"
        aria-label="채널 필터"
      >
        <button
          type="button"
          className={`channel-insight__full-list-toggle-btn${channelFilter === 'all' ? ' is-active' : ''}`}
          aria-pressed={channelFilter === 'all'}
          onClick={() => setChannelFilter('all')}
        >
          전체
        </button>
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`channel-insight__full-list-toggle-btn${channelFilter === c.key ? ' is-active' : ''}`}
            style={
              { '--chip-color': CHANNEL_CHIP_COLOR[c.key] } as CSSProperties
            }
            aria-pressed={channelFilter === c.key}
            onClick={() => setChannelFilter(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div
        className="channel-insight__full-list-toggles"
        role="group"
        aria-label="컬럼 표시"
      >
        {METRIC_FIELDS.map((f) => {
          const active = visibleKeys.has(f.key)
          return (
            <button
              key={f.key}
              type="button"
              className={`channel-insight__full-list-toggle-btn${active ? ' is-active' : ''}`}
              style={{ '--chip-color': f.color } as CSSProperties}
              aria-pressed={active}
              onClick={() => toggleColumn(f.key)}
            >
              {f.label}
            </button>
          )
        })}
        {hasResultType && (
          <span className="channel-insight__full-list-toggle-item">
            <button
              type="button"
              className={`channel-insight__full-list-toggle-btn${showResultType ? ' is-active' : ''}`}
              aria-pressed={showResultType}
              onClick={() => setShowResultType((v) => !v)}
            >
              전환 목표
            </button>
            {/* 토글 버튼 밖에 별도로 둔다 — 버튼 안에 넣으면 "?" 클릭이 토글까지
                같이 눌러버린다(SortableMetricHeader와 같은 이유). */}
            <span className="channel-insight__info" tabIndex={0}>
              <InfoIcon />
              <span className="channel-insight__info-tooltip" role="tooltip">
                전환 목표(결과 유형)는 Meta 캠페인에만 표시됩니다 — Meta Ads
                Manager의 "결과" 컬럼이 세는 액션 종류를 그대로 가져온 값으로,
                Google/Naver 캠페인엔 대응 개념이 없어 표시되지 않습니다.
              </span>
            </span>
          </span>
        )}
      </div>

      <div className="channel-insight__table-wrap">
        <table className="channel-insight__table channel-insight__table--full-list">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  className="channel-insight__sort-head"
                  onClick={() => toggleSort('name')}
                >
                  {headLabel}
                  <SortArrows active={sort.key === 'name'} dir={sort.dir} />
                </button>
              </th>
              <th>Channel</th>
              {visibleFields.map((f) => (
                <th key={f.key}>
                  <SortableMetricHeader
                    field={f}
                    active={sort.key === f.key}
                    dir={sort.dir}
                    onSort={() => toggleSort(f.key)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td className="empty-label" colSpan={visibleFields.length + 2}>
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => (
                <tr key={row.key}>
                  <td>
                    {row.name}
                    {showResultType && row.resultType && (
                      <span className="channel-insight__result-type-badge">
                        {row.resultType}
                      </span>
                    )}
                  </td>
                  <td className="channel-insight__full-list-channels">
                    {row.channels.map((ch) => (
                      <ChannelLabel
                        key={ch}
                        channelKey={ch}
                        label={CHANNELS.find((c) => c.key === ch)?.label ?? ch}
                      />
                    ))}
                  </td>
                  {visibleFields.map((f) => (
                    <td key={f.key}>{f.formatCompact(row.metrics[f.key])}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const ChannelInsight = () => {
  const {
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    loading,
    error,
    combinedInsight,
    load,
    loadRange,
  } = useChannelInsightViewModel()

  // 페이지에 들어오면 기본 기간(최근 7일)으로 바로 조회 — "조회" 버튼 없이도
  // 데이터가 바로 보이도록. 마운트 시 한 번만.
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    chartOpen,
    resultTab,
    selectedCampaignNames,
    selectedAdsetNames,
    metricMode,
    selectedMetricKeys,
    showUnit,
    pivotView,
    campaigns,
    selectedCampaign,
    adsets,
    periodLabel,
    canonicalDates,
    metricKeyList,
    chartGroups,
    chartDefaultActiveGroupKeys,
    excelExportOpen,
    excelTotal,
    excelSeries,
    excelCampaigns,
    setChartOpen,
    setResultTab,
    setSelectedCampaignName,
    toggleCampaignMulti,
    toggleAdsetMulti,
    toggleMetric,
    setMetricModeFor,
    clearAllMetrics,
    setShowUnit,
    setPivotView,
    setExcelExportOpen,
  } = useChannelInsightPageViewModel(combinedInsight, dateStart, dateEnd)

  return (
    <div className="channel-insight">
      {/* combinedInsight 유무와 무관하게 항상 보인다 — DateRangePicker가 이
          안에 있어서, 최초 조회 실패 등으로 combinedInsight가 끝내 안 생겨도
          날짜를 다시 골라 재조회할 방법이 사라지지 않는다. 보기 단위(select)와
          "그래프로 보기"는 원래대로 데이터가 있을 때만 보인다. */}
      <div
        className="channel-insight__result-tabs"
        role="group"
        aria-label="보기 단위"
      >
        {combinedInsight && (
          <>
            <select
              className="channel-insight__result-select"
              value={resultTab}
              onChange={(e) => setResultTab(e.target.value as ResultTab)}
            >
              {RESULT_TABS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="channel-insight__btn channel-insight__ghost"
              onClick={() => setChartOpen(true)}
              disabled={chartGroups.length === 0}
              title={
                chartGroups.length === 0
                  ? '그래프로 볼 항목을 먼저 선택해주세요.'
                  : undefined
              }
            >
              그래프로 보기
            </button>

            <button
              type="button"
              className="channel-insight__btn channel-insight__ghost"
              onClick={() => setExcelExportOpen(true)}
            >
              엑셀 다운로드
            </button>
          </>
        )}

        {/* 이 row 맨 오른쪽에 고정(margin-left: auto) — 보기 단위 select/그래프
            버튼이 있든 없든 항상 오른쪽 끝에 붙는다. */}
        <div className="channel-insight__query-row">
          <DateRangePicker
            dateStart={dateStart}
            dateEnd={dateEnd}
            onChange={(start, end) => {
              setDateStart(start)
              setDateEnd(end)
              // dateStart/dateEnd state 반영을 기다리지 않고 방금 고른 범위로 바로
              // 조회한다 — "업데이트" 버튼이 곧 조회 버튼을 겸한다.
              loadRange(start, end)
            }}
            disabled={loading}
          />
          {loading && (
            <span className="channel-insight__query-loading">조회하는 중…</span>
          )}
        </div>
      </div>

      {error && <div className="channel-insight__banner is-error">{error}</div>}

      {/* 최초 조회 전엔 아직 combinedInsight 자체가 없어 ResultPanel이 아예
          렌더되지 않는다 — 그 사이 화면이 텅 비어 보이지 않도록 ResultPanel이
          로딩 중 보여줄 모양(Summary + 표 세 개)을 통째로 미리 깔아둔다. */}
      {loading && !combinedInsight && (
        <ResultSkeleton
          periodLabel={periodLabel}
          dateStart={dateStart}
          dateEnd={dateEnd}
        />
      )}

      {combinedInsight && (
        <>
          {(resultTab === 'campaign' || resultTab === 'adset') && (
            <div
              className="channel-insight__metric-row"
              role="group"
              aria-label="지표 선택"
            >
              {/* 표의 행 축(날짜/요일/주차) — 캠페인 선택 드롭다운 왼쪽에 둔다. */}
              <select
                className="channel-insight__result-select"
                value={pivotView}
                onChange={(e) => setPivotView(e.target.value as PivotView)}
                aria-label="보기 단위"
              >
                {PIVOT_VIEW_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              {/* 캠페인 탭 — 캠페인 다중 선택. */}
              {resultTab === 'campaign' &&
                (campaigns.length === 0 ? (
                  <span className="channel-insight__result-empty">
                    캠페인 데이터 없음
                  </span>
                ) : (
                  <MultiSelectDropdown
                    options={campaigns.map((c) => ({
                      key: c.campaignName,
                      label: c.campaignName,
                    }))}
                    selected={selectedCampaignNames}
                    onToggle={toggleCampaignMulti}
                    emptyLabel="캠페인 선택"
                    countSuffix="개 캠페인"
                  />
                ))}

              {/* adset 탭 — 캠페인은 단일 선택, adset은 다중 선택. */}
              {resultTab === 'adset' &&
                (campaigns.length === 0 ? (
                  <span className="channel-insight__result-empty">
                    캠페인 데이터 없음
                  </span>
                ) : (
                  <select
                    className="channel-insight__result-select"
                    value={selectedCampaign?.campaignName ?? ''}
                    onChange={(e) => setSelectedCampaignName(e.target.value)}
                  >
                    {campaigns.map((c) => (
                      <option key={c.campaignName} value={c.campaignName}>
                        {c.campaignName}
                      </option>
                    ))}
                  </select>
                ))}

              {resultTab === 'adset' &&
                selectedCampaign &&
                (adsets.length === 0 ? (
                  <span className="channel-insight__result-empty">
                    adset 데이터 없음
                  </span>
                ) : (
                  <MultiSelectDropdown
                    options={adsets.map((a) => ({
                      key: a.adsetName,
                      label: a.adsetName,
                    }))}
                    selected={selectedAdsetNames}
                    onToggle={toggleAdsetMulti}
                    emptyLabel="adset 선택"
                    countSuffix="개 adset"
                  />
                ))}

              <MultiSelectDropdown<MetricKey>
                options={METRIC_FIELDS.map((f) => ({
                  key: f.key,
                  label: f.label,
                }))}
                selected={selectedMetricKeys}
                onToggle={toggleMetric}
                emptyLabel="지표 선택"
                countSuffix="개 지표"
              />
              <button
                type="button"
                className={`channel-insight__unit-toggle${
                  showUnit ? ' is-active' : ''
                }`}
                aria-pressed={showUnit}
                onClick={() => setShowUnit((v) => !v)}
              >
                단위 표시
              </button>
            </div>
          )}

          {resultTab === 'total' && (
            <ResultPanel
              periodLabel={periodLabel}
              total={combinedInsight.total}
              series={combinedInsight.series}
              loading={loading}
              dateStart={dateStart}
              dateEnd={dateEnd}
            />
          )}
          {resultTab === 'campaign' && (
            <>
              <PivotSummary
                groups={campaigns
                  .filter((c) => selectedCampaignNames.has(c.campaignName))
                  .map((c) => ({
                    key: c.campaignName,
                    label: c.campaignName,
                    byDate: c.combined.byDate,
                  }))}
                metricKeys={metricKeyList}
                dates={canonicalDates}
                emptyLabel="표시할 캠페인을 선택해주세요."
                showUnit={showUnit}
                view={pivotView}
              />
              <section className="channel-insight__section">
                <h3 className="channel-insight__section-title">
                  전체 캠페인 합계 요약
                </h3>
                <FullListTable
                  rows={campaigns.map((c) => ({
                    key: c.campaignName,
                    name: c.campaignName,
                    metrics: aggregateMetrics(c.combined.byDate),
                    resultType: c.resultType,
                    channels: channelsOf(c),
                  }))}
                  headLabel="Campaign"
                  emptyLabel="캠페인 데이터 없음"
                />
              </section>
            </>
          )}
          {resultTab === 'adset' && (
            <>
              <PivotSummary
                groups={adsets
                  .filter((a) => selectedAdsetNames.has(a.adsetName))
                  .map((a) => ({
                    key: a.adsetName,
                    label: a.adsetName,
                    byDate: a.combined.byDate,
                  }))}
                metricKeys={metricKeyList}
                dates={canonicalDates}
                emptyLabel="표시할 adset을 선택해주세요."
                showUnit={showUnit}
                view={pivotView}
              />
              <section className="channel-insight__section">
                <h3 className="channel-insight__section-title">
                  캠페인별 전체 광고셋
                </h3>
                <FullListTable
                  rows={adsets.map((a) => ({
                    key: a.adsetName,
                    name: a.adsetName,
                    metrics: aggregateMetrics(a.combined.byDate),
                    channels: channelsOf(a),
                  }))}
                  headLabel="Adset"
                  emptyLabel="adset 데이터 없음"
                />
              </section>
              {/* 위 표는 현재 선택된 캠페인 하나에 딸린 adset만 보여준다 — 이 표는
                  캠페인 구분 없이 전체 캠페인의 adset을 한데 모아 보여준다. 같은
                  이름의 adset이 서로 다른 캠페인에 있을 수 있어(행 구분은 되지만
                  이름만으로는 어느 캠페인 소속인지 알 수 없다) 표 자체는 동일한
                  구성(FullListTable)을 그대로 쓴다. */}
              <section className="channel-insight__section">
                <h3 className="channel-insight__section-title">전체 광고셋</h3>
                <FullListTable
                  rows={campaigns.flatMap((c) =>
                    c.adsets.map((a) => ({
                      key: `${c.campaignName}::${a.adsetName}`,
                      name: a.adsetName,
                      metrics: aggregateMetrics(a.combined.byDate),
                      channels: channelsOf(a),
                    })),
                  )}
                  headLabel="Adset"
                  emptyLabel="adset 데이터 없음"
                />
              </section>
            </>
          )}
          {resultTab === 'periodTest' && (
            <PeriodTestPanel
              combinedInsight={combinedInsight}
              dateStart={dateStart}
              dateEnd={dateEnd}
            />
          )}
        </>
      )}

      {chartOpen && chartGroups.length > 0 && (
        <ChannelInsightChartModal
          groups={chartGroups}
          defaultActiveGroupKeys={chartDefaultActiveGroupKeys}
          metricMode={metricMode}
          setMode={setMetricModeFor}
          clearAllMetrics={clearAllMetrics}
          onClose={() => setChartOpen(false)}
        />
      )}

      {excelExportOpen && (
        <Suspense fallback={null}>
          <ExcelExportModal
            onClose={() => setExcelExportOpen(false)}
            dateStart={dateStart}
            dateEnd={dateEnd}
            total={excelTotal}
            series={excelSeries}
            campaigns={excelCampaigns}
          />
        </Suspense>
      )}
    </div>
  )
}
