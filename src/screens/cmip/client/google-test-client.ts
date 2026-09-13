/**
 * Google Ads 연동 테스트 전용 클라이언트 — functions-cmip에 새로 추가된
 * getGoogleAuthUrl/getGoogleAuthStatus/getGoogleAdsInsight를 그대로 호출한다.
 * 실 서비스 화면(meta-insight)의 구글 데이터(google-insight-mock)와는 무관하고,
 * GoogleTestPanel에서 "진짜 연동이 되는지"만 확인하는 용도다.
 */
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'
import { CallableError, callFunction } from './csv-client'

export interface GoogleAuthUrlResult {
  url: string
}

export interface GoogleAuthStatusResult {
  connected: boolean
  updatedAt: string | null
}

export interface GoogleAdsInsightRow {
  date: string
  campaignId: string
  campaignName: string
  costMicros: number
  cost: number
  impressions: number
  clicks: number
  conversions: number
}

export interface GoogleAdsInsightResult {
  brandId: string
  dateStart: string
  dateEnd: string
  totalCount: number
  rows: GoogleAdsInsightRow[]
}

interface ErrorBody {
  error?: string
}

/** GET 쿼리스트링 호출 — getAllInsights(insight-client.ts)와 같은 방식. */
async function getJson<T>(
  name: string,
  params: Record<string, string>,
): Promise<T> {
  const query = new URLSearchParams(params)
  const res = await fetch(`${CMIP_API_BASE}/${name}?${query.toString()}`)

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(`${name} 응답을 해석할 수 없습니다.`, res.status)
  }

  if (!res.ok) {
    const message =
      (body as ErrorBody)?.error ??
      `${name} 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return body as T
}

export const getGoogleAuthUrl = (
  brandId: string,
): Promise<GoogleAuthUrlResult> => getJson('getGoogleAuthUrl', { brandId })

export const getGoogleAuthStatus = (
  brandId: string,
): Promise<GoogleAuthStatusResult> =>
  getJson('getGoogleAuthStatus', { brandId })

/** getGoogleAdsInsight는 GET/POST 둘 다 받지만, 파라미터가 4개라 body로 보내는
 * 쪽(callFunction, 기존 csv-client 공용 POST 헬퍼)이 더 간단하다. */
export const getGoogleAdsInsightRaw = (
  brandId: string,
  dateStart: string,
  dateEnd: string,
  customerId: string,
): Promise<GoogleAdsInsightResult> =>
  callFunction('getGoogleAdsInsight', {
    brandId,
    dateStart,
    dateEnd,
    customerId,
  })
