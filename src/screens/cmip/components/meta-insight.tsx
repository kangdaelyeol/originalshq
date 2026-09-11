import { Fragment, useState } from 'react'
import { useMetaInsightViewModel } from '../view-model/use-meta-insight-view-model'
import type {
  ChannelSplitSeries,
  DateSummary,
  DayOfWeekSummary,
  GroupedInsightSeries,
  MetricsSummary,
  WeekSummary,
} from '../client'
import {
  aggregateMetrics,
  metricsForDateSubset,
  weekdayLabelOf,
} from '../client'
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

type ResultTab = 'total' | 'campaign' | 'adset'

const RESULT_TABS: readonly { key: ResultTab; label: string }[] = [
  { key: 'total', label: '전체 요약' },
  { key: 'campaign', label: '캠페인' },
  { key: 'adset', label: 'Adset' },
]

/** ChannelSplitSeries(combined/meta/google의 byDate)로부터 채널별 total(KPI 카드용
 * 합계)을 만든다 — 캠페인/adset은 total이 따로 없고 시계열만 있어서, 그 시계열을
 * 그대로 합산해 만든다. */
function totalsFromSeries(entity: ChannelSplitSeries): {
  combined: MetricsSummary
  meta: MetricsSummary
  google: MetricsSummary
} {
  return {
    combined: aggregateMetrics(entity.combined.byDate),
    meta: aggregateMetrics(entity.meta.byDate),
    google: aggregateMetrics(entity.google.byDate),
  }
}

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
  channels,
}: {
  rows: readonly T[]
  rowKey: (row: T) => string
  headLabel: string
  headValue: (row: T) => string
  /** 그 행(날짜/요일/주차)이 가리키는 기간의 채널별 total — 드롭다운으로 펼쳐 보여준다. */
  getChannelBreakdown: (row: T) => ChannelBreakdown
  /** 펼쳤을 때 보여줄 채널 — 이 캠페인/adset에 아예 데이터가 없는 채널(예: Meta
   * 전용 캠페인의 Google)은 모든 행이 0으로만 나와서 무의미하니 미리 제외하고 받는다. */
  channels: readonly { key: 'meta' | 'google'; label: string }[]
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
                    channels.map((channel) => (
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

interface ResultPanelProps {
  periodLabel: string
  total: {
    combined: MetricsSummary
    meta: MetricsSummary
    google: MetricsSummary
  }
  series: {
    combined: GroupedInsightSeries
    meta: GroupedInsightSeries
    google: GroupedInsightSeries
  }
}

/** "전체 요약"/캠페인/adset 세 탭이 공유하는 요약 섹션 — Summary KPI 카드 +
 * 일별/요일별/주차별 표. 어느 단위(전체/캠페인/adset)의 series를 넘기든 동일하게
 * 동작한다. */
function ResultPanel({ periodLabel, total, series }: ResultPanelProps) {
  const [showChannelTotal, setShowChannelTotal] = useState(false)

  // 이 캠페인/adset에 데이터가 아예 없는 채널(예: Meta 전용 캠페인의 Google)은
  // 펼쳐봐야 모든 행이 0으로만 나와서 의미가 없으니 미리 걸러낸다. "전체 요약"
  // 탭에서는 두 채널 다 실제로 조회했으니 보통 둘 다 포함된다.
  const applicableChannels = CHANNELS.filter(
    (c) => series[c.key].byDate.length > 0,
  )

  return (
    <div className="meta-insight__result">
      <section className="meta-insight__summary">
        <div className="meta-insight__summary-head">
          <span className="meta-insight__summary-label">Summary</span>
          <span className="meta-insight__summary-period">{periodLabel}</span>
        </div>
        <KpiGrid metrics={total.combined} />

        {applicableChannels.length > 0 && (
          <>
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
                {applicableChannels.map((channel) => (
                  <div
                    key={channel.key}
                    className="meta-insight__summary-channel"
                  >
                    <span className="meta-insight__summary-channel-label">
                      {channel.label}
                    </span>
                    <KpiGrid metrics={total[channel.key]} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="meta-insight__section">
        <h3 className="meta-insight__section-title">일별 성과</h3>
        <MetricsTable<DateSummary>
          rows={series.combined.byDate}
          rowKey={(row) => row.date}
          headLabel="날짜"
          headValue={(row) => row.date}
          channels={applicableChannels}
          getChannelBreakdown={(row) => ({
            meta: metricsForDateSubset(
              series.meta.byDate,
              (d) => d === row.date,
            ),
            google: metricsForDateSubset(
              series.google.byDate,
              (d) => d === row.date,
            ),
          })}
        />
      </section>

      <section className="meta-insight__section">
        <h3 className="meta-insight__section-title">요일별 성과</h3>
        <MetricsTable<DayOfWeekSummary>
          rows={series.combined.byDayOfWeek}
          rowKey={(row) => row.dayOfWeek}
          headLabel="요일"
          headValue={(row) => row.dayOfWeek}
          channels={applicableChannels}
          getChannelBreakdown={(row) => ({
            meta: metricsForDateSubset(
              series.meta.byDate,
              (d) => weekdayLabelOf(d) === row.dayOfWeek,
            ),
            google: metricsForDateSubset(
              series.google.byDate,
              (d) => weekdayLabelOf(d) === row.dayOfWeek,
            ),
          })}
        />
      </section>

      <section className="meta-insight__section">
        <h3 className="meta-insight__section-title">주차별 성과</h3>
        <MetricsTable<WeekSummary>
          rows={series.combined.byGroupedWeek}
          rowKey={(row) => row.period}
          headLabel="기간"
          headValue={(row) => row.period}
          channels={applicableChannels}
          getChannelBreakdown={(row) => ({
            meta: metricsForDateSubset(
              series.meta.byDate,
              (d) => d >= row.startDate && d <= row.endDate,
            ),
            google: metricsForDateSubset(
              series.google.byDate,
              (d) => d >= row.startDate && d <= row.endDate,
            ),
          })}
        />
      </section>
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
    combinedInsight,
    load,
  } = useMetaInsightViewModel()
  const [chartOpen, setChartOpen] = useState(false)
  const [resultTab, setResultTab] = useState<ResultTab>('total')
  const [selectedCampaignName, setSelectedCampaignName] = useState<
    string | null
  >(null)
  const [selectedAdsetName, setSelectedAdsetName] = useState<string | null>(
    null,
  )

  const campaigns = combinedInsight?.byCampaign ?? []
  // 이름이 목록에 없으면(처음 진입, 재조회로 캠페인이 바뀜 등) 첫 캠페인으로
  // 자연스럽게 대체 — 별도 리셋 로직 없이 항상 유효한 선택을 유지한다.
  const selectedCampaign =
    campaigns.find((c) => c.campaignName === selectedCampaignName) ??
    campaigns[0] ??
    null
  const adsets = selectedCampaign?.adsets ?? []
  const selectedAdset =
    adsets.find((a) => a.adsetName === selectedAdsetName) ?? adsets[0] ?? null

  const periodLabel = `${dateStart} ~ ${dateEnd}`

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
          disabled={!combinedInsight}
        >
          그래프로 보기
        </button>
      </div>

      {error && <div className="meta-insight__banner is-error">{error}</div>}

      {combinedInsight && (
        <>
          <div
            className="meta-insight__result-tabs"
            role="tablist"
            aria-label="보기 단위"
          >
            {RESULT_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={resultTab === t.key}
                className={`meta-insight__result-tab${
                  resultTab === t.key ? ' is-active' : ''
                }`}
                onClick={() => setResultTab(t.key)}
              >
                {t.label}
              </button>
            ))}

            {resultTab !== 'total' &&
              (campaigns.length === 0 ? (
                <span className="meta-insight__result-empty">
                  캠페인 데이터 없음
                </span>
              ) : (
                <select
                  className="meta-insight__result-select"
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
                <span className="meta-insight__result-empty">
                  adset 데이터 없음
                </span>
              ) : (
                <select
                  className="meta-insight__result-select"
                  value={selectedAdset?.adsetName ?? ''}
                  onChange={(e) => setSelectedAdsetName(e.target.value)}
                >
                  {adsets.map((a) => (
                    <option key={a.adsetName} value={a.adsetName}>
                      {a.adsetName}
                    </option>
                  ))}
                </select>
              ))}
          </div>

          {resultTab === 'total' && (
            <ResultPanel
              periodLabel={periodLabel}
              total={combinedInsight.total}
              series={combinedInsight.series}
            />
          )}
          {resultTab === 'campaign' && selectedCampaign && (
            <ResultPanel
              key={selectedCampaign.campaignName}
              periodLabel={periodLabel}
              total={totalsFromSeries(selectedCampaign)}
              series={selectedCampaign}
            />
          )}
          {resultTab === 'adset' && selectedAdset && (
            <ResultPanel
              key={`${selectedCampaign?.campaignName}:${selectedAdset.adsetName}`}
              periodLabel={periodLabel}
              total={totalsFromSeries(selectedAdset)}
              series={selectedAdset}
            />
          )}
        </>
      )}

      {chartOpen && combinedInsight && (
        <MetaInsightChartModal
          combined={combinedInsight}
          onClose={() => setChartOpen(false)}
        />
      )}
    </div>
  )
}
