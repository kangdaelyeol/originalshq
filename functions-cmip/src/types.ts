/**
 * 매체 키/라벨 — Python `src/core/database.py` 상단 상수 이관.
 */

import { DetectedChannel, ParsedRow, ParseResult } from './csv'

export type ISODate = string

export const Channel = [
  'naver',
  'meta',
  'google',
  'daangn',
  'smartstore',
] as const

export type Channel = (typeof Channel)[number]

export const ChannelKo = {
  naver: '네이버',
  meta: '메타',
  google: '구글',
  daangn: '당근',
  smartstore: '스마트스토어',
} as const

export type ChannelKo = (typeof ChannelKo)[keyof typeof ChannelKo]

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

/** importRowsBatch에 넘길 수 있는 원소 형태 — ParseResult 자체, row 배열, 단일 row 모두 허용. */
export type ImportBatchItem = ParseResult | ParsedRow[] | ParsedRow

export interface ImportBatchResult {
  inserted: number
  deleted: number
}

/** (채널, 캠페인명, 날짜) 튜플. */
export type ConflictKey = readonly [string, string, string]

export interface ManualCommerceEntry {
  date: string
  orders?: number
  revenue?: number
}

// --------------------------------------------------------------------------- //
// 공통: base64 파일 → ParseResult
// --------------------------------------------------------------------------- //
export interface CsvFileInput {
  name?: string
  contentBase64: string
  channelHint?: DetectedChannel | null
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
// importCsv — 실제 적재
// --------------------------------------------------------------------------- //
export interface ImportCsvData {
  brandId: string | number
  files: CsvFileInput[]
}

export interface ImportCsvResult extends ImportBatchResult {
  warnings: string[]
}

// --------------------------------------------------------------------------- //
// previewCsv — 미리보기(드라이런)
// --------------------------------------------------------------------------- //
export interface PreviewCsvData {
  brandId: string | number
  files: CsvFileInput[]
}

export interface PreviewCsvFileSummary {
  source: string
  channel: ParseResult['channel']
  format: ParseResult['detectedFormat']
  rowCount: number
  dateRange: ParseResult['dateRange']
  warnings: string[]
  sample: ParseResult['rows']
}

export interface PreviewCsvResult {
  files: PreviewCsvFileSummary[]
  totalRows: number
  conflicts: ConflictKey[]
}

// --------------------------------------------------------------------------- //
// saveCommerceRevenue — 커머스 채널 수기입력
// --------------------------------------------------------------------------- //
export interface SaveCommerceRevenueData {
  brandId: string | number
  entries: ManualCommerceEntry[]
  channel?: Channel
}
