// Cafe24 연동(OAuth)·주문 매출·환불 보정 엔드포인트.
import * as logger from 'firebase-functions/logger'
import { cafe24ClientId, cafe24SecretKey } from '../config'
import {
  buildCafe24AuthUrl,
  checkCafe24AuthStatus,
  exchangeAndSaveCafe24Tokens,
  getCafe24Revenue as fetchCafe24Revenue,
  syncCafe24Orders as syncCafe24OrdersFromApi,
  createCafe24Adjustment as createCafe24AdjustmentDoc,
  deleteCafe24Adjustment as deleteCafe24AdjustmentDoc,
  listCafe24Adjustments as listCafe24AdjustmentDocs,
  validateCafe24AdjustmentInput,
} from '../cafe24'
import { endpoint, HttpError, insightQuery } from '../http'
import { requestedRange, scheduledSync } from '../scheduled-sync'
import { onRequest } from '../trace/functions'

const cafe24MainId = 'hiswill00'

// Cafe24 개발자센터의 앱 설정(redirect_uri)에 이 값 그대로 등록해야 한다 —
// getCafe24AuthUrl(동의 화면 URL 생성)과 cafe24OauthCallback(토큰 교환) 양쪽이
// 같은 값을 써야 Cafe24가 "redirect_uri 불일치" 없이 콜백을 돌려준다.
const CAFE24_OAUTH_REDIRECT_URI =
  'https://asia-northeast3-xtool-63b29.cloudfunctions.net/cafe24OauthCallback'

// ────────────────────────────────
// Cafe24 OAuth — 온라인 스토어 매출(주문) 연동의 인증 부분. 주문 데이터 조회
// 엔드포인트는 이 인증이 끝난 뒤 이어서 추가한다.
// ────────────────────────────────

/**
 * Cafe24 로그인/동의 화면 URL 발급 — 프론트가 이 URL을 새 탭으로 연다.
 * state는 CSRF 방지용 — 브랜드 구분이 필요 없는 단일 몰 연동이라 고정값을
 * 쓴다(cafe24OauthCallback에서 그대로 되돌아오는지만 확인).
 */
export const getCafe24AuthUrl = onRequest(
  { secrets: [cafe24ClientId] },
  endpoint({ method: 'GET' }, async () => ({
    url: buildCafe24AuthUrl(
      cafe24MainId,
      cafe24ClientId.value(),
      CAFE24_OAUTH_REDIRECT_URI,
      'cafe24',
    ),
  })),
)

/**
 * Cafe24 OAuth 2.0 콜백 엔드포인트
 * - Cafe24 개발자센터 앱 설정의 Redirect URI에 입력할 URL:
 *   https://asia-northeast3-xtool-63b29.cloudfunctions.net/cafe24OauthCallback
 */
export const cafe24OauthCallback = onRequest(
  { secrets: [cafe24ClientId, cafe24SecretKey] },
  endpoint(
    { method: 'GET', fallback: 'Cafe24 OAuth 인증 실패' },
    async ({ request }) => {
      const {
        code,
        state,
        error,
        error_description: errorDescription,
      } = request.query as {
        code?: string
        state?: string
        error?: string
        error_description?: string
      }

      if (error) {
        throw new HttpError(
          400,
          `Cafe24 OAuth Error: ${errorDescription || error}`,
        )
      }
      if (!code) {
        throw new HttpError(400, 'Authorization code(code)가 누락되었습니다.')
      }
      if (state !== 'cafe24') {
        throw new HttpError(400, 'state 값이 올바르지 않습니다.')
      }

      await exchangeAndSaveCafe24Tokens(
        code,
        cafe24MainId,
        CAFE24_OAUTH_REDIRECT_URI,
        cafe24ClientId.value(),
        cafe24SecretKey.value(),
      )
      return {
        success: true,
        message: 'Cafe24 연동 및 토큰 저장이 완료되었습니다.',
      }
    },
  ),
)

/**
 * 이 몰에 Cafe24 refreshToken이 저장돼 있는지 확인 — "연동 시작"과 "조회"
 * 중 뭘 먼저 눌러야 하는지 UI가 판단하는 용도(Google Ads의
 * getGoogleAuthStatus와 같은 역할).
 */
export const getCafe24AuthStatus = onRequest(
  endpoint({ method: 'GET' }, () => checkCafe24AuthStatus()),
)

// ────────────────────────────────
// Cafe24 주문(매출) 데이터 — 동기화 + 조회. Monday CRM과 달리 매일 계속
// 쌓이는 데이터라 보드 전체를 매번 다 지우고 다시 받는 방식이 아니라, 요청
// 범위(백필은 넓게, 롤링 재동기화는 최근 N일만 좁게)만큼만 가져와 upsert한다
// (cafe24/firestore.ts 참고 — 주문은 사라지지 않고 상태만 바뀌어서 삭제가
// 필요 없다).
// ────────────────────────────────

// 롤링 재동기화 기본 범위 — 취소/환불은 보통 최근 주문에서 일어나므로 이
// 정도면 상태 변경을 놓치지 않으면서도 매번 다시 받는 양이 과하지 않다.
const CAFE24_SYNC_WINDOW_DAYS = 30

/**
 * Cafe24 주문을 지정한 기간만큼 가져와 Firestore(cafe24Orders)에 upsert한다.
 * body에 startDate/endDate를 안 주면 기본으로 "최근 30일"을 동기화한다 —
 * 과거 데이터를 한 번에 넓게 백필하고 싶을 때만 명시적으로 범위를 넘기면
 * 된다(3개월 넘는 범위도 cafe24/utils.ts가 알아서 나눠 호출한다).
 */
export const syncCafe24Orders = onRequest(
  { secrets: [cafe24ClientId, cafe24SecretKey], timeoutSeconds: 300 },
  endpoint(
    { method: 'POST', fallback: 'Cafe24 주문 동기화 실패' },
    async ({ request }) => {
      const { dateStart, dateEnd } = requestedRange(
        request,
        CAFE24_SYNC_WINDOW_DAYS,
      )
      return syncCafe24OrdersFromApi(
        cafe24MainId,
        cafe24ClientId.value(),
        cafe24SecretKey.value(),
        dateStart,
        dateEnd,
      )
    },
  ),
)

/**
 * Cafe24 주문을 매일 09·11·13·15·17·22시(KST) 최근 30일 롤링 재동기화한다 —
 * 예전엔 하루 한 번(자정)이었는데, 다른 동기화들과 같은 시각으로 맞춰 낮
 * 동안 들어온 주문과 취소/환불이 그날 안에 반영되게 했다.
 */
export const syncCafe24OrdersScheduled = scheduledSync({
  secrets: [cafe24ClientId, cafe24SecretKey],
  windowDays: CAFE24_SYNC_WINDOW_DAYS,
  jobs: [
    {
      job: 'cafe24-orders',
      label: 'Cafe24 주문',
      run: ({ dateStart, dateEnd }) =>
        syncCafe24OrdersFromApi(
          cafe24MainId,
          cafe24ClientId.value(),
          cafe24SecretKey.value(),
          dateStart,
          dateEnd,
        ),
    },
  ],
})

/**
 * Cafe24 매출 조회 — Monday CRM의 getOfflineRevenue와 같은 GET +
 * dateStart/dateEnd 쿼리 방식. Cafe24를 실시간으로 부르지 않고
 * syncCafe24Orders로 미리 동기화해둔 Firestore에서 읽으므로 시크릿이
 * 필요 없다.
 */
export const getCafe24Revenue = onRequest(
  endpoint(
    {
      method: 'GET',
      validate: insightQuery,
      fallback: 'Cafe24 매출 조회 실패',
    },
    ({ data }) => fetchCafe24Revenue(data.dateStart, data.dateEnd),
  ),
)

// ────────────────────────────────
// Cafe24 환불 수동 보정 — 카페24 API로는 알 수 없는 환불 변동(취소 철회 등,
// cafe24/adjustments.ts 주석 참고)을 관리자가 날짜·금액으로 직접 등록한다.
// 등록된 보정은 getCafe24Revenue의 refundAmount/paymentAmount에 반영된다.
// ────────────────────────────────
export const listCafe24Adjustments = onRequest(
  endpoint({ method: 'GET', fallback: '보정 목록 조회 실패' }, async () => ({
    adjustments: await listCafe24AdjustmentDocs(),
  })),
)

export const createCafe24Adjustment = onRequest(
  endpoint(
    {
      method: 'POST',
      validate: (request) => validateCafe24AdjustmentInput(request.body),
      fallback: '보정 등록 실패',
    },
    async ({ data, response }) => {
      const adjustment = await createCafe24AdjustmentDoc(data)
      logger.info('Cafe24 환불 보정 등록:', adjustment)
      response.status(201).send({ adjustment })
    },
  ),
)

export const deleteCafe24Adjustment = onRequest(
  endpoint(
    { method: 'POST', fallback: '보정 삭제 실패' },
    async ({ request }) => {
      const { id } = (request.body ?? {}) as { id?: unknown }
      if (typeof id !== 'string' || id === '') {
        throw new HttpError(400, 'id 필요')
      }
      if (!(await deleteCafe24AdjustmentDoc(id))) {
        throw new HttpError(404, '보정 항목을 찾을 수 없습니다')
      }
      logger.info('Cafe24 환불 보정 삭제:', id)
      return { id, deleted: true }
    },
  ),
)
