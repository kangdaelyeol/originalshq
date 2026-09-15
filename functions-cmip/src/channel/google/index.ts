import { OAuth2Client } from 'google-auth-library'
import { db } from '../../data'

const GOOGLE_ADS_API_VERSION = 'v25' // 2026-09 기준 최신 버전

interface AdsMetricsRow {
  segments?: { date?: string }
  campaign?: { id?: string; name?: string }
  metrics?: {
    costMicros?: string | number
    impressions?: string | number
    clicks?: string | number
    conversions?: string | number
  }
}

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
  customerId: string, // target Ads id
  loginCustomerId?: string, // MCC id
) {
  const brandDoc = await db.collection('brands').doc(brandId).get()
  const refreshToken = brandDoc.data()?.googleAds?.refreshToken

  if (!refreshToken) {
    throw new Error(`브랜드(${brandId})의 Google Ads 연동 정보가 없습니다.`)
  }

  const accessToken = await getAccessToken(refreshToken, clientId, clientSecret)

  const query = `
    SELECT
      segments.date,
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
    ORDER BY segments.date DESC
  `

  const cleanCustomerId = customerId.replace(/-/g, '')
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cleanCustomerId}/googleAds:searchStream`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  }

  if (loginCustomerId && loginCustomerId.trim()) {
    headers['login-customer-id'] = loginCustomerId.trim().replace(/-/g, '')
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Google Ads API 호출 실패: ${errorText}`)
  }

  const chunks = (await response.json()) as Array<{ results?: AdsMetricsRow[] }>
  const rows: unknown[] = []

  for (const chunk of chunks) {
    if (!chunk.results) continue
    for (const r of chunk.results) {
      const costMicros = Number(r.metrics?.costMicros || 0)
      rows.push({
        date: r.segments?.date || '',
        campaignId: r.campaign?.id || '',
        campaignName: r.campaign?.name || '',
        costMicros,
        cost: Math.round(costMicros / 1000000),
        impressions: Number(r.metrics?.impressions || 0),
        clicks: Number(r.metrics?.clicks || 0),
        conversions: Number(r.metrics?.conversions || 0),
      })
    }
  }

  return { brandId, dateStart, dateEnd, totalCount: rows.length, rows }
}
