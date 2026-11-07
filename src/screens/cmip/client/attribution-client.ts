/**
 * getMondayAttribution 클라이언트 — functions-xtool `getMondayAttribution`
 * (onRequest, GET) 호출. xtool 통합 고객(전화번호 기준)마다 처음 나타난 날,
 * 유입 경로로 판정한 광고 채널, 구매 내역을 한 줄씩 준다. ROAS 탭의 "광고
 * 기여 ROAS"(하한)와 "고객 유입 월 코호트 ROAS"가 광고비와 맞춰 계산한다.
 */
import { API_BASE } from '@/screens/xtool-lead-manager/constants'
import { authFetch } from '@/xtool-auth/auth-fetch'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'

/** 가장 이른 상담의 UTM source로 묶은 채널 — meta/google/naver/openai/daangn은
 * UTM이 광고 채널인 고객, other는 UTM은 있지만 광고비를 모으지 않는 곳
 * (chatgpt.com 자연 유입·threads 등), unknown은 UTM이 없는 고객(문의 없이 산 고객, UTM 없이 들어온 문의
 * 포함). 방문체험 보드의 유입경로(영업전환·자연유입)는 쓰지 않는다. */
export type AttributionChannel =
  'meta' | 'google' | 'naver' | 'openai' | 'daangn' | 'other' | 'unknown'

/** 고객 1명 — [처음 나타난 날, 채널, UTM source, [결제일, 금액][], 그 UTM
 * 상담의 접수일, 그 UTM 상담의 utm_campaign, 그 접수일 이후 처음 방문체험을
 * 예약한 날, 첫 오프라인 결제일, 첫 온라인 주문 결제일]. 구매는 날짜별로
 * 합쳐져 있고 취소는 빠져 있다(오래된 순). 접수일부터는 없으면 ''(예전 형식의
 * 데이터엔 아예 없을 수 있다). 뒤의 셋(광고 성과표 재료)은 광고 채널 고객만
 * 있다. Meta의 utm_campaign은 광고(소재) 이름이다. */
export type AttributionRow = [
  ISODate,
  AttributionChannel,
  string,
  [ISODate, number][],
  (ISODate | '')?,
  string?,
  (ISODate | '')?,
  (ISODate | '')?,
  (ISODate | '')?,
]

export async function getAttribution(): Promise<AttributionRow[]> {
  // xtool 함수가 로그인한 구성원인지 확인한다 — 토큰을 붙인다.
  const res = await authFetch(`${API_BASE}/getMondayAttribution`)

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
  'openai',
  'daangn',
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

/** 결제 전환의 구매 범위(공통 정의 D4) — 통합(오프라인 결제 + 온라인 주문)·
 * 오프라인만·온라인만. 온라인 소모품 구매가 전환을 부풀릴 수 있어 나눠 본다. */
export type PurchaseScope = 'all' | 'offline' | 'online'

/** 광고 성과표 재료(방문체험 예약일·범위별 첫 결제일)가 있는 줄인지 — 서버가
 * 이 재료를 만든 뒤의 동기화부터 광고 채널 고객에 붙는다. */
export const hasLeadOutcomes = (row: AttributionRow): boolean => row.length > 6

/** 리드일 — 그 UTM 상담의 접수일(공통 정의 D3), 없으면 처음 나타난 날. */
export const leadDateOf = (row: AttributionRow): ISODate => row[4] || row[0]

/** date가 start부터 days일 안(당일 포함)인지. */
const withinDays = (date: ISODate, start: ISODate, days: number): boolean =>
  date >= start && date <= plusDays(start, days - 1)

/** 리드가 리드일부터 days일 안에 (구매 범위의) 첫 구매를 했는지 — 그
 * 범위에서 리드 전에 이미 산 고객은 아니다. 통합·90일은 ROAS 하한의 귀속 첫
 * 구매(attributedFirstPurchase)와 같은 규칙이다. */
export function convertedWithin(
  row: AttributionRow,
  scope: PurchaseScope,
  days: number,
): boolean {
  const first =
    scope === 'all' ? row[3][0]?.[0] : scope === 'offline' ? row[7] : row[8]
  return !!first && withinDays(first, leadDateOf(row), days)
}

/** 리드가 리드일부터 days일 안에 방문체험을 예약했는지(리드 전 예약은 서버가
 * 뺀다). */
export function visitBookedWithin(row: AttributionRow, days: number): boolean {
  const booked = row[6]
  return !!booked && withinDays(booked, leadDateOf(row), days)
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
