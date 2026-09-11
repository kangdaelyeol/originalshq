import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type {
  DateSummary,
  DayOfWeekSummary,
  MetaInsightSummary,
  MetricsSummary,
  WeekSummary,
} from '../client'
import { METRIC_FIELDS, type MetricField } from './metric-fields'
import { IndexLineChart, type IndexSeries } from './index-line-chart'
import { formatMD } from '../utils'
import '../styles/meta-insight-chart-modal.scss'

type InsightView = 'byDate' | 'byDayOfWeek' | 'byGroupedWeek'
type MetricKey = keyof MetricsSummary

const VIEW_OPTIONS: readonly { value: InsightView; label: string }[] = [
  { value: 'byDate', label: '일별' },
  { value: 'byDayOfWeek', label: '요일별' },
  { value: 'byGroupedWeek', label: '주차별' },
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

const X_AXIS_LABEL: Record<InsightView, string> = {
  byDate: '날짜',
  byDayOfWeek: '요일',
  byGroupedWeek: '기간',
}

// 모달을 처음 열었을 때 기본으로 켜둘 지표 — 완전히 빈 화면으로 시작하지 않도록.
const DEFAULT_LINE: readonly MetricKey[] = ['impressions']

type SeriesKind = 'line' | 'bar'
type MetricMode = SeriesKind | 'off'

const MODE_OPTIONS: readonly MetricMode[] = ['off', 'line', 'bar']

const MODE_LABEL: Record<MetricMode, string> = {
  off: '끄기',
  line: '꺾은선',
  bar: '막대',
}

type MenuKey = 'view' | 'metric'

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

interface MetaInsightChartModalProps {
  data: MetaInsightSummary
  onClose: () => void
}

export const MetaInsightChartModal = ({
  data,
  onClose,
}: MetaInsightChartModalProps) => {
  const [view, setView] = useState<InsightView>('byDate')
  const [expanded, setExpanded] = useState(false)
  // 지표 하나당 종류(꺾은선/막대)를 최대 하나만 가진다 — radio처럼, 다른 종류를 누르면
  // 그쪽으로 옮겨간다. Map에 없으면 미선택.
  const [metricMode, setMetricMode] = useState<
    ReadonlyMap<MetricKey, SeriesKind>
  >(() => new Map(DEFAULT_LINE.map((key) => [key, 'line' as SeriesKind])))
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

  const rows: readonly MetricsSummary[] = data[view]
  const categories = useMemo(
    () => rows.map((row) => labelOf(view, row)),
    [rows, view],
  )

  const setMode = (key: MetricKey, mode: MetricMode) => {
    setMetricMode((prev) => {
      const next = new Map(prev)
      if (mode === 'off') next.delete(key)
      else next.set(key, mode)
      return next
    })
  }

  const series: IndexSeries[] = useMemo(() => {
    const build = (f: MetricField, type: SeriesKind): IndexSeries => ({
      key: f.key,
      label: f.label,
      color: f.color,
      type,
      unit: f.unit,
      raw: rows.map((row) => row[f.key]),
      format: f.format,
      formatCompact: f.formatCompact,
    })
    // 막대를 먼저 — 차트가 라인/마커를 그 위에 얹는다.
    const bars = METRIC_FIELDS.filter(
      (f) => metricMode.get(f.key) === 'bar',
    ).map((f) => build(f, 'bar'))
    const lines = METRIC_FIELDS.filter(
      (f) => metricMode.get(f.key) === 'line',
    ).map((f) => build(f, 'line'))
    return [...bars, ...lines]
  }, [rows, metricMode])

  return (
    <div className="meta-insight-chart-modal" onClick={onClose}>
      <div
        className={`meta-insight-chart-modal__panel${
          expanded ? ' is-expanded' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="meta-insight-chart-modal__header">
          <h2 className="meta-insight-chart-modal__title">
            Meta 인사이트 그래프
          </h2>
          <div className="meta-insight-chart-modal__header-actions">
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
              지표 {metricMode.size > 0 ? `${metricMode.size}개` : '선택'}
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
              </div>
            )}
          </div>
        </div>

        <div className="meta-insight-chart-modal__chart-single">
          <IndexLineChart
            categories={categories}
            series={series}
            xAxisLabel={X_AXIS_LABEL[view]}
          />
        </div>
      </div>
    </div>
  )
}
