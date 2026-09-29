/**
 * getOfflineRevenue 클라이언트 — functions-cmip `getOfflineRevenue`(onRequest, GET)
 * 호출. getAllInsights/getNaverInsight와 완전히 같은 모양(GET + dateStart/dateEnd
 * 쿼리, 서버가 total/byDate/byDayOfWeek/byGroupedWeek까지 이미 집계해서 반환)이라
 * insight-client.ts와 거의 동일하게 구현한다. Monday CRM 오프라인 매출 보드
 * 원본이라 impressions/clicks 같은 광고 지표는 없고, 서버가 byMonth까지 함께
 * 낸다(광고 채널 쪽엔 없는 4번째 버킷 — groupByMonth로 프론트에서 파생하는
 * 대신 서버가 직접 계산해서 준다).
 */
import { CMIP_API_BASE } from '@/screens/xtool-lead-manager/constants'
import type { ISODate } from '../types'
import { CallableError } from './csv-client'

export interface OfflineRevenueMetrics {
  /** 총 결제금액 — 매출 집계의 기준값(revenue - discount). 장기 할부 이자
   * (12/24/36개월)와 "계약금/분할납부" 잔금(아직 안 걷은 금액)은 여기 포함되지
   * 않는다 — 각각 installmentInterest/deferredBalance로 따로 집계. */
  totalPaid: number
  /** 매출액(할인 반영 전). */
  revenue: number
  /** 할인액. */
  discount: number
  /** 매출로 집계된 결제 라인(품목) 건수 — 할부 이자 라인은 매출이 아니라서
   * 뺀다. 고객(주문) 단위가 아니라 subitem 단위. */
  lineCount: number
  /** 장기 할부 이자(12/24/36개월) 합계 — 고객이 할부로 결제해 카드사에 내는
   * 이자라 매장 매출(totalPaid 등)과 분리해서 따로 집계한다. */
  installmentInterest: number
  /** "계약금"/"분할납부" 잔금(총 계약금액 중 아직 안 걷고 나중에 분할로 받을
   * 금액) 합계 — 계약 체결일에 상품가 전체를 매출로 인식하기 위해 매출과
   * 분리했다. 음수 값 그대로 더한 값(보통 0 이하)이라 참고용으로만 쓴다. */
  deferredBalance: number
}

export interface OfflineRevenueDateSummary extends OfflineRevenueMetrics {
  date: ISODate
}

export interface OfflineRevenueDayOfWeekSummary extends OfflineRevenueMetrics {
  dayOfWeek: string
}

export interface OfflineRevenueWeekSummary extends OfflineRevenueMetrics {
  period: string
  startDate: ISODate
  endDate: ISODate
}

export interface OfflineRevenueMonthSummary extends OfflineRevenueMetrics {
  period: string
  startDate: ISODate
  endDate: ISODate
}

export interface OfflineRevenueSummary {
  total: OfflineRevenueMetrics
  byDate: OfflineRevenueDateSummary[]
  byDayOfWeek: OfflineRevenueDayOfWeekSummary[]
  byGroupedWeek: OfflineRevenueWeekSummary[]
  byMonth: OfflineRevenueMonthSummary[]
}

interface ErrorBody {
  error?: string
}

export async function getOfflineRevenue(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<OfflineRevenueSummary> {
  const params = new URLSearchParams({ dateStart, dateEnd })
  const res = await fetch(
    `${CMIP_API_BASE}/getOfflineRevenue?${params.toString()}`,
  )

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CallableError(
      'getOfflineRevenue 응답을 해석할 수 없습니다.',
      res.status,
    )
  }

  if (!res.ok) {
    const message =
      (body as ErrorBody)?.error ??
      `getOfflineRevenue 호출에 실패했습니다. (HTTP ${res.status})`
    throw new CallableError(message, res.status)
  }

  return body as OfflineRevenueSummary
}
