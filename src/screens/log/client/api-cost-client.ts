import { requestJson } from './http'

// API 비용 분석 — functions-xtool getApiCosts(BigQuery ops_logs 집계). 모양은
// functions-xtool/src/api-cost.ts와 같다.

export interface ApiCostByFn {
  fn: string
  /** xtool / cmip — 예전 응답에는 없다. */
  codebase?: string
  trigger: string
  calls: number
  /** 5xx·예외. */
  errors: number
  /** 4xx(찾을 수 없음·잘못된 입력 등) — 실패가 아니다. 예전 응답에는 없다. */
  clientErrors?: number
  coldStarts: number
  avgMs: number
  p95Ms: number
  maxMs: number
  reads: number
  writes: number
  deletes: number
  maxReads: number
  responseBytes: number
  gibSeconds: number
  seconds: number
  externalCalls: number
  bigqueryBytes: number
  memoryMb: number
}

export interface ApiCostByDay {
  date: string
  fn: string
  calls: number
  reads: number
  writes: number
  deletes: number
  gibSeconds: number
  seconds: number
}

export interface ApiCostCall {
  at: number
  fn: string
  method: string
  status: number
  durationMs: number
  reads: number
  writes: number
  deletes: number
  responseBytes: number
  external: string
  coldStart: boolean
}

export interface ApiCostReport {
  days: number
  byFn: ApiCostByFn[]
  byDay: ApiCostByDay[]
  topReads: ApiCostCall[]
  topSlow: ApiCostCall[]
  external: Record<string, Record<string, number>>
  bytesProcessed: number
  fetchedAt: number
  cached: boolean
}

export const getApiCosts = (days: number) =>
  requestJson<ApiCostReport>(
    `getApiCosts?days=${days}`,
    'API 비용을 불러오지 못했습니다',
  )
