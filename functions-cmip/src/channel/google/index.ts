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
import {
  GoogleAdGroupInsightRow,
  GoogleAdsAccount,
  GoogleCampaignInsightRow,
} from './types'
import * as logger from 'firebase-functions/logger'
import {
  recordAdEntitiesSafely,
  sightingsFromGoogleAdGroups,
  sightingsFromGoogleCampaigns,
} from '../../ad-settings/entities'

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

export async function getRefreshToken(brandId: string): Promise<string> {
  const brandDoc = await db.collection('brands').doc(brandId).get()
  const refreshToken = brandDoc.data()?.googleAds?.refreshToken
  if (!refreshToken) {
    throw new Error(`브랜드(${brandId})의 Google Ads 연동 정보가 없습니다.`)
  }
  return refreshToken
}

/** 조회 구간을 LIVE_WINDOW_DAYS 경계로 쪼개서, 최근 구간은 라이브 API로,
 * 그보다 과거인 구간은 Firestore에서 읽은 뒤 두 배열을 이어붙여 그대로
 * 반환한다 — meta/index.ts의 getMetaInsightWithHistory와 같은 구조. Google은
 * 백엔드가 집계를 안 하고 가공된 행만 돌려주므로(프론트
 * google-insight-client.ts가 집계) "요약 함수 재사용" 단계 자체가 필요 없어
 * Meta보다 더 단순하다 — 행을 이어붙이는 게 곧 최종 반환값이다. */
async function readWithHistory<Row>(
  brandId: string,
  dateStart: string,
  dateEnd: string,
  account: GoogleAdsAccount,
  fromDb: (dateStart: string, dateEnd: string) => Promise<Row[]>,
  fromApi: (
    dateStart: string,
    dateEnd: string,
    account: GoogleAdsAccount,
    refreshToken: string,
  ) => Promise<Row[]>,
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
    needsHistorical ? fromDb(dateStart, historicalEnd) : Promise.resolve([]),
    needsLive
      ? (async () =>
          fromApi(
            liveStart,
            dateEnd,
            account,
            await getRefreshToken(brandId),
          ))()
      : Promise.resolve([]),
  ])

  const rows: Row[] = [...historicalRows, ...liveRows]
  return { brandId, dateStart, dateEnd, totalCount: rows.length, rows }
}

/** 캠페인 단위 조회 — 최근은 라이브, 과거는 googleCampaignInsightDaily. */
export const getGoogleCampaignInsightWithHistory = (
  brandId: string,
  dateStart: string,
  dateEnd: string,
  account: GoogleAdsAccount,
) =>
  readWithHistory<GoogleCampaignInsightRow>(
    brandId,
    dateStart,
    dateEnd,
    account,
    fetchGoogleCampaignInsightRowsFromDb,
    fetchGoogleCampaignInsightRows,
  )

/** getGoogleCampaignInsightWithHistory와 동일 구조의 adGroup 버전. */
export const getGoogleAdGroupInsightWithHistory = (
  brandId: string,
  dateStart: string,
  dateEnd: string,
  account: GoogleAdsAccount,
) =>
  readWithHistory<GoogleAdGroupInsightRow>(
    brandId,
    dateStart,
    dateEnd,
    account,
    fetchGoogleAdGroupInsightRowsFromDb,
    fetchGoogleAdGroupInsightRows,
  )

/** 수동/스케줄 동기화 공용(캠페인) — 라이브로 fetch해서
 * Firestore(googleCampaignInsightDaily)에 upsert한다. */
export async function syncGoogleCampaignInsightRows(
  brandId: string,
  dateStart: string,
  dateEnd: string,
  account: GoogleAdsAccount,
): Promise<{ upserted: number }> {
  const refreshToken = await getRefreshToken(brandId)
  const rows = await fetchGoogleCampaignInsightRows(
    dateStart,
    dateEnd,
    account,
    refreshToken,
  )
  const result = await upsertGoogleCampaignInsightRows(rows)
  // 캠페인 목록(광고 설정 화면)도 같이 넓힌다.
  await recordAdEntitiesSafely(sightingsFromGoogleCampaigns(rows), logger.warn)
  return result
}

/** 수동/스케줄 동기화 공용(adGroup). */
export async function syncGoogleAdGroupInsightRows(
  brandId: string,
  dateStart: string,
  dateEnd: string,
  account: GoogleAdsAccount,
): Promise<{ upserted: number }> {
  const refreshToken = await getRefreshToken(brandId)
  const rows = await fetchGoogleAdGroupInsightRows(
    dateStart,
    dateEnd,
    account,
    refreshToken,
  )
  const result = await upsertGoogleAdGroupInsightRows(rows)
  // 캠페인·광고그룹 목록(광고 설정 화면)도 같이 넓힌다.
  await recordAdEntitiesSafely(sightingsFromGoogleAdGroups(rows), logger.warn)
  return result
}
