// Meta Insight API Input Value
interface ResultsValue {
  value: number
  attribution_windows: string[]
}

type Indicator = { indicator: string; values?: ResultsValue[] }

export interface DataSetInsight {
  campaign_name: string
  adset_name: string
  impressions: number
  inline_link_clicks: number
  spend: number
  reach: number
  results?: Indicator[]
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
