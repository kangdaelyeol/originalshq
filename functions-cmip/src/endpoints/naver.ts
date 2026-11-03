// Naver 검색광고 인사이트 엔드포인트.
import { naverAccessLicense, naverSecretKey } from '../config'
import {
  getNaverInsightWithHistory,
  syncNaverInsightRows,
} from '../channel/naver'
import { CUSTOMER_ID as NAVER_CUSTOMER_ID } from '../channel/naver/constants'
import { endpoint, insightQuery } from '../http'
import { requestedRange, scheduledSync } from '../scheduled-sync'
import { onRequest } from '../trace/functions'

/** Naver API 인증 — CUSTOMER ID는 민감정보가 아니라 상수(channel/naver/constants). */
const naverAuth = () => ({
  apiKey: naverAccessLicense.value(),
  secretKey: naverSecretKey.value(),
  customerId: NAVER_CUSTOMER_ID,
})

/**
 * Naver 검색광고 인사이트 조회 엔드포인트 — Meta(getAllInsights)와 같은 모양
 * (total/byDate/byDayOfWeek/byGroupedWeek/byCampaign)을 그대로 반환한다.
 * CUSTOMER ID는 민감정보가 아니라 상수로 고정돼 있어(channel/naver/constants),
 * Meta처럼 dateStart/dateEnd만 받으면 된다.
 */
export const getNaverInsight = onRequest(
  { secrets: [naverAccessLicense, naverSecretKey] },
  endpoint(
    {
      method: 'GET',
      validate: insightQuery,
      fallback: 'Naver 인사이트 조회 실패',
    },
    ({ data }) =>
      // getNaverInsight(라이브 전체 조회) 대신
      // getNaverInsightWithHistory를 쓴다 — 최근 7일은 라이브 API, 8일
      // 이상 전은 Firestore(naverInsightDaily) 배치 동기화 값을 읽어서
      // 합친다. 네이버는 /stats가 "하루 = 요청 한 번"이라 조회 기간이
      // 길수록 라이브 호출이 느린데, 이 전환으로 그 비용을 크게 줄인다.
      // 반환 모양은 그대로라 프론트는 손댈 게 없다(channel/naver/index.ts
      // 참고).
      getNaverInsightWithHistory(data.dateStart, data.dateEnd, naverAuth()),
  ),
)

// ────────────────────────────────
// Naver 인사이트 — 동기화 + 조회. Meta/Google과 같은 이유로(매일 계속 쌓이고
// 값이 갱신되는 데이터) 삭제 없이 upsert만 한다(channel/naver/firestore.ts
// 참고).
// ────────────────────────────────

// 롤링 재동기화 기본 범위 — Meta/Google의 SYNC_WINDOW_DAYS와 동일한 이유로
// LIVE_WINDOW_DAYS(7일)보다 여유 있게 잡는다.
const NAVER_SYNC_WINDOW_DAYS = 14

/**
 * 네이버 인사이트를 지정한 기간만큼 라이브로 가져와
 * Firestore(naverInsightDaily)에 upsert한다. body에 startDate/endDate를 안
 * 주면 기본으로 "최근 14일"을 동기화한다.
 */
export const syncNaverInsights = onRequest(
  { secrets: [naverAccessLicense, naverSecretKey], timeoutSeconds: 300 },
  endpoint(
    { method: 'POST', fallback: 'Naver 인사이트 동기화 실패' },
    async ({ request }) => {
      const { dateStart, dateEnd } = requestedRange(
        request,
        NAVER_SYNC_WINDOW_DAYS,
      )
      return syncNaverInsightRows(dateStart, dateEnd, naverAuth())
    },
  ),
)

/**
 * 네이버 인사이트를 매일 09·11·13·15·17·22시(KST) 최근 14일 롤링 재동기화한다 —
 * syncMetaInsightsScheduled/syncGoogleInsightsScheduled와 같은 패턴.
 */
export const syncNaverInsightsScheduled = scheduledSync({
  secrets: [naverAccessLicense, naverSecretKey],
  windowDays: NAVER_SYNC_WINDOW_DAYS,
  jobs: [
    {
      job: 'naver-insights',
      label: 'Naver 인사이트',
      run: ({ dateStart, dateEnd }) =>
        syncNaverInsightRows(dateStart, dateEnd, naverAuth()),
    },
  ],
})
