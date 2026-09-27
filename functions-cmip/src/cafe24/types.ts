import type { ISODate } from '../types'

/** Cafe24 주문 1건을 평탄화한 행 — Monday CRM의 OfflineSaleRow와 같은 결이지만,
 * paid/canceled는 원본 그대로 저장해두고 "매출로 셀지"는 집계 시점(helper.ts)
 * 에 걸러낸다. 데이터 원본을 있는 그대로 보존해두면 나중에 집계 기준이
 * 바뀌어도(예: 부분취소 처리 방식을 다르게 하고 싶어짐) 재동기화 없이 집계
 * 로직만 바꾸면 된다. */
export interface Cafe24OrderRow {
  orderId: string
  orderDate: ISODate
  memberId: string | null
  /** 결제 완료 여부(Cafe24 "T"/"F"를 boolean으로 변환). */
  paid: boolean
  /** 주문 전체 취소 여부. 부분취소(일부 품목만 취소)는 이 값이 그대로 false로
   * 남고 대신 paymentAmount 자체가 줄어든다. */
  canceled: boolean
  /** 실제 결제 금액 — actual_order_amount.payment_amount. 부분취소/환불까지
   * 반영된 값이라 이게 "진짜 매출"이다(initial_order_amount는 최초 주문
   * 시점 값이라 부분취소가 있으면 실제보다 크게 나온다). */
  paymentAmount: number
}

export interface Cafe24MetricsSummary {
  paymentAmount: number
  orderCount: number
}

export interface Cafe24DateSummary extends Cafe24MetricsSummary {
  date: string
}

export interface Cafe24DayOfWeekSummary extends Cafe24MetricsSummary {
  dayOfWeek: string
}

export interface Cafe24WeekSummary extends Cafe24MetricsSummary {
  period: string
  startDate: string
  endDate: string
}

export interface Cafe24MonthSummary extends Cafe24MetricsSummary {
  period: string
  startDate: string
  endDate: string
}

export interface Cafe24RevenueSummary {
  total: Cafe24MetricsSummary
  byDate: Cafe24DateSummary[]
  byDayOfWeek: Cafe24DayOfWeekSummary[]
  byGroupedWeek: Cafe24WeekSummary[]
  byMonth: Cafe24MonthSummary[]
}
