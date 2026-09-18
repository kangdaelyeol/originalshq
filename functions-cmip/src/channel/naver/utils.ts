import * as crypto from 'crypto'
import { DateRange, MetricsSummary, NaverInsightRow } from './types'

// ────────────────────────────────────────────────────────────────────────
// 인증 — 네이버 검색광고 API는 OAuth 토큰이 아니라 요청마다 HMAC-SHA256
// 서명을 직접 만들어 보낸다. 서명 대상 문자열은 "{timestamp}.{method}.{uri}"
// (uri는 쿼리스트링 제외, 경로만 — 예: "/stats"), SECRET_KEY로 HMAC-SHA256
// 해시한 뒤 base64 인코딩한다.
// 참고: https://naver.github.io/searchad-apidoc/#/guides/auth
// ────────────────────────────────────────────────────────────────────────

export const buildNaverSignature = (
  timestamp: string,
  method: string,
  uri: string,
  secretKey: string,
): string => {
  const message = `${timestamp}.${method}.${uri}`
  return crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('base64')
}

/** 요청 하나에 실어 보낼 인증 헤더 4종을 한 번에 만든다. uri는 쿼리스트링을
 * 뺀 경로만 넘길 것(예: "/stats", "/ncc/campaigns"). */
export const buildNaverHeaders = (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  uri: string,
  apiKey: string,
  secretKey: string,
  customerId: string,
): Record<string, string> => {
  const timestamp = Date.now().toString()
  const signature = buildNaverSignature(timestamp, method, uri, secretKey)

  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Timestamp': timestamp,
    'X-API-KEY': apiKey,
    'X-Customer': customerId,
    'X-Signature': signature,
  }
}

// ────────────────────────────────────────────────────────────────────────
// 지표 계산 — Meta(channel/meta/utils.ts)와 동일한 공식. reach가 없어
// frequency는 항상 0.
// ────────────────────────────────────────────────────────────────────────

export const round2 = (n: number): number => Math.round(n * 100) / 100

function calcMetrics(
  impressions: number,
  clicks: number,
  spend: number,
  conversions: number,
): MetricsSummary {
  return {
    impressions,
    clicks,
    spend,
    conversions,
    ctr: impressions > 0 ? round2((clicks / impressions) * 100) : 0,
    cpc: clicks > 0 ? round2(spend / clicks) : 0,
    cpa: conversions > 0 ? round2(spend / conversions) : 0,
    cvr: clicks > 0 ? round2((conversions / clicks) * 100) : 0,
    cpm: impressions > 0 ? round2((spend / impressions) * 1000) : 0,
    frequency: 0,
  }
}

export const sumRows = (rows: NaverInsightRow[]): MetricsSummary => {
  const impressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0)
  const clicks = rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0)
  const spend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0)
  const conversions = rows.reduce((s, r) => s + (Number(r.conversions) || 0), 0)

  return calcMetrics(impressions, clicks, spend, conversions)
}

// ────────────────────────────────────────────────────────────────────────
// 날짜 연산 — Meta(channel/meta/utils.ts)와 완전히 동일(그대로 복사) —
// buildWeekRanges가 계정 전체(functions-cmip 전 채널)에서 항상 같은 방식으로
// 주차를 잘라야 채널 간 경계가 어긋나지 않는다.
// ────────────────────────────────────────────────────────────────────────

export const getSearchDate = (startDate: string, endDate: string): number => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1)
}

export const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 시작~끝(포함) 날짜 배열 — /stats를 하루씩 순회 호출할 때 쓴다. */
export const dateRange = (startDate: string, endDate: string): string[] => {
  const out: string[] = []
  for (let cur = startDate; cur <= endDate; cur = addDays(cur, 1)) {
    out.push(cur)
  }
  return out
}

export const formatMD = (dateStr: string): string => {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export const buildWeekRanges = (
  startDate: string,
  endDate: string,
): DateRange[] => {
  const searchDate = getSearchDate(startDate, endDate)
  const remDate = searchDate % 7

  const ranges: DateRange[] = []
  let cursor = startDate

  if (remDate > 0) {
    const rangeEnd = addDays(cursor, remDate - 1)
    ranges.push({ start: cursor, end: rangeEnd })
    cursor = addDays(cursor, remDate)
  }

  while (cursor <= endDate) {
    const rangeEnd = addDays(cursor, 6)
    ranges.push({ start: cursor, end: rangeEnd })
    cursor = addDays(cursor, 7)
  }

  return ranges
}
