// import { GoogleAuth } from 'google-auth-library'
// import { defineSecret } from 'firebase-functions/params'
// import { onRequest } from 'firebase-functions/v2/https'
// import { logger } from 'firebase-functions'

import { OAuth2Client } from 'google-auth-library'
import { db } from '../../data'

// const adsSaKey = defineSecret('ADS_SA_KEY_JSON') // 서비스 계정 JSON 키 전체
// const adsDevToken = defineSecret('ADS_DEVELOPER_TOKEN') // Cloud 콘솔에서 확인한 값

// const API_VERSION = 'v25'
// const CUSTOMER_ID = '1234567890'
// const LOGIN_CUSTOMER_ID = '' // MCC 계정이면 채우기

// async function getAccessToken(): Promise<string> {
//   const credentials = JSON.parse(adsSaKey.value())
//   const auth = new GoogleAuth({
//     credentials,
//     scopes: ['https://www.googleapis.com/auth/adwords'],
//   })
//   const client = await auth.getClient()
//   const { token } = await client.getAccessToken()
//   if (!token) throw new Error('access token 발급 실패')
//   return token
// }

// async function fetchAdGroupPerformance() {
//   const accessToken = await getAccessToken()
//   const query = `
//     SELECT
//       campaign.id, campaign.name,
//       ad_group.id, ad_group.name,
//       metrics.impressions, metrics.clicks,
//       metrics.cost_micros, metrics.conversions
//     FROM ad_group
//     WHERE segments.date DURING LAST_7_DAYS
//   `
//   const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}/googleAds:search`
//   const headers: Record<string, string> = {
//     Authorization: `Bearer ${accessToken}`,
//     'developer-token': adsDevToken.value(),
//     'Content-Type': 'application/json',
//   }
//   if (LOGIN_CUSTOMER_ID) headers['login-customer-id'] = LOGIN_CUSTOMER_ID

//   const rows: unknown[] = []
//   let pageToken: string | undefined
//   do {
//     const res = await fetch(url, {
//       method: 'POST',
//       headers,
//       body: JSON.stringify({ query, pageSize: 1000, pageToken }),
//     })
//     if (!res.ok) throw new Error(`Ads API 오류: ${await res.text()}`)
//     const data = await res.json()
//     rows.push(...(data.results ?? []))
//     pageToken = data.nextPageToken
//   } while (pageToken)

//   return rows
// }

// // ────────────────────────────────
// // getAdsInsight
// // ────────────────────────────────
// export const getAdsInsight = onRequest(
//   { secrets: [adsSaKey, adsDevToken] },
//   async (request, response) => {
//     try {
//       const rows = await fetchAdGroupPerformance()
//       response.status(200).send({ count: rows.length, rows })
//     } catch (error) {
//       logger.error('Ads 인사이트 조회 실패:', error)
//       response.status(500).send({ error: '서버 오류' })
//     }
//   },
// )

// v16은 sunset(폐기)되어 이 경로 자체가 404를 반환한다 — Google Ads API는
// 버전을 자주(연 3~4회) 폐기하니, 이 값이 다시 404가 나면 release notes에서
// 현재 활성 버전으로 갱신할 것: https://developers.google.com/google-ads/api/docs/release-notes
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

/**
 * Google Ads OAuth 동의 화면 URL 생성 — 테스트 UI의 "연동 시작" 버튼이 이 URL을
 * 새 탭으로 열면, 사용자가 동의한 뒤 oauthCallback으로 리다이렉트되어 토큰이
 * 저장된다. access_type=offline + prompt=consent가 빠지면 이미 한 번 동의한
 * 계정으로 재동의할 때 refresh_token이 응답에서 생략될 수 있어 반드시 넣는다.
 */
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

/** 이 브랜드에 Google Ads refreshToken이 저장돼 있는지만 확인 — 테스트 UI가
 * "연동 시작"과 "조회" 중 무엇을 먼저 보여줄지 판단하는 용도. */
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

  // 1. Authorization Code를 Access Token 및 Refresh Token으로 교환
  const { tokens } = await oauth2Client.getToken(code)

  if (!tokens.refresh_token) {
    // 필수: access_type=offline 및 prompt=consent 설정 없이 재인증할 경우 refresh_token이 안 들어올 수 있음
    throw new Error('Refresh Token을 수령하지 못했습니다. 다시 승인해주세요.')
  }

  // 2. 해당 브랜드(brandId) 문서에 구글 토큰 저장 (Security Rules 및 관리용)
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

/**
 * Firestore에 저장된 Refresh Token으로 Access Token 발급
 */
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

/**
 * Google Ads API 인사이트 데이터 추출
 */
export async function getGoogleInsight(
  brandId: string,
  dateStart: string,
  dateEnd: string,
  clientId: string,
  clientSecret: string,
  developerToken: string,
  customerId: string, // 타겟 Google Ads 고객 ID (숫자 10자리, 하이픈 제외)
) {
  // 1. 해당 브랜드의 Refresh Token 조회
  const brandDoc = await db.collection('brands').doc(brandId).get()
  const refreshToken = brandDoc.data()?.googleAds?.refreshToken

  if (!refreshToken) {
    throw new Error(`브랜드(${brandId})의 Google Ads 연동 정보가 없습니다.`)
  }

  // 2. Access Token 갱신
  const accessToken = await getAccessToken(refreshToken, clientId, clientSecret)

  // 3. GAQL 쿼리 작성 (날짜, 캠페인별 성과 지표)
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

  // 4. Google Ads REST API 호출 (searchStream)
  const cleanCustomerId = customerId.replace(/-/g, '')
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cleanCustomerId}/googleAds:searchStream`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Google Ads API 호출 실패: ${errorText}`)
  }

  const chunks = (await response.json()) as Array<{ results?: AdsMetricsRow[] }>
  const rows: unknown[] = []

  // Stream 구조 파싱 및 규격화
  for (const chunk of chunks) {
    if (!chunk.results) continue
    for (const r of chunk.results) {
      const costMicros = Number(r.metrics?.costMicros || 0)
      rows.push({
        date: r.segments?.date || '',
        campaignId: r.campaign?.id || '',
        campaignName: r.campaign?.name || '',
        costMicros,
        cost: Math.round(costMicros / 1000000), // micro-currency를 기본 단위로 환산
        impressions: Number(r.metrics?.impressions || 0),
        clicks: Number(r.metrics?.clicks || 0),
        conversions: Number(r.metrics?.conversions || 0),
      })
    }
  }

  return { brandId, dateStart, dateEnd, totalCount: rows.length, rows }
}
