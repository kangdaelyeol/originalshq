export const API_BASE_URL = 'https://api.ads.openai.com/v1'

// GET /ad_account/insights의 fields[] — 지정하지 않으면 impressions만
// 내려온다(2026-10-30 실제 호출로 확인). readable_time은 계정 시간대
// (Asia/Seoul) 기준 "YYYY-MM-DD"라 그대로 date_start로 쓴다.
// spend는 micros가 아니라 계정 통화(KRW) 원 단위 그대로다.
export const INSIGHT_FIELDS = [
  'campaign_id',
  'campaign_name',
  'ad_group_id',
  'ad_group_name',
  'readable_time',
  'impressions',
  'clicks',
  'spend',
  'conversions',
  'order_created_attributed_sales',
] as const

// 요청 한 번에 받을 최대 행 수 — API 상한(1~2000).
export const PAGE_LIMIT = 2000

// time_ranges[]의 timezone — 계정 시간대와 같지만, 다른 채널과 날짜 경계를
// 확실히 맞추려고 명시한다.
export const TIMEZONE = 'Asia/Seoul'
