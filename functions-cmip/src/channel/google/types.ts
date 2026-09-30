export interface GetGoogleInsightParams {
  brandId: string
  dateStart: string // YYYY-MM-DD
  dateEnd: string // YYYY-MM-DD
  loginCustomerId: string
}

// 캠페인 단위 가공된 행 하나 — GAQL 원본(AdsMetricsRow)에서 파생 지표까지
// 계산해 붙인 모양. Firestore(googleCampaignInsightDaily) 저장/조회에도
// 그대로 쓰인다(client.ts/firestore.ts 참고).
export interface GoogleCampaignInsightRow {
  date: string
  campaignId: string
  campaignName: string
  costMicros: number
  cost: number
  impressions: number
  clicks: number
  conversions: number
  conversionsValue: number
  ctr: number
  cpc: number
  cpa: number
  cvr: number
  cpm: number
  frequency: number
}

// adGroup(adset) 단위 — 캠페인 단위와 같은 지표 + adGroup 식별자.
// Google 정책상 frequency는 adGroup 레벨에서 지원 안 돼 항상 0.
export interface GoogleAdGroupInsightRow extends GoogleCampaignInsightRow {
  adGroupId: string
  adGroupName: string
}

export interface AdsMetricsRow {
  segments?: { date?: string }
  campaign?: { id?: string; name?: string }
  metrics?: {
    costMicros?: string | number
    impressions?: string | number
    clicks?: string | number
    conversions?: string | number
    conversionsValue?: string | number
  }
}

export interface AdGroupMetricsRow {
  segments?: { date?: string }
  adGroup?: { id?: string; name?: string; campaign?: string }
  campaign?: { id?: string; name?: string } // 추가
  metrics?: {
    costMicros?: string | number
    impressions?: string | number
    clicks?: string | number
    conversions?: string | number
    conversionsValue?: string | number
  }
}
