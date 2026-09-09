import { useState } from 'react'
import { useMetaInsightViewModel } from '../view-model/use-meta-insight-view-model'
import type { DateSummary, DayOfWeekSummary, MetricsSummary, WeekSummary } from '../client'
import { METRIC_FIELDS } from './metric-fields'
import { MetaInsightChartModal } from './meta-insight-chart-modal'
import '../styles/meta-insight.scss'

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

function MetricsTable<T extends MetricsSummary>({
  rows,
  rowKey,
  headLabel,
  headValue,
}: {
  rows: readonly T[]
  rowKey: (row: T) => string
  headLabel: string
  headValue: (row: T) => string
}) {
  return (
    <div className="meta-insight__table-wrap">
      <table className="meta-insight__table">
        <thead>
          <tr>
            <th>{headLabel}</th>
            {METRIC_FIELDS.map((f) => (
              <th key={f.key}>{f.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={METRIC_FIELDS.length + 1}>데이터 없음</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                <td>{headValue(row)}</td>
                {METRIC_FIELDS.map((f) => (
                  <td key={f.key}>{f.formatCompact(row[f.key])}</td>
                ))}
              </tr>
            ))
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
    load,
  } = useMetaInsightViewModel()
  const [chartOpen, setChartOpen] = useState(false)

  return (
    <div className="meta-insight">
      <div className="meta-insight__form">
        <div className="meta-insight__field">
          <label htmlFor="insight-date-start">시작일</label>
          <input
            id="insight-date-start"
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="meta-insight__field">
          <label htmlFor="insight-date-end">종료일</label>
          <input
            id="insight-date-end"
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

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

      {data && (
        <div className="meta-insight__result">
          <section className="meta-insight__summary">
            <div className="meta-insight__summary-head">
              <span className="meta-insight__summary-label">Summary</span>
              <span className="meta-insight__summary-period">
                {dateStart} ~ {dateEnd}
              </span>
            </div>
            <KpiGrid metrics={data.total} />
          </section>

          <section className="meta-insight__section">
            <h3 className="meta-insight__section-title">일별 성과</h3>
            <MetricsTable<DateSummary>
              rows={data.byDate}
              rowKey={(row) => row.date}
              headLabel="날짜"
              headValue={(row) => row.date}
            />
          </section>

          <section className="meta-insight__section">
            <h3 className="meta-insight__section-title">요일별 성과</h3>
            <MetricsTable<DayOfWeekSummary>
              rows={data.byDayOfWeek}
              rowKey={(row) => row.dayOfWeek}
              headLabel="요일"
              headValue={(row) => row.dayOfWeek}
            />
          </section>

          <section className="meta-insight__section">
            <h3 className="meta-insight__section-title">주차별 성과</h3>
            <MetricsTable<WeekSummary>
              rows={data.byGroupedWeek}
              rowKey={(row) => row.period}
              headLabel="기간"
              headValue={(row) => row.period}
            />
          </section>
        </div>
      )}

      {chartOpen && data && (
        <MetaInsightChartModal data={data} onClose={() => setChartOpen(false)} />
      )}
    </div>
  )
}
