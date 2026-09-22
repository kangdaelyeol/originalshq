import { useState } from 'react'
import {
  emptyMetrics,
  emptySeries,
  type ChannelSplitSeries,
  type CombinedInsight,
} from '../client'
import type { MetricKey } from '../components/metric-fields'
import { CHANNELS, channelsOf } from '../components/channels'
import type { ExportCampaign } from '../components/excel-writer'
import type {
  ChartGroup,
  MetricMode,
  SeriesKind,
} from './use-channel-insight-chart-modal-view-model'
import type { ISODate } from '../types'

export type ResultTab = 'total' | 'campaign' | 'adset' | 'periodTest'

/** 캠페인/adset 탭의 "보기 단위" — 교차표(PivotSummary)의 행 축(첫 컬럼)을
 * 날짜/요일/주차 중 무엇으로 묶을지. */
export type PivotView = 'byDate' | 'byDayOfWeek' | 'byGroupedWeek'

/** ChannelInsight 페이지 전용 상태 — useChannelInsightViewModel(날짜 범위/조회)과는
 * 별개로, 탭 전환·캠페인/adset 다중 선택·지표 선택(표+그래프 공유)·그래프
 * 모달/엑셀 모달 열림 여부, 그리고 이들로부터 파생되는 값(선택된 캠페인,
 * 그래프 모달 후보 그룹, 엑셀로 넘길 데이터 등)까지 계산해서 돌려준다. */
export const useChannelInsightPageViewModel = (
  combinedInsight: CombinedInsight | null,
  dateStart: ISODate,
  dateEnd: ISODate,
) => {
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
  // 캠페인/adset 교차표의 지표 선택 — 그래프 모달의 지표 선택(꺾은선/막대/끄기)과
  // 같은 상태를 공유한다. 표는 "켜져 있는지"만 보고(line/bar 구분 없이), 그래프는
  // 그 종류까지 쓴다 — 어느 쪽에서 지표를 바꾸든 서로 바로 반영된다.
  const [metricMode, setMetricMode] = useState<
    ReadonlyMap<MetricKey, SeriesKind>
  >(() => new Map([['impressions', 'line']]))
  const selectedMetricKeys: ReadonlySet<MetricKey> = new Set(metricMode.keys())
  // 캠페인/adset 교차표의 지표 헤더에 단위(원/%/회 등)를 같이 보여줄지.
  const [showUnit, setShowUnit] = useState(false)
  // 캠페인/adset 교차표의 행 축(날짜/요일/주차) — 기본은 날짜별.
  const [pivotView, setPivotView] = useState<PivotView>('byDate')

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
  // 표의 체크박스는 켬/끔만 다룬다 — 새로 켤 때는 그래프 쪽 기본값과 맞춰
  // "꺾은선"으로 시작한다.
  const toggleMetric = (key: MetricKey) => {
    setMetricMode((prev) => {
      const next = new Map(prev)
      if (next.has(key)) next.delete(key)
      else next.set(key, 'line')
      return next
    })
  }
  // 그래프 쪽은 종류(꺾은선/막대/끄기)까지 다룬다.
  const setMetricModeFor = (key: MetricKey, mode: MetricMode) => {
    setMetricMode((prev) => {
      const next = new Map(prev)
      if (mode === 'off') next.delete(key)
      else next.set(key, mode)
      return next
    })
  }
  const clearAllMetrics = () => setMetricMode(new Map())

  const periodLabel = `${dateStart} ~ ${dateEnd}`
  const canonicalDates =
    combinedInsight?.series.combined.byDate.map((d) => d.date) ?? []
  const metricKeyList = [...selectedMetricKeys]

  // 그래프 모달이 고를 수 있는 전체 후보 — 표에서 체크된 것만 보여주면 표에서
  // 뺀 캠페인/adset은 그래프에서 아예 볼 수 없게 되므로, 항상 그 탭의 전체
  // 목록을 넘긴다(전체 요약 탭은 계정 전체 하나뿐). 어떤 걸 볼지는 모달 안의
  // 그룹 드롭다운이 따로 고른다. CombinedCampaign/CombinedAdset이 이미
  // ChannelSplitSeries 모양(combined/meta/google)을 그대로 갖고 있어 series로
  // 바로 넘길 수 있다.
  // periodTest(매체별 테스트) 탭은 그래프/엑셀 대상이 아니라 빈 배열 —
  // "그래프로 보기" 버튼이 chartGroups.length===0로 자연히 비활성화된다.
  const chartGroups: ChartGroup[] = !combinedInsight
    ? []
    : resultTab === 'total'
      ? [{ key: 'total', label: '전체 요약', series: combinedInsight.series }]
      : resultTab === 'campaign'
        ? campaigns.map((c) => ({
            key: c.campaignName,
            label: c.campaignName,
            series: c,
          }))
        : resultTab === 'adset'
          ? adsets.map((a) => ({
              key: a.adsetName,
              label: a.adsetName,
              series: a,
            }))
          : []

  // 모달을 처음 열 때 기본으로 켜둘 그룹 — 표에서 이미 체크해둔 것들과 같은
  // 화면으로 시작한다. 그 뒤로는 그래프 안에서 자유롭게 더 고를 수 있다.
  const chartDefaultActiveGroupKeys: readonly string[] =
    resultTab === 'total'
      ? ['total']
      : resultTab === 'campaign'
        ? [...selectedCampaignNames]
        : [...selectedAdsetNames]

  // ------------------------------------------------------------------ 엑셀 다운로드
  const [excelExportOpen, setExcelExportOpen] = useState(false)

  const channelLabelsOf = (entity: ChannelSplitSeries): string =>
    channelsOf(entity)
      .map((k) => CHANNELS.find((c) => c.key === k)?.label ?? k)
      .join(', ')

  // 채널 필터 등 화면 토글 상태와 무관하게 항상 전체 데이터를 담는다(엑셀에서
  // 뭘 뺄지는 모달의 지표/시트 선택만으로 고른다). combined.byDate/byDayOfWeek/
  // byGroupedWeek는 이미 각 캠페인/adset(ChannelSplitSeries 모양)이 갖고 있어
  // 그대로 넘기고, 채널 라벨 문자열만 미리 계산해서 얹는다.
  const excelTotal = combinedInsight?.total ?? {
    combined: emptyMetrics(),
    meta: emptyMetrics(),
    google: emptyMetrics(),
    naver: emptyMetrics(),
  }
  const excelSeries: ChannelSplitSeries = combinedInsight?.series ?? {
    combined: emptySeries(),
    meta: emptySeries(),
    google: emptySeries(),
    naver: emptySeries(),
  }
  const excelCampaigns: ExportCampaign[] = campaigns.map((c) => ({
    ...c,
    channelLabel: channelLabelsOf(c),
    adsets: c.adsets.map((a) => ({ ...a, channelLabel: channelLabelsOf(a) })),
  }))

  return {
    // 진행 상태
    chartOpen,
    resultTab,
    selectedCampaignName,
    selectedCampaignNames,
    selectedAdsetNames,
    metricMode,
    selectedMetricKeys,
    showUnit,
    pivotView,
    campaigns,
    selectedCampaign,
    adsets,
    periodLabel,
    canonicalDates,
    metricKeyList,
    chartGroups,
    chartDefaultActiveGroupKeys,
    excelExportOpen,
    excelTotal,
    excelSeries,
    excelCampaigns,
    // 액션
    setChartOpen,
    setResultTab,
    setSelectedCampaignName,
    toggleCampaignMulti,
    toggleAdsetMulti,
    toggleMetric,
    setMetricModeFor,
    clearAllMetrics,
    setShowUnit,
    setPivotView,
    setExcelExportOpen,
  }
}
