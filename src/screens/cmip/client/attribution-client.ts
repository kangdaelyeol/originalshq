/**
 * getMondayAttribution 클라이언트 — functions-xtool `getMondayAttribution`
 * (onRequest, GET) 호출. xtool 통합 고객(전화번호 기준)마다 처음 나타난 날,
 * 유입 경로로 판정한 광고 채널, 구매 내역을 한 줄씩 준다. ROAS 탭의 "광고
 * 기여 ROAS"(하한)와 "고객 유입 월 코호트 ROAS"가 광고비와 맞춰 계산한다.
 */
import { API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'

/** 가장 이른 상담의 UTM source로 묶은 채널 — meta/google/naver는 UTM이 광고
 * 채널인 고객, other는 UTM은 있지만 광고비를 모으지 않는 곳(chatgpt.com·당근
 * 등), unknown은 UTM이 없는 고객(문의 없이 산 고객, UTM 없이 들어온 문의
 * 포함). 방문체험 보드의 유입경로(영업전환·자연유입)는 쓰지 않는다. */
export type AttributionChannel =
  'meta' | 'google' | 'naver' | 'other' | 'unknown'

/** 고객 1명 — [처음 나타난 날, 채널, UTM source, [결제일, 금액][], 그 UTM
 * 상담의 접수일]. 구매는 날짜별로 합쳐져 있고 취소는 빠져 있다(오래된 순).
 * 접수일은 UTM이 없으면 ''(예전 형식의 데이터엔 아예 없을 수 있다). */
export type AttributionRow = [
  ISODate,
  AttributionChannel,
  string,
  [ISODate, number][],
  (ISODate | '')?,
]

export async function getAttribution(): Promise<AttributionRow[]> {
  const res = await fetch(`${API_BASE}/getMondayAttribution`)

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(
      'getMondayAttribution 응답을 해석할 수 없습니다.',
      res.status,
    )
  }

  if (!res.ok) {
    const message =
      (body as { error?: string })?.error ??
      `getMondayAttribution 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return (body as { rows: AttributionRow[] }).rows
}

const AD_CHANNEL_SET: ReadonlySet<AttributionChannel> = new Set([
  'meta',
  'google',
  'naver',
])

/** 광고 성과로 인정하는 기간(일) — UTM 상담 접수일부터. */
export const AD_ATTRIBUTION_DAYS = 90

export const isAdChannel = (channel: AttributionChannel): boolean =>
  AD_CHANNEL_SET.has(channel)

const plusDays = (date: ISODate, days: number): ISODate =>
  new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10)

/** 광고 성과로 인정하는 기간 [UTM 상담 접수일, +89일] — UTM이 광고 채널이
 * 아니면 null. */
export function adAttributionWindow(
  row: AttributionRow,
): { start: ISODate; end: ISODate } | null {
  if (!isAdChannel(row[1])) return null
  const start = row[4] || row[0]
  return { start, end: plusDays(start, AD_ATTRIBUTION_DAYS - 1) }
}

/** 하한 ROAS에 넣는 첫 구매 — UTM이 광고 채널인 고객의 첫 구매가 그 UTM
 * 상담 접수일 당일이나 그 뒤, 90일 안이면 그 [결제일, 금액]. 상담 전에 이미
 * 산 적 있는 고객(광고 전에 산 것)과 90일을 넘겨 산 고객은 null. */
export function attributedFirstPurchase(
  row: AttributionRow,
): [ISODate, number] | null {
  const window = adAttributionWindow(row)
  const first = row[3][0]
  if (!window || !first) return null
  return first[0] >= window.start && first[0] <= window.end ? first : null
}

/** 날짜별 "UTM 광고 매출" — attributedFirstPurchase를 그 결제일에 놓는다.
 * 하한 ROAS(전체 요약·ROAS 탭)의 분자다. [start, end] 밖은 뺀다. */
export function utmAdRevenueByDate(
  rows: readonly AttributionRow[],
  start: ISODate,
  end: ISODate,
): Record<ISODate, number> {
  const byDate: Record<ISODate, number> = {}
  for (const row of rows) {
    const first = attributedFirstPurchase(row)
    if (!first || first[0] < start || first[0] > end) continue
    byDate[first[0]] = (byDate[first[0]] ?? 0) + first[1]
  }
  return byDate
}
