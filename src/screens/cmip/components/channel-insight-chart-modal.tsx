import type { CSSProperties } from 'react'
import { METRIC_FIELDS } from './metric-fields'
import { IndexLineChart } from './index-line-chart'
import { CHANNEL_ORDER, CHANNEL_STYLE } from './chart-colors'
import { DateRangeNarrow } from './date-range-narrow'
import {
  useChannelInsightChartModalViewModel,
  type InsightView,
  type MetricKey,
} from '../view-model/use-channel-insight-chart-modal-view-model'
import type {
  ChartGroup,
  MetricMode,
  SeriesKind,
} from '../view-model/use-channel-insight-chart-modal-view-model'
import type { CompareMode } from './index-line-chart-types'
import '../styles/channel-insight-chart-modal.scss'

export type { ChartGroup, MetricMode, SeriesKind } from '../view-model/use-channel-insight-chart-modal-view-model'

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

const X_AXIS_LABEL: Record<InsightView, string> = {
  byDate: '날짜',
  byDayOfWeek: '요일',
  byGroupedWeek: '기간',
}

const MODE_OPTIONS: readonly MetricMode[] = ['off', 'line', 'bar']

const MODE_LABEL: Record<MetricMode, string> = {
  off: '끄기',
  line: '꺾은선',
  bar: '막대',
}

function ChevronIcon() {
  return (
    <svg
      className="channel-insight-chart-modal__chevron"
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
      className="channel-insight-chart-modal__group-check"
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

interface ChannelInsightChartModalProps {
  /** 그릴 수 있는 전체 후보 — 페이지에서 체크된 것만이 아니라 항상 전체
   * 캠페인/adset(또는 전체 요약 하나) 목록이다. 어떤 걸 볼지는 이 모달 안의
   * 그룹 드롭다운이 따로 고른다. */
  groups: readonly ChartGroup[]
  /** 모달을 처음 열었을 때 기본으로 켜둘 그룹 — 보통 페이지에서 이미 체크해둔
   * 항목들(그래야 표에서 보던 것과 같은 화면으로 시작한다). groups에 없는 키는
   * 무시된다. */
  defaultActiveGroupKeys?: readonly string[]
  // 지표 선택(꺾은선/막대/끄기)은 캠페인/adset 교차표의 지표 선택과 같은
  // 상태를 페이지(channel-insight.tsx)에서 그대로 물려받는다 — 그래프에서 지표를
  // 바꾸면 표도 즉시 같이 바뀐다(반대도 마찬가지).
  metricMode: ReadonlyMap<MetricKey, SeriesKind>
  setMode: (key: MetricKey, mode: MetricMode) => void
  clearAllMetrics: () => void
  onClose: () => void
}

export const ChannelInsightChartModal = ({
  groups,
  defaultActiveGroupKeys,
  metricMode,
  setMode,
  clearAllMetrics,
  onClose,
}: ChannelInsightChartModalProps) => {
  const {
    view,
    channels,
    activeGroupKeys,
    compareMode,
    expanded,
    chartTheme,
    openMenu,
    controlsRef,
    groupTriggerLabel,
    dateBounds,
    dateNarrow,
    categories,
    series,
    setView,
    toggleChannel,
    toggleGroup,
    setCompareMode,
    setExpanded,
    setChartTheme,
    setOpenMenu,
    setDateNarrow,
  } = useChannelInsightChartModalViewModel(
    groups,
    defaultActiveGroupKeys,
    metricMode,
    onClose,
  )

  return (
    <div className="channel-insight-chart-modal" onClick={onClose}>
      <div
        className={`channel-insight-chart-modal__panel${
          expanded ? ' is-expanded' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="channel-insight-chart-modal__header">
          <div
            className="channel-insight-chart-modal__channel-tabs"
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
                  className={`channel-insight-chart-modal__channel-tab${
                    active ? ' is-active' : ''
                  }`}
                  onClick={() => toggleChannel(key)}
                >
                  {CHANNEL_STYLE[key].label}
                </button>
              )
            })}
          </div>
          <div className="channel-insight-chart-modal__header-actions">
            <button
              type="button"
              className="channel-insight-chart-modal__expand"
              onClick={() =>
                setChartTheme((t) => (t === 'dark' ? 'light' : 'dark'))
              }
              aria-pressed={chartTheme === 'light'}
            >
              {chartTheme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </button>
            <button
              type="button"
              className="channel-insight-chart-modal__expand"
              onClick={() => setExpanded((v) => !v)}
              aria-pressed={expanded}
            >
              {expanded ? '작게 보기' : '크게 보기'}
            </button>
            <button
              type="button"
              className="channel-insight-chart-modal__close"
              onClick={onClose}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="channel-insight-chart-modal__controls" ref={controlsRef}>
          {/* 캠페인/adset 탭에서만(그룹이 2개 이상일 때만) 뜬다 — 전체 요약
              탭은 그룹이 하나뿐이라 고를 이유가 없다. */}
          {groups.length > 1 && (
            <div className="channel-insight-chart-modal__dropdown">
              <button
                type="button"
                className={`channel-insight-chart-modal__dropdown-trigger${
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
                <div className="channel-insight-chart-modal__dropdown-menu channel-insight-chart-modal__group-menu">
                  {groups.map((g) => (
                    <label
                      key={g.key}
                      className="channel-insight-chart-modal__group-item"
                    >
                      <input
                        type="checkbox"
                        className="channel-insight-chart-modal__group-input"
                        checked={activeGroupKeys.has(g.key)}
                        onChange={() => toggleGroup(g.key)}
                      />
                      <span className="channel-insight-chart-modal__group-box">
                        <span className="channel-insight-chart-modal__group-fill" />
                        <CheckIcon />
                      </span>
                      <span className="channel-insight-chart-modal__group-label">
                        {g.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="channel-insight-chart-modal__dropdown">
            <button
              type="button"
              className={`channel-insight-chart-modal__dropdown-trigger${
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
                className="channel-insight-chart-modal__dropdown-menu"
                role="listbox"
              >
                {VIEW_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={view === o.value}
                    className={`channel-insight-chart-modal__dropdown-item${
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

          <div className="channel-insight-chart-modal__dropdown">
            <button
              type="button"
              className={`channel-insight-chart-modal__dropdown-trigger${
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
              <div className="channel-insight-chart-modal__dropdown-menu channel-insight-chart-modal__metric-menu">
                {METRIC_FIELDS.map((f) => {
                  const mode: MetricMode = metricMode.get(f.key) ?? 'off'
                  return (
                    <div
                      key={f.key}
                      className="channel-insight-chart-modal__metric-row"
                    >
                      <span
                        className="channel-insight-chart-modal__metric-row-dot"
                        style={{ background: f.color }}
                      />
                      <span className="channel-insight-chart-modal__metric-row-label">
                        {f.label}
                      </span>
                      <div
                        className="channel-insight-chart-modal__metric-row-toggle"
                        role="group"
                        aria-label={f.label}
                      >
                        {MODE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className={`channel-insight-chart-modal__metric-toggle-btn${
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
                <div className="channel-insight-chart-modal__metric-menu-actions">
                  <button
                    type="button"
                    className="channel-insight-chart-modal__metric-menu-action"
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
          <div className="channel-insight-chart-modal__dropdown channel-insight-chart-modal__dropdown--compare">
            <button
              type="button"
              className={`channel-insight-chart-modal__dropdown-trigger${
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
                className="channel-insight-chart-modal__dropdown-menu"
                role="listbox"
              >
                {COMPARE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={compareMode === o.value}
                    className={`channel-insight-chart-modal__dropdown-item${
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
          className={`channel-insight-chart-modal__chart-single${
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
