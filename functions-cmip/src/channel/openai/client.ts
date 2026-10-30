// OpenAI Ads API 호출 — 라이브 조회(getOpenaiInsightWithHistory)와 Firestore
// 배치 동기화(syncOpenaiInsightRows) 둘 다 fetchAllOpenaiInsightRows 하나를
// 공유한다(naver/client.ts와 같은 이유).
import { API_BASE_URL, INSIGHT_FIELDS, PAGE_LIMIT, TIMEZONE } from './constants'
import type {
  OpenaiInsight,
  OpenaiInsightApiRow,
  OpenaiListResponse,
} from './types'

/** API 키 하나가 광고 계정 하나에 묶여 있어(키로 계정이 정해진다) 계정 ID를
 * 따로 보내지 않는다. */
export interface OpenaiCredentials {
  apiKey: string
}

// 429·5xx는 이만큼 쉬었다가 다시 시도한다 — 공식 문서가 구체적인 한도 수치
// 없이 "bounded retries with increasing delays"만 권한다.
const RETRY_DELAYS_MS = [1000, 3000, 6000]

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** 인증 헤더를 붙여 GET 요청하고 JSON으로 파싱한다. query 값이 배열이면
 * 같은 키를 반복해서 붙인다(fields[]=a&fields[]=b). */
export async function fetchOpenai<T>(
  path: string,
  query: Record<string, string | readonly string[]>,
  credentials: OpenaiCredentials,
  /** 있으면 POST로 JSON 본문을 보낸다(조회용 POST — /conversions/insights 등). */
  body?: unknown,
): Promise<T> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') params.append(key, value)
    else for (const v of value) params.append(key, v)
  }
  const qs = params.toString()
  const url = qs ? `${API_BASE_URL}${path}?${qs}` : `${API_BASE_URL}${path}`

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(
      url,
      body === undefined
        ? { headers: { Authorization: `Bearer ${credentials.apiKey}` } }
        : {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${credentials.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          },
    )
    if (response.ok) return (await response.json()) as T

    const errorText = await response.text()
    const retryable = response.status === 429 || response.status >= 500
    if (retryable && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt])
      continue
    }
    throw new Error(`OpenAI Ads API 호출 실패(${path}): ${errorText}`)
  }
}

/** [dateStart, dateEnd](포함) 구간의 광고그룹 × 일별 행을 전부 모은다 —
 * 계정 단위 insights 한 번으로 모든 광고그룹이 오고, has_more면 last_id를
 * after로 넘겨 다음 페이지를 받는다. */
export async function fetchAllOpenaiInsightRows(
  dateStart: string,
  dateEnd: string,
  credentials: OpenaiCredentials,
): Promise<OpenaiInsight> {
  const baseQuery = {
    aggregation_level: 'ad_group',
    time_granularity: 'daily',
    'time_ranges[]': JSON.stringify({
      type: 'date_range',
      since: dateStart,
      until: dateEnd,
      timezone: TIMEZONE,
    }),
    'fields[]': INSIGHT_FIELDS,
    limit: String(PAGE_LIMIT),
  }

  const rows: OpenaiInsightApiRow[] = []
  let after: string | null = null
  do {
    const page: OpenaiListResponse<OpenaiInsightApiRow> =
      await fetchOpenai<OpenaiListResponse<OpenaiInsightApiRow>>(
        '/ad_account/insights',
        after ? { ...baseQuery, after } : baseQuery,
        credentials,
      )
    rows.push(...page.data)
    after = page.has_more ? page.last_id : null
  } while (after)

  return rows.map((row) => ({
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    adgroup_id: row.ad_group_id,
    adgroup_name: row.ad_group_name,
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    spend: Number(row.spend || 0),
    conversions: Number(row.conversions || 0),
    revenue: Number(row.order_created_attributed_sales || 0),
    date_start: row.readable_time,
  }))
}
