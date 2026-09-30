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
  itemDiscount: number
  orderCount: number
}

interface RefundTotals {
  refundAmount: number
  pointsRefunded: number
  refundCount: number
  unrecordedRefundAmount: number
}

interface AdditionalTotals {
  additionalShippingFee: number
}

const sumGross = (rows: readonly Cafe24OrderRow[]): GrossTotals => ({
  grossPayment: rows.reduce((s, r) => s + r.grossPayment, 0),
  shippingFee: rows.reduce((s, r) => s + r.shippingFee, 0),
  pointsSpent: rows.reduce((s, r) => s + r.pointsSpent, 0),
  couponDiscount: rows.reduce((s, r) => s + r.couponDiscount, 0),
  itemDiscount: rows.reduce((s, r) => s + r.itemDiscount, 0),
  orderCount: rows.length,
})

/** 카페24 /admin/refunds에 실제로 기록된 환불(isFallback=false)과 폴백 환불
 * (NCHECKOUT 등, Cafe24RefundRow.isFallback 주석 참고)을 나눠서 합산한다 —
 * combine()의 paymentAmount는 결국 이 둘을 합쳐서 빼지만(실제로 나간 돈은
 * 다 반영해야 하니까), refundAmount(화면 기록분)와 unrecordedRefundAmount
 * (폴백분)를 따로 노출해야 "카페24 화면엔 왜 이 금액이 안 보이는지" 감사할
 * 수 있어서 나눠서 반환한다. */
const sumRefund = (rows: readonly Cafe24RefundRow[]): RefundTotals => {
  const official = rows.filter((r) => !r.isFallback)
  return {
    refundAmount: official.reduce((s, r) => s + r.amount, 0),
    pointsRefunded: official.reduce((s, r) => s + r.pointsRefunded, 0),
    refundCount: official.length,
    unrecordedRefundAmount: rows
      .filter((r) => r.isFallback)
      .reduce((s, r) => s + r.amount, 0),
  }
}

const sumAdditional = (rows: readonly Cafe24OrderRow[]): AdditionalTotals => ({
  additionalShippingFee: rows.reduce((s, r) => s + r.additionalShippingFee, 0),
})

/** 결제(paymentDate 기준) + 반품 추가배송비(cancelDate 기준)를 더해 총결제액을
 * 내고, 여기서 상품할인·환불(refundDate 기준)을 빼서 순매출을 낸다 —
 * grossPayment는 3/12 매출 대조로 상품할인을 빼기 전 값이어야 한다는 걸
 * 확인했다(카페24 관리자 "총결제액" 컬럼이 할인 반영 전 금액이었다 — 예전엔
 * client.ts가 할인을 미리 뺀 값을 grossPayment에 넣어서, 우리 "총 결제액"이
 * 실제로는 카페24의 "총매출액"(할인 반영 후) 개념과 같아지는 라벨 불일치가
 * 있었다). 그래서 이 함수에서 gross.itemDiscount를 따로 빼야 한다.
 *
 * 배송비는 예전엔 "택배사로 나가는 실비 통과항목"으로 보고 뺐었는데, 9/30에
 * 있었던 5/24 매출 불일치 조사에서 카페24 공식 서비스 가이드(일별/월별매출:
 * "결제합계 = 상품구매금액 + 배송비 - 할인 - 쿠폰", "순매출 = 결제합계 -
 * 환불합계")와 debugCafe24OrdersRaw로 뽑은 실제 5/24 주문 1건(상품 85,100 +
 * 배송비 5,000 = 카페24 payment_amount 90,100 = 관리자 화면 순매출
 * 90,100)을 대조해 카페24 순매출이 배송비를 포함한다는 걸 확인했다 — 배송비는
 * 그대로 둔다. 적립금(pointsSpent)도 카페24 관리자 화면(결제/환불 양쪽 다
 * 적립금 포함)과 맞추기 위해 grossPayment/refundAmount 계산 단계(client.ts)에서부터
 * 이미 포함시키고 있어 여기서 따로 뺄 게 없다 — shippingFee/pointsSpent 둘 다
 * 지표로는 참고용으로 계속 따로 노출한다(ROAS 계산은 이 값과 별개로 온라인
 * 매출에서 배송비를 다시 빼서 쓴다 — use-roas-view-model.ts 참고).
 * paymentAmount는 refund.refundAmount(카페24 /admin/refunds 기록분)뿐 아니라
 * refund.unrecordedRefundAmount(NCHECKOUT=네이버페이 등 폴백 환불)까지 둘 다
 * 뺀다 — 4월 매출 대조 중 한때 폴백분을 빼면 카페24 화면과 어긋난다고 보고
 * 제외했었는데, 그 화면 자체가 애초에 네이버페이 쪽에서 처리된 취소를 전혀
 * 모르고(총 결제액에서도 안 깎임) "카페24 매출액"이라는 이름과 달리 실제로
 * 가게에 남은 돈보다 부풀려 보여준다는 걸 재확인해서, 실제로 나간 돈을 다
 * 반영하는 쪽으로 다시 되돌렸다 — refundAmount/unrecordedRefundAmount는
 * 그대로 각각 노출해서 "카페24 화면 기록분"과 "폴백분"을 구분할 수 있게는
 * 유지한다. 이 함수가 사실상 이 파일의 핵심이고, 나머지 summarizeBy* 함수들은
 * 전부 "무엇으로 그룹핑하느냐"만 다를 뿐 마지막엔 이 함수로 합친다. */
const combine = (
  gross: GrossTotals,
  refund: RefundTotals,
  additional: AdditionalTotals,
): Cafe24MetricsSummary => {
  const grossPayment = gross.grossPayment + additional.additionalShippingFee
  const shippingFee = gross.shippingFee + additional.additionalShippingFee
  return {
    paymentAmount:
      grossPayment -
      gross.itemDiscount -
      refund.refundAmount -
      refund.unrecordedRefundAmount,
    grossPayment,
    refundAmount: refund.refundAmount,
    shippingFee,
    pointsSpent: gross.pointsSpent,
    pointsRefunded: refund.pointsRefunded,
    couponDiscount: gross.couponDiscount,
    itemDiscount: gross.itemDiscount,
    additionalShippingFee: additional.additionalShippingFee,
    unrecordedRefundAmount: refund.unrecordedRefundAmount,
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

/** paymentDate/refundDate/cancelDate 세 가지 서로 다른 날짜 기준을 각각
 * keyOf로 그룹핑한 뒤, 같은 키(날짜/요일/월)끼리 combine()으로 합쳐
 * Cafe24MetricsSummary 맵을 낸다 — summarizeByDate/DayOfWeek/Month가 "무엇을
 * 키로 쓰느냐"만 다를 뿐 나머지는 완전히 같은 모양이라 하나로 묶었다
 * (summarizeByWeek는 그룹핑이 아니라 고정 구간을 순회하는 다른 모양이라
 * 별도로 둔다). */
function summarizeByKey(
  orderRows: readonly Cafe24OrderRow[],
  refundRows: readonly Cafe24RefundRow[],
  dateStart: ISODate,
  dateEnd: ISODate,
  keyOf: {
    gross: (row: Cafe24OrderRow) => string
    refund: (row: Cafe24RefundRow) => string
    additional: (row: Cafe24OrderRow) => string
  },
): Map<string, Cafe24MetricsSummary> {
  const groupedGross = groupBy(
    grossRowsInRange(orderRows, dateStart, dateEnd),
    keyOf.gross,
  )
  const groupedRefund = groupBy(
    refundRowsInRange(refundRows, dateStart, dateEnd),
    keyOf.refund,
  )
  const groupedAdditional = groupBy(
    additionalRowsInRange(orderRows, dateStart, dateEnd),
    keyOf.additional,
  )
  const keys = new Set([
    ...groupedGross.keys(),
    ...groupedRefund.keys(),
    ...groupedAdditional.keys(),
  ])

  const result = new Map<string, Cafe24MetricsSummary>()
  for (const key of keys) {
    result.set(
      key,
      combine(
        sumGross(groupedGross.get(key) ?? []),
        sumRefund(groupedRefund.get(key) ?? []),
        sumAdditional(groupedAdditional.get(key) ?? []),
      ),
    )
  }
  return result
}

export const summarizeByDate = (
  orderRows: readonly Cafe24OrderRow[],
  refundRows: readonly Cafe24RefundRow[],
  dateStart: ISODate,
  dateEnd: ISODate,
): Cafe24DateSummary[] => {
  const grouped = summarizeByKey(orderRows, refundRows, dateStart, dateEnd, {
    gross: (r) => r.paymentDate!,
    refund: (r) => r.refundDate,
    additional: (r) => r.cancelDate!,
  })
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, summary]) => ({ date, ...summary }))
}

export const summarizeByDayOfWeek = (
  orderRows: readonly Cafe24OrderRow[],
  refundRows: readonly Cafe24RefundRow[],
  dateStart: ISODate,
  dateEnd: ISODate,
): Cafe24DayOfWeekSummary[] => {
  const grouped = summarizeByKey(orderRows, refundRows, dateStart, dateEnd, {
    gross: (r) => weekdayKo(r.paymentDate!),
    refund: (r) => weekdayKo(r.refundDate),
    additional: (r) => weekdayKo(r.cancelDate!),
  })
  return Array.from(grouped.entries())
    .map(([dayOfWeek, summary]) => ({ dayOfWeek, ...summary }))
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
  const grouped = summarizeByKey(orderRows, refundRows, dateStart, dateEnd, {
    gross: (r) => r.paymentDate!.slice(0, 7),
    refund: (r) => r.refundDate.slice(0, 7),
    additional: (r) => r.cancelDate!.slice(0, 7),
  })
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, summary]) => ({
      period: monthKey.replace('-', '.'),
      ...monthBounds(monthKey, dateStart, dateEnd),
      ...summary,
    }))
}
