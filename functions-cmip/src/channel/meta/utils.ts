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

export const getConversions = (row: DataSetInsight): number =>
  sumIndicatorValues(row.results)

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

export const sumRows = (rows: DataSetInsight[]): MetricsSummary => {
  const impressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0)
  const clicks = rows.reduce(
    (s, r) => s + (Number(r.inline_link_clicks) || 0),
    0,
  )
  const spend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0)
  const conversions = rows.reduce((s, r) => s + getConversions(r), 0)
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
    fields:
      'campaign_name,adset_name,impressions,inline_link_clicks,spend,reach,results,action_values,date_start,date_stop',
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
