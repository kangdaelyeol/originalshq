/**
 * getAllInsights 클라이언트 — functions-cmip `getAllInsights`(onRequest, GET) 호출.
 * onCall/onRequest POST와 달리 쿼리 스트링으로 dateStart/dateEnd(YYYY-MM-DD)를 받는다.
 */
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'

export interface MetricsSummary {
  impressions: number
  clicks: number
  spend: number
  conversions: number
  /** 전환매출액. 채널·전환 추적 설정에 따라 값이 안 잡힐 수 있어(예: 리드
   * 목표 캠페인, 전환 추적 미설정 네이버 계정) 0이 "매출 없음"과 "측정 안 됨"
   * 둘 다를 의미할 수 있다. */
  revenue: number
  ctr: number
  cpc: number
  cpa: number
  cvr: number
  cpm: number
  frequency: number
}

export interface DateSummary extends MetricsSummary {
  date: ISODate
}

export interface DayOfWeekSummary extends MetricsSummary {
  dayOfWeek: string
}

export interface WeekSummary extends MetricsSummary {
  period: string
  startDate: ISODate
  endDate: ISODate
}

/** 캠페인/adset처럼 하위 그룹 단위로 total과 같은 도출 방식의 시계열 3종을
 * 묶어 재사용하는 형태(functions-cmip GroupedInsightSeries와 동일). */
export interface GroupedInsightSeries {
  byDate: DateSummary[]
  byDayOfWeek: DayOfWeekSummary[]
  byGroupedWeek: WeekSummary[]
}

export interface AdsetSummary extends GroupedInsightSeries {
  adsetName: string
}

export interface CampaignSummary extends GroupedInsightSeries {
  campaignName: string
  adsets: AdsetSummary[]
  /** 결과 유형(Meta Ads Manager의 "결과" 컬럼) — Meta 캠페인만 채워 보낸다.
   * Google/Naver 캠페인엔 대응 개념이 없어 항상 undefined. */
  resultType?: string | null
}

export interface MetaInsightSummary {
  total: MetricsSummary
  byDate: DateSummary[]
  byDayOfWeek: DayOfWeekSummary[]
  byGroupedWeek: WeekSummary[]
  // Meta/Google(getGoogleInsights) 둘 다 항상 채워 보내지만, 이 타입을 쓰는 다른
  // 채널이 나중에 캠페인 단위를 아직 지원 못 하는 경우를 위해 optional로 둔다.
  byCampaign?: CampaignSummary[]
}

interface ErrorBody {
  error?: string
}

export async function getAllInsights(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<MetaInsightSummary> {
  const params = new URLSearchParams({ dateStart, dateEnd })
  const res = await fetch(
    `${CMIP_API_BASE}/getAllInsights?${params.toString()}`,
  )

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(
      'getAllInsights 응답을 해석할 수 없습니다.',
      res.status,
    )
  }

  if (!res.ok) {
    const message =
      (body as ErrorBody)?.error ??
      `getAllInsights 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return body as MetaInsightSummary
}
