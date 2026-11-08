/**
 * getAdGroupInsights 클라이언트 — functions-cmip `getAdGroupInsights`(GET) 호출. Google·네이버·OpenAI·당근의 광고그룹
 * 단위 광고비(광고그룹 → 캠페인)와, 소재 동기화가 찾은 광고 이름 → 광고그룹 대응을 받는다. "광고 성과" 탭이 Monday
 * 상담의 utm_campaign과 맞춘다(Meta는 meta-ads-client.ts — 광고 단위).
 */
import { authFetch } from '@/xtool-auth/auth-fetch'
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'

export const AD_GROUP_CHANNELS = [
  'google',
  'naver',
  'openai',
  'daangn',
] as const
export type AdGroupChannel = (typeof AD_GROUP_CHANNELS)[number]

export interface ChannelAdGroups {
  /** 광고그룹 — Google은 광고그룹이 없는 캠페인의 광고비를 '(광고그룹 없음)' 줄로 준다. */
  adGroups: {
    id: string
    name: string
    campaignId: string
    campaignName: string
  }[]
  /** [adGroups의 순번, 날짜, 광고비, 노출, 클릭] — 셋 다 0인 날은 없다. */
  daily: [number, ISODate, number, number, number][]
  /** 소재 동기화가 찾은 광고(소재) 이름과 그 광고그룹 id — 집행 중일 때 본 이미지·영상 소재만. */
  ads: { name: string; adGroupId: string }[]
}

export interface AdGroupInsights {
  /** 매체마다 — 못 읽은 매체는 빠진다(errors에 이유). */
  channels: Partial<Record<AdGroupChannel, ChannelAdGroups>>
  /** 못 읽은 매체, 또는 소재 이름 대응('creatives' — 못 읽으면 소재 이름으로는 찾지 않는다)과 그 이유. */
  errors: Partial<Record<AdGroupChannel | 'creatives', string>>
}

export async function getAdGroupInsights(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<AdGroupInsights> {
  const params = new URLSearchParams({ dateStart, dateEnd })
  const res = await authFetch(
    `${CMIP_API_BASE}/getAdGroupInsights?${params.toString()}`,
  )

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(
      'getAdGroupInsights 응답을 해석할 수 없습니다.',
      res.status,
    )
  }

  if (!res.ok) {
    const message =
      (body as { error?: string })?.error ??
      `getAdGroupInsights 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return body as AdGroupInsights
}
