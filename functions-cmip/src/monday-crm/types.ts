import type { ISODate } from '../types'

/** Monday CRM 보드(오프라인 매출)의 subitem(품목/할부 이자 등 결제 라인) 1건을
 * 평탄화한 행 — item(고객/접수일) 쪽의 date/customerName을 그대로 복사해
 * 갖고 있어 날짜 범위로 바로 집계할 수 있다(data/firestore.ts의 performance
 * 컬렉션과 같은 평탄 구조 관례). */
export interface OfflineSaleRow {
  mondayItemId: string
  mondaySubitemId: string
  date: ISODate
  customerName: string
  productName: string
  /** 매출액 (numeric_mm1rvgfs) */
  revenue: number
  /** 할인액 (numeric_mm19vata) */
  discount: number
  /** 총 결제금액 (formula_mm1gsc6e, 보통 revenue - discount) — "매출" 집계의
   * 기준값으로 쓴다. */
  totalPaid: number
}

export interface OfflineSaleMetricsSummary {
  totalPaid: number
  revenue: number
  discount: number
  /** 결제 라인(품목/할부 이자 등) 건수 — 고객(주문) 단위가 아니라 subitem 단위. */
  lineCount: number
}

export interface OfflineSaleDateSummary extends OfflineSaleMetricsSummary {
  date: string
}

export interface OfflineSaleDayOfWeekSummary extends OfflineSaleMetricsSummary {
  dayOfWeek: string
}

export interface OfflineSaleWeekSummary extends OfflineSaleMetricsSummary {
  period: string
  startDate: string
  endDate: string
}

export interface OfflineSaleMonthSummary extends OfflineSaleMetricsSummary {
  period: string
  startDate: string
  endDate: string
}

/** getOfflineRevenue 엔드포인트의 응답 모양 — channel/meta·naver의
 * {total, byDate, byDayOfWeek, byGroupedWeek} 관례에 byMonth를 더했다(오프라인
 * 매출은 월별 추이도 바로 필요해서 프론트에 미루지 않고 서버에서 함께 낸다). */
export interface OfflineRevenueSummary {
  total: OfflineSaleMetricsSummary
  byDate: OfflineSaleDateSummary[]
  byDayOfWeek: OfflineSaleDayOfWeekSummary[]
  byGroupedWeek: OfflineSaleWeekSummary[]
  byMonth: OfflineSaleMonthSummary[]
}
