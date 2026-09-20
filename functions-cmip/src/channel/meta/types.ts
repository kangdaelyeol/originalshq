// Meta Insight API Input Value
interface ResultsValue {
  value: number
  attribution_windows: string[]
}

export type Indicator = { indicator: string; values?: ResultsValue[] }

export interface DataSetInsight {
  campaign_name: string
  adset_name: string
  impressions: number
  inline_link_clicks: number
  spend: number
  reach: number
  results?: Indicator[]
  /** results와 같은 모양(Indicator[])이지만 값이 "건수"가 아니라 "금액" —
   * 예: results가 구매 42건이면, action_values의 같은 액션에는 그 42건의
   * 합산 매출액이 들어있다. */
  action_values?: Indicator[]
  date_start: string
  date_stop: string
}

export type MetaInsight = DataSetInsight[]

// Output Summarized Data

export interface MetricsSummary {
  impressions: number
  clicks: number
  spend: number
  conversions: number
  /** 전환매출액 — action_values 합계. results가 매출과 무관한 목표(리드 등)면 0. */
  revenue: number
  ctr: number
  cpc: number
  cpa: number
  cvr: number
  cpm: number
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

/** 캠페인/adset처럼 하위 그룹 단위로 total과 "같은 도출 방식"의 시계열 3종
 * (byDate/byDayOfWeek/byGroupedWeek)을 묶어 재사용하는 형태. */
export interface GroupedInsightSeries {
  byDate: DateSummary[]
  byDayOfWeek: DayOfWeekSummary[]
  byGroupedWeek: WeekSummary[]
}

export interface AdsetSummary extends GroupedInsightSeries {
  adsetName: string
}

export interface CampaignSummary extends GroupedInsightSeries {
  campaignName: string
  adsets: AdsetSummary[]
  /** 결과 유형(Ads Manager의 "결과" 컬럼이 세는 액션 종류) — results[0].indicator를
   * 그대로(접두어만 정리) 가져온다. 캠페인 전체 기간에 결과 데이터가 하나도
   * 없으면 null. 날짜·주차별로는 값이 바뀔 수 있는 값이 아니라(캠페인은
   * 보통 목표 하나로 운영) 캠페인 단위에만 둔다 — Google/Naver엔 대응 개념이
   * 없어 그쪽 채널의 CampaignSummary엔 이 필드 자체가 없다. */
  resultType: string | null
}
