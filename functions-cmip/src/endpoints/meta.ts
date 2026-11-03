// Meta 인사이트·광고 단위 엔드포인트.
import { metaAdsId } from '../config'
import { getMetaInsightWithHistory, syncMetaInsightRows } from '../channel/meta'
import { readMetaAdInsights, syncMetaAdRows } from '../channel/meta/ads'
import { endpoint, insightQuery } from '../http'
import { requestedRange, scheduledSync } from '../scheduled-sync'
import { onRequest } from '../trace/functions'

export const getAllInsights = onRequest(
  { secrets: [metaAdsId] },
  endpoint({ method: 'GET', validate: insightQuery }, ({ data }) =>
    // getMetaInsight(라이브 전체 조회) 대신 getMetaInsightWithHistory를
    // 쓴다 — 최근 7일은 라이브 API, 8일 이상 전은 Firestore
    // (metaInsightDaily) 배치 동기화 값을 읽어서 합친다. 반환 모양은
    // 그대로라 프론트는 손댈 게 없다(channel/meta/index.ts의
    // getMetaInsightWithHistory 주석 참고).
    getMetaInsightWithHistory(data.dateStart, data.dateEnd, metaAdsId.value()),
  ),
)

// ────────────────────────────────
// Meta 인사이트 — 동기화 + 조회. Cafe24 주문과 같은 이유로(매일 계속 쌓이고
// 어트리뷰션이 갱신되는 데이터) 삭제 없이 upsert만 한다(meta/firestore.ts
// 참고).
// ────────────────────────────────

// 롤링 재동기화 기본 범위 — LIVE_WINDOW_DAYS(7일)보다 여유 있게 잡아서,
// 어트리뷰션이 웬만큼 안정된 뒤에 DB에 반영되게 한다(cafe24의
// CAFE24_SYNC_WINDOW_DAYS와 같은 이유).
const META_SYNC_WINDOW_DAYS = 14

/**
 * Meta 인사이트를 지정한 기간만큼 라이브로 가져와 Firestore(metaInsightDaily)에
 * upsert한다. body에 startDate/endDate를 안 주면 기본으로 "최근 14일"을
 * 동기화한다 — 과거 데이터를 넓게 백필하고 싶을 때만 명시적으로 범위를
 * 넘기면 된다.
 */
export const syncMetaInsights = onRequest(
  { secrets: [metaAdsId], timeoutSeconds: 300 },
  endpoint(
    { method: 'POST', fallback: 'Meta 인사이트 동기화 실패' },
    async ({ request }) => {
      const { dateStart, dateEnd } = requestedRange(
        request,
        META_SYNC_WINDOW_DAYS,
      )
      return syncMetaInsightRows(dateStart, dateEnd, metaAdsId.value())
    },
  ),
)

/**
 * Meta 인사이트를 매일 09·11·13·15·17·22시(KST) 최근 14일 롤링 재동기화한다 —
 * syncCafe24OrdersScheduled와 같은 패턴.
 */
export const syncMetaInsightsScheduled = scheduledSync({
  secrets: [metaAdsId],
  windowDays: META_SYNC_WINDOW_DAYS,
  jobs: [
    {
      job: 'meta-insights',
      label: 'Meta 인사이트',
      run: ({ dateStart, dateEnd }) =>
        syncMetaInsightRows(dateStart, dateEnd, metaAdsId.value()),
    },
    // 광고(소재) 단위 — 광고셋 단위가 실패해도 따로 돈다(/log에 따로 남는다).
    {
      job: 'meta-ads',
      label: 'Meta 광고 단위',
      run: ({ dateStart, dateEnd }) =>
        syncMetaAdRows(dateStart, dateEnd, metaAdsId.value()),
    },
  ],
})

/**
 * Meta 광고(소재) 단위 인사이트를 Firestore(metaAdInsightDaily)에 upsert한다 —
 * 과거분 백필용. body에 startDate/endDate가 없으면 최근 14일. 광고 × 날짜라
 * 행이 많아서, 넓은 기간은 한 달씩 나눠 부른다.
 */
export const syncMetaAdInsights = onRequest(
  { secrets: [metaAdsId], timeoutSeconds: 300, memory: '512MiB' },
  endpoint(
    { method: 'POST', fallback: 'Meta 광고 단위 동기화 실패' },
    async ({ request }) => {
      const { dateStart, dateEnd } = requestedRange(
        request,
        META_SYNC_WINDOW_DAYS,
      )
      return syncMetaAdRows(dateStart, dateEnd, metaAdsId.value())
    },
  ),
)

/** "광고 성과" 탭 — [dateStart, dateEnd]의 광고 단위 광고비와 광고 →
 * 광고셋 → 캠페인 연결. 저장된 값만 읽는다(예약 동기화가 최근 14일을 하루
 * 6번 다시 받는다). */
export const getMetaAdInsights = onRequest(
  { memory: '512MiB' },
  endpoint({ method: 'GET', validate: insightQuery }, ({ data }) =>
    readMetaAdInsights(data.dateStart, data.dateEnd),
  ),
)
