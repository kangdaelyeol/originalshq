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
  ctr: number
  cpc: number
  cpa: number
  cvr: number
  cpm: number
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

export interface MetaInsightSummary {
  total: MetricsSummary
  byDate: DateSummary[]
  byDayOfWeek: DayOfWeekSummary[]
  byGroupedWeek: WeekSummary[]
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
    throw new CallableError('getAllInsights 응답을 해석할 수 없습니다.', res.status)
  }

  if (!res.ok) {
    const message =
      (body as ErrorBody)?.error ??
      `getAllInsights 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return body as MetaInsightSummary
}
