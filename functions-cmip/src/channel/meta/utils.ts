import { DataSetInsight, DateRange, Indicator, MetricsSummary } from './types'

function calcMetrics(
  impressions: number,
  clicks: number,
  spend: number,
  conversions: number,
  revenue: number,
  reach: number,
): MetricsSummary {
  return {
    impressions,
    clicks,
    spend,
    conversions,
    revenue,
    ctr: impressions > 0 ? round2((clicks / impressions) * 100) : 0,
    cpc: clicks > 0 ? round2(spend / clicks) : 0,
    cpa: conversions > 0 ? round2(spend / conversions) : 0,
    cvr: clicks > 0 ? round2((conversions / clicks) * 100) : 0,
    cpm: impressions > 0 ? round2((spend / impressions) * 1000) : 0,
    // reach는 중복 제거된 사용자 수라 날짜·adset row를 그대로 합산하면 겹치는
    // 사용자가 중복 집계된다. 다른 지표와 동일하게 row 합산 방식을 따르므로,
    // 이 frequency는 근사치로 봐야 한다(기간이 넓을수록 실제보다 낮게 나올 수 있음).
    frequency: reach > 0 ? round2(impressions / reach) : 0,
  }
}

export const round2 = (n: number): number => Math.round(n * 100) / 100

/** Indicator[] 배열(results/action_values 공용 모양) 합산 — 두 필드가 "건수
 * vs 금액"만 다르고 구조는 같아서 같은 함수를 공유한다. */
function sumIndicatorValues(indicators?: Indicator[]): number {
  if (!indicators) return 0
  return indicators.reduce((sum, r) => {
    if (!r.values) return sum
    return sum + r.values.reduce((s, v) => s + (Number(v.value) || 0), 0)
  }, 0)
}

/** 전환으로 치지 않는 결과 — 트래픽·참여·도달을 목표로 한 광고셋의 '결과'(랜딩
 * 페이지 조회·링크 클릭·콘텐츠 조회·참여·동영상 조회·도달·노출). results에는
 * 광고셋마다 고른 목표의 건수가 들어와서, 그대로 더하면 랜딩 조회 1회가 전환
 * 1건이 됐다(기획전 캠페인이 전환 856건·CPA 309원으로 보였다). Meta 결과
 * 지표(indicator) 이름의 일부로 찾는다 — 'actions:' 접두어와 상관없이. */
const NON_CONVERSION_RESULT =
  /landing_page_view|link_click|view_content|engagement|video|thruplay|reach|impressions|ad_recall/

/** 광고셋 '결과'의 합 — 목표가 무엇이든 그 목표의 건수. 광고 테스트처럼 같은
 * 목표끼리 단가를 비교할 때 쓴다(랜딩 조회 목표면 랜딩 조회 단가). */
export const getResults = (row: DataSetInsight): number =>
  sumIndicatorValues(row.results)

/** 전환 — '결과' 중 트래픽·참여·도달류(NON_CONVERSION_RESULT)를 뺀 것. 분석
 * 화면의 Conversions·CPA·CVR가 쓴다. */
export const getConversions = (row: DataSetInsight): number =>
  sumIndicatorValues(
    row.results?.filter((r) => !NON_CONVERSION_RESULT.test(r.indicator)),
  )

/** 전환매출액 — action_values 합계. results와 같은 방식(전부 합산)으로,
 * 특정 action_type만 골라내지 않는다 — 필드 자체를 요청한 시점에 이미 그
 * 캠페인/adset의 결과와 관련된 값만 내려온다고 보고 기존 getConversions와
 * 동일한 철학을 따른다. */
export const getRevenue = (row: DataSetInsight): number =>
  sumIndicatorValues(row.action_values)

/** 결과 유형 — results 배열의 첫 indicator를 대표값으로 쓴다(캠페인은 보통
 * 하나의 결과 목표로 운영되므로 행마다 다를 일이 거의 없다). Meta 응답의
 * indicator는 보통 "actions:omni_purchase"처럼 "actions:" 접두어가 붙어
 * 오는데, 읽기 편하도록 접두어만 벗겨낸다. */
export const getResultType = (row: DataSetInsight): string | null => {
  const indicator = row.results?.[0]?.indicator
  if (!indicator) return null
  return indicator.startsWith('actions:') ? indicator.slice(8) : indicator
}

/** count — 행 하나의 전환 수(기본 getConversions, 광고 테스트는 getResults). */
export const sumRows = (
  rows: DataSetInsight[],
  count: (row: DataSetInsight) => number = getConversions,
): MetricsSummary => {
  const impressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0)
  const clicks = rows.reduce(
    (s, r) => s + (Number(r.inline_link_clicks) || 0),
    0,
  )
  const spend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0)
  const conversions = rows.reduce((s, r) => s + count(r), 0)
  const revenue = rows.reduce((s, r) => s + getRevenue(r), 0)
  const reach = rows.reduce((s, r) => s + (Number(r.reach) || 0), 0)

  return calcMetrics(impressions, clicks, spend, conversions, revenue, reach)
}

export const getFetchUrl = (
  dateStart: string,
  dateEnd: string,
  adsId: string,
  accessToken: string,
): string => {
  const params = new URLSearchParams({
    // campaign_id,adset_id — metaInsightDaily(Firestore 배치 동기화) 문서
    // ID로 쓰려고 추가했다(DataSetInsight.campaign_id/adset_id 주석 참고).
    fields:
      'campaign_id,campaign_name,adset_id,adset_name,impressions,inline_link_clicks,spend,reach,results,action_values,date_start,date_stop',
    time_increment: '1',
    level: 'adset',
    access_token: accessToken,
    time_range: JSON.stringify({
      since: dateStart,
      until: dateEnd,
    }),
    limit: '5000',
  })
  return `https://graph.facebook.com/v25.0/act_${adsId}/insights?${params.toString()}`
}

export const getSearchDate = (startDate: string, endDate: string): number => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1)
}

export const getNextDate = (date: string, count: number = 1): string => {
  return new Date(new Date(date).getTime() + 1000 * 3600 * 24 * count)
    .toISOString()
    .slice(0, 10)
}

export const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export const formatMD = (dateStr: string): string => {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export const buildWeekRanges = (
  startDate: string,
  endDate: string,
): DateRange[] => {
  const searchDate = getSearchDate(startDate, endDate)
  const remDate = searchDate % 7

  const ranges: DateRange[] = []
  let cursor = startDate

  if (remDate > 0) {
    const rangeEnd = addDays(cursor, remDate - 1)
    ranges.push({ start: cursor, end: rangeEnd })
    cursor = addDays(cursor, remDate)
  }

  while (cursor <= endDate) {
    const rangeEnd = addDays(cursor, 6)
    ranges.push({ start: cursor, end: rangeEnd })
    cursor = addDays(cursor, 7)
  }

  return ranges
}
