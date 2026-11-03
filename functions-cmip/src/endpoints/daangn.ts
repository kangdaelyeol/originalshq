// 당근 광고 인사이트 엔드포인트.
import { daangnAdsApiKey } from '../config'
import {
  getDaangnInsightWithHistory,
  syncDaangnInsightRows,
} from '../channel/daangn'
import { endpoint, insightQuery } from '../http'
import { requestedRange, scheduledSync } from '../scheduled-sync'
import { onRequest } from '../trace/functions'

/** 당근 광고 API 인증 — 키 하나가 광고 계정 하나에 묶여 있다(계정 ID는
 * channel/daangn/constants). */
const daangnAuth = () => ({ apiKey: daangnAdsApiKey.value() })

/**
 * 당근 광고 인사이트 조회 — getOpenaiInsight와 같은 모양
 * (total/byDate/byDayOfWeek/byGroupedWeek/byCampaign)을 반환한다.
 */
export const getDaangnInsight = onRequest(
  { secrets: [daangnAdsApiKey] },
  endpoint(
    {
      method: 'GET',
      validate: insightQuery,
      fallback: '당근 인사이트 조회 실패',
    },
    ({ data }) =>
      getDaangnInsightWithHistory(data.dateStart, data.dateEnd, daangnAuth()),
  ),
)

// ────────────────────────────────
// 당근 인사이트 — 동기화 + 조회. OpenAI와 같은 이유로 삭제 없이 upsert만
// 한다(channel/daangn/firestore.ts 참고).
// ────────────────────────────────

// 롤링 재동기화 기본 범위 — 다른 매체와 같이 LIVE_WINDOW_DAYS(7일)보다 여유
// 있게 잡는다.
const DAANGN_SYNC_WINDOW_DAYS = 14

/** 지정한 기간(기본 최근 14일)을 라이브로 받아 daangnInsightDaily에 upsert. */
export const syncDaangnInsights = onRequest(
  { secrets: [daangnAdsApiKey], timeoutSeconds: 300 },
  endpoint(
    { method: 'POST', fallback: '당근 인사이트 동기화 실패' },
    async ({ request }) => {
      const { dateStart, dateEnd } = requestedRange(
        request,
        DAANGN_SYNC_WINDOW_DAYS,
      )
      return syncDaangnInsightRows(dateStart, dateEnd, daangnAuth())
    },
  ),
)

/** 매일 09·11·13·15·17·22시(KST) 최근 14일 롤링 재동기화. */
export const syncDaangnInsightsScheduled = scheduledSync({
  secrets: [daangnAdsApiKey],
  windowDays: DAANGN_SYNC_WINDOW_DAYS,
  jobs: [
    {
      job: 'daangn-insights',
      label: '당근 인사이트',
      run: ({ dateStart, dateEnd }) =>
        syncDaangnInsightRows(dateStart, dateEnd, daangnAuth()),
    },
  ],
})
