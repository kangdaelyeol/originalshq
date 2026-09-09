export type ISODate = string

export const Channel = [
  'naver',
  'meta',
  'google',
  'daangn',
  'smartstore',
] as const

export type Channel = (typeof Channel)[number]

// --------------------------------------------------------------------------- //
// 브랜드 — 운영 대상은 xTool / BleeqUp 둘뿐. id = Firestore brands/{id} 문서 ID.
// --------------------------------------------------------------------------- //
export const BRAND_OPTIONS = [
  { id: 'xtool', label: 'xTool' },
  { id: 'bleequp', label: 'BleeqUp' },
] as const

export type BrandId = (typeof BRAND_OPTIONS)[number]['id']

export interface WindowStats {
  cost: number
  clicks: number
  imps: number
  conv: number
  rev: number
  ctr: number
  cpa: number
  roas: number
}

// --------------------------------------------------------------------------- //
// alertCheck — 이상 징후 재검사
// --------------------------------------------------------------------------- //
export interface AlertCheckData {
  brandId: string | number
  refDate?: ISODate | null
  periodLen?: number
}

export type AlertType =
  | 'CPA_SURGE'
  | 'CPA_IMPROVE'
  | 'CTR_DROP'
  | 'INEFFICIENCY'

export interface ManualCommerceEntry {
  date: string
  orders?: number
  revenue?: number
}

// --------------------------------------------------------------------------- //
// mortarScore
// --------------------------------------------------------------------------- //
export interface MortarScoreData {
  brandId: string | number
  refDate?: ISODate | null
  periodLen?: number
}

// --------------------------------------------------------------------------- //
// saveCommerceRevenue — 커머스 채널 수기입력
// --------------------------------------------------------------------------- //
export interface SaveCommerceRevenueData {
  brandId: string | number
  entries: ManualCommerceEntry[]
  channel?: Channel
}

// --------------------------------------------------------------------------- //
// generateReport — 주간/월간 보고서 구조 데이터
// brandId만 필수. 날짜를 비우면 서버가 (주간 최근 7일 / 월간 최근 30일, 어제까지)로 채운다.
// --------------------------------------------------------------------------- //
export type ReportType = 'weekly' | 'monthly'
export type ReportFmt = 'pdf' | 'docx'

export interface GenerateReportData {
  brandId: string | number
  reportType?: ReportType
  dateStart?: ISODate | null
  dateEnd?: ISODate | null
  notes?: string
  nextPlanNote?: string
  fmt?: ReportFmt
}
