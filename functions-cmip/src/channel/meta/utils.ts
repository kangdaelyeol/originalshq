import { DataSetInsight, MetricsSummary } from './types'

function calcMetrics(
  impressions: number,
  clicks: number,
  spend: number,
  conversions: number,
): MetricsSummary {
  return {
    impressions,
    clicks,
    spend,
    conversions,
    ctr: impressions > 0 ? round2((clicks / impressions) * 100) : 0,
    cpc: clicks > 0 ? round2(spend / clicks) : 0,
    cpa: conversions > 0 ? round2(spend / conversions) : 0,
  }
}

export const round2 = (n: number): number => Math.round(n * 100) / 100

export const getConversions = (row: DataSetInsight): number => {
  if (!row.results) return 0
  return row.results.reduce((sum, r) => {
    if (!r.values) return sum
    return sum + r.values.reduce((s, v) => s + Number(v.value), 0)
  }, 0)
}

export const sumRows = (rows: DataSetInsight[]): MetricsSummary => {
  const impressions = rows.reduce((s, r) => s + Number(r.impressions), 0)
  const clicks = rows.reduce((s, r) => s + Number(r.inline_link_clicks), 0)
  const spend = rows.reduce((s, r) => s + Number(r.spend), 0)
  const conversions = rows.reduce((s, r) => s + getConversions(r), 0)

  return calcMetrics(impressions, clicks, spend, conversions)
}

export const getFetchUrl = (
  dateStart: string,
  dateEnd: string,
  adsId: string,
  accessToken: string,
): string => {
  const params = new URLSearchParams({
    item_increament: '1',
    level: 'adset',
    access_token: accessToken,
    time_range: JSON.stringify({
      since: dateStart,
      until: dateEnd,
    }),
  })
  return `https://graph.facebook.com/v25.0/act_${adsId}/insights?${params.toString()}`
}

export const getSearchDate = (startDate: string, endDate: string): number => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1)
}

export const getNextDate = (date: string): string => {
  return new Date(new Date(date).getTime() + 1000 * 3600 * 24)
    .toISOString()
    .slice(0, 10)
}
