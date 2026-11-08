import { BigQuery } from '@google-cloud/bigquery'
import { addBigQueryBytes } from './cost-trace'

// API 비용 분석(/log "비용 분석" 탭) — xtool·cmip의 cost-trace.ts가 남긴 호출별 로그를
// BigQuery(xtool-63b29.ops_logs)에서 함수별·날짜별로 집계한다. 로그 싱크
// (api-cost-to-bigquery)가 만든 테이블이라 필드 이름이 소문자로 바뀌어 있지만
// BigQuery 열 이름은 대소문자를 가리지 않는다. 숫자는 FLOAT로 들어와 정수로
// 바꿔 쓴다. 금액 계산(단가)은 화면이 한다 — 단가를 바꿔도 다시 배포하지 않게.

const TABLE = '`xtool-63b29.ops_logs.run_googleapis_com_stdout`'
const LOCATION = 'asia-northeast3'
// 실수로 큰 범위를 읽지 않게 — 넘으면 BigQuery가 쿼리를 거절한다.
const MAX_BYTES_BILLED = 2 * 1024 ** 3

/** 함수 하나의 기간 합계. */
export interface ApiCostByFn {
  fn: string
  /** xtool / cmip. */
  codebase: string
  trigger: string
  calls: number
  /** 5xx·예외. */
  errors: number
  /** 4xx(찾을 수 없음·잘못된 입력 등) — 실패가 아니다. */
  clientErrors: number
  coldStarts: number
  /** CORS 사전 요청(OPTIONS) — 화면이 본 요청 앞에 보내는 확인. calls에
   * 들어 있다(과금되는 호출). */
  preflights: number
  /** 걸린 시간 — 사전 요청은 빼고 본 요청만. */
  avgMs: number
  p95Ms: number
  maxMs: number
  /** 지연 나눠 보기 — 콜드 스타트 준비 시간과 Firestore·외부 호출에 쓴 시간
   * (본 요청 평균). 이 값을 남기기 시작한 로그(cost-trace.ts initMs 등)가
   * 아직 없으면 null. */
  latency: ApiLatency | null
  reads: number
  writes: number
  deletes: number
  /** 한 번에 가장 많이 읽은 수. */
  maxReads: number
  responseBytes: number
  /** 메모리 × 실행 시간(GiB·초) — 실행 비용의 재료. */
  gibSeconds: number
  /** 실행 시간 합(초) — vCPU 비용의 재료. */
  seconds: number
  externalCalls: number
  bigqueryBytes: number
  memoryMb: number
}

/** 함수 하나의 지연 나눠 보기 — 값을 남기는 로그만으로 센다. */
export interface ApiLatency {
  /** 잰 본 요청 수. */
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

/** 날짜(KST) × 함수 하나. */
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

/** 호출 하나 — 비싼(많이 읽은·오래 걸린) 호출 목록. */
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
  /** 읽기가 많은 순 / 오래 걸린 순 상위 호출. */
  topReads: ApiCostCall[]
  topSlow: ApiCostCall[]
  /** 함수별 외부 호출 — 호스트 → 횟수. */
  external: Record<string, Record<string, number>>
  /** 이 보고서를 만들며 BigQuery가 처리한 바이트. */
  bytesProcessed: number
  fetchedAt: number
}

const WHERE = `
  WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
    AND jsonPayload.kind = 'api-cost'
`

const BY_FN = `
  SELECT
    jsonPayload.fn AS fn,
    ANY_VALUE(jsonPayload.codebase) AS codebase,
    ANY_VALUE(jsonPayload.trigger) AS trigger,
    COUNT(*) AS calls,
    -- 실패는 5xx와 예외만 — 4xx(404 등)는 따로 센다. ok 값이 아니라 상태
    -- 코드로 가려 예전 로그(4xx도 ok=false로 남긴 것)에도 같게 맞는다.
    COUNTIF(jsonPayload.status >= 500 OR jsonPayload.error != '') AS errors,
    COUNTIF(jsonPayload.status >= 400 AND jsonPayload.status < 500)
      AS clientErrors,
    COUNTIF(jsonPayload.coldStart) AS coldStarts,
    COUNTIF(jsonPayload.method = 'OPTIONS') AS preflights,
    -- 걸린 시간은 본 요청만 — 사전 요청(OPTIONS)은 몇 ms라 섞으면 평균이
    -- 실제보다 짧아 보인다(APPROX_QUANTILES는 NULL을 뺀다).
    AVG(IF(jsonPayload.method != 'OPTIONS', jsonPayload.durationMs, NULL))
      AS avgMs,
    APPROX_QUANTILES(
      IF(jsonPayload.method != 'OPTIONS', jsonPayload.durationMs, NULL), 100
    )[OFFSET(95)] AS p95Ms,
    MAX(IF(jsonPayload.method != 'OPTIONS', jsonPayload.durationMs, NULL))
      AS maxMs,
    SUM(jsonPayload.reads) AS reads,
    SUM(jsonPayload.writes) AS writes,
    SUM(jsonPayload.deletes) AS deletes,
    MAX(jsonPayload.reads) AS maxReads,
    SUM(jsonPayload.responseBytes) AS responseBytes,
    SUM(jsonPayload.memoryMb / 1024 * jsonPayload.durationMs / 1000)
      AS gibSeconds,
    SUM(jsonPayload.durationMs / 1000) AS seconds,
    SUM(jsonPayload.externalCalls) AS externalCalls,
    SUM(jsonPayload.bigqueryBytes) AS bigqueryBytes,
    MAX(jsonPayload.memoryMb) AS memoryMb
  FROM ${TABLE}
  ${WHERE}
  GROUP BY fn
`

// 지연 나눠 보기 — cost-trace.ts가 initMs·readCalls 등을 남기기 시작한 뒤의
// 로그만. 이 열들은 그 로그가 처음 들어올 때 싱크가 테이블에 만들어서, 그 전에는
// 쿼리가 실패한다 — 그래서 따로 돌리고 실패하면 latency를 비워 둔다.
const LATENCY = `
  SELECT
    jsonPayload.fn AS fn,
    COUNT(*) AS samples,
    AVG(IF(jsonPayload.coldStart, jsonPayload.initMs, NULL)) AS coldInitAvgMs,
    MAX(IF(jsonPayload.coldStart, jsonPayload.initMs, NULL)) AS coldInitMaxMs,
    AVG(jsonPayload.readCalls) AS readCallsAvg,
    AVG(jsonPayload.readMs) AS readMsAvg,
    AVG(jsonPayload.externalMs) AS externalMsAvg
  FROM ${TABLE}
  ${WHERE}
    AND jsonPayload.method != 'OPTIONS'
    AND jsonPayload.readCalls IS NOT NULL
  GROUP BY fn
`

const BY_DAY = `
  SELECT
    FORMAT_TIMESTAMP('%Y-%m-%d', timestamp, 'Asia/Seoul') AS date,
    jsonPayload.fn AS fn,
    COUNT(*) AS calls,
    SUM(jsonPayload.reads) AS reads,
    SUM(jsonPayload.writes) AS writes,
    SUM(jsonPayload.deletes) AS deletes,
    SUM(jsonPayload.memoryMb / 1024 * jsonPayload.durationMs / 1000)
      AS gibSeconds,
    SUM(jsonPayload.durationMs / 1000) AS seconds
  FROM ${TABLE}
  ${WHERE}
  GROUP BY date, fn
`

// "at"은 BigQuery 예약어라 별칭으로 못 쓴다 — atMs로 받아 at으로 옮긴다.
const CALL_FIELDS = `
  UNIX_MILLIS(timestamp) AS atMs,
  jsonPayload.fn AS fn,
  jsonPayload.method AS method,
  jsonPayload.status AS status,
  jsonPayload.durationMs AS durationMs,
  jsonPayload.reads AS reads,
  jsonPayload.writes AS writes,
  jsonPayload.deletes AS deletes,
  jsonPayload.responseBytes AS responseBytes,
  jsonPayload.external AS external,
  jsonPayload.coldStart AS coldStart
`

const topCalls = (order: 'reads' | 'durationMs') => `
  SELECT ${CALL_FIELDS}
  FROM ${TABLE}
  ${WHERE}
  ORDER BY jsonPayload.${order} DESC
  LIMIT 30
`

const EXTERNAL = `
  SELECT
    jsonPayload.fn AS fn,
    jsonPayload.external AS external,
    COUNT(*) AS calls
  FROM ${TABLE}
  ${WHERE}
    AND jsonPayload.externalCalls > 0
  GROUP BY fn, external
`

const num = (value: unknown) => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}
const int = (value: unknown) => Math.round(num(value))

const toCall = (row: Record<string, unknown>): ApiCostCall => ({
  at: int(row.atMs),
  fn: String(row.fn ?? ''),
  method: String(row.method ?? ''),
  status: int(row.status),
  durationMs: int(row.durationMs),
  reads: int(row.reads),
  writes: int(row.writes),
  deletes: int(row.deletes),
  responseBytes: int(row.responseBytes),
  external: String(row.external ?? ''),
  coldStart: row.coldStart === true,
})

/** 쿼리 하나 — 결과 행과 처리한 바이트. */
const run = async (
  bigquery: BigQuery,
  query: string,
  days: number,
): Promise<{ rows: Record<string, unknown>[]; bytes: number }> => {
  const [job] = await bigquery.createQueryJob({
    query,
    location: LOCATION,
    params: { days },
    maximumBytesBilled: String(MAX_BYTES_BILLED),
  })
  const [rows] = await job.getQueryResults()
  const [metadata] = await job.getMetadata()
  return {
    rows: rows as Record<string, unknown>[],
    bytes: num(metadata.statistics?.query?.totalBytesProcessed),
  }
}

/** 최근 days일의 API 비용 보고서 — 쿼리 여섯 개를 같이 돌린다. */
export async function buildApiCostReport(days: number): Promise<ApiCostReport> {
  const bigquery = new BigQuery()
  const [fnRes, dayRes, readsRes, slowRes, extRes, latencyRes] =
    await Promise.all([
      run(bigquery, BY_FN, days),
      run(bigquery, BY_DAY, days),
      run(bigquery, topCalls('reads'), days),
      run(bigquery, topCalls('durationMs'), days),
      run(bigquery, EXTERNAL, days),
      // 열이 아직 없으면 실패한다(LATENCY 설명) — 그때는 지연 없이.
      run(bigquery, LATENCY, days).catch(() => null),
    ])
  const latencyByFn = new Map<string, ApiLatency>(
    (latencyRes?.rows ?? []).map((row) => [
      String(row.fn ?? ''),
      {
        samples: int(row.samples),
        coldInitAvgMs: int(row.coldInitAvgMs),
        coldInitMaxMs: int(row.coldInitMaxMs),
        readCallsAvg: Math.round(num(row.readCallsAvg) * 10) / 10,
        readMsAvg: int(row.readMsAvg),
        externalMsAvg: int(row.externalMsAvg),
      },
    ]),
  )

  const external: ApiCostReport['external'] = {}
  for (const row of extRes.rows) {
    const fn = String(row.fn ?? '')
    let hosts: Record<string, unknown> = {}
    try {
      hosts = JSON.parse(String(row.external ?? '{}'))
    } catch {
      continue
    }
    const target = (external[fn] ??= {})
    for (const [host, count] of Object.entries(hosts)) {
      target[host] = (target[host] ?? 0) + num(count) * int(row.calls)
    }
  }

  const bytesProcessed = [
    fnRes,
    dayRes,
    readsRes,
    slowRes,
    extRes,
    latencyRes ?? { bytes: 0 },
  ].reduce((sum, each) => sum + each.bytes, 0)
  addBigQueryBytes(bytesProcessed)

  return {
    days,
    byFn: fnRes.rows
      .map((row) => ({
        fn: String(row.fn ?? ''),
        codebase: String(row.codebase ?? ''),
        trigger: String(row.trigger ?? ''),
        calls: int(row.calls),
        errors: int(row.errors),
        clientErrors: int(row.clientErrors),
        coldStarts: int(row.coldStarts),
        preflights: int(row.preflights),
        avgMs: int(row.avgMs),
        p95Ms: int(row.p95Ms),
        maxMs: int(row.maxMs),
        latency: latencyByFn.get(String(row.fn ?? '')) ?? null,
        reads: int(row.reads),
        writes: int(row.writes),
        deletes: int(row.deletes),
        maxReads: int(row.maxReads),
        responseBytes: int(row.responseBytes),
        gibSeconds: num(row.gibSeconds),
        seconds: num(row.seconds),
        externalCalls: int(row.externalCalls),
        bigqueryBytes: int(row.bigqueryBytes),
        memoryMb: int(row.memoryMb),
      }))
      .sort((a, b) => b.reads - a.reads),
    byDay: dayRes.rows
      .map((row) => ({
        date: String(row.date ?? ''),
        fn: String(row.fn ?? ''),
        calls: int(row.calls),
        reads: int(row.reads),
        writes: int(row.writes),
        deletes: int(row.deletes),
        gibSeconds: num(row.gibSeconds),
        seconds: num(row.seconds),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    topReads: readsRes.rows.map(toCall),
    topSlow: slowRes.rows.map(toCall),
    external,
    bytesProcessed,
    fetchedAt: Date.now(),
  }
}
