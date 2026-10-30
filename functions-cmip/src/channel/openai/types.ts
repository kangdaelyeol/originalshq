// ────────────────────────────────────────────────────────────────────────
// OpenAI(ChatGPT) Ads API 원본 응답 — https://developers.openai.com/ads
// 필드명은 2026-10-30 실제 키로 호출해 확인했다.
// ────────────────────────────────────────────────────────────────────────

/** GET /ad_account/insights 응답 원소(aggregation_level=ad_group,
 * time_granularity=daily) — fields[]로 요청한 필드만 내려온다. 노출이 없는
 * 날은 행 자체가 빠진다. */
export interface OpenaiInsightApiRow {
  id: string
  campaign_id: string
  campaign_name: string
  ad_group_id: string
  ad_group_name: string
  readable_time: string
  impressions?: number
  clicks?: number
  spend?: number
  conversions?: number
  order_created_attributed_sales?: number
}

export interface OpenaiListResponse<T> {
  object: 'list'
  data: T[]
  has_more: boolean
  last_id: string | null
}

// ────────────────────────────────────────────────────────────────────────
// 내부 가공용 — NaverInsightRow와 필드까지 같은 모양("날짜 하나 × 광고그룹
// 하나"). 모양이 같아서 집계(helper/utils)는 channel/naver 것을 그대로 쓴다
// (index.ts 참고).
// ────────────────────────────────────────────────────────────────────────
export interface OpenaiInsightRow {
  campaign_id: string
  campaign_name: string
  adgroup_id: string
  adgroup_name: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  revenue: number
  date_start: string
}

export type OpenaiInsight = OpenaiInsightRow[]
