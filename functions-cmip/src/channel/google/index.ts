import { OAuth2Client } from 'google-auth-library'
import { db } from '../../data'
import { AdGroupMetricsRow, AdsMetricsRow } from './types'

const GOOGLE_ADS_API_VERSION = 'v25' // 2026-09 기준 최신 버전

export function buildGoogleAdsAuthUrl(
  brandId: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): string {
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/adwords'],
    state: brandId,
  })
}

export async function checkGoogleAuthStatus(
  brandId: string,
): Promise<{ connected: boolean; updatedAt: string | null }> {
  const snap = await db.collection('brands').doc(brandId).get()
  const googleAds = snap.data()?.googleAds as
    | { refreshToken?: string; updatedAt?: string }
    | undefined
  return {
    connected: Boolean(googleAds?.refreshToken),
    updatedAt: googleAds?.updatedAt ?? null,
  }
}

export async function exchangeAndSaveGoogleTokens(
  code: string,
  brandId: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<void> {
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)

  const { tokens } = await oauth2Client.getToken(code)

  if (!tokens.refresh_token) {
    throw new Error('Refresh Token을 수령하지 못했습니다. 다시 승인해주세요.')
  }

  await db
    .collection('brands')
    .doc(brandId)
    .set(
      {
        googleAds: {
          refreshToken: tokens.refresh_token,
          updatedAt: new Date().toISOString(),
        },
      },
      { merge: true },
    )
}

async function getAccessToken(
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

export async function getGoogleInsight(
  brandId: string,
  dateStart: string,
  dateEnd: string,
  clientId: string,
  clientSecret: string,
  developerToken: string,
  customerId: string, // 타겟 Google Ads 고객 ID
  loginCustomerId?: string, // 상위 MCC 계정 ID
) {
  // 1. 해당 브랜드의 Refresh Token 조회
  const brandDoc = await db.collection('brands').doc(brandId).get()
  const refreshToken = brandDoc.data()?.googleAds?.refreshToken

  if (!refreshToken) {
    throw new Error(`브랜드(${brandId})의 Google Ads 연동 정보가 없습니다.`)
  }

  // 2. Access Token 갱신
  const accessToken = await getAccessToken(refreshToken, clientId, clientSecret)

  // 3. Customer ID 정제 및 URL/Header 구성
  const cleanCustomerId = customerId.trim().replace(/-/g, '')
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cleanCustomerId}/googleAds:searchStream`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  }

  if (loginCustomerId && loginCustomerId.trim()) {
    headers['login-customer-id'] = loginCustomerId.trim().replace(/-/g, '')
  }

  // 4. GAQL 쿼리 정의
  // 4-1. 일별 추이용 쿼리 (segments.date 포함)
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

  // 4-2. 기간 전체 Frequency(빈도) 조회용 쿼리 (segments.date 제외)
  const querySummary = `
    SELECT
      campaign.id,
      metrics.average_impression_frequency_per_user
    FROM campaign
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
  `

  // 5. Promise.all을 활용한 병렬 API 호출
  const [responseDaily, responseSummary] = await Promise.all([
    fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: queryDaily }),
    }),
    fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: querySummary }),
    }),
  ])

  if (!responseDaily.ok) {
    const errorText = await responseDaily.text()
    throw new Error(`Google Ads API 호출 실패 (Daily): ${errorText}`)
  }

  if (!responseSummary.ok) {
    const errorText = await responseSummary.text()
    throw new Error(
      `Google Ads API 호출 실패 (Summary/Frequency): ${errorText}`,
    )
  }

  // 6. Frequency(빈도) 데이터 파싱 및 Map 생성
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
      if (campaignId) {
        frequencyMap.set(campaignId, Number(rawFreq.toFixed(2)))
      }
    }
  }

  // 7. 일별 데이터 파싱 및 10개 핵심 지표 종합 가공
  const chunksDaily = (await responseDaily.json()) as Array<{
    results?: AdsMetricsRow[]
  }>
  const rows: unknown[] = []

  for (const chunk of chunksDaily) {
    if (!chunk.results) continue
    for (const r of chunk.results) {
      const campaignId = r.campaign?.id || ''
      const costMicros = Number(r.metrics?.costMicros || 0)
      const cost = Math.round(costMicros / 1000000) // Spend (원)
      const impressions = Number(r.metrics?.impressions || 0) // Impressions
      const clicks = Number(r.metrics?.clicks || 0) // Clicks
      const conversions = Number(r.metrics?.conversions || 0) // Conversions
      const conversionsValue = Number(r.metrics?.conversionsValue || 0) // 전환 가치(매출)

      // 파생 지표 계산 (0으로 나누기 방지)
      const ctr =
        impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0 // CTR (%)
      const cpc = clicks > 0 ? Math.round(cost / clicks) : 0 // CPC (원)
      const cpa = conversions > 0 ? Math.round(cost / conversions) : 0 // CPA (원)
      const cvr =
        clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0 // CVR (%)
      const cpm = impressions > 0 ? Math.round((cost / impressions) * 1000) : 0 // CPM (원)

      // Map에서 해당 캠페인의 전체 기간 Frequency 가져오기 (없으면 0)
      const frequency = frequencyMap.get(campaignId) || 0

      rows.push({
        date: r.segments?.date || '',
        campaignId,
        campaignName: r.campaign?.name || '',
        costMicros,
        cost, // Spend (기본 화폐 단위)
        impressions,
        clicks,
        conversions,
        conversionsValue,
        ctr,
        cpc,
        cpa,
        cvr,
        cpm,
        frequency, // 해당 선택 기간 전체의 캠페인 평균 Frequency
      })
    }
  }

  return { brandId, dateStart, dateEnd, totalCount: rows.length, rows }
}

export async function getGoogleAdGroupInsight(
  brandId: string,
  dateStart: string,
  dateEnd: string,
  clientId: string,
  clientSecret: string,
  developerToken: string,
  customerId: string, // 타겟 Google Ads 고객 ID
  loginCustomerId?: string, // 상위 MCC 계정 ID
) {
  // 1. Refresh Token 조회
  const brandDoc = await db.collection('brands').doc(brandId).get()
  const refreshToken = brandDoc.data()?.googleAds?.refreshToken

  if (!refreshToken) {
    throw new Error(`브랜드(${brandId})의 Google Ads 연동 정보가 없습니다.`)
  }

  // 2. Access Token 갱신
  const accessToken = await getAccessToken(refreshToken, clientId, clientSecret)

  // 3. Customer ID 정제 및 URL/Header 구성
  const cleanCustomerId = customerId.trim().replace(/-/g, '')
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cleanCustomerId}/googleAds:searchStream`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  }

  if (loginCustomerId && loginCustomerId.trim()) {
    headers['login-customer-id'] = loginCustomerId.trim().replace(/-/g, '')
  }

  // 4. GAQL 쿼리 정의 (ad_group 레벨에서는 frequency 지표가 지원되지 않음)
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

  // 5. Google Ads API 호출
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Google Ads AdGroup API 호출 실패: ${errorText}`)
  }

  // 6. 응답 데이터 파싱 및 지표 가공
  const chunks = (await response.json()) as Array<{
    results?: AdGroupMetricsRow[]
  }>
  const rows: unknown[] = []

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
      })
    }
  }

  return { brandId, dateStart, dateEnd, totalCount: rows.length, rows }
}
