import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { useUsageTracking } from '@/hooks'
import { AutoHeight, LoadingPanel } from '@/components/glass'
import { useChannelInsightViewModel } from '../../view-model/use-channel-insight-view-model'
import {
  useChannelInsightPageViewModel,
  type ResultTab,
  type PivotView,
} from '../../view-model/use-channel-insight-page-view-model'
import { SingleSelectDropdown } from '../single-select-dropdown'
import {
  adsetKey,
  aggregateMetrics,
  campaignKey,
  emptyMetrics,
  type DateSummary,
} from '../../client'
import { METRIC_FIELDS, type MetricKey } from '../metric-fields'
import { channelsOf } from '../channels'
import { DateRangePicker } from '../date-range-picker'
import { PeriodUnitPicker } from '../period-unit-picker'
import { ChannelInsightChartModal } from '../channel-insight-chart-modal'
import { PeriodTestPanel } from '../period-test-panel'
import { RoasPanel } from '../roas-panel'
import { AdPerformancePanel } from '../ad-performance'
import { CampaignHighlightCards } from '../campaign-highlights'
import { defaultRangeOf } from '../../utils'
import { ResultLoading, ResultPanel } from './result-panel'
import { MultiSelectDropdown } from './multi-select-dropdown'
import { PIVOT_VIEW_OPTIONS } from './constants'
import { PivotSummary } from './pivot-summary'
import { FullListTable } from './full-list-table'
import '../../styles/channel-insight.scss'

// exceljs가 꽤 커서(~900KB) 실제로 모달을 열 때만 불러온다 — cmip 화면
// 진입 시 항상 받아지는 번들에 넣지 않는다.
const ExcelExportModal = lazy(() =>
  import('../excel-export-modal').then((m) => ({
    default: m.ExcelExportModal,
  })),
)

/** 캠페인·광고셋/매체별 테스트/ROAS/광고 성과 탭의 내용 틀 — 섹션 사이 세로
 * 간격만 준다. 재조회 중에는 각 탭이 이 안에 로딩 판(TabLoading)을 대신
 * 그린다 — combinedInsight는 재조회가 끝나야 새 값으로 바뀌어서, 그동안 이전
 * 기간 값을 그대로 보여 주지 않기 위해서다. */
function TabContent({ children }: { children: ReactNode }) {
  return <div className="channel-insight__tab-content">{children}</div>
}

/** 탭 하나를 불러오는 동안 — 섹션 카드 하나에 로딩. */
function TabLoading() {
  return (
    <section className="channel-insight__section">
      <LoadingPanel label="인사이트를 불러오는 중" minHeight={420} />
    </section>
  )
}

/** 인사이트 조회 — 보기 단위(전체 요약·캠페인·광고셋·매체별 테스트·ROAS·광고
 * 성과)는 화면 맨 위 줄의 탭이 고르고(screens/cmip/index.tsx), 여기는 조회
 * 줄(그래프·엑셀 | 기간)과 그 보기의 내용을 그린다. */
export const ChannelInsight = ({ resultTab }: { resultTab: ResultTab }) => {
  const {
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    loading,
    error,
    combinedInsight,
    offlineRevenueData,
    onlineRevenueData,
    repeatRevenueData,
    attributionData,
    adRevenueData,
    load,
    loadRange,
    refresh,
  } = useChannelInsightViewModel()

  // 페이지에 들어오면 기본 기간(최근 7일)으로 바로 조회 — "조회" 버튼 없이도
  // 데이터가 바로 보이도록. 마운트 시 한 번만.
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    chartOpen,
    selectedKeys,
    selectedGroups,
    expandedCampaigns,
    campaignHighlights,
    highlightLevel,
    flashKey,
    listView,
    metricMode,
    selectedMetricKeys,
    showUnit,
    pivotView,
    campaigns,
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
    toggleSelected,
    toggleExpandedCampaign,
    setHighlightLevel,
    focusHighlight,
    clearFlash,
    setListView,
    toggleMetric,
    setMetricModeFor,
    clearAllMetrics,
    setShowUnit,
    setPivotView,
    setExcelExportOpen,
  } = useChannelInsightPageViewModel(
    combinedInsight,
    dateStart,
    dateEnd,
    resultTab,
  )

  /** 조회 기간의 날짜마다 값(없는 날은 0) — 카드 보기의 작은 추이 그래프. */
  const dailyOf = (byDate: readonly DateSummary[]): DateSummary[] => {
    const byDay = new Map(byDate.map((day) => [day.date, day]))
    return canonicalDates.map(
      (date) => byDay.get(date) ?? { ...emptyMetrics(), date },
    )
  }

  // 사용 분석(/log) — 지금 보고 있는 결과 탭(전체 요약·캠페인·광고셋·매체별
  // 테스트·ROAS).
  useUsageTracking('cmip', resultTab)

  return (
    <div className="channel-insight">
      {/* 조회 줄 — combinedInsight 유무와 무관하게 항상 보인다. DateRangePicker가
          이 안에 있어서, 최초 조회 실패 등으로 combinedInsight가 끝내 안 생겨도
          날짜를 다시 골라 재조회할 방법이 사라지지 않는다. "그래프로 보기"·
          "엑셀 다운로드"는 원래대로 데이터가 있을 때만 보인다. */}
      <div
        className="channel-insight__result-tabs"
        role="group"
        aria-label="조회"
      >
        {combinedInsight && (
          <>
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

        {/* 이 row 맨 오른쪽에 고정(margin-left: auto) — 그래프·엑셀
            버튼이 있든 없든 항상 오른쪽 끝에 붙는다. */}
        <div className="channel-insight__query-row">
          {/* 단위를 누르면 그 단위의 기본 기간으로 바로 조회한다. */}
          <PeriodUnitPicker
            dateStart={dateStart}
            dateEnd={dateEnd}
            onSelect={(unit) => {
              const { start, end } = defaultRangeOf(unit)
              setDateStart(start)
              setDateEnd(end)
              loadRange(start, end)
            }}
            disabled={loading}
          />
          <DateRangePicker
            dateStart={dateStart}
            dateEnd={dateEnd}
            onChange={(start, end) => {
              setDateStart(start)
              setDateEnd(end)
              // dateStart/dateEnd state 반영을 기다리지 않고 방금 고른 범위로 바로
              // 조회한다 — "업데이트" 버튼이 곧 조회 버튼을 겸한다. 이 기간을 이미
              // 이 세션에서 조회했으면 세션 캐시를 그대로 쓴다(loadRange 참고).
              loadRange(start, end)
            }}
            disabled={loading}
          />
          <button
            type="button"
            className="channel-insight__btn channel-insight__ghost"
            onClick={refresh}
            disabled={loading}
            title="세션 캐시를 무시하고 지금 기간을 다시 조회합니다."
          >
            새로고침
          </button>
        </div>
      </div>

      {error && <div className="channel-insight__banner is-error">{error}</div>}

      {/* 보기 내용 — 불러오는 동안은 로딩 판, 다 받으면 그 높이에서 부드럽게
          자라고 섹션이 흐릿하게 떠오른다. 보기를 바꿀 때는 자라지 않게 새로
          붙인다(key — 바꾸는 효과는 화면 전환이 맡는다). */}
      <AutoHeight key={resultTab}>
        {/* 최초 조회 전엔 아직 combinedInsight 자체가 없어 ResultPanel이 아예
          렌더되지 않는다 — 그 사이 ResultPanel과 같은 섹션 틀에 로딩을 둔다. */}
        {loading &&
          !combinedInsight &&
          (resultTab === 'total' ? (
            <ResultLoading />
          ) : (
            <TabContent>
              <TabLoading />
            </TabContent>
          ))}

        {combinedInsight && (
          <>
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
            {resultTab === 'campaignAdset' && (
              <TabContent>
                {loading ? (
                  <TabLoading />
                ) : (
                  <>
                    <CampaignHighlightCards
                      highlights={campaignHighlights}
                      level={highlightLevel}
                      onLevelChange={setHighlightLevel}
                      onFocus={focusHighlight}
                    />
                    <section className="channel-insight__section">
                      <h3 className="channel-insight__section-title">
                        캠페인 · 광고셋
                      </h3>
                      <FullListTable
                        rows={campaigns.map((c) => ({
                          key: c.campaignName,
                          selectKey: campaignKey(c.campaignName),
                          name: c.campaignName,
                          metrics: aggregateMetrics(c.combined.byDate),
                          resultType: c.resultType,
                          channels: channelsOf(c),
                          trend: dailyOf(c.combined.byDate),
                          children: c.adsets.map((a) => ({
                            key: `${c.campaignName}::${a.adsetName}`,
                            selectKey: adsetKey(c.campaignName, a.adsetName),
                            name: a.adsetName,
                            metrics: aggregateMetrics(a.combined.byDate),
                            channels: channelsOf(a),
                          })),
                        }))}
                        headLabel="캠페인 / 광고셋"
                        emptyLabel="캠페인 데이터 없음"
                        selected={selectedKeys}
                        onToggleSelect={toggleSelected}
                        expanded={expandedCampaigns}
                        onToggleExpanded={toggleExpandedCampaign}
                        flashKey={flashKey}
                        onFlashEnd={clearFlash}
                        view={listView}
                        onViewChange={setListView}
                      />
                    </section>
                    <PivotSummary
                      groups={selectedGroups.map((g) => ({
                        key: g.key,
                        label: g.label,
                        byDate: g.series.combined.byDate,
                      }))}
                      metricKeys={metricKeyList}
                      dates={canonicalDates}
                      emptyLabel="위 목록에서 비교할 캠페인·광고셋을 체크해주세요."
                      showUnit={showUnit}
                      view={pivotView}
                      toolbar={
                        <>
                          <SingleSelectDropdown<PivotView>
                            options={PIVOT_VIEW_OPTIONS}
                            value={pivotView}
                            onChange={setPivotView}
                            ariaLabel="보기 단위"
                          />

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
                        </>
                      }
                    />
                  </>
                )}
              </TabContent>
            )}
            {resultTab === 'periodTest' && (
              <TabContent>
                {loading ? (
                  <TabLoading />
                ) : (
                  <PeriodTestPanel
                    combinedInsight={combinedInsight}
                    dateStart={dateStart}
                    dateEnd={dateEnd}
                  />
                )}
              </TabContent>
            )}
            {resultTab === 'roas' && (
              <TabContent>
                {loading ? (
                  <TabLoading />
                ) : (
                  <RoasPanel
                    combinedInsight={combinedInsight}
                    offlineRevenue={offlineRevenueData}
                    onlineRevenue={onlineRevenueData}
                    repeatRevenue={repeatRevenueData}
                    adRevenue={adRevenueData}
                    attribution={attributionData}
                  />
                )}
              </TabContent>
            )}
            {resultTab === 'adPerformance' && (
              <TabContent>
                {loading ? (
                  <TabLoading />
                ) : (
                  <AdPerformancePanel
                    attribution={attributionData}
                    dateStart={dateStart}
                    dateEnd={dateEnd}
                  />
                )}
              </TabContent>
            )}
          </>
        )}
      </AutoHeight>

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
            combinedInsight={combinedInsight}
            offlineRevenue={offlineRevenueData}
            onlineRevenue={onlineRevenueData}
            repeatRevenue={repeatRevenueData}
            adRevenue={adRevenueData}
          />
        </Suspense>
      )}
    </div>
  )
}
