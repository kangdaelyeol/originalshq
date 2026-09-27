/**
 * getCafe24Revenue 클라이언트 — functions-cmip `getCafe24Revenue`(onRequest, GET)
 * 호출. offline-revenue-client.ts(Monday CRM, 오프라인 매출)와 완전히 같은
 * 모양(GET + dateStart/dateEnd 쿼리, 서버가 total/byDate/byDayOfWeek/
 * byGroupedWeek/byMonth까지 이미 집계해서 반환)이라 그대로 복사해 구현한다.
 * Cafe24는 온라인 스토어 주문 데이터라 "온라인 매출" 쪽을 담당 — 오프라인
 * 매출과 합치지 않고 별도로 쓴다(전체 요약/ROAS 탭에서 온라인/오프라인을
 * 따로 집계해 보여줘야 해서).
 */
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'

export interface Cafe24RevenueMetrics {
  /** 실제 결제 금액(부분취소/환불 반영) 합계 — 매출 집계의 기준값. */
  paymentAmount: number
  /** 매출로 집계된(결제완료 + 전체취소 아님) 주문 건수. */
  orderCount: number
}

export interface Cafe24RevenueDateSummary extends Cafe24RevenueMetrics {
  date: ISODate
}

export interface Cafe24RevenueDayOfWeekSummary extends Cafe24RevenueMetrics {
  dayOfWeek: string
}

export interface Cafe24RevenueWeekSummary extends Cafe24RevenueMetrics {
  period: string
  startDate: ISODate
  endDate: ISODate
}

export interface Cafe24RevenueMonthSummary extends Cafe24RevenueMetrics {
  period: string
  startDate: ISODate
  endDate: ISODate
}

export interface Cafe24RevenueSummary {
  total: Cafe24RevenueMetrics
  byDate: Cafe24RevenueDateSummary[]
  byDayOfWeek: Cafe24RevenueDayOfWeekSummary[]
  byGroupedWeek: Cafe24RevenueWeekSummary[]
  byMonth: Cafe24RevenueMonthSummary[]
}

interface ErrorBody {
  error?: string
}

export async function getCafe24Revenue(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<Cafe24RevenueSummary> {
  const params = new URLSearchParams({ dateStart, dateEnd })
  const res = await fetch(
    `${CMIP_API_BASE}/getCafe24Revenue?${params.toString()}`,
  )

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(
      'getCafe24Revenue 응답을 해석할 수 없습니다.',
      res.status,
    )
  }

  if (!res.ok) {
    const message =
      (body as ErrorBody)?.error ??
      `getCafe24Revenue 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return body as Cafe24RevenueSummary
}
