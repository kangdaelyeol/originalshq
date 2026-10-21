import { BigQuery } from '@google-cloud/bigquery'

// GA4 → BigQuery 내보내기 — GA4 속성이 이 데이터세트에 하루 한 테이블
// (events_YYYYMMDD)씩 쌓는다. 스트리밍 내보내기를 켜 두면 오늘 이벤트는
// events_intraday_YYYYMMDD에 몇 분 안에 들어온다.
//
// 데이터세트는 xtool 함수와 다른 GCP 프로젝트에 있다. 쿼리 작업은 함수가 도는
// 프로젝트(xtool-63b29)에서 실행하고 저쪽 데이터세트는 읽기만 한다 — 그래서
// 함수 서비스 계정에는 이 데이터세트의 "BigQuery 데이터 뷰어"만 있으면 된다
// (데이터세트 공유 화면에서 줄 수 있다). 쿼리 비용은 xtool-63b29에 붙는다.
const GA4_PROJECT_ID = 'micro-chiller-507902-e0'
const GA4_DATASET = 'analytics_522881907'
const GA4_LOCATION = 'asia-northeast3'

// 한 번의 조회가 읽을 수 있는 최대 데이터 양 — 실수로 큰 범위를 읽어 비용이
// 나가는 것을 막는다. 넘으면 BigQuery가 쿼리를 거절한다.
const MAX_BYTES_BILLED = 5 * 1024 ** 3
const MAX_ROWS = 20_000

/** 이벤트 하나 — 화면 타임라인에 그대로 쓴다. */
export interface Ga4Event {
  clientId: string
  /** 이벤트 시각(ms). */
  at: number
  name: string
  pageLocation: string | null
  pageTitle: string | null
  /** GA4 세션 id — 같은 값이면 한 방문. */
  sessionId: number | null
  /** 이벤트에 붙은 유입 값(세션 시작 등에만 있다). */
  source: string | null
  medium: string | null
  campaign: string | null
  /** 사용자 첫 유입(traffic_source) — 그 사람이 처음 어디서 왔는지. */
  firstSource: string | null
  firstMedium: string | null
  firstCampaign: string | null
  deviceCategory: string | null
  os: string | null
  browser: string | null
  country: string | null
  city: string | null
}

const param = (key: string, kind: 'string_value' | 'int_value') =>
  `(SELECT value.${kind} FROM UNNEST(event_params) WHERE key = '${key}')`

const QUERY = `
  SELECT
    user_pseudo_id AS clientId,
    -- "at"은 BigQuery 예약어라 별칭으로 못 쓴다.
    DIV(event_timestamp, 1000) AS eventAtMs,
    event_name AS name,
    ${param('page_location', 'string_value')} AS pageLocation,
    ${param('page_title', 'string_value')} AS pageTitle,
    ${param('ga_session_id', 'int_value')} AS sessionId,
    ${param('source', 'string_value')} AS source,
    ${param('medium', 'string_value')} AS medium,
    ${param('campaign', 'string_value')} AS campaign,
    traffic_source.source AS firstSource,
    traffic_source.medium AS firstMedium,
    traffic_source.name AS firstCampaign,
    device.category AS deviceCategory,
    device.operating_system AS os,
    device.web_info.browser AS browser,
    geo.country AS country,
    geo.city AS city
  FROM \`${GA4_PROJECT_ID}.${GA4_DATASET}.events_*\`
  WHERE
    (
      _TABLE_SUFFIX BETWEEN @fromDate AND @toDate
      OR _TABLE_SUFFIX BETWEEN CONCAT('intraday_', @fromDate)
        AND CONCAT('intraday_', @toDate)
    )
    AND user_pseudo_id IN UNNEST(@clientIds)
  ORDER BY eventAtMs
  LIMIT ${MAX_ROWS}
`

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** clientIds의 GA4 이벤트 — [fromDate, toDate](YYYYMMDD) 범위의 일별·실시간
 * 테이블에서, 시간순. */
export async function fetchGa4Events(
  clientIds: string[],
  fromDate: string,
  toDate: string,
): Promise<{ events: Ga4Event[]; bytesProcessed: number }> {
  if (clientIds.length === 0) return { events: [], bytesProcessed: 0 }
  // projectId를 주지 않으면 함수가 도는 프로젝트에서 작업을 실행한다.
  const bigquery = new BigQuery()
  const [job] = await bigquery.createQueryJob({
    query: QUERY,
    location: GA4_LOCATION,
    params: { clientIds, fromDate, toDate },
    maximumBytesBilled: String(MAX_BYTES_BILLED),
  })
  const [rows] = await job.getQueryResults()
  const [metadata] = await job.getMetadata()
  const events = (rows as Record<string, unknown>[]).map((row) => ({
    clientId: String(row.clientId),
    at: toNumber(row.eventAtMs) ?? 0,
    name: String(row.name ?? ''),
    pageLocation: (row.pageLocation as string | null) ?? null,
    pageTitle: (row.pageTitle as string | null) ?? null,
    sessionId: toNumber(row.sessionId),
    source: (row.source as string | null) ?? null,
    medium: (row.medium as string | null) ?? null,
    campaign: (row.campaign as string | null) ?? null,
    firstSource: (row.firstSource as string | null) ?? null,
    firstMedium: (row.firstMedium as string | null) ?? null,
    firstCampaign: (row.firstCampaign as string | null) ?? null,
    deviceCategory: (row.deviceCategory as string | null) ?? null,
    os: (row.os as string | null) ?? null,
    browser: (row.browser as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    city: (row.city as string | null) ?? null,
  }))
  return {
    events,
    bytesProcessed: Number(
      metadata.statistics?.query?.totalBytesProcessed ?? 0,
    ),
  }
}
