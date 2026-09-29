import type { ISODate } from '../types'

/** Cafe24 주문 1건을 평탄화한 행 — "결제"(grossPayment)만 담당한다. 예전엔
 * 여기에 취소/환불(cancelDate/refundAmount)까지 order.cancel_date와
 * initial/actual 금액 차이로 derive해서 같이 담았었는데, 8/31 매출 조사에서
 * 실제로 안 맞는 케이스를 발견했다 — 반품 접수(cancel_date)는 한 번뿐이어도
 * 실제 카드 부분취소/환불은 여러 번(예: 8/18에 68,000원, 8/31에 528,700원)
 * 나뉘어 일어날 수 있는데, order 객체의 cancel_date는 단일 날짜라 이걸
 * 표현하지 못한다. 그래서 환불은 카페24가 별도로 제공하는 "환불(refunds)"
 * 리소스(refund-client.ts, Cafe24RefundRow)에서 따로 가져온다 — 환불 이벤트
 * 하나하나가 자기 refund_date를 갖고 있어서 정확하다.
 *
 * 결제는 order_date가 아니라 payment_date 기준이다 — 7/29 주문 중 무통장입금
 * 등으로 실제 결제 확인이 7/30에 된 건이 있었는데, 카페24 관리자 일별
 * 리포트가 이 건을 7/30에 넣는 걸 직접 검증으로 확인했다. */
export interface Cafe24OrderRow {
  orderId: string
  /** 참고용 — 주문 접수일(order_date). 집계에는 안 쓴다(아래 paymentDate가
   * grossPayment 귀속 기준). */
  orderDate: ISODate
  /** 실제 결제가 확인된 날짜(payment_date를 날짜만 잘라서) — 결제 안 된
   * 주문(paid='F')은 null. grossPayment는 orderDate가 아니라 이 날짜에
   * 귀속된다(카페24 관리자 리포트와 맞추기 위해 — 위 주석 참고). 무통장입금
   * 등은 orderDate와 며칠 차이날 수 있다. */
  paymentDate: ISODate | null
  /** 실제로 취소/반품이 접수 처리된 날짜(cancel_date) — 없으면 null.
   * refundAmount 계산에는 더 이상 안 쓰지만(위 주석 참고, Cafe24RefundRow가
   * 담당), additionalShippingFee를 귀속시키는 데는 이 날짜를 쓴다 —
   * 반품배송비 추가결제는 카페24 자체에 날짜 필드가 없고(claim_reason
   * 자유텍스트에만 적힘, /admin/return/{claim_code}로 직접 확인함) 유일하게
   * 확보 가능한 날짜가 이 cancel_date뿐이며, 8/21 사례로 실제 그 날짜에
   * 귀속되는 걸 검증했다. */
  cancelDate: ISODate | null
  memberId: string | null
  /** 결제 완료 여부(Cafe24 "T"/"F"를 boolean으로 변환). */
  paid: boolean
  /** 결제금액 — 주문 시점(initial_order_amount) 기준 상품구매금액+배송비-
   * 적립금사용액, 취소 여부와 무관하게 그대로. paymentDate에 귀속된다(그 날
   * 실제로 결제 확인된 금액이라는 뜻이라 나중에 취소되더라도 바뀌지 않음 —
   * 대신 취소분은 Cafe24RefundRow로 따로 반영된다). */
  grossPayment: number
  /** 참고용 — grossPayment에 포함된 배송비(초기 금액 기준). */
  shippingFee: number
  /** 참고용 — grossPayment에서 이미 제외된 적립금 사용액(초기 금액 기준,
   * 우리 순매출이 아니라 할인으로 취급 — 매장 자체 적립금만 해당, 결제수단
   * 자체가 다른 네이버페이 등은 여기 안 걸린다). */
  pointsSpent: number
  /** 참고용 — grossPayment에서 이미 제외된 주문 단위 할인 합계(쿠폰·멤버십·
   * 세트상품할인 등, client.ts의 OTHER_DISCOUNT_FIELDS). 지금까지 이 매장이
   * 실제로 쓴 건 쿠폰뿐이라 "쿠폰할인"으로 부른다(7/7 환불 건에서 발견 —
   * coupon_discount_price 100,000원을 처음엔 안 빼서 환불액이 과다
   * 집계됐었다). */
  couponDiscount: number
  /** 반품 처리 중 추가로 결제받은 배송비(actual_order_amount.shipping_fee가
   * initial보다 커진 만큼) — 대부분 0. 8/21 조사에서 발견: 반품 접수 시
   * "반품배송비 구매자부담"으로 별도 카드결제가 일어나는 경우가 있는데
   * 원 주문 결제(paymentDate)에도, 환불(refundDate)에도 안 잡히는 제3의
   * 현금흐름이라 따로 뗐다. grossPayment에는 안 섞고 cancelDate에 귀속시켜
   * combine()에서 더한다(types.ts Cafe24MetricsSummary 주석 참고). */
  additionalShippingFee: number
  /** 이 주문 하나만으로 계산한 취소분(initial-actual 델타, 취소 없으면 0) —
   * 평소엔 안 쓰고 /admin/refunds에 기록이 없는 채널의 폴백으로만 쓴다.
   * 8/6 조사에서 발견: market_id가 NCHECKOUT(네이버페이)인 주문은 취소돼도
   * /admin/refunds에 아예 안 잡힌다(카페24 자체 PG가 아니라 네이버페이 쪽에서
   * 환불이 처리돼서로 보임 — 6~9월 데이터에서 NCHECKOUT 취소 7건 전부
   * /admin/refunds 누락, 합계 26,163,000원). index.ts의
   * buildFallbackRefundRows가 이 값을 실제 환불 목록에 orderId가 없는
   * 주문에 한해서만 Cafe24RefundRow로 합성해 채워 넣는다(있으면 중복
   * 계산이라 안 씀). */
  cancelRefundAmount: number
}

/** Cafe24 "환불(refunds)" 리소스 — 주문의 cancel_date 대신 이걸 쓰는 이유는
 * 위 Cafe24OrderRow 주석 참고. 환불 이벤트 하나(refund_code)가 자기만의
 * refund_date/금액을 갖고, 같은 주문에 여러 번 있을 수 있다. */
export interface Cafe24RefundRow {
  refundCode: string
  orderId: string
  /** 실제 환불이 완료 처리된 날짜(refund_date) — 반품/취소 "접수일"
   * (accepted_refund_date)과 다를 수 있다(위 예시처럼 접수 8/21, 완료
   * 8/31). 카페24 관리자 "일별 매출내역"의 환불합계가 이 날짜 기준인 걸
   * 8/31 데이터로 정확히 검증했다(대조 계산이 원 단위까지 일치). */
  refundDate: ISODate
  /** 실제 환불된 금액(actual_refund_amount) — 적립금/예치금 환불분은 이미
   * 빠진 순수 현금 환불액(관리자 화면의 "실환불액"과 동일 기준). */
  amount: number
}

export interface Cafe24MetricsSummary {
  /** 순매출(온라인 매출 대표값) = grossPayment - shippingFee - refundAmount.
   * "순매출은 총매출에서 배송비·적립금 제외"로 정의 확정 — 적립금은 이미
   * grossPayment 계산 시점(상품구매금액 기준, netAmount)에서 빠져있어서 여기
   * 공식엔 안 보이고, 배송비만 명시적으로 뺀다. 배송비/적립금은 매출에서는
   * 빠지지만 각자 다른 성격(배송비=실비 통과항목, 적립금=할인)이라 하나로
   * 합치지 않고 shippingFee/pointsSpent로 따로 노출한다. */
  paymentAmount: number
  /** 총매출 — 그 기간에 "결제"로 귀속된 금액 합계(배송비 포함, 적립금 제외).
   * 결제일(paymentDate) 기준 본 결제금액 + 반품 처리일(cancelDate) 기준
   * 추가배송비(additionalShippingFee) 합. 서로 다른 날짜 기준을 더하는
   * 이유는 Cafe24OrderRow 주석 참고. */
  grossPayment: number
  /** 그 기간에 "환불"로 귀속된 금액 합계(환불 완료일=refund_date 기준). */
  refundAmount: number
  /** 참고용 — grossPayment에 포함된 배송비 합계(기본 배송비 + 추가배송비),
   * paymentAmount(순매출)에서는 빠져있다. */
  shippingFee: number
  /** 참고용 — grossPayment(따라서 paymentAmount)에서 이미 제외된 적립금
   * 사용액 합계. */
  pointsSpent: number
  /** 참고용 — grossPayment(따라서 paymentAmount)에서 이미 제외된 쿠폰 등
   * 주문 단위 할인 합계(Cafe24OrderRow.couponDiscount 주석 참고). */
  couponDiscount: number
  /** 참고용 — grossPayment/shippingFee에 포함된 반품 추가배송비 합계만 따로
   * (반품 처리일 기준). */
  additionalShippingFee: number
  /** 결제 건수(결제일 기준, 매출 집계에 포함된 것만). */
  orderCount: number
  /** 환불 건수(환불 완료일 기준, 한 주문에 여러 건일 수 있음). */
  refundCount: number
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
