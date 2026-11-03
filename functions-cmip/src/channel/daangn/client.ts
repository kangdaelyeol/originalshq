// 당근 광고 OpenAPI 호출 — 라이브 조회(getDaangnInsightWithHistory)와 Firestore
// 배치 동기화(syncDaangnInsightRows) 둘 다 fetchAllDaangnInsightRows 하나를
// 공유한다(openai/client.ts와 같은 이유).
import { addDays } from '../utils'
import {
  ADVERTISER_ID,
  API_BASE_URL,
  PAGE_SIZE,
  PERFORMANCE_MAX_DAYS,
  PERFORMANCE_MAX_IDS,
} from './constants'
import type {
  DaangnGroupApi,
  DaangnInsight,
  DaangnPagination,
  DaangnPerformanceApi,
} from './types'

export interface DaangnCredentials {
  apiKey: string
}

// 한도(분당 60회)를 넘으면 429 — 문서대로 1·2·4초씩 늘려 가며 다시 시도한다.
const RETRY_DELAYS_MS = [1000, 2000, 4000]

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** 인증 헤더(키·광고 계정)를 붙여 부르고 JSON으로 파싱한다. body가 있으면 POST. */
export async function fetchDaangn<T>(
  path: string,
  credentials: DaangnCredentials,
  body?: unknown,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'X-API-KEY': credentials.apiKey,
        'X-ADVERTISER-ID': ADVERTISER_ID,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (response.ok) return (await response.json()) as T

    const errorText = await response.text()
    const retryable = response.status === 429 || response.status >= 500
    if (retryable && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt])
      continue
    }
    throw new Error(`당근 광고 API 호출 실패(${path}): ${errorText}`)
  }
}

/** 광고그룹 전부 — 지난 기간 성과도 받으려고 꺼진·지운 것까지. */
export async function fetchDaangnGroups(
  credentials: DaangnCredentials,
): Promise<DaangnGroupApi[]> {
  const groups: DaangnGroupApi[] = []
  const statuses = ['ON', 'OFF', 'DELETED']
    .map((s) => `liveStatusTypes=${s}`)
    .join('&')
  for (let page = 1; ; page++) {
    const res = await fetchDaangn<{
      groups?: DaangnGroupApi[]
      pagination?: DaangnPagination
    }>(
      `/v1/groups?pageNumber=${page}&pageSize=${PAGE_SIZE}&${statuses}`,
      credentials,
    )
    groups.push(...(res.groups ?? []))
    if (!res.pagination || page >= res.pagination.totalPageCount) return groups
  }
}

/** 성과의 duration(그 날 0시, UTC 표기) → 한국 날짜. */
const kstDateOf = (duration: string): string =>
  new Date(Date.parse(duration) + 9 * 3_600_000).toISOString().slice(0, 10)

/** [start, end](포함)를 maxDays일씩 나눈다. */
const splitRange = (start: string, end: string, maxDays: number) => {
  const out: [string, string][] = []
  for (let s = start; s <= end; s = addDays(s, maxDays)) {
    const e = addDays(s, maxDays - 1)
    out.push([s, e < end ? e : end])
  }
  return out
}

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size))
  return out
}

/**
 * [dateStart, dateEnd](포함, 한국 날짜) 구간의 광고그룹 × 일별 행을 전부
 * 모은다 — 광고그룹 목록을 받아 50개씩, 기간은 31일씩 나눠 성과 API를 부른다.
 * 노출·클릭·비용이 모두 0인 날은 뺀다(다른 매체처럼 집행한 날만 남긴다).
 */
export async function fetchAllDaangnInsightRows(
  dateStart: string,
  dateEnd: string,
  credentials: DaangnCredentials,
): Promise<DaangnInsight> {
  const groups = await fetchDaangnGroups(credentials)
  const byId = new Map(groups.map((g) => [g.groupId, g]))
  const rows: DaangnInsight = []
  for (const [start, end] of splitRange(
    dateStart,
    dateEnd,
    PERFORMANCE_MAX_DAYS,
  )) {
    for (const ids of chunk(
      groups.map((g) => g.groupId),
      PERFORMANCE_MAX_IDS,
    )) {
      const res = await fetchDaangn<{ performances?: DaangnPerformanceApi[] }>(
        '/v1/performance',
        credentials,
        {
          startDateTime: `${start}T00:00:00+09:00`,
          endDateTime: `${end}T23:59:59+09:00`,
          timeGranularity: 'DAY',
          analysisItem: 'Group',
          ids,
        },
      )
      for (const p of res.performances ?? []) {
        const date = kstDateOf(p.duration)
        // 기간 끝을 포함하는 날까지 오므로 요청한 범위만 남긴다.
        if (date < start || date > end) continue
        const spend = Number(p.cost ?? 0)
        if (!(p.impression || p.click || spend)) continue
        const group = byId.get(p.id)
        rows.push({
          campaign_id: group?.campaignId ?? '',
          campaign_name: group?.campaignTitle ?? '',
          adgroup_id: p.id,
          adgroup_name: group?.title ?? '',
          impressions: p.impression ?? 0,
          clicks: p.click ?? 0,
          spend,
          conversions: p.purchase ?? 0,
          revenue: p.purchasePrice ?? 0,
          date_start: date,
          reach: p.reach ?? 0,
          events: {
            install: p.install ?? 0,
            completeRegistration: p.completeRegistration ?? 0,
            login: p.login ?? 0,
            viewContent: p.viewContent ?? 0,
            addToCart: p.addToCart ?? 0,
            lead: p.lead ?? 0,
            purchase: p.purchase ?? 0,
            submitApplication: p.submitApplication ?? 0,
          },
        })
      }
    }
  }
  return rows
}
