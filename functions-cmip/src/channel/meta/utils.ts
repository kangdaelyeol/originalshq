import { DataSetInsight, DateRange, MetricsSummary } from './types'

function calcMetrics(
  impressions: number,
  clicks: number,
  spend: number,
  conversions: number,
  reach: number,
): MetricsSummary {
  return {
    impressions,
    clicks,
    spend,
    conversions,
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

export const getConversions = (row: DataSetInsight): number => {
  if (!row.results) return 0
  return row.results.reduce((sum, r) => {
    if (!r.values) return sum
    return sum + r.values.reduce((s, v) => s + (Number(v.value) || 0), 0)
  }, 0)
}

export const sumRows = (rows: DataSetInsight[]): MetricsSummary => {
  const impressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0)
  const clicks = rows.reduce(
    (s, r) => s + (Number(r.inline_link_clicks) || 0),
    0,
  )
  const spend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0)
  const conversions = rows.reduce((s, r) => s + getConversions(r), 0)
  const reach = rows.reduce((s, r) => s + (Number(r.reach) || 0), 0)

  return calcMetrics(impressions, clicks, spend, conversions, reach)
}

export const getFetchUrl = (
  dateStart: string,
  dateEnd: string,
  adsId: string,
  accessToken: string,
): string => {
  const params = new URLSearchParams({
    fields:
      'campaign_name,adset_name,impressions,inline_link_clicks,spend,reach,results,date_start,date_stop',
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
