// ────────────────────────────────────────────────────────────────────────
// 당근 광고 OpenAPI 원본 응답 — 필드명은 2026-11-03 실제 키로 호출해 확인했다.
// ────────────────────────────────────────────────────────────────────────

export interface DaangnPagination {
  pageNumber: number
  pageSize: number
  totalCount: number
  totalPageCount: number
}

/** GET /v1/groups 원소 중 쓰는 것. */
export interface DaangnGroupApi {
  groupId: string
  title: string
  campaignId: string
  campaignTitle: string
  liveStatusType: 'ON' | 'OFF' | 'DELETED'
}

/** POST /v1/performance 원소(timeGranularity=DAY). duration은 그 날의 시작
 * 시각(UTC) — 한국 시각 0시라 '2026-10-28T15:00:00.000Z'가 10/29다. 비용은
 * 원 단위 정수 문자열. */
export interface DaangnPerformanceApi {
  id: string
  duration: string
  impression?: number
  reach?: number
  click?: number
  cost?: string
  install?: number
  completeRegistration?: number
  login?: number
  viewContent?: number
  addToCart?: number
  lead?: number
  purchase?: number
  purchasePrice?: number
  submitApplication?: number
}

/** 전환 이벤트별 건수 — 어느 것을 "전환"으로 볼지는 광고 목표마다 달라서
 * 원본 그대로 남긴다(conversions는 그중 구매). */
export type DaangnEvents = Pick<
  Required<DaangnPerformanceApi>,
  | 'install'
  | 'completeRegistration'
  | 'login'
  | 'viewContent'
  | 'addToCart'
  | 'lead'
  | 'purchase'
  | 'submitApplication'
>

// ────────────────────────────────────────────────────────────────────────
// 내부 가공용 — NaverInsightRow와 필드까지 같은 모양("날짜 하나 × 광고그룹
// 하나")이라 집계는 channel/naver 것을 그대로 쓴다(OpenAI와 같은 방식).
// ────────────────────────────────────────────────────────────────────────
export interface DaangnInsightRow {
  campaign_id: string
  campaign_name: string
  adgroup_id: string
  adgroup_name: string
  impressions: number
  clicks: number
  /** 당근이 준 비용 그대로(원). VAT 포함 여부는 화면 숫자와 맞춰 확인 중. */
  spend: number
  /** 구매 건수. */
  conversions: number
  /** 구매 금액(purchasePrice). */
  revenue: number
  date_start: string
  reach: number
  events: DaangnEvents
}

export type DaangnInsight = DaangnInsightRow[]
