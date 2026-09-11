import { Fragment, useState } from 'react'
import { useMetaInsightViewModel } from '../view-model/use-meta-insight-view-model'
import type {
  DateSummary,
  DayOfWeekSummary,
  MetricsSummary,
  WeekSummary,
} from '../client'
import { metricsForDateSubset, weekdayLabelOf } from '../client'
import { METRIC_FIELDS } from './metric-fields'
import { DateRangePicker } from './date-range-picker'
import { MetaInsightChartModal } from './meta-insight-chart-modal'
import '../styles/meta-insight.scss'

// 지금은 Meta/Google뿐이지만, 당근·네이버가 붙으면 이 목록만 늘리면 된다
// (CombinedInsight.total/series가 그 채널 키를 갖게 되는 시점에 맞춰).
const CHANNELS: readonly { key: 'meta' | 'google'; label: string }[] = [
  { key: 'meta', label: 'Meta' },
  { key: 'google', label: 'Google' },
]

function ChevronIcon() {
  return (
    <svg
      className="meta-insight__chevron"
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

function KpiGrid({ metrics }: { metrics: MetricsSummary }) {
  return (
    <div className="meta-insight__summary-grid">
      {METRIC_FIELDS.map(({ key, label, format }) => (
        <div key={key} className="meta-insight__kpi">
          <span className="meta-insight__kpi-label">{label}</span>
          <span className="meta-insight__kpi-value">
            {format(metrics[key])}
          </span>
        </div>
      ))}
    </div>
  )
}

interface ChannelBreakdown {
  meta: MetricsSummary
  google: MetricsSummary
}

function MetricsTable<T extends MetricsSummary>({
  rows,
  rowKey,
  headLabel,
  headValue,
  getChannelBreakdown,
}: {
  rows: readonly T[]
  rowKey: (row: T) => string
  headLabel: string
  headValue: (row: T) => string
  /** 그 행(날짜/요일/주차)이 가리키는 기간의 채널별 total — 드롭다운으로 펼쳐 보여준다. */
  getChannelBreakdown: (row: T) => ChannelBreakdown
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="meta-insight__table-wrap">
      <table className="meta-insight__table">
        <thead>
          <tr>
            <th
              className="meta-insight__table-toggle-head"
              aria-hidden="true"
            />
            <th>{headLabel}</th>
            {METRIC_FIELDS.map((f) => (
              <th key={f.key}>{f.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={METRIC_FIELDS.length + 2}>데이터 없음</td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row)
              const isOpen = expanded.has(key)
              const breakdown = isOpen ? getChannelBreakdown(row) : null
              return (
                <Fragment key={key}>
                  <tr
                    className="meta-insight__table-row--clickable"
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => toggle(key)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      toggle(key)
                    }}
                  >
                    <td className="meta-insight__table-toggle-cell">
                      <span
                        className={`meta-insight__table-toggle${
                          isOpen ? ' is-open' : ''
                        }`}
                      >
                        <ChevronIcon />
                      </span>
                    </td>
                    <td>{headValue(row)}</td>
                    {METRIC_FIELDS.map((f) => (
                      <td key={f.key}>{f.formatCompact(row[f.key])}</td>
                    ))}
                  </tr>
                  {breakdown &&
                    CHANNELS.map((channel) => (
                      <tr
                        key={`${key}-${channel.key}`}
                        className="meta-insight__table-row--channel"
                      >
                        <td />
                        <td className="meta-insight__table-channel-label">
                          {channel.label}
                        </td>
                        {METRIC_FIELDS.map((f) => (
                          <td key={f.key}>
                            {f.formatCompact(breakdown[channel.key][f.key])}
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
  )
}

export const MetaInsight = () => {
  const {
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    loading,
    error,
    data,
    combinedInsight,
    load,
  } = useMetaInsightViewModel()
  const [chartOpen, setChartOpen] = useState(false)
  const [showChannelTotal, setShowChannelTotal] = useState(false)

  return (
    <div className="meta-insight">
      <DateRangePicker
        dateStart={dateStart}
        dateEnd={dateEnd}
        onChange={(start, end) => {
          setDateStart(start)
          setDateEnd(end)
        }}
        disabled={loading}
      />

      <div className="meta-insight__actions">
        <button type="button" onClick={load} disabled={loading}>
          {loading ? '조회하는 중…' : '조회'}
        </button>
        <button
          type="button"
          className="meta-insight__ghost"
          onClick={() => setChartOpen(true)}
          disabled={!data}
        >
          그래프로 보기
        </button>
      </div>

      {error && <div className="meta-insight__banner is-error">{error}</div>}

      {combinedInsight && (
        <div className="meta-insight__result">
          <section className="meta-insight__summary">
            <div className="meta-insight__summary-head">
              <span className="meta-insight__summary-label">Summary</span>
              <span className="meta-insight__summary-period">
                {dateStart} ~ {dateEnd}
              </span>
            </div>
            <KpiGrid metrics={combinedInsight.total.combined} />

            <button
              type="button"
              className={`meta-insight__summary-toggle${
                showChannelTotal ? ' is-open' : ''
              }`}
              aria-expanded={showChannelTotal}
              onClick={() => setShowChannelTotal((v) => !v)}
            >
              자세히 보기
              <ChevronIcon />
            </button>

            {showChannelTotal && (
              <div className="meta-insight__summary-channels">
                {CHANNELS.map((channel) => (
                  <div
                    key={channel.key}
                    className="meta-insight__summary-channel"
                  >
                    <span className="meta-insight__summary-channel-label">
                      {channel.label}
                    </span>
                    <KpiGrid metrics={combinedInsight.total[channel.key]} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="meta-insight__section">
            <h3 className="meta-insight__section-title">일별 성과</h3>
            <MetricsTable<DateSummary>
              rows={combinedInsight.series.combined.byDate}
              rowKey={(row) => row.date}
              headLabel="날짜"
              headValue={(row) => row.date}
              getChannelBreakdown={(row) => ({
                meta: metricsForDateSubset(
                  combinedInsight.series.meta.byDate,
                  (d) => d === row.date,
                ),
                google: metricsForDateSubset(
                  combinedInsight.series.google.byDate,
                  (d) => d === row.date,
                ),
              })}
            />
          </section>

          <section className="meta-insight__section">
            <h3 className="meta-insight__section-title">요일별 성과</h3>
            <MetricsTable<DayOfWeekSummary>
              rows={combinedInsight.series.combined.byDayOfWeek}
              rowKey={(row) => row.dayOfWeek}
              headLabel="요일"
              headValue={(row) => row.dayOfWeek}
              getChannelBreakdown={(row) => ({
                meta: metricsForDateSubset(
                  combinedInsight.series.meta.byDate,
                  (d) => weekdayLabelOf(d) === row.dayOfWeek,
                ),
                google: metricsForDateSubset(
                  combinedInsight.series.google.byDate,
                  (d) => weekdayLabelOf(d) === row.dayOfWeek,
                ),
              })}
            />
          </section>

          <section className="meta-insight__section">
            <h3 className="meta-insight__section-title">주차별 성과</h3>
            <MetricsTable<WeekSummary>
              rows={combinedInsight.series.combined.byGroupedWeek}
              rowKey={(row) => row.period}
              headLabel="기간"
              headValue={(row) => row.period}
              getChannelBreakdown={(row) => ({
                meta: metricsForDateSubset(
                  combinedInsight.series.meta.byDate,
                  (d) => d >= row.startDate && d <= row.endDate,
                ),
                google: metricsForDateSubset(
                  combinedInsight.series.google.byDate,
                  (d) => d >= row.startDate && d <= row.endDate,
                ),
              })}
            />
          </section>
        </div>
      )}

      {chartOpen && data && (
        <MetaInsightChartModal
          data={data}
          onClose={() => setChartOpen(false)}
        />
      )}
    </div>
  )
}
