/**
 * getMondayLeadQuality 클라이언트 — functions-xtool `getMondayLeadQuality`(GET) 호출. 상담 접수일이
 * [from, to]인 UTM 상담을 접수일·매체·utm_campaign별로 센 것(상담 수, 판정이 끝난 상담 수, 그중 오기입
 * 수)을 준다. "광고 성과" 탭이 광고와 맞춰 오기입률(공통 정의 D2)을 낸다. 번호를 못 읽어 고객 통합에서
 * 빠진 상담(오기입은 대개 번호가 틀려서)도 들어 있다.
 */
import { API_BASE } from '@/screens/xtool-lead-manager/constants'
import { authFetch } from '@/xtool-auth/auth-fetch'
import type { ISODate } from '../types'
import type { AttributionChannel } from './attribution-client'
import { CallableError } from './csv-client'

/** [상담 접수일, 매체, utm_campaign, 상담 수, 그중 판정이 끝난 상담 수, 그중 오기입 수] — 판정이 끝난
 * 상담은 상태가 비었거나 '신규 상담 유입'인 것을 뺀 것. */
export type LeadQualityRow = [ISODate, AttributionChannel, string, number, number, number]

export async function getLeadQuality(from: ISODate, to: ISODate): Promise<LeadQualityRow[]> {
  // xtool 함수가 로그인한 구성원인지 확인한다 — 토큰을 붙인다.
  const res = await authFetch(`${API_BASE}/getMondayLeadQuality?from=${from}&to=${to}`)

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError('getMondayLeadQuality 응답을 해석할 수 없습니다.', res.status)
  }

  if (!res.ok) {
    const message =
      (body as { error?: string })?.error ?? `getMondayLeadQuality 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return (body as { rows: LeadQualityRow[] }).rows
}
