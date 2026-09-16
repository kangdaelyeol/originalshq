/**
 * Google Ads 연동 테스트 전용 클라이언트 — functions-cmip에 새로 추가된
 * getGoogleAuthUrl/getGoogleAuthStatus/getGoogleCampaignInsight(캠페인 단위)/
 * getGoogleAdsInsight(adGroup=adset 단위)를 그대로 호출한다. 실 서비스 화면
 * (meta-insight, google-insight-client.ts가 담당)과는 무관하고, GoogleTestPanel
 * 에서 "진짜 연동이 되는지"만 확인하는 용도다.
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

// 두 엔드포인트가 공통으로 갖는 지표 필드.
interface GoogleInsightMetrics {
  date: string
  campaignId: string
  campaignName: string
  costMicros: number
  cost: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  cpc: number
  cpa: number
  cvr: number
  cpm: number
  /** adGroup(adset) 단위는 Google 정책상 항상 0 — 캠페인 단위만 실제 값. */
  frequency: number
}

export type GoogleCampaignInsightRow = GoogleInsightMetrics

export interface GoogleAdGroupInsightRow extends GoogleInsightMetrics {
  adGroupId: string
  adGroupName: string
}

export interface GoogleInsightResult<TRow> {
  brandId: string
  dateStart: string
  dateEnd: string
  totalCount: number
  rows: TRow[]
}

export interface GoogleInsightRequest {
  brandId: string
  dateStart: string
  dateEnd: string
  customerId: string
  loginCustomerId: string
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

/** 캠페인 단위 — 실제 frequency 포함. */
export const getGoogleCampaignInsightRaw = (
  req: GoogleInsightRequest,
): Promise<GoogleInsightResult<GoogleCampaignInsightRow>> =>
  callFunction('getGoogleCampaignInsight', req)

/** adGroup(adset) 단위 — Google 정책상 frequency는 항상 0. */
export const getGoogleAdGroupInsightRaw = (
  req: GoogleInsightRequest,
): Promise<GoogleInsightResult<GoogleAdGroupInsightRow>> =>
  callFunction('getGoogleAdsInsight', req)
