import { weekdayKo } from '../channel/utils'
import { buildWeekRanges, formatMD } from './utils'
import type {
  Cafe24DateSummary,
  Cafe24DayOfWeekSummary,
  Cafe24MetricsSummary,
  Cafe24MonthSummary,
  Cafe24OrderRow,
  Cafe24RefundRow,
  Cafe24WeekSummary,
} from './types'
import type { ISODate } from '../types'

const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일']

/** "결제"(grossPayment)로 셀 행 — 결제 완료(paid) + paymentDate가 조회 구간
 * 안. */
const grossRowsInRange = (
  rows: readonly Cafe24OrderRow[],
  dateStart: ISODate,
  dateEnd: ISODate,
): Cafe24OrderRow[] =>
  rows.filter(
    (r) =>
      r.paid &&
      r.paymentDate != null &&
      r.paymentDate >= dateStart &&
      r.paymentDate <= dateEnd,
  )

/** "환불"(refundAmount)로 셀 행 — refundDate가 조회 구간 안. */
const refundRowsInRange = (
  rows: readonly Cafe24RefundRow[],
  dateStart: ISODate,
  dateEnd: ISODate,
): Cafe24RefundRow[] =>
  rows.filter((r) => r.refundDate >= dateStart && r.refundDate <= dateEnd)

/** "반품 추가배송비"(additionalShippingFee)로 셀 행 — cancelDate가 조회
 * 구간 안(대부분 0이라 필터링해도 실제 합계엔 영향 없지만, 키 집합에 불필요한
 * 날짜가 안 섞이게 미리 0인 행은 뺀다). */
const additionalRowsInRange = (
  rows: readonly Cafe24OrderRow[],
  dateStart: ISODate,
  dateEnd: ISODate,
): Cafe24OrderRow[] =>
  rows.filter(
    (r) =>
      r.additionalShippingFee > 0 &&
      r.cancelDate != null &&
      r.cancelDate >= dateStart &&
      r.cancelDate <= dateEnd,
  )

function groupBy<T>(
  rows: readonly T[],
  keyOf: (row: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyOf(row)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  }
  return grouped
}

interface GrossTotals {
  grossPayment: number
  shippingFee: number
  pointsSpent: number
  couponDiscount: number
  marketDiscount: number
  orderCount: number
}

interface RefundTotals {
  refundAmount: number
  refundCount: number
}

interface AdditionalTotals {
  additionalShippingFee: number
}

const sumGross = (rows: readonly Cafe24OrderRow[]): GrossTotals => ({
  grossPayment: rows.reduce((s, r) => s + r.grossPayment, 0),
  shippingFee: rows.reduce((s, r) => s + r.shippingFee, 0),
  pointsSpent: rows.reduce((s, r) => s + r.pointsSpent, 0),
  couponDiscount: rows.reduce((s, r) => s + r.couponDiscount, 0),
  marketDiscount: rows.reduce((s, r) => s + r.marketDiscount, 0),
  orderCount: rows.length,
})

const sumRefund = (rows: readonly Cafe24RefundRow[]): RefundTotals => ({
  refundAmount: rows.reduce((s, r) => s + r.amount, 0),
  refundCount: rows.length,
})

const sumAdditional = (rows: readonly Cafe24OrderRow[]): AdditionalTotals => ({
  additionalShippingFee: rows.reduce((s, r) => s + r.additionalShippingFee, 0),
})

/** 결제(paymentDate 기준) + 반품 추가배송비(cancelDate 기준)를 더해 총매출을
 * 내고, 여기서 배송비와 환불(refundDate 기준)을 빼서 순매출을 낸다 — 배송비는
 * 택배사로 나가는 실비 통과항목이라 뺀다. 적립금(pointsSpent)은 예전엔
 * "우리가 준 할인"으로 취급해 같이 뺐었는데, 카페24 관리자 화면(결제/환불
 * 양쪽 다 적립금 포함)과 맞추기 위해 지금은 grossPayment/refundAmount 계산
 * 단계(client.ts)에서부터 이미 포함시키고 있어 여기서 따로 뺄 게 없다 —
 * shippingFee/pointsSpent 둘 다 지표로는 참고용으로 계속 따로 노출한다. 이
 * 함수가 사실상 이 파일의 핵심이고, 나머지 summarizeBy* 함수들은 전부
 * "무엇으로 그룹핑하느냐"만 다를 뿐 마지막엔 이 함수로 합친다. */
const combine = (
  gross: GrossTotals,
  refund: RefundTotals,
  additional: AdditionalTotals,
): Cafe24MetricsSummary => {
  const grossPayment = gross.grossPayment + additional.additionalShippingFee
  const shippingFee = gross.shippingFee + additional.additionalShippingFee
  return {
    paymentAmount: grossPayment - shippingFee - refund.refundAmount,
    grossPayment,
    refundAmount: refund.refundAmount,
    shippingFee,
    pointsSpent: gross.pointsSpent,
    couponDiscount: gross.couponDiscount,
    marketDiscount: gross.marketDiscount,
    additionalShippingFee: additional.additionalShippingFee,
    orderCount: gross.orderCount,
    refundCount: refund.refundCount,
  }
}

export const summarizeTotal = (
  orderRows: readonly Cafe24OrderRow[],
  refundRows: readonly Cafe24RefundRow[],
  dateStart: ISODate,
  dateEnd: ISODate,
): Cafe24MetricsSummary =>
  combine(
    sumGross(grossRowsInRange(orderRows, dateStart, dateEnd)),
    sumRefund(refundRowsInRange(refundRows, dateStart, dateEnd)),
    sumAdditional(additionalRowsInRange(orderRows, dateStart, dateEnd)),
  )

export const summarizeByDate = (
  orderRows: readonly Cafe24OrderRow[],
  refundRows: readonly Cafe24RefundRow[],
  dateStart: ISODate,
  dateEnd: ISODate,
): Cafe24DateSummary[] => {
  const groupedGross = groupBy(
    grossRowsInRange(orderRows, dateStart, dateEnd),
    (r) => r.paymentDate!,
  )
  const groupedRefund = groupBy(
    refundRowsInRange(refundRows, dateStart, dateEnd),
    (r) => r.refundDate,
  )
  const groupedAdditional = groupBy(
    additionalRowsInRange(orderRows, dateStart, dateEnd),
    (r) => r.cancelDate!,
  )
  const dates = new Set([
    ...groupedGross.keys(),
    ...groupedRefund.keys(),
    ...groupedAdditional.keys(),
  ])
  return Array.from(dates)
    .sort()
    .map((date) => ({
      date,
      ...combine(
        sumGross(groupedGross.get(date) ?? []),
        sumRefund(groupedRefund.get(date) ?? []),
        sumAdditional(groupedAdditional.get(date) ?? []),
      ),
    }))
}

export const summarizeByDayOfWeek = (
  orderRows: readonly Cafe24OrderRow[],
  refundRows: readonly Cafe24RefundRow[],
  dateStart: ISODate,
  dateEnd: ISODate,
): Cafe24DayOfWeekSummary[] => {
  const groupedGross = groupBy(
    grossRowsInRange(orderRows, dateStart, dateEnd),
    (r) => weekdayKo(r.paymentDate!),
  )
  const groupedRefund = groupBy(
    refundRowsInRange(refundRows, dateStart, dateEnd),
    (r) => weekdayKo(r.refundDate),
  )
  const groupedAdditional = groupBy(
    additionalRowsInRange(orderRows, dateStart, dateEnd),
    (r) => weekdayKo(r.cancelDate!),
  )
  const days = new Set([
    ...groupedGross.keys(),
    ...groupedRefund.keys(),
    ...groupedAdditional.keys(),
  ])
  return Array.from(days)
    .map((dayOfWeek) => ({
      dayOfWeek,
      ...combine(
        sumGross(groupedGross.get(dayOfWeek) ?? []),
        sumRefund(groupedRefund.get(dayOfWeek) ?? []),
        sumAdditional(groupedAdditional.get(dayOfWeek) ?? []),
      ),
    }))
    .sort(
      (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
    )
}

export const summarizeByWeek = (
  orderRows: readonly Cafe24OrderRow[],
  refundRows: readonly Cafe24RefundRow[],
  dateStart: ISODate,
  dateEnd: ISODate,
): Cafe24WeekSummary[] => {
  const ranges = buildWeekRanges(dateStart, dateEnd)

  return ranges.map((range) => ({
    period: `${formatMD(range.start)}~${formatMD(range.end)}`,
    startDate: range.start,
    endDate: range.end,
    ...combine(
      sumGross(grossRowsInRange(orderRows, range.start, range.end)),
      sumRefund(refundRowsInRange(refundRows, range.start, range.end)),
      sumAdditional(additionalRowsInRange(orderRows, range.start, range.end)),
    ),
  }))
}

/** monthKey("YYYY-MM")의 달력상 시작/끝 날짜 — dateStart~dateEnd 범위로
 * 클램프한다(조회 구간이 달 중간에서 시작/끝나는 경우 표시용 period가 실제
 * 조회 범위를 벗어나지 않게). 그 달에 결제 행이 하나도 없고 환불 행만 있는
 * 경우(다른 달 주문의 환불만 잡힌 달)에도 startDate/endDate를 안전하게 낼 수
 * 있어야 해서 행의 실제 날짜가 아니라 달력 자체로 계산한다. */
function monthBounds(
  monthKey: string,
  dateStart: ISODate,
  dateEnd: ISODate,
): { startDate: ISODate; endDate: ISODate } {
  const [year, month] = monthKey.split('-').map(Number)
  const first = `${monthKey}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const last = `${monthKey}-${String(lastDay).padStart(2, '0')}`
  return {
    startDate: first < dateStart ? dateStart : first,
    endDate: last > dateEnd ? dateEnd : last,
  }
}

export const summarizeByMonth = (
  orderRows: readonly Cafe24OrderRow[],
  refundRows: readonly Cafe24RefundRow[],
  dateStart: ISODate,
  dateEnd: ISODate,
): Cafe24MonthSummary[] => {
  const groupedGross = groupBy(
    grossRowsInRange(orderRows, dateStart, dateEnd),
    (r) => r.paymentDate!.slice(0, 7),
  )
  const groupedRefund = groupBy(
    refundRowsInRange(refundRows, dateStart, dateEnd),
    (r) => r.refundDate.slice(0, 7),
  )
  const groupedAdditional = groupBy(
    additionalRowsInRange(orderRows, dateStart, dateEnd),
    (r) => r.cancelDate!.slice(0, 7),
  )
  const months = new Set([
    ...groupedGross.keys(),
    ...groupedRefund.keys(),
    ...groupedAdditional.keys(),
  ])
  return Array.from(months)
    .sort()
    .map((monthKey) => ({
      period: monthKey.replace('-', '.'),
      ...monthBounds(monthKey, dateStart, dateEnd),
      ...combine(
        sumGross(groupedGross.get(monthKey) ?? []),
        sumRefund(groupedRefund.get(monthKey) ?? []),
        sumAdditional(groupedAdditional.get(monthKey) ?? []),
      ),
    }))
}
