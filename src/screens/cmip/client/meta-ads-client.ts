/**
 * getMetaAdInsights 클라이언트 — functions-cmip `getMetaAdInsights`(GET) 호출.
 * Meta 광고(소재) 단위 광고비와 광고 → 광고셋 → 캠페인 연결을 받는다. "광고
 * 성과" 탭이 Monday 상담의 utm_campaign(광고 이름)과 맞춘다.
 */
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'

export interface MetaAd {
  id: string
  name: string
  adsetId: string
  adsetName: string
  campaignId: string
  campaignName: string
}

/** ads는 광고 정보, daily는 [ads의 순번, 날짜, 광고비, 노출, 클릭] —
 * 광고비·노출·클릭이 모두 0인 날은 없다. */
export interface MetaAdInsights {
  ads: MetaAd[]
  daily: [number, ISODate, number, number, number][]
}

export async function getMetaAdInsights(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<MetaAdInsights> {
  const params = new URLSearchParams({ dateStart, dateEnd })
  const res = await fetch(
    `${CMIP_API_BASE}/getMetaAdInsights?${params.toString()}`,
  )

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(
      'getMetaAdInsights 응답을 해석할 수 없습니다.',
      res.status,
    )
  }

  if (!res.ok) {
    const message =
      (body as { error?: string })?.error ??
      `getMetaAdInsights 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return body as MetaAdInsights
}
