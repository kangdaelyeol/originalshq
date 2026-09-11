import { Fragment, useEffect, useRef, useState } from 'react'
import { useMetaInsightViewModel } from '../view-model/use-meta-insight-view-model'
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
  metricsForDateSubset,
  weekdayLabelOf,
} from '../client'
import { METRIC_FIELDS } from './metric-fields'
import { DateRangePicker } from './date-range-picker'
import { MetaInsightChartModal } from './meta-insight-chart-modal'
import { dateRange } from '../utils'
import type { ISODate } from '../types'
import '../styles/meta-insight.scss'

type MetricKey = keyof MetricsSummary

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

/** 조회 중(로딩)일 때 KpiGrid 자리에 대신 깔아두는 스켈레톤 — 값이 들어올 자리를
 * 그대로 흉내 내서(라벨 폭 짧게, 값 폭 길게) 레이아웃이 흔들리지 않게 한다. */
function KpiSkeletonGrid() {
  return (
    <div className="meta-insight__summary-grid" aria-hidden>
      {METRIC_FIELDS.map(({ key }) => (
        <div key={key} className="meta-insight__kpi">
          <span className="meta-insight__skeleton-bar meta-insight__skeleton-bar--label" />
          <span className="meta-insight__skeleton-bar meta-insight__skeleton-bar--value" />
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
    <div className="meta-insight__table-wrap" aria-hidden>
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
          {Array.from({ length: rowCount }, (_, i) => (
            <tr key={i}>
              <td className="meta-insight__table-toggle-cell" />
              <td>
                <span className="meta-insight__skeleton-bar meta-insight__skeleton-bar--cell" />
              </td>
              {METRIC_FIELDS.map((f) => (
                <td key={f.key}>
                  <span className="meta-insight__skeleton-bar meta-insight__skeleton-bar--cell" />
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
    <div className="meta-insight__result">
      <section className="meta-insight__summary">
        <div className="meta-insight__summary-head">
          <span className="meta-insight__summary-label">Summary</span>
          <span className="meta-insight__summary-period">{periodLabel}</span>
        </div>
        <KpiSkeletonGrid />
      </section>

      <section className="meta-insight__section">
        <h3 className="meta-insight__section-title">일별 성과</h3>
        <TableSkeleton headLabel="날짜" rowCount={dayCount} />
      </section>

      <section className="meta-insight__section">
        <h3 className="meta-insight__section-title">요일별 성과</h3>
        <TableSkeleton headLabel="요일" rowCount={Math.min(7, dayCount)} />
      </section>

      <section className="meta-insight__section">
        <h3 className="meta-insight__section-title">주차별 성과</h3>
        <TableSkeleton
          headLabel="기간"
          rowCount={Math.max(1, Math.ceil(dayCount / 7))}
        />
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
  }
  series: {
    combined: GroupedInsightSeries
    meta: GroupedInsightSeries
    google: GroupedInsightSeries
  }
  /** 재조회 중(날짜 범위 변경 등)엔 이전 결과가 그대로 남아있는 동안에도 Summary/
   * 표 칸을 스켈레톤으로 덮어서 "새로 불러오는 중"임을 보여준다. */
  loading: boolean
  /** 로딩 중 표 스켈레톤의 행 수를 "지금 조회 중인" 기간에 맞추기 위한 값 —
   * 실제 데이터가 아니라 dateStart/dateEnd(즉시 반영되는 입력값)만 있으면 된다. */
  dateStart: ISODate
  dateEnd: ISODate
}

/** "전체 요약" 탭 전용 — Summary KPI 카드 + 일별/요일별/주차별 표. */
function ResultPanel({
  periodLabel,
  total,
  series,
  loading,
  dateStart,
  dateEnd,
}: ResultPanelProps) {
  const [showChannelTotal, setShowChannelTotal] = useState(false)

  const dayCount = dateRange(dateStart, dateEnd).length

  // 이 캠페인/adset에 데이터가 아예 없는 채널(예: Meta 전용 캠페인의 Google)은
  // 펼쳐봐야 모든 행이 0으로만 나와서 의미가 없으니 미리 걸러낸다.
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
        {loading ? <KpiSkeletonGrid /> : <KpiGrid metrics={total.combined} />}

        {!loading && applicableChannels.length > 0 && (
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
        {loading ? (
          <TableSkeleton headLabel="날짜" rowCount={dayCount} />
        ) : (
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
        )}
      </section>

      <section className="meta-insight__section">
        <h3 className="meta-insight__section-title">요일별 성과</h3>
        {loading ? (
          <TableSkeleton headLabel="요일" rowCount={Math.min(7, dayCount)} />
        ) : (
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
        )}
      </section>

      <section className="meta-insight__section">
        <h3 className="meta-insight__section-title">주차별 성과</h3>
        {loading ? (
          <TableSkeleton
            headLabel="기간"
            rowCount={Math.max(1, Math.ceil(dayCount / 7))}
          />
        ) : (
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
        )}
      </section>
    </div>
  )
}

// ------------------------------------------------------------------ 다중 선택 드롭다운
// 캠페인 탭의 캠페인 선택, adset 탭의 adset 선택, 지표 선택이 공유하는 체크박스
// 팝오버. 지표 선택엔 MetricKey를, 나머지엔 일반 string을 써서 제네릭으로 뒀다.
interface MultiSelectOption<T extends string> {
  key: T
  label: string
}

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
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const selectedOption =
    selected.size === 1 ? options.find((o) => selected.has(o.key)) : undefined
  const triggerLabel =
    selected.size === 0
      ? emptyLabel
      : (selectedOption?.label ?? `${selected.size}${countSuffix}`)

  return (
    <div className="meta-insight__multi-select" ref={ref}>
      <button
        type="button"
        className={`meta-insight__result-select meta-insight__multi-select-trigger${
          open ? ' is-open' : ''
        }`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {triggerLabel}
        <ChevronIcon />
      </button>
      {open && (
        <div className="meta-insight__multi-select-menu">
          {options.map((o) => (
            <label key={o.key} className="meta-insight__multi-select-item">
              <input
                type="checkbox"
                checked={selected.has(o.key)}
                onChange={() => onToggle(o.key)}
              />
              {o.label}
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

/** 캠페인/adset 탭 전용 — 선택된 항목(캠페인 또는 adset) × 선택된 지표를 날짜별로
 * 교차 표시한다. 첫 행은 일 평균(전체 조회 기간 기준), 그 아래로 날짜별 원본이
 * 최신순(내림차순)으로 이어진다. 주차 집계는 안 쓴다(나중에 차트에서 쓸 데이터라
 * 여기서는 손대지 않는다). */
function PivotSummary({
  groups,
  metricKeys,
  dates,
  emptyLabel,
  showUnit,
}: {
  groups: readonly PivotGroup[]
  metricKeys: readonly MetricKey[]
  dates: readonly string[]
  emptyLabel: string
  /** 지표 헤더에 단위(원/%/회 등)를 같이 보여줄지. */
  showUnit: boolean
}) {
  const metricFields = METRIC_FIELDS.filter((f) => metricKeys.includes(f.key))

  if (groups.length === 0 || metricFields.length === 0) {
    return (
      <section className="meta-insight__summary">
        <p className="meta-insight__result-empty">
          {groups.length === 0 ? emptyLabel : '표시할 지표를 선택해주세요.'}
        </p>
      </section>
    )
  }

  const groupsWithLookup = groups.map((g) => ({
    ...g,
    byDateKey: new Map(g.byDate.map((row) => [row.date, row])),
  }))

  // 평균 행 — 조회 기간 전체(dates, 값 없는 날은 0)를 기준으로 한 일 평균.
  const dayCount = dates.length || 1
  const groupAverages = groupsWithLookup.map((g) => {
    const resolvedRows = dates.map((d) => g.byDateKey.get(d) ?? emptyMetrics())
    const agg = aggregateMetrics(resolvedRows)
    return { key: g.key, agg }
  })

  // 최신 날짜가 위로 오도록 — dates는 오름차순으로 들어오므로 뒤집기만 하면 된다.
  const datesDesc = [...dates].reverse()

  return (
    <section className="meta-insight__summary meta-insight__pivot">
      <div className="meta-insight__table-wrap">
        <table className="meta-insight__table meta-insight__table--pivot">
          <thead>
            <tr>
              <th rowSpan={2} className="meta-insight__pivot-date-head">
                날짜
              </th>
              {groupsWithLookup.map((g) => (
                <th
                  key={g.key}
                  colSpan={metricFields.length}
                  className="meta-insight__pivot-group-head"
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {groupsWithLookup.flatMap((g) =>
                metricFields.map((f) => (
                  <th
                    key={`${g.key}-${f.key}`}
                    className="meta-insight__pivot-metric-head"
                  >
                    {showUnit ? `${f.label}(${f.unit})` : f.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {dates.length === 0 ? (
              <tr>
                <td colSpan={1 + groupsWithLookup.length * metricFields.length}>
                  데이터 없음
                </td>
              </tr>
            ) : (
              <>
                <tr className="meta-insight__table-row--total">
                  <td>합계</td>
                  {groupAverages.flatMap(({ key, agg }) =>
                    metricFields.map((f) => (
                      <td key={`${key}-${f.key}`}>
                        {f.formatCompact(agg[f.key])}
                      </td>
                    )),
                  )}
                </tr>
                <tr className="meta-insight__table-row--average">
                  <td>평균</td>
                  {groupAverages.flatMap(({ key, agg }) =>
                    metricFields.map((f) => (
                      <td key={`${key}-${f.key}`}>
                        {f.formatCompact(
                          SUM_METRIC_KEYS.has(f.key)
                            ? agg[f.key] / dayCount
                            : agg[f.key],
                        )}
                      </td>
                    )),
                  )}
                </tr>
                {datesDesc.map((date) => (
                  <tr key={date}>
                    <td>
                      {date} ({weekdayLabelOf(date)})
                    </td>
                    {groupsWithLookup.flatMap((g) => {
                      const row = g.byDateKey.get(date)
                      return metricFields.map((f) => (
                        <td key={`${g.key}-${f.key}`}>
                          {f.formatCompact(row ? row[f.key] : 0)}
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
    loadRange,
  } = useMetaInsightViewModel()

  // 페이지에 들어오면 기본 기간(최근 7일)으로 바로 조회 — "조회" 버튼 없이도
  // 데이터가 바로 보이도록. 마운트 시 한 번만.
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [chartOpen, setChartOpen] = useState(false)
  const [resultTab, setResultTab] = useState<ResultTab>('total')

  // adset 탭에서 "어느 캠페인의 adset을 볼지"는 단일 선택 — 캠페인 탭의 다중
  // 선택과는 별개 상태다.
  const [selectedCampaignName, setSelectedCampaignName] = useState<
    string | null
  >(null)
  // 캠페인 탭: 캠페인 다중 선택. adset 탭: (선택된 캠페인 안의) adset 다중 선택.
  const [selectedCampaignNames, setSelectedCampaignNames] = useState<
    ReadonlySet<string>
  >(() => new Set())
  const [selectedAdsetNames, setSelectedAdsetNames] = useState<
    ReadonlySet<string>
  >(() => new Set())
  const [selectedMetricKeys, setSelectedMetricKeys] = useState<
    ReadonlySet<MetricKey>
  >(() => new Set(['impressions']))
  // 캠페인/adset 교차표의 지표 헤더에 단위(원/%/회 등)를 같이 보여줄지.
  const [showUnit, setShowUnit] = useState(false)

  const campaigns = combinedInsight?.byCampaign ?? []
  // 이름이 목록에 없으면(처음 진입, 재조회로 캠페인이 바뀜 등) 첫 캠페인으로
  // 자연스럽게 대체 — 별도 리셋 로직 없이 항상 유효한 선택을 유지한다.
  const selectedCampaign =
    campaigns.find((c) => c.campaignName === selectedCampaignName) ??
    campaigns[0] ??
    null
  const adsets = selectedCampaign?.adsets ?? []

  // 캠페인 목록 자체가 바뀌면(재조회 등) 다중 선택을 첫 캠페인 하나로 리셋한다 —
  // 같은 목록 안에서 사용자가 전부 해제한 것(빈 선택)은 그대로 존중한다. 렌더 중
  // 비교해서 바뀐 시점에만 반영("prop 변화에 맞춰 state 조정하기" 패턴).
  const campaignListKey = campaigns.map((c) => c.campaignName).join('|')
  const [syncedCampaignListKey, setSyncedCampaignListKey] = useState<
    string | null
  >(null)
  if (campaignListKey !== syncedCampaignListKey) {
    setSyncedCampaignListKey(campaignListKey)
    setSelectedCampaignNames(
      new Set(campaigns[0] ? [campaigns[0].campaignName] : []),
    )
  }

  // adset 탭에서 보는 캠페인이 바뀌거나 그 adset 목록이 바뀌면 adset 다중 선택을
  // 그 캠페인의 첫 adset 하나로 리셋한다.
  const adsetListKey = `${selectedCampaign?.campaignName ?? ''}::${adsets
    .map((a) => a.adsetName)
    .join('|')}`
  const [syncedAdsetListKey, setSyncedAdsetListKey] = useState<string | null>(
    null,
  )
  if (adsetListKey !== syncedAdsetListKey) {
    setSyncedAdsetListKey(adsetListKey)
    setSelectedAdsetNames(new Set(adsets[0] ? [adsets[0].adsetName] : []))
  }

  const toggleCampaignMulti = (name: string) => {
    setSelectedCampaignNames((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }
  const toggleAdsetMulti = (name: string) => {
    setSelectedAdsetNames((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }
  const toggleMetric = (key: MetricKey) => {
    setSelectedMetricKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const periodLabel = `${dateStart} ~ ${dateEnd}`
  const canonicalDates =
    combinedInsight?.series.combined.byDate.map((d) => d.date) ?? []
  const metricKeyList = [...selectedMetricKeys]

  return (
    <div className="meta-insight">
      <div className="meta-insight__query-row">
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
          <span className="meta-insight__query-loading">조회하는 중…</span>
        )}
      </div>

      {error && <div className="meta-insight__banner is-error">{error}</div>}

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
          <div
            className="meta-insight__result-tabs"
            role="group"
            aria-label="보기 단위"
          >
            <select
              className="meta-insight__result-select"
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
              className="meta-insight__btn meta-insight__ghost"
              onClick={() => setChartOpen(true)}
            >
              그래프로 보기
            </button>
          </div>

          {(resultTab === 'campaign' || resultTab === 'adset') && (
            <div
              className="meta-insight__metric-row"
              role="group"
              aria-label="지표 선택"
            >
              {/* 캠페인 탭 — 캠페인 다중 선택. */}
              {resultTab === 'campaign' &&
                (campaigns.length === 0 ? (
                  <span className="meta-insight__result-empty">
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
                className={`meta-insight__unit-toggle${
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
            />
          )}
          {resultTab === 'adset' && (
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
