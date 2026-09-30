// Google Ads API 호출 — 라이브 조회(index.ts의 getGoogleInsight/
// getGoogleAdGroupInsight)와 Firestore 배치 동기화(syncGoogleCampaignInsightRows/
// syncGoogleAdGroupInsightRows) 둘 다 이 파일의 두 fetch 함수를 공유한다
// (meta/client.ts와 같은 이유 — GAQL 호출/토큰갱신 로직을 한 곳에서만
// 관리해서 라이브/배치가 서로 다른 결과를 내는 일이 없게).
import {
  AdGroupMetricsRow,
  AdsMetricsRow,
  GoogleAdGroupInsightRow,
  GoogleCampaignInsightRow,
} from './types'

const GOOGLE_ADS_API_VERSION = 'v25' // 2026-09 기준 최신 버전

export async function getAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const data = (await res.json()) as { access_token?: string; error?: string }
  if (!res.ok || !data.access_token) {
    throw new Error(`Access Token 발급 실패: ${data.error || res.statusText}`)
  }

  return data.access_token
}

function buildHeaders(
  accessToken: string,
  developerToken: string,
  loginCustomerId?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  }
  if (loginCustomerId && loginCustomerId.trim()) {
    headers['login-customer-id'] = loginCustomerId.trim().replace(/-/g, '')
  }
  return headers
}

/** 캠페인 단위 행 — GAQL `FROM campaign` 쿼리(일별 지표) +
 * `FROM campaign`(frequency 전용, segments.date 없이 조회 기간 전체 평균 하나)
 * 두 쿼리를 병렬 호출해 합친다(예전 getGoogleInsight 본문 그대로, 반환
 * 모양만 `{brandId,...}` 래핑 없이 행 배열만). row마다 customerId를 붙여
 * 돌려준다(Firestore 문서 ID/upsert에 필요 — firestore.ts 참고). */
export async function fetchGoogleCampaignInsightRows(
  dateStart: string,
  dateEnd: string,
  clientId: string,
  clientSecret: string,
  developerToken: string,
  customerId: string,
  refreshToken: string,
  loginCustomerId?: string,
): Promise<(GoogleCampaignInsightRow & { customerId: string })[]> {
  const accessToken = await getAccessToken(refreshToken, clientId, clientSecret)
  const cleanCustomerId = customerId.trim().replace(/-/g, '')
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cleanCustomerId}/googleAds:searchStream`
  const headers = buildHeaders(accessToken, developerToken, loginCustomerId)

  const queryDaily = `
    SELECT
      segments.date,
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
    ORDER BY segments.date DESC
  `

  const querySummary = `
    SELECT
      campaign.id,
      metrics.average_impression_frequency_per_user
    FROM campaign
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
  `

  const [responseDaily, responseSummary] = await Promise.all([
    fetch(url, { method: 'POST', headers, body: JSON.stringify({ query: queryDaily }) }),
    fetch(url, { method: 'POST', headers, body: JSON.stringify({ query: querySummary }) }),
  ])

  if (!responseDaily.ok) {
    throw new Error(`Google Ads API 호출 실패 (Daily): ${await responseDaily.text()}`)
  }
  if (!responseSummary.ok) {
    throw new Error(
      `Google Ads API 호출 실패 (Summary/Frequency): ${await responseSummary.text()}`,
    )
  }

  const chunksSummary = (await responseSummary.json()) as Array<{
    results?: Array<{
      campaign?: { id?: string }
      metrics?: { averageImpressionFrequencyPerUser?: string | number }
    }>
  }>

  const frequencyMap = new Map<string, number>()
  for (const chunk of chunksSummary) {
    if (!chunk.results) continue
    for (const r of chunk.results) {
      const campaignId = r.campaign?.id
      const rawFreq = Number(r.metrics?.averageImpressionFrequencyPerUser || 0)
      if (campaignId) frequencyMap.set(campaignId, Number(rawFreq.toFixed(2)))
    }
  }

  const chunksDaily = (await responseDaily.json()) as Array<{
    results?: AdsMetricsRow[]
  }>
  const rows: (GoogleCampaignInsightRow & { customerId: string })[] = []

  for (const chunk of chunksDaily) {
    if (!chunk.results) continue
    for (const r of chunk.results) {
      const campaignId = r.campaign?.id || ''
      const costMicros = Number(r.metrics?.costMicros || 0)
      const cost = Math.round(costMicros / 1000000)
      const impressions = Number(r.metrics?.impressions || 0)
      const clicks = Number(r.metrics?.clicks || 0)
      const conversions = Number(r.metrics?.conversions || 0)
      const conversionsValue = Number(r.metrics?.conversionsValue || 0)

      const ctr =
        impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0
      const cpc = clicks > 0 ? Math.round(cost / clicks) : 0
      const cpa = conversions > 0 ? Math.round(cost / conversions) : 0
      const cvr =
        clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0
      const cpm = impressions > 0 ? Math.round((cost / impressions) * 1000) : 0
      const frequency = frequencyMap.get(campaignId) || 0

      rows.push({
        date: r.segments?.date || '',
        campaignId,
        campaignName: r.campaign?.name || '',
        costMicros,
        cost,
        impressions,
        clicks,
        conversions,
        conversionsValue,
        ctr,
        cpc,
        cpa,
        cvr,
        cpm,
        frequency,
        customerId: cleanCustomerId,
      })
    }
  }

  return rows
}

/** adGroup(adset) 단위 행 — GAQL `FROM ad_group`. Google 정책상 이 레벨은
 * frequency 지표를 지원하지 않아 항상 0(예전 getGoogleAdGroupInsight
 * 본문과 동일). */
export async function fetchGoogleAdGroupInsightRows(
  dateStart: string,
  dateEnd: string,
  clientId: string,
  clientSecret: string,
  developerToken: string,
  customerId: string,
  refreshToken: string,
  loginCustomerId?: string,
): Promise<(GoogleAdGroupInsightRow & { customerId: string })[]> {
  const accessToken = await getAccessToken(refreshToken, clientId, clientSecret)
  const cleanCustomerId = customerId.trim().replace(/-/g, '')
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cleanCustomerId}/googleAds:searchStream`
  const headers = buildHeaders(accessToken, developerToken, loginCustomerId)

  const query = `
    SELECT
      segments.date,
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM ad_group
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
    ORDER BY segments.date DESC
  `

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error(`Google Ads AdGroup API 호출 실패: ${await response.text()}`)
  }

  const chunks = (await response.json()) as Array<{ results?: AdGroupMetricsRow[] }>
  const rows: (GoogleAdGroupInsightRow & { customerId: string })[] = []

  for (const chunk of chunks) {
    if (!chunk.results) continue
    for (const r of chunk.results) {
      const campaignId = r.campaign?.id || ''
      const campaignName = r.campaign?.name || ''
      const adGroupId = r.adGroup?.id || ''

      const costMicros = Number(r.metrics?.costMicros || 0)
      const cost = Math.round(costMicros / 1000000)
      const impressions = Number(r.metrics?.impressions || 0)
      const clicks = Number(r.metrics?.clicks || 0)
      const conversions = Number(r.metrics?.conversions || 0)
      const conversionsValue = Number(r.metrics?.conversionsValue || 0)

      const ctr =
        impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0
      const cpc = clicks > 0 ? Math.round(cost / clicks) : 0
      const cpa = conversions > 0 ? Math.round(cost / conversions) : 0
      const cvr =
        clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0
      const cpm = impressions > 0 ? Math.round((cost / impressions) * 1000) : 0

      rows.push({
        date: r.segments?.date || '',
        campaignId,
        campaignName,
        adGroupId,
        adGroupName: r.adGroup?.name || '',
        costMicros,
        cost,
        impressions,
        clicks,
        conversions,
        conversionsValue,
        ctr,
        cpc,
        cpa,
        cvr,
        cpm,
        frequency: 0,
        customerId: cleanCustomerId,
      })
    }
  }

  return rows
}
