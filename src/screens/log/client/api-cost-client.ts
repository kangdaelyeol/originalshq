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
  /** CORS 사전 요청(OPTIONS) 수 — calls에 들어 있다. 예전 응답에는 없다. */
  preflights?: number
  /** 걸린 시간 — 사전 요청은 빼고 본 요청만(예전 응답은 사전 요청까지 섞인 값). */
  avgMs: number
  p95Ms: number
  maxMs: number
  /** 지연 나눠 보기 — 그 값을 남기는 로그가 아직 없으면 null, 예전 응답에는 없다. */
  latency?: ApiLatency | null
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

/** 함수 하나의 지연 나눠 보기(functions-xtool api-cost.ts ApiLatency). */
export interface ApiLatency {
  samples: number
  /** 콜드 스타트 준비 시간(인스턴스가 뜬 뒤 첫 요청을 받기까지) 평균·최대(ms). */
  coldInitAvgMs: number
  coldInitMaxMs: number
  /** 호출당 Firestore 왕복 수와 그 시간(ms) 평균. */
  readCallsAvg: number
  readMsAvg: number
  /** 호출당 외부 호출 시간(ms) 평균. */
  externalMsAvg: number
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
