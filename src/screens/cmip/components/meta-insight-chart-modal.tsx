import { useEffect, useMemo, useState } from 'react'
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

const DELTA_LABEL: Record<InsightView, string> = {
  byDate: '전일 대비',
  byDayOfWeek: '이전 요일 대비',
  byGroupedWeek: '전주 대비',
}

// 지표별 고정 색상 팔레트가 최대 8개까지만 서로 안전하게 구분되도록 되어 있어서,
// 동시에 겹쳐 볼 수 있는 지표 수(꺾은선 ∪ 막대)를 그만큼으로 제한한다.
const MAX_SELECTED = 8

// 모달을 처음 열었을 때 기본으로 켜둘 지표 — 완전히 빈 화면으로 시작하지 않도록.
const DEFAULT_LINE: readonly MetricKey[] = ['impressions']
const DEFAULT_BAR: readonly MetricKey[] = []

type SeriesKind = 'line' | 'bar'

const KIND_LABEL: Record<SeriesKind, string> = {
  line: '꺾은선',
  bar: '막대',
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
  // 꺾은선 / 막대를 독립된 선택 집합으로 둔다 — 같은 지표를 양쪽에 동시에 넣을 수 있다.
  const [lineKeys, setLineKeys] = useState<ReadonlySet<MetricKey>>(
    () => new Set(DEFAULT_LINE),
  )
  const [barKeys, setBarKeys] = useState<ReadonlySet<MetricKey>>(
    () => new Set(DEFAULT_BAR),
  )

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const rows: readonly MetricsSummary[] = data[view]
  const categories = useMemo(
    () => rows.map((row) => labelOf(view, row)),
    [rows, view],
  )

  // 합집합 기준으로 한도를 센다 — 같은 지표가 양쪽에 있어도 한 번만 카운트.
  const unionSize = useMemo(
    () => new Set([...lineKeys, ...barKeys]).size,
    [lineKeys, barKeys],
  )

  const toggleMetric = (kind: SeriesKind, key: MetricKey) => {
    const setKeys = kind === 'line' ? setLineKeys : setBarKeys
    const otherKeys = kind === 'line' ? barKeys : lineKeys
    setKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        return next
      }
      // 새로 켤 때만 한도 확인 — 다른 그룹에 이미 있으면 합집합이 안 늘어난다.
      const wouldGrow = !otherKeys.has(key)
      if (wouldGrow && unionSize >= MAX_SELECTED) return prev
      next.add(key)
      return next
    })
  }

  const series: IndexSeries[] = useMemo(() => {
    const build = (f: MetricField, type: SeriesKind): IndexSeries => ({
      key: `${f.key}:${type}`,
      label: f.label,
      color: f.color,
      type,
      unit: f.unit,
      raw: rows.map((row) => row[f.key]),
      format: f.format,
      formatCompact: f.formatCompact,
    })
    const lines = METRIC_FIELDS.filter((f) => lineKeys.has(f.key)).map((f) =>
      build(f, 'line'),
    )
    const bars = METRIC_FIELDS.filter((f) => barKeys.has(f.key)).map((f) =>
      build(f, 'bar'),
    )
    // 막대를 먼저 — 차트가 라인/마커를 그 위에 얹는다.
    return [...bars, ...lines]
  }, [rows, lineKeys, barKeys])

  return (
    <div className="meta-insight-chart-modal" onClick={onClose}>
      <div
        className="meta-insight-chart-modal__panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="meta-insight-chart-modal__header">
          <h2 className="meta-insight-chart-modal__title">
            Meta 인사이트 그래프
          </h2>
          <button
            type="button"
            className="meta-insight-chart-modal__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        <nav
          className="meta-insight-chart-modal__tabs"
          role="tablist"
          aria-label="집계 기준"
        >
          {VIEW_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={view === o.value}
              className={`meta-insight-chart-modal__tab${
                view === o.value ? ' is-active' : ''
              }`}
              onClick={() => setView(o.value)}
            >
              {o.label}
            </button>
          ))}
        </nav>

        <fieldset className="meta-insight-chart-modal__checkbox-group">
          <legend className="meta-insight-chart-modal__checkbox-legend">
            지표 선택 ({unionSize}/{MAX_SELECTED})
          </legend>
          {(['line', 'bar'] as const).map((kind) => {
            const keys = kind === 'line' ? lineKeys : barKeys
            const otherKeys = kind === 'line' ? barKeys : lineKeys
            return (
              <div
                key={kind}
                className="meta-insight-chart-modal__checkbox-kind"
              >
                <span className="meta-insight-chart-modal__checkbox-kind-label">
                  {KIND_LABEL[kind]}
                </span>
                <div className="meta-insight-chart-modal__checkbox-row">
                  {METRIC_FIELDS.map((f) => {
                    const checked = keys.has(f.key)
                    const disabled =
                      !checked &&
                      !otherKeys.has(f.key) &&
                      unionSize >= MAX_SELECTED
                    return (
                      <label
                        key={f.key}
                        className={`meta-insight-chart-modal__checkbox${
                          disabled ? ' is-disabled' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleMetric(kind, f.key)}
                        />
                        <span
                          className="meta-insight-chart-modal__checkbox-swatch"
                          style={{ background: f.color }}
                        />
                        {f.label}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </fieldset>

        <div className="meta-insight-chart-modal__chart-single">
          <IndexLineChart
            categories={categories}
            series={series}
            xAxisLabel={X_AXIS_LABEL[view]}
            deltaLabel={DELTA_LABEL[view]}
          />
        </div>
      </div>
    </div>
  )
}
