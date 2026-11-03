/**
 * getDaangnInsight 클라이언트 — functions-cmip `getDaangnInsight`(onRequest, GET) 호출.
 * getOpenaiInsight와 같은 모양(GET + dateStart/dateEnd 쿼리, 서버가
 * total/byDate/byDayOfWeek/byGroupedWeek/byCampaign까지 이미 집계해서 반환)이라
 * openai-insight-client.ts와 똑같이 구현한다. 광고비(spend)는 서버에서 VAT를 뺀
 * 값이다(당근 원본은 VAT 포함 — 다른 매체와 같은 기준으로 맞춘다).
 */
import { authFetch } from '@/xtool-auth/auth-fetch'
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'
import type { MetaInsightSummary } from './insight-client'

interface ErrorBody {
  error?: string
}

export async function getDaangnInsights(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<MetaInsightSummary> {
  const params = new URLSearchParams({ dateStart, dateEnd })
  const res = await authFetch(
    `${CMIP_API_BASE}/getDaangnInsight?${params.toString()}`,
  )

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(
      'getDaangnInsight 응답을 해석할 수 없습니다.',
      res.status,
    )
  }

  if (!res.ok) {
    const message =
      (body as ErrorBody)?.error ??
      `getDaangnInsight 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return body as MetaInsightSummary
}
