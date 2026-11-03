// OpenAI(ChatGPT) Ads 인사이트 엔드포인트.
import { openaiAdsApiKey } from '../config'
import {
  getOpenaiInsightWithHistory,
  syncOpenaiInsightRows,
} from '../channel/openai'
import { endpoint, insightQuery } from '../http'
import { requestedRange, scheduledSync } from '../scheduled-sync'
import { onRequest } from '../trace/functions'

/** OpenAI Ads API 인증 — 키 하나가 광고 계정 하나에 묶여 있다. */
const openaiAuth = () => ({ apiKey: openaiAdsApiKey.value() })

/**
 * OpenAI(ChatGPT) Ads 인사이트 조회 엔드포인트 — getNaverInsight와 같은 모양
 * (total/byDate/byDayOfWeek/byGroupedWeek/byCampaign)을 반환한다. API 키 하나가
 * 광고 계정 하나에 묶여 있어 dateStart/dateEnd만 받으면 된다.
 */
export const getOpenaiInsight = onRequest(
  { secrets: [openaiAdsApiKey] },
  endpoint(
    {
      method: 'GET',
      validate: insightQuery,
      fallback: 'OpenAI 인사이트 조회 실패',
    },
    ({ data }) =>
      getOpenaiInsightWithHistory(data.dateStart, data.dateEnd, openaiAuth()),
  ),
)

// ────────────────────────────────
// OpenAI 인사이트 — 동기화 + 조회. Naver와 같은 이유로 삭제 없이 upsert만
// 한다(channel/openai/firestore.ts 참고).
// ────────────────────────────────

// 롤링 재동기화 기본 범위 — 전환이 하루 이상 늦게 확정되므로(공식 문서)
// LIVE_WINDOW_DAYS(7일)보다 여유 있게 잡는다.
const OPENAI_SYNC_WINDOW_DAYS = 14

/**
 * OpenAI 인사이트를 지정한 기간만큼 라이브로 가져와
 * Firestore(openaiInsightDaily)에 upsert한다. body에 startDate/endDate를 안
 * 주면 기본으로 "최근 14일"을 동기화한다.
 */
export const syncOpenaiInsights = onRequest(
  { secrets: [openaiAdsApiKey], timeoutSeconds: 300 },
  endpoint(
    { method: 'POST', fallback: 'OpenAI 인사이트 동기화 실패' },
    async ({ request }) => {
      const { dateStart, dateEnd } = requestedRange(
        request,
        OPENAI_SYNC_WINDOW_DAYS,
      )
      return syncOpenaiInsightRows(dateStart, dateEnd, openaiAuth())
    },
  ),
)

/**
 * OpenAI 인사이트를 매일 09·11·13·15·17·22시(KST) 최근 14일 롤링 재동기화한다 —
 * syncNaverInsightsScheduled와 같은 패턴.
 */
export const syncOpenaiInsightsScheduled = scheduledSync({
  secrets: [openaiAdsApiKey],
  windowDays: OPENAI_SYNC_WINDOW_DAYS,
  jobs: [
    {
      job: 'openai-insights',
      label: 'OpenAI 인사이트',
      run: ({ dateStart, dateEnd }) =>
        syncOpenaiInsightRows(dateStart, dateEnd, openaiAuth()),
    },
  ],
})
