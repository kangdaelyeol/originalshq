import { useMemo, useState } from 'react'
import { groupByCustomPeriod, type GroupedInsightSeries } from '../client'
import { METRIC_FIELDS, type MetricKey } from '../components/metric-fields'
import type { ChannelKey } from '../components/channels'
import type { ISODate } from '../types'

interface ResultSeries {
  combined: GroupedInsightSeries
  meta: GroupedInsightSeries
  google: GroupedInsightSeries
  naver: GroupedInsightSeries
}

/** "전체 요약" 탭(ResultPanel) 전용 상태 — Summary 카드의 채널별 펼침, 일별/
 * 요일별/주차별/지정기간 표마다 독립적인 "대비 표시"·지표 컬럼·채널 필터,
 * 그리고 "이전 일정 vs 지정 일정" 표의 구간 일수와 그 결과 행(customPeriodRows)을
 * 다룬다. 표마다 독립 상태를 두는 이유(MetricsTable이 재조회 시 unmount/remount
 * 되어 자체 상태를 두면 초기화되어 버림)는 기존 컴포넌트 주석 그대로다. */
export const useResultPanelViewModel = (
  series: ResultSeries,
  dateStart: ISODate,
  dateEnd: ISODate,
) => {
  const [showChannelTotal, setShowChannelTotal] = useState(false)

  // 일별/요일별/주차별 표마다 "대비 표시" 토글을 독립적으로 둔다 — 표 하나만
  // 켜서 보고 싶은 경우가 많아서다(예: 일별은 대비로, 주차별은 그냥 값만).
  const [compareOn, setCompareOn] = useState({
    byDate: true,
    byDayOfWeek: true,
    byGroupedWeek: true,
    byCustomPeriod: true,
  })
  const toggleCompare = (key: keyof typeof compareOn) =>
    setCompareOn((prev) => ({ ...prev, [key]: !prev[key] }))

  // 일별/요일별/주차별 표마다 지표 컬럼 표시 여부도 독립적으로 둔다(대비 표시와
  // 같은 이유).
  const allMetricKeys = useMemo(
    () => new Set(METRIC_FIELDS.map((f) => f.key)),
    [],
  )
  const [visibleMetrics, setVisibleMetrics] = useState({
    byDate: allMetricKeys,
    byDayOfWeek: allMetricKeys,
    byGroupedWeek: allMetricKeys,
    byCustomPeriod: allMetricKeys,
  })
  const toggleMetricVisible = (
    table: keyof typeof visibleMetrics,
    key: MetricKey,
  ) =>
    setVisibleMetrics((prev) => {
      const next = new Set(prev[table])
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return { ...prev, [table]: next }
    })

  // 일별/요일별/주차별 표마다 채널 필터("전체"=combined 또는 특정 채널)도
  // 독립적으로 둔다 — visibleMetrics와 같은 이유.
  const [channelFilter, setChannelFilter] = useState<{
    byDate: 'all' | ChannelKey
    byDayOfWeek: 'all' | ChannelKey
    byGroupedWeek: 'all' | ChannelKey
    byCustomPeriod: 'all' | ChannelKey
  }>({
    byDate: 'all',
    byDayOfWeek: 'all',
    byGroupedWeek: 'all',
    byCustomPeriod: 'all',
  })
  const setChannelFilterFor = (
    table: keyof typeof channelFilter,
    value: 'all' | ChannelKey,
  ) => setChannelFilter((prev) => ({ ...prev, [table]: value }))

  // "이전 일정 vs 지정 일정" 비교표의 구간 일수(N) — 기본값 7은 그냥 흔한
  // 단위(1주)일 뿐, 언제든 바꿀 수 있다. null은 입력칸을 지우는 중(아직 새
  // 값을 안 정함) — 이때는 구간을 하나도 못 만드니 groupByCustomPeriod에 0을
  // 넘겨 빈 배열을 받는다(그 함수의 size<1 가드에 그대로 걸림 — MetricsTable이
  // 빈 rows를 "데이터 없음"으로 보여준다).
  const [bucketSize, setBucketSize] = useState<number | null>(7)
  const customPeriodSource =
    channelFilter.byCustomPeriod === 'all'
      ? series.combined.byDate
      : series[channelFilter.byCustomPeriod].byDate
  const customPeriodRows = useMemo(
    () =>
      groupByCustomPeriod(
        customPeriodSource,
        dateStart,
        dateEnd,
        bucketSize ?? 0,
      ),
    [customPeriodSource, dateStart, dateEnd, bucketSize],
  )

  return {
    // 진행 상태
    showChannelTotal,
    compareOn,
    visibleMetrics,
    channelFilter,
    bucketSize,
    customPeriodRows,
    // 액션
    setShowChannelTotal,
    toggleCompare,
    toggleMetricVisible,
    setChannelFilterFor,
    setBucketSize,
  }
}
