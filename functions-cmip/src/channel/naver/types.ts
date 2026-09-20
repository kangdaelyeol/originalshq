// ────────────────────────────────────────────────────────────────────────
// Naver 검색광고(SearchAd) API 원본 응답 — 실제 필드명은 공식 문서
// (https://naver.github.io/searchad-apidoc/) 기준으로 우선 반영했다. 문서가
// JS로 렌더링돼 있어 응답 예제 일부는 커뮤니티/이슈 트래커에서 확인한 값이라,
// 실제 키를 발급받아 호출해보면서 보정이 필요할 수 있다(특히 NaverStatRow의
// 날짜 필드명 — 하단 helper.ts 주석 참고).
// ────────────────────────────────────────────────────────────────────────

/** GET /ncc/campaigns 응답 원소. */
export interface NaverCampaign {
  nccCampaignId: string
  name: string
  customerId?: number
  status?: string
}

/** GET /ncc/adgroups 응답 원소 — Meta의 adset에 대응. */
export interface NaverAdgroup {
  nccAdgroupId: string
  nccCampaignId: string
  name: string
  status?: string
}

/** GET /stats 응답 원소 — id(캠페인/adgroup 등)별 지표 한 덩이.
 * fields 파라미터로 요청한 필드만 내려온다. */
export interface NaverStatRow {
  /** 조회 레벨에 따라 nccCampaignId 또는 nccAdgroupId. */
  id: string
  impCnt?: number
  clkCnt?: number
  salesAmt?: number
  /** 전환수 — 전환 추적(스크립트)을 붙인 계정만 값이 채워진다. */
  ccnt?: number
  /** 전환매출액 — ccnt와 마찬가지로 전환 추적을 붙인 계정만 값이 채워진다. */
  convAmt?: number
}

// ────────────────────────────────────────────────────────────────────────
// 내부 가공용 — Meta의 DataSetInsight와 같은 역할. 원본 API 응답(캠페인/
// adgroup 목록 + 날짜별 stat)을 조합해 "날짜 하나 × adgroup 하나" 행으로
// 펼친 것. helper.ts는 이 행 배열만 알면 된다(원본 API 응답 형태를 몰라도 됨).
// ────────────────────────────────────────────────────────────────────────
export interface NaverInsightRow {
  campaign_name: string
  adgroup_name: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  revenue: number
  date_start: string
}

export type NaverInsight = NaverInsightRow[]

// ────────────────────────────────────────────────────────────────────────
// Output Summarized Data — Meta(functions-cmip/src/channel/meta/types.ts)와
// 완전히 같은 모양이다. 프론트가 채널마다 다른 타입을 다룰 필요 없이 하나의
// 계약(MetricsSummary 등)만 알면 되도록 의도적으로 맞췄다.
// ────────────────────────────────────────────────────────────────────────
export interface MetricsSummary {
  impressions: number
  clicks: number
  spend: number
  conversions: number
  /** 전환매출액 — convAmt 합계. 전환 추적을 안 붙인 계정/기간은 0. */
  revenue: number
  ctr: number
  cpc: number
  cpa: number
  cvr: number
  cpm: number
  /** 네이버 검색광고엔 도달·빈도(reach/frequency) 개념이 없어 항상 0 —
   * Google Ads의 adGroup 레벨 frequency=0과 같은 이유(그 채널·레벨엔 아예
   * 없는 지표를 억지로 만들지 않고 0으로 채워 계약 모양만 맞춘다). */
  frequency: number
}

export interface DateSummary extends MetricsSummary {
  date: string
}

export interface DayOfWeekSummary extends MetricsSummary {
  dayOfWeek: string
}

export interface DateRange {
  start: string
  end: string
}

export interface WeekSummary extends MetricsSummary {
  period: string
  startDate: string
  endDate: string
}

/** 캠페인/adgroup처럼 하위 그룹 단위로 total과 "같은 도출 방식"의 시계열 3종
 * (byDate/byDayOfWeek/byGroupedWeek)을 묶어 재사용하는 형태. */
export interface GroupedInsightSeries {
  byDate: DateSummary[]
  byDayOfWeek: DayOfWeekSummary[]
  byGroupedWeek: WeekSummary[]
}

/** 이름은 adsetName이지만 실제로는 네이버 광고그룹(adgroup)명이 들어간다 —
 * Meta/Google과 같은 계약(프론트의 AdsetSummary)을 그대로 쓰기 위함. */
export interface AdsetSummary extends GroupedInsightSeries {
  adsetName: string
}

export interface CampaignSummary extends GroupedInsightSeries {
  campaignName: string
  adsets: AdsetSummary[]
}
