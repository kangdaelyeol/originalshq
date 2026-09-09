import { useEffect, useMemo, useState } from 'react'
import type {
  DateSummary,
  DayOfWeekSummary,
  MetaInsightSummary,
  MetricsSummary,
  WeekSummary,
} from '../client'
import { METRIC_FIELDS } from './metric-fields'
import { SegmentedToggle } from './segmented-toggle'
import { BarLineChart, type ChartPoint, type ChartType } from './bar-line-chart'
import { formatMD } from '../utils'
import '../styles/meta-insight-chart-modal.scss'

type InsightView = 'byDate' | 'byDayOfWeek' | 'byGroupedWeek'

const VIEW_OPTIONS: readonly { value: InsightView; label: string }[] = [
  { value: 'byDate', label: '일별' },
  { value: 'byDayOfWeek', label: '요일별' },
  { value: 'byGroupedWeek', label: '주차별' },
]

const CHART_TYPE_OPTIONS: readonly { value: ChartType; label: string }[] = [
  { value: 'bar', label: '막대 그래프' },
  { value: 'line', label: '선 그래프' },
]

const METRIC_OPTIONS = METRIC_FIELDS.map((f) => ({
  value: f.key,
  label: f.label,
}))

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

const DELTA_LABEL: Record<InsightView, string> = {
  byDate: '전일 대비',
  byDayOfWeek: '이전 요일 대비',
  byGroupedWeek: '전주 대비',
}

const X_AXIS_LABEL: Record<InsightView, string> = {
  byDate: '날짜',
  byDayOfWeek: '요일',
  byGroupedWeek: '기간',
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
  const [metricKey, setMetricKey] = useState<keyof MetricsSummary>(
    'impressions',
  )
  const [chartType, setChartType] = useState<ChartType>('bar')

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

  const metric = METRIC_FIELDS.find((f) => f.key === metricKey)!
  const rows: readonly MetricsSummary[] = data[view]

  const points: ChartPoint[] = useMemo(
    () =>
      rows.map((row) => ({
        label: labelOf(view, row),
        value: row[metricKey],
      })),
    [rows, view, metricKey],
  )

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

        <div className="meta-insight-chart-modal__controls">
          <SegmentedToggle
            label="지표"
            options={METRIC_OPTIONS}
            value={metricKey}
            onChange={setMetricKey}
          />
          <SegmentedToggle
            label="그래프 종류"
            options={CHART_TYPE_OPTIONS}
            value={chartType}
            onChange={setChartType}
          />
        </div>

        <div className="meta-insight-chart-modal__chart">
          <BarLineChart
            points={points}
            type={chartType}
            valueFormat={metric.format}
            deltaLabel={DELTA_LABEL[view]}
            xAxisLabel={X_AXIS_LABEL[view]}
            yAxisUnit={metric.unit}
          />
        </div>
      </div>
    </div>
  )
}
