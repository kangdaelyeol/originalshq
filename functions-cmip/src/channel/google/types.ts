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
  cost: number // 원화/기본 화폐 단위
  impressions: number
  clicks: number
  conversions: number
}
