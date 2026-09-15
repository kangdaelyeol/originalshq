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
