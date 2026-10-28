import { useMemo, useState } from 'react'
import { groupByCustomPeriod, type GroupedInsightSeries } from '../client'
import { METRIC_FIELDS, type MetricKey } from '../components/metric-fields'
import { CHANNELS, type ChannelKey } from '../components/channels'
import {
  boolean,
  oneOf,
  recordOf,
  setOf,
  usePersistentState,
} from '@/hooks/use-persistent-state'
import type { ISODate } from '../types'

type ResultTable = 'byDate' | 'byDayOfWeek' | 'byGroupedWeek' | 'byCustomPeriod'

/** 표 네 개에 같은 값을 넣은 객체. */
const tablesOf = <V>(value: V): Record<ResultTable, V> => ({
  byDate: value,
  byDayOfWeek: value,
  byGroupedWeek: value,
  byCustomPeriod: value,
})

const METRIC_KEYS = METRIC_FIELDS.map((f) => f.key)
const CHANNEL_FILTERS: readonly ('all' | ChannelKey)[] = [
  'all',
  ...CHANNELS.map((c) => c.key),
]

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
  // 아래 표 설정(대비 표시·지표 컬럼·채널 필터)은 전부 이 브라우저에 남아
  // 다음에 들어와도 그대로다.
  const [compareOn, setCompareOn] = usePersistentState(
    'cmip.resultPanel.compareOn',
    tablesOf(true),
    recordOf(tablesOf(true), boolean),
  )
  const toggleCompare = (key: ResultTable) =>
    setCompareOn((prev) => ({ ...prev, [key]: !prev[key] }))

  // 일별/요일별/주차별 표마다 지표 컬럼 표시 여부도 독립적으로 둔다(대비 표시와
  // 같은 이유). 저장은 "끈 지표"로 한다 — 나중에 지표가 새로 생기면 기본으로
  // 보이도록.
  const [hiddenMetrics, setHiddenMetrics] = usePersistentState<
    Record<ResultTable, ReadonlySet<MetricKey>>
  >(
    'cmip.resultPanel.hiddenMetrics',
    () => tablesOf(new Set<MetricKey>()),
    recordOf(tablesOf(new Set<MetricKey>()), setOf(METRIC_KEYS)),
    (value) =>
      Object.fromEntries(
        Object.entries(value).map(([table, keys]) => [table, [...keys]]),
      ),
  )
  const visibleMetrics = useMemo(() => {
    const visibleOf = (hidden: ReadonlySet<MetricKey>) =>
      new Set(METRIC_KEYS.filter((key) => !hidden.has(key)))
    return {
      byDate: visibleOf(hiddenMetrics.byDate),
      byDayOfWeek: visibleOf(hiddenMetrics.byDayOfWeek),
      byGroupedWeek: visibleOf(hiddenMetrics.byGroupedWeek),
      byCustomPeriod: visibleOf(hiddenMetrics.byCustomPeriod),
    }
  }, [hiddenMetrics])
  const toggleMetricVisible = (table: ResultTable, key: MetricKey) =>
    setHiddenMetrics((prev) => {
      const next = new Set(prev[table])
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return { ...prev, [table]: next }
    })

  // 일별/요일별/주차별 표마다 채널 필터("전체"=combined 또는 특정 채널)도
  // 독립적으로 둔다 — visibleMetrics와 같은 이유.
  const [channelFilter, setChannelFilter] = usePersistentState<
    Record<ResultTable, 'all' | ChannelKey>
  >(
    'cmip.resultPanel.channelFilter',
    tablesOf('all'),
    recordOf(tablesOf<'all' | ChannelKey>('all'), oneOf(CHANNEL_FILTERS)),
  )
  const setChannelFilterFor = (
    table: ResultTable,
    value: 'all' | ChannelKey,
  ) => setChannelFilter((prev) => ({ ...prev, [table]: value }))

  // "이전 일정 vs 지정 일정" 비교표의 구간 일수(N) — 기본값 7은 그냥 흔한
  // 단위(1주)일 뿐, 언제든 바꿀 수 있다. null은 입력칸을 지우는 중(아직 새
  // 값을 안 정함) — 이때는 구간을 하나도 못 만드니 groupByCustomPeriod에 0을
  // 넘겨 빈 배열을 받는다(그 함수의 size<1 가드에 그대로 걸림 — MetricsTable이
  // 빈 rows를 "데이터 없음"으로 보여준다).
  const [bucketSize, setBucketSize] = usePersistentState<number | null>(
    'cmip.resultPanel.bucketSize',
    7,
    (stored) =>
      stored === null ||
      (typeof stored === 'number' && Number.isInteger(stored) && stored > 0)
        ? (stored as number | null)
        : undefined,
  )
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
