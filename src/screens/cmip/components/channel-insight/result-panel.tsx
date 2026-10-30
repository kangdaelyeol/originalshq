import {
  PERIOD_VIEWS,
  useResultPanelViewModel,
  type PeriodView,
} from '../../view-model/use-result-panel-view-model'
import {
  metricsForDateSubset,
  weekdayLabelOf,
  type DateSummary,
  type DayOfWeekSummary,
  type GroupedInsightSeries,
  type MetricsSummary,
  type WeekSummary,
} from '../../client'
import { CHANNELS } from '../channels'
import type { ISODate } from '../../types'
import { ChannelLabel } from './channel-label'
import { ChevronIcon } from '../icons'
import { KpiGrid } from './kpi-grid'
import { AutoHeight, LoadingPanel, Segmented } from '@/components/glass'
import { MetricsTable } from './metrics-table'

// 섹션마다 로딩 판 높이(px) — 다 받은 내용의 대강의 높이.
const SUMMARY_LOADING = 170
const TABLE_LOADING = 300
const COMPARE_LOADING = 160

// 기간별 성과 보기 — { 보기: 이름 }(Segmented가 받는 모양).
const PERIOD_VIEW_LABEL = Object.fromEntries(
  PERIOD_VIEWS.map((each) => [each.value, each.label]),
) as Record<PeriodView, string>
/** 최초 조회 중(아직 combinedInsight 자체가 없어 ResultPanel이 렌더되지 않는
 * 시점)에 그 자리를 대신하는 틀 — ResultPanel과 같은 섹션(Summary·기간별 성과·
 * 비교분석)에 섹션마다 로딩 하나. */
export function ResultLoading({ periodLabel }: { periodLabel: string }) {
  return (
    <div className="channel-insight__result">
      <section className="channel-insight__summary">
        <div className="channel-insight__summary-head">
          <span className="channel-insight__summary-label">Summary</span>
          <span className="channel-insight__summary-period">{periodLabel}</span>
        </div>
        <LoadingPanel label="요약을 불러오는 중" minHeight={SUMMARY_LOADING} />
      </section>

      <section className="channel-insight__section">
        <h3 className="channel-insight__section-title">기간별 성과</h3>
        <LoadingPanel
          label="기간별 성과를 불러오는 중"
          minHeight={TABLE_LOADING}
        />
      </section>

      <section className="channel-insight__section">
        <h3 className="channel-insight__section-title">
          이전 일정 vs 지정 일정 비교분석
        </h3>
        <LoadingPanel
          label="비교분석을 불러오는 중"
          minHeight={COMPARE_LOADING}
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
    naver: MetricsSummary
  }
  series: {
    combined: GroupedInsightSeries
    meta: GroupedInsightSeries
    google: GroupedInsightSeries
    naver: GroupedInsightSeries
  }
  /** 재조회 중(날짜 범위 변경 등)엔 이전 결과가 그대로 남아있는 동안에도 Summary/
   * 표 자리를 섹션마다 로딩 판으로 덮어서 "새로 불러오는 중"임을 보여준다. */
  loading: boolean
  /** 지금 조회 중인 기간 — 기간별 보기 계산(useResultPanelViewModel)에 쓴다. */
  dateStart: ISODate
  dateEnd: ISODate
}

/** "기간별 성과" 섹션 머리 — 제목, 보기 버튼(일별/주차별/월별/요일별), "대비
 * 표시" 토글을 한 줄에. */
function PeriodSectionHead({
  view,
  onViewChange,
  active,
  onToggle,
}: {
  view: PeriodView
  onViewChange: (view: PeriodView) => void
  active: boolean
  onToggle: () => void
}) {
  return (
    <div className="channel-insight__section-head">
      <h3 className="channel-insight__section-title">기간별 성과</h3>
      <Segmented
        className="channel-insight__period-view-picker"
        options={PERIOD_VIEW_LABEL}
        value={view}
        onChange={onViewChange}
        label="보기"
      />
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
export function ResultPanel({
  periodLabel,
  total,
  series,
  loading,
  dateStart,
  dateEnd,
}: ResultPanelProps) {
  const {
    showChannelTotal,
    periodView,
    byMonth,
    compareOn,
    visibleMetrics,
    channelFilter,
    bucketSize,
    customPeriodRows,
    setShowChannelTotal,
    setPeriodView,
    toggleCompare,
    toggleMetricVisible,
    setChannelFilterFor,
    setBucketSize,
  } = useResultPanelViewModel(series, dateStart, dateEnd)

  // 이 캠페인/adset에 데이터가 아예 없는 채널(예: Meta 전용 캠페인의 Google)은
  // 펼쳐봐야 모든 행이 0으로만 나와서 의미가 없으니 미리 걸러낸다.
  const applicableChannels = CHANNELS.filter(
    (c) => series[c.key].byDate.length > 0,
  )

  // 표의 한 줄을 펼쳤을 때 채널별 값 — 그 줄이 가리키는 날짜들만 원본
  // 일별 값에서 다시 더한다.
  const breakdownOf = (match: (date: ISODate) => boolean) => ({
    meta: metricsForDateSubset(series.meta.byDate, match),
    google: metricsForDateSubset(series.google.byDate, match),
    naver: metricsForDateSubset(series.naver.byDate, match),
  })

  return (
    <div className="channel-insight__result">
      <section className="channel-insight__summary">
        <div className="channel-insight__summary-head">
          <span className="channel-insight__summary-label">Summary</span>
          <span className="channel-insight__summary-period">{periodLabel}</span>
        </div>
        <AutoHeight className="channel-insight__section-body">
          {loading ? (
            <LoadingPanel
              label="요약을 불러오는 중"
              minHeight={SUMMARY_LOADING}
            />
          ) : (
            <div>
              <KpiGrid metrics={total.combined} />

              {applicableChannels.length > 0 && (
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
                          <KpiGrid metrics={total[channel.key]} channelScoped />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </AutoHeight>
      </section>

      {/* 기간별 성과 — 일별/주차별/월별/요일별을 버튼으로 바꿔 본다. 보기마다
          대비 표시·지표 컬럼·채널 필터를 따로 기억한다. MetricsTable은 보기가
          바뀌면 새로 그려 정렬·펼침이 섞이지 않게 한다(key). */}
      <section className="channel-insight__section">
        <PeriodSectionHead
          view={periodView}
          onViewChange={setPeriodView}
          active={compareOn[periodView]}
          onToggle={() => toggleCompare(periodView)}
        />
        <AutoHeight className="channel-insight__section-body">
          {loading ? (
            <LoadingPanel
              label="기간별 성과를 불러오는 중"
              minHeight={TABLE_LOADING}
            />
          ) : periodView === 'byDate' ? (
            <MetricsTable<DateSummary>
              key="byDate"
              rows={
                channelFilter.byDate === 'all'
                  ? series.combined.byDate
                  : series[channelFilter.byDate].byDate
              }
              rowKey={(row) => row.date}
              headLabel="날짜"
              headValue={(row) => row.date}
              channels={
                channelFilter.byDate === 'all' ? applicableChannels : []
              }
              showCompare={compareOn.byDate}
              visibleKeys={visibleMetrics.byDate}
              onToggleMetric={(key) => toggleMetricVisible('byDate', key)}
              channelFilter={channelFilter.byDate}
              onChannelFilterChange={(v) => setChannelFilterFor('byDate', v)}
              getChannelBreakdown={(row) => breakdownOf((d) => d === row.date)}
            />
          ) : periodView === 'byDayOfWeek' ? (
            <MetricsTable<DayOfWeekSummary>
              key="byDayOfWeek"
              labelDefaultDir="asc"
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
              onChannelFilterChange={(v) =>
                setChannelFilterFor('byDayOfWeek', v)
              }
              getChannelBreakdown={(row) =>
                breakdownOf((d) => weekdayLabelOf(d) === row.dayOfWeek)
              }
            />
          ) : (
            // 주차별·월별 — 같은 모양(기간 이름 + 시작·끝 날짜)이라 한 표로.
            <MetricsTable<WeekSummary>
              key={periodView}
              rows={
                periodView === 'byGroupedWeek'
                  ? channelFilter.byGroupedWeek === 'all'
                    ? series.combined.byGroupedWeek
                    : series[channelFilter.byGroupedWeek].byGroupedWeek
                  : byMonth[
                      channelFilter.byMonth === 'all'
                        ? 'combined'
                        : channelFilter.byMonth
                    ]
              }
              rowKey={(row) => row.period}
              headLabel={periodView === 'byMonth' ? '월' : '기간'}
              headValue={(row) => row.period}
              channels={
                channelFilter[periodView] === 'all' ? applicableChannels : []
              }
              showCompare={compareOn[periodView]}
              visibleKeys={visibleMetrics[periodView]}
              onToggleMetric={(key) => toggleMetricVisible(periodView, key)}
              channelFilter={channelFilter[periodView]}
              onChannelFilterChange={(v) => setChannelFilterFor(periodView, v)}
              getChannelBreakdown={(row) =>
                breakdownOf((d) => d >= row.startDate && d <= row.endDate)
              }
            />
          )}
        </AutoHeight>
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
        <AutoHeight className="channel-insight__section-body">
          {loading ? (
            <LoadingPanel
              label="비교분석을 불러오는 중"
              minHeight={COMPARE_LOADING}
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
              onToggleMetric={(key) =>
                toggleMetricVisible('byCustomPeriod', key)
              }
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
        </AutoHeight>
      </section>
    </div>
  )
}
