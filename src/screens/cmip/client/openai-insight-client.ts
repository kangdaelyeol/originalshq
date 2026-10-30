/**
 * getOpenaiInsight 클라이언트 — functions-cmip `getOpenaiInsight`(onRequest, GET) 호출.
 * getAllInsights(Meta)와 완전히 같은 모양(GET + dateStart/dateEnd 쿼리, 서버가
 * total/byDate/byDayOfWeek/byGroupedWeek/byCampaign까지 이미 집계해서 반환)이라
 * insight-client.ts와 거의 동일하게 구현한다 — 프론트에서 따로 합칠 원본 행이 없다
 * (google-insight-client.ts와 달리).
 */
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'
import type { MetaInsightSummary } from './insight-client'

interface ErrorBody {
  error?: string
}

export async function getOpenaiInsights(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<MetaInsightSummary> {
  const params = new URLSearchParams({ dateStart, dateEnd })
  const res = await fetch(
    `${CMIP_API_BASE}/getOpenaiInsight?${params.toString()}`,
  )

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(
      'getOpenaiInsight 응답을 해석할 수 없습니다.',
      res.status,
    )
  }

  if (!res.ok) {
    const message =
      (body as ErrorBody)?.error ??
      `getOpenaiInsight 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return body as MetaInsightSummary
}
