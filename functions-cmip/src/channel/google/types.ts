export interface GetGoogleInsightParams {
  brandId: string
  dateStart: string // YYYY-MM-DD
  dateEnd: string // YYYY-MM-DD
  loginCustomerId: string
}

export interface GoogleInsightRow {
  date: string
  campaignId: string
  campaignName: string
  costMicros: number
  cost: number
  impressions: number
  clicks: number
  conversions: number
}

export interface AdsMetricsRow {
  segments?: { date?: string }
  campaign?: { id?: string; name?: string }
  metrics?: {
    costMicros?: string | number
    impressions?: string | number
    clicks?: string | number
    conversions?: string | number
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
  }
}
