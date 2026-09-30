import { OAuth2Client } from 'google-auth-library'
import { db } from '../../data'
import { addDays, todayISO } from '../utils'
import {
  fetchGoogleAdGroupInsightRows,
  fetchGoogleCampaignInsightRows,
} from './client'
import {
  fetchGoogleAdGroupInsightRowsFromDb,
  fetchGoogleCampaignInsightRowsFromDb,
  upsertGoogleAdGroupInsightRows,
  upsertGoogleCampaignInsightRows,
} from './firestore'
import { GoogleAdGroupInsightRow, GoogleCampaignInsightRow } from './types'

// 지금 실제로 연동된 Google Ads 계정은 하나뿐이라(프론트
// google-insight-client.ts의 GOOGLE_ADS_BRAND_ID 등과 동일한 값) 동기화
// 쪽(요청 컨텍스트가 없는 스케줄 함수)도 같은 값을 기본으로 쓴다. 계정이
// 늘면 이 상수들과 syncGoogleInsights의 override 파라미터를 함께 확장하면
// 된다.
export const GOOGLE_SYNC_BRAND_ID = '10'
export const GOOGLE_SYNC_CUSTOMER_ID = '2771515076'
export const GOOGLE_SYNC_LOGIN_CUSTOMER_ID = '7421390798'

/** 최근 N일은 어트리뷰션 지연으로 계속 소급 수정될 수 있어서 라이브 API로,
 * 그 이전은 Firestore 배치 동기화 값을 읽는다 — meta/index.ts의 같은 상수와
 * 동일한 이유. */
const LIVE_WINDOW_DAYS = 7

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

async function getRefreshToken(brandId: string): Promise<string> {
  const brandDoc = await db.collection('brands').doc(brandId).get()
  const refreshToken = brandDoc.data()?.googleAds?.refreshToken
  if (!refreshToken) {
    throw new Error(`브랜드(${brandId})의 Google Ads 연동 정보가 없습니다.`)
  }
  return refreshToken
}

/** 라이브 조회 전용(캠페인 단위) — client.ts의 fetchGoogleCampaignInsightRows를
 * 감싸서 기존 반환 모양({brandId, dateStart, dateEnd, totalCount, rows})을
 * 그대로 유지한다. GoogleTestPanel(디버그 화면)이 이 모양에 직접 의존한다. */
export async function getGoogleInsight(
  brandId: string,
  dateStart: string,
  dateEnd: string,
  clientId: string,
  clientSecret: string,
  developerToken: string,
  customerId: string,
  loginCustomerId?: string,
) {
  const refreshToken = await getRefreshToken(brandId)
  const rows = await fetchGoogleCampaignInsightRows(
    dateStart,
    dateEnd,
    clientId,
    clientSecret,
    developerToken,
    customerId,
    refreshToken,
    loginCustomerId,
  )
  return { brandId, dateStart, dateEnd, totalCount: rows.length, rows }
}

/** 라이브 조회 전용(adGroup=adset 단위) — getGoogleInsight와 동일한 구조. */
export async function getGoogleAdGroupInsight(
  brandId: string,
  dateStart: string,
  dateEnd: string,
  clientId: string,
  clientSecret: string,
  developerToken: string,
  customerId: string,
  loginCustomerId?: string,
) {
  const refreshToken = await getRefreshToken(brandId)
  const rows = await fetchGoogleAdGroupInsightRows(
    dateStart,
    dateEnd,
    clientId,
    clientSecret,
    developerToken,
    customerId,
    refreshToken,
    loginCustomerId,
  )
  return { brandId, dateStart, dateEnd, totalCount: rows.length, rows }
}

/** 조회 구간을 LIVE_WINDOW_DAYS 경계로 쪼개서, 최근 구간은 라이브 API로,
 * 그보다 과거인 구간은 Firestore(googleCampaignInsightDaily)에서 읽은 뒤 두
 * 배열을 이어붙여 그대로 반환한다 — meta/index.ts의
 * getMetaInsightWithHistory와 같은 구조. Google은 백엔드가 집계를 안 하고
 * 가공된 행만 돌려주므로(프론트 google-insight-client.ts가 집계) "요약 함수
 * 재사용" 단계 자체가 필요 없어 Meta보다 더 단순하다 — 행을 이어붙이는 게
 * 곧 최종 반환값이다. */
export async function getGoogleCampaignInsightWithHistory(
  brandId: string,
  dateStart: string,
  dateEnd: string,
  clientId: string,
  clientSecret: string,
  developerToken: string,
  customerId: string,
  loginCustomerId?: string,
) {
  const today = todayISO()
  const liveStartBoundary = addDays(today, -(LIVE_WINDOW_DAYS - 1))
  const historicalEnd =
    dateEnd < liveStartBoundary ? dateEnd : addDays(liveStartBoundary, -1)
  const liveStart =
    dateStart > liveStartBoundary ? dateStart : liveStartBoundary

  const needsHistorical = dateStart <= historicalEnd
  const needsLive = liveStart <= dateEnd

  const [historicalRows, liveRows] = await Promise.all([
    needsHistorical
      ? fetchGoogleCampaignInsightRowsFromDb(dateStart, historicalEnd)
      : Promise.resolve([] as GoogleCampaignInsightRow[]),
    needsLive
      ? (async () => {
          const refreshToken = await getRefreshToken(brandId)
          return fetchGoogleCampaignInsightRows(
            liveStart,
            dateEnd,
            clientId,
            clientSecret,
            developerToken,
            customerId,
            refreshToken,
            loginCustomerId,
          )
        })()
      : Promise.resolve([] as GoogleCampaignInsightRow[]),
  ])

  const rows: GoogleCampaignInsightRow[] = [...historicalRows, ...liveRows]
  return { brandId, dateStart, dateEnd, totalCount: rows.length, rows }
}

/** getGoogleCampaignInsightWithHistory와 동일 구조의 adGroup 버전. */
export async function getGoogleAdGroupInsightWithHistory(
  brandId: string,
  dateStart: string,
  dateEnd: string,
  clientId: string,
  clientSecret: string,
  developerToken: string,
  customerId: string,
  loginCustomerId?: string,
) {
  const today = todayISO()
  const liveStartBoundary = addDays(today, -(LIVE_WINDOW_DAYS - 1))
  const historicalEnd =
    dateEnd < liveStartBoundary ? dateEnd : addDays(liveStartBoundary, -1)
  const liveStart =
    dateStart > liveStartBoundary ? dateStart : liveStartBoundary

  const needsHistorical = dateStart <= historicalEnd
  const needsLive = liveStart <= dateEnd

  const [historicalRows, liveRows] = await Promise.all([
    needsHistorical
      ? fetchGoogleAdGroupInsightRowsFromDb(dateStart, historicalEnd)
      : Promise.resolve([] as GoogleAdGroupInsightRow[]),
    needsLive
      ? (async () => {
          const refreshToken = await getRefreshToken(brandId)
          return fetchGoogleAdGroupInsightRows(
            liveStart,
            dateEnd,
            clientId,
            clientSecret,
            developerToken,
            customerId,
            refreshToken,
            loginCustomerId,
          )
        })()
      : Promise.resolve([] as GoogleAdGroupInsightRow[]),
  ])

  const rows: GoogleAdGroupInsightRow[] = [...historicalRows, ...liveRows]
  return { brandId, dateStart, dateEnd, totalCount: rows.length, rows }
}

/** 수동/스케줄 동기화 공용(캠페인) — 라이브로 fetch해서
 * Firestore(googleCampaignInsightDaily)에 upsert한다. */
export async function syncGoogleCampaignInsightRows(
  dateStart: string,
  dateEnd: string,
  brandId: string,
  clientId: string,
  clientSecret: string,
  developerToken: string,
  customerId: string,
  loginCustomerId?: string,
): Promise<{ upserted: number }> {
  const refreshToken = await getRefreshToken(brandId)
  const rows = await fetchGoogleCampaignInsightRows(
    dateStart,
    dateEnd,
    clientId,
    clientSecret,
    developerToken,
    customerId,
    refreshToken,
    loginCustomerId,
  )
  return upsertGoogleCampaignInsightRows(rows)
}

/** 수동/스케줄 동기화 공용(adGroup). */
export async function syncGoogleAdGroupInsightRows(
  dateStart: string,
  dateEnd: string,
  brandId: string,
  clientId: string,
  clientSecret: string,
  developerToken: string,
  customerId: string,
  loginCustomerId?: string,
): Promise<{ upserted: number }> {
  const refreshToken = await getRefreshToken(brandId)
  const rows = await fetchGoogleAdGroupInsightRows(
    dateStart,
    dateEnd,
    clientId,
    clientSecret,
    developerToken,
    customerId,
    refreshToken,
    loginCustomerId,
  )
  return upsertGoogleAdGroupInsightRows(rows)
}

/** 디버그 전용 — 실제 Google Ads API 원본(가공은 됐지만 배치되지 않은) 행을
 * 눈으로 확인/대조하는 용도(cafe24의 debugFetchCafe24OrdersRaw와 같은 목적). */
export async function debugFetchGoogleCampaignRaw(
  dateStart: string,
  dateEnd: string,
  brandId: string,
  clientId: string,
  clientSecret: string,
  developerToken: string,
  customerId: string,
  loginCustomerId?: string,
): Promise<{ rows: GoogleCampaignInsightRow[]; count: number }> {
  const refreshToken = await getRefreshToken(brandId)
  const rows = await fetchGoogleCampaignInsightRows(
    dateStart,
    dateEnd,
    clientId,
    clientSecret,
    developerToken,
    customerId,
    refreshToken,
    loginCustomerId,
  )
  return { rows, count: rows.length }
}

export async function debugFetchGoogleAdGroupRaw(
  dateStart: string,
  dateEnd: string,
  brandId: string,
  clientId: string,
  clientSecret: string,
  developerToken: string,
  customerId: string,
  loginCustomerId?: string,
): Promise<{ rows: GoogleAdGroupInsightRow[]; count: number }> {
  const refreshToken = await getRefreshToken(brandId)
  const rows = await fetchGoogleAdGroupInsightRows(
    dateStart,
    dateEnd,
    clientId,
    clientSecret,
    developerToken,
    customerId,
    refreshToken,
    loginCustomerId,
  )
  return { rows, count: rows.length }
}
