/**
 * getMondayAttribution 클라이언트 — functions-xtool `getMondayAttribution`
 * (onRequest, GET) 호출. xtool 통합 고객(전화번호 기준)마다 처음 나타난 날,
 * 유입 경로로 판정한 광고 채널, 구매 내역을 한 줄씩 준다. ROAS 탭의 "광고
 * 기여 ROAS"(하한)와 "고객 유입 월 코호트 ROAS"가 광고비와 맞춰 계산한다.
 */
import { API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'

/** 유입 경로를 묶은 채널 — meta/google/naver는 광고로 확인된 고객, other는
 * 경로가 있지만 광고가 아닌 고객(영업전환·자연유입 등), unknown은 경로가 비어
 * 있는 고객(문의 없이 산 고객 포함). */
export type AttributionChannel =
  'meta' | 'google' | 'naver' | 'other' | 'unknown'

/** 고객 1명 — [처음 나타난 날, 채널, 원래 유입 경로, [결제일, 금액][]].
 * 구매는 날짜별로 합쳐져 있고 취소는 빠져 있다(오래된 순). */
export type AttributionRow = [
  ISODate,
  AttributionChannel,
  string,
  [ISODate, number][],
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
