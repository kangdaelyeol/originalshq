// Google Ads 연동(OAuth)·인사이트 엔드포인트.
import type { Request } from 'firebase-functions/v2/https'
import {
  googleClientId,
  googleClientSecret,
  googleDeveloperToken,
} from '../config'
import {
  exchangeAndSaveGoogleTokens,
  buildGoogleAdsAuthUrl,
  checkGoogleAuthStatus,
  getGoogleCampaignInsightWithHistory,
  getGoogleAdGroupInsightWithHistory,
  syncGoogleCampaignInsightRows,
  syncGoogleAdGroupInsightRows,
  GOOGLE_SYNC_BRAND_ID,
  GOOGLE_SYNC_CUSTOMER_ID,
  GOOGLE_SYNC_LOGIN_CUSTOMER_ID,
} from '../channel/google'
import type {
  GetGoogleInsightParams,
  GoogleAdsAccount,
} from '../channel/google/types'
import { endpoint, HttpError } from '../http'
import {
  requestedRange,
  scheduledSync,
  type SyncRange,
} from '../scheduled-sync'
import { onRequest } from '../trace/functions'
import type { OauthCallbackQuery, OauthCallbackResult } from '../types'

// Google Cloud Console의 Authorized redirect URIs에 등록된 값과 반드시 동일해야
// 한다 — oauthCallback(토큰 교환)과 getGoogleAuthUrl(동의 화면 URL 생성) 양쪽에서
// 같은 값을 써야 "redirect_uri_mismatch" 없이 오간다.
const GOOGLE_OAUTH_REDIRECT_URI =
  'https://asia-northeast3-xtool-63b29.cloudfunctions.net/oauthCallback'

/**
 * Google Ads OAuth 2.0 콜백 엔드포인트
 * - Google Cloud Console Authorized redirect URIs에 입력할 URL:
 *   https://asia-northeast3-xtool-63b29.cloudfunctions.net/oauthCallback
 */
export const oauthCallback = onRequest(
  { secrets: [googleClientId, googleClientSecret] },
  // 구글 OAuth 콜백은 GET 방식
  endpoint(
    // Google이 부르는 주소라 로그인 확인을 하지 않는다.
    { method: 'GET', fallback: 'Google OAuth 인증 실패', public: true },
    async ({ request }) => {
      const { code, state, error, error_description } =
        request.query as OauthCallbackQuery

      // 1. 구글에서 인증 거부/오류 반환 시 처리
      if (error) {
        throw new HttpError(
          400,
          `Google OAuth Error: ${error_description || error}`,
        )
      }

      // 2. 필수 파라미터 검증 (code: 인증 코드, state: 브랜드 구분용 brandId)
      if (!code) {
        throw new HttpError(400, 'Authorization code(code)가 누락되었습니다.')
      }
      if (!state) {
        throw new HttpError(
          400,
          'state(brandId) 파라미터가 누락되어 브랜드 식별이 불가능합니다.',
        )
      }

      const brandId = String(state)

      // 3. 토큰 교환 및 Firestore 저장 수행
      await exchangeAndSaveGoogleTokens(
        code,
        brandId,
        googleClientId.value(),
        googleClientSecret.value(),
        GOOGLE_OAUTH_REDIRECT_URI,
      )

      // 4. 처리 완료 후 처리 (프론트엔드로 성공 리디렉션 또는 JSON 반환)
      // A. 웹 서비스 화면으로 리디렉션 시:
      // response.redirect(`https://your-frontend-domain.com/brands/${brandId}/settings?google_ads=success`)

      // B. API 형태로 완료 결과 응답 시:
      const result: OauthCallbackResult = {
        success: true,
        brandId,
        message: 'Google Ads API 연동 및 Refresh Token 저장이 완료되었습니다.',
      }
      return result
    },
  ),
)

// --------------------------------------------------------------------------- //
// Google Ads 연동 테스트용 보조 엔드포인트
// (src/screens/cmip GoogleTestPanel 전용) — client_id/secret은 프론트로 절대
// 나가지 않고, 서버가 만든 동의 화면 URL만 새 탭으로 열어주는 식으로 연동을
// 검증한다.
// --------------------------------------------------------------------------- //
export interface GetGoogleAuthUrlData {
  brandId: string
}

export interface GetGoogleAuthUrlResult {
  url: string
}

/**
 * Google Ads OAuth 동의 화면 URL 발급.
 */
export const getGoogleAuthUrl = onRequest(
  { secrets: [googleClientId, googleClientSecret] },
  endpoint({ method: 'GET' }, async ({ request }) => {
    const { brandId } = request.query as Partial<GetGoogleAuthUrlData>
    if (!brandId) throw new HttpError(400, 'brandId 필요')
    const url = buildGoogleAdsAuthUrl(
      String(brandId),
      googleClientId.value(),
      googleClientSecret.value(),
      GOOGLE_OAUTH_REDIRECT_URI,
    )
    const result: GetGoogleAuthUrlResult = { url }
    return result
  }),
)

export interface GetGoogleAuthStatusData {
  brandId: string
}

export interface GetGoogleAuthStatusResult {
  connected: boolean
  updatedAt: string | null
}

/**
 * 이 브랜드에 Google Ads refreshToken이 저장돼 있는지 확인 — "연동 시작"과
 * "조회"(getGoogleAdsInsight) 중 뭘 먼저 눌러야 하는지 UI가 판단하는 용도.
 */
export const getGoogleAuthStatus = onRequest(
  endpoint({ method: 'GET' }, async ({ request }) => {
    const { brandId } = request.query as Partial<GetGoogleAuthStatusData>
    if (!brandId) throw new HttpError(400, 'brandId 필요')
    const result: GetGoogleAuthStatusResult = await checkGoogleAuthStatus(
      String(brandId),
    )
    return result
  }),
)

/** Google Ads 접속 값 — 시크릿 3개와 어느 계정인지(channel/google/types.ts). */
const googleAccount = (
  customerId: string,
  loginCustomerId?: string,
): GoogleAdsAccount => ({
  clientId: googleClientId.value(),
  clientSecret: googleClientSecret.value(),
  developerToken: googleDeveloperToken.value(),
  customerId,
  loginCustomerId,
})

/** Google 인사이트 조회의 입력 — GET 쿼리 또는 POST 바디. 다섯 칸 모두 필수. */
const googleInsightParams = (request: Request) => {
  const params = (
    request.method === 'GET' ? request.query : request.body
  ) as Partial<GetGoogleInsightParams> & { customerId?: string }
  const { brandId, dateStart, dateEnd, customerId, loginCustomerId } = params
  if (!brandId || !dateStart || !dateEnd || !customerId || !loginCustomerId) {
    throw new HttpError(
      400,
      'brandId, dateStart, dateEnd, customerId, loginCustomerId 가 모두 필요합니다.',
    )
  }
  return {
    brandId: String(brandId),
    dateStart: String(dateStart),
    dateEnd: String(dateEnd),
    account: googleAccount(String(customerId), loginCustomerId),
  }
}

/**
 * Google Ads 인사이트 조회 엔드포인트
 */
export const getGoogleCampaignInsight = onRequest(
  { secrets: [googleClientId, googleClientSecret, googleDeveloperToken] },
  endpoint(
    { method: ['GET', 'POST'], fallback: 'Google Ads 인사이트 조회 실패' },
    async ({ request }) => {
      const { brandId, dateStart, dateEnd, account } =
        googleInsightParams(request)
      // getGoogleInsight(라이브 전체 조회) 대신
      // getGoogleCampaignInsightWithHistory를 쓴다 — 최근 7일은 라이브
      // API, 8일 이상 전은 Firestore(googleCampaignInsightDaily) 배치
      // 동기화 값을 읽어서 합친다. 반환 모양은 그대로라 프론트/
      // GoogleTestPanel 모두 손댈 게 없다(channel/google/index.ts 참고).
      return getGoogleCampaignInsightWithHistory(
        brandId,
        dateStart,
        dateEnd,
        account,
      )
    },
  ),
)

export const getGoogleAdsInsight = onRequest(
  { secrets: [googleClientId, googleClientSecret, googleDeveloperToken] },
  endpoint(
    { method: ['GET', 'POST'], fallback: 'Google Ads 인사이트 조회 실패' },
    async ({ request }) => {
      const { brandId, dateStart, dateEnd, account } =
        googleInsightParams(request)
      // getGoogleAdGroupInsight 대신 getGoogleAdGroupInsightWithHistory —
      // 위 getGoogleCampaignInsight 핸들러와 동일한 이유.
      return getGoogleAdGroupInsightWithHistory(
        brandId,
        dateStart,
        dateEnd,
        account,
      )
    },
  ),
)

// ────────────────────────────────
// Google Ads 인사이트 — 동기화 + 조회. Meta/Cafe24와 같은 이유로(매일 계속
// 쌓이고 어트리뷰션이 갱신되는 데이터) 삭제 없이 upsert만 한다
// (channel/google/firestore.ts 참고).
// ────────────────────────────────

// 롤링 재동기화 기본 범위 — meta의 META_SYNC_WINDOW_DAYS와 동일한 이유로
// LIVE_WINDOW_DAYS(7일)보다 여유 있게 잡는다.
const GOOGLE_SYNC_WINDOW_DAYS = 14

/** 캠페인·adGroup을 함께 동기화한다(수동·예약 공용). */
const syncGoogleInsightRows = async (
  brandId: string,
  { dateStart, dateEnd }: SyncRange,
  account: GoogleAdsAccount,
) => {
  const [campaignResult, adGroupResult] = await Promise.all([
    syncGoogleCampaignInsightRows(brandId, dateStart, dateEnd, account),
    syncGoogleAdGroupInsightRows(brandId, dateStart, dateEnd, account),
  ])
  return { campaignResult, adGroupResult }
}

/**
 * Google Ads 인사이트(캠페인+adGroup)를 지정한 기간만큼 라이브로 가져와
 * Firestore에 upsert한다. body를 생략하면 기본으로 "최근 14일 × 유일한
 * 연동 계정(GOOGLE_SYNC_*)"을 동기화한다 — 과거 데이터를 넓게 백필하고
 * 싶을 때만 명시적으로 범위를 넘기면 된다.
 */
export const syncGoogleInsights = onRequest(
  {
    secrets: [googleClientId, googleClientSecret, googleDeveloperToken],
    timeoutSeconds: 300,
  },
  endpoint(
    { method: 'POST', fallback: 'Google Ads 인사이트 동기화 실패' },
    async ({ request }) => {
      const { brandId, customerId, loginCustomerId } = (request.body ?? {}) as {
        brandId?: string
        customerId?: string
        loginCustomerId?: string
      }
      const { campaignResult, adGroupResult } = await syncGoogleInsightRows(
        brandId || GOOGLE_SYNC_BRAND_ID,
        requestedRange(request, GOOGLE_SYNC_WINDOW_DAYS),
        googleAccount(
          customerId || GOOGLE_SYNC_CUSTOMER_ID,
          loginCustomerId || GOOGLE_SYNC_LOGIN_CUSTOMER_ID,
        ),
      )
      return {
        campaignUpserted: campaignResult.upserted,
        adGroupUpserted: adGroupResult.upserted,
      }
    },
  ),
)

/**
 * Google Ads 인사이트를 매일 09·11·13·15·17·22시(KST) 최근 14일 롤링 재동기화한다 —
 * syncCafe24OrdersScheduled/syncMetaInsightsScheduled와 같은 패턴.
 */
export const syncGoogleInsightsScheduled = scheduledSync({
  secrets: [googleClientId, googleClientSecret, googleDeveloperToken],
  windowDays: GOOGLE_SYNC_WINDOW_DAYS,
  jobs: [
    {
      job: 'google-insights',
      label: 'Google Ads 인사이트',
      run: (range) =>
        syncGoogleInsightRows(
          GOOGLE_SYNC_BRAND_ID,
          range,
          googleAccount(GOOGLE_SYNC_CUSTOMER_ID, GOOGLE_SYNC_LOGIN_CUSTOMER_ID),
        ),
    },
  ],
})
