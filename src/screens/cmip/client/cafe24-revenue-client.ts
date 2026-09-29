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
  /** 순매출(온라인 매출 대표값) = grossPayment - shippingFee - refundAmount —
   * "순매출은 총매출에서 배송비·적립금 제외"로 정의 확정. 적립금은 이미
   * grossPayment 계산 단계에서 빠져있어 공식엔 안 보이고, 배송비만 명시적으로
   * 뺀다. 배송비/적립금은 성격이 달라(배송비=실비 통과항목, 적립금=할인) 매출
   * 정의에서는 둘 다 빼되 하나로 합치지 않고 shippingFee/pointsSpent로 따로
   * 노출한다. 결제(결제일 기준)와 환불(환불완료일 기준)을 서로 다른 날짜/
   * 리소스에서 가져와 계산한다 — 카페24 관리자 일별 리포트가 주문일이 아니라
   * 결제일 기준으로 집계하는 걸 확인해서 맞췄고, 환불도 카페24의 별도
   * "환불(refunds)" 리소스가 제공하는 환불완료일 기준으로 맞췄다(한 주문이
   * 여러 번에 나눠 환불되는 경우 접수일 하나로는 표현이 안 돼서 — 실제로
   * 발견한 사례: 접수 8/21, 카드 부분취소 완료는 8/18과 8/31 두 번). */
  paymentAmount: number
  /** 총매출 — 주문 시점(취소 여부 무관) 상품구매금액+배송비-적립금사용액
   * 합계(결제일 기준) + 반품 추가배송비 합계(반품 접수일 기준). 배송비 포함,
   * 적립금 제외. 이 둘을 더하는 이유는 additionalShippingFee 주석 참고. */
  grossPayment: number
  /** 환불금액 — 실제로 환불 완료 처리된 금액 합계, 환불완료일 기준(결제일과
   * 다른 달일 수 있음). */
  refundAmount: number
  /** 참고용 — grossPayment에 포함된 배송비 합계(기본 배송비 + 추가배송비),
   * paymentAmount(순매출)에서는 빠져있다. */
  shippingFee: number
  /** 참고용 — grossPayment(따라서 paymentAmount)에서 이미 제외된 적립금
   * 사용액 합계(매출 아님, 할인 취급). */
  pointsSpent: number
  /** 참고용 — grossPayment에서 이미 제외된 쿠폰 등 주문 단위 할인 합계.
   * 지금까지 이 매장이 실제로 쓴 건 쿠폰뿐이라 "쿠폰할인"으로 부른다(7/7
   * 환불 건에서 발견 — 이걸 안 빼서 환불액이 100,000원 과다 집계됐었다). */
  couponDiscount: number
  /** 참고용 — grossPayment에 포함된 반품 추가배송비 합계만 따로(반품 접수일
   * 기준). 반품 시 "반품배송비 구매자부담"으로 별도 결제가 일어나는 경우가
   * 있는데, 원 주문 결제에도 환불에도 안 잡히는 제3의 현금흐름이라 따로
   * 추적한다(shippingFee에도 이미 합산되어 있음). */
  additionalShippingFee: number
  /** 결제 건수(결제일 기준). */
  orderCount: number
  /** 환불 건수(환불완료일 기준, 한 주문에 여러 건일 수 있음). */
  refundCount: number
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
