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
  /** 실제로 취소/반품이 접수 처리된 날짜 — 없으면 null. 카페24 원본
   * order.cancel_date를 그대로 쓰지 않고 client.ts의 effectiveCancelDate를
   * 거친 값이다 — 주문 전체가 취소되면 order.cancel_date에 찍히지만, 품목
   * 일부만 취소되면(canceled: "M") 그 필드는 계속 null로 남고 대신
   * items[].cancel_date에만 찍힌다(5/6 매출 대조로 발견 — 20260408-0000013
   * 주문이 이 케이스라 cancelRefundAmount가 있는데도 cancelDate가 null이라
   * buildFallbackRefunds가 통째로 건너뛰고 있었다). refundAmount 계산에는
   * 더 이상 안 쓰지만(위 주석 참고, Cafe24RefundRow가 담당),
   * additionalShippingFee를 귀속시키는 데는 이 날짜를 쓴다 — 반품배송비
   * 추가결제는 카페24 자체에 날짜 필드가 없고(claim_reason 자유텍스트에만
   * 적힘, /admin/return/{claim_code}로 직접 확인함) 유일하게 확보 가능한
   * 날짜가 이 cancelDate뿐이며, 8/21 사례로 실제 그 날짜에 귀속되는 걸
   * 검증했다. */
  cancelDate: ISODate | null
  memberId: string | null
  /** 결제 완료 여부(Cafe24 "T"/"F"를 boolean으로 변환). */
  paid: boolean
  /** 결제금액 — 주문 시점(initial_order_amount) 기준 상품구매금액+배송비
   * (쿠폰 등 주문 단위 할인은 뺌, 적립금은 안 뺌 — 아래 pointsSpent 주석
   * 참고), 취소 여부와 무관하게 그대로. **상품 할인(itemDiscount)은 여기서
   * 안 뺀다** — 3/12 매출 대조로 카페24 관리자 "총결제액" 컬럼이 상품할인
   * 반영 전 금액이라는 걸 확인해서, 여기 맞춰 상품할인은 순매출
   * (paymentAmount) 계산 단계(helper.ts)에서만 뺀다. paymentDate에
   * 귀속된다(그 날 실제로 결제 확인된 금액이라는 뜻이라 나중에 취소되더라도
   * 바뀌지 않음 — 대신 취소분은 Cafe24RefundRow로 따로 반영된다). */
  grossPayment: number
  /** 참고용 — grossPayment에 포함된 배송비(초기 금액 기준). */
  shippingFee: number
  /** 참고용 — grossPayment에 포함된 적립금 사용액(초기 금액 기준, 매장 자체
   * 적립금만 해당). 처음엔 "적립금은 매출 아님"으로 grossPayment에서
   * 뺐었는데, 6월 매출 대조 중 카페24 관리자 "일별 매출내역"이 결제/환불
   * 양쪽 다 적립금을 포함시키는 걸 확인해서(예: 전액 적립금으로 결제된
   * 주문을 취소하면 환불합계에 그 적립금 환불분이 그대로 잡힘) 화면 기준으로
   * 전환했다 — 지금은 grossPayment에 포함돼 있고, 이 필드는 그 중 적립금이
   * 얼마인지 참고용으로만 보여준다. */
  pointsSpent: number
  /** 참고용 — grossPayment에서 이미 제외된 주문 단위 할인 합계(쿠폰·멤버십·
   * 세트상품할인 등, client.ts의 OTHER_DISCOUNT_FIELDS). 지금까지 이 매장이
   * 실제로 쓴 건 쿠폰뿐이라 "쿠폰할인"으로 부른다(7/7 환불 건에서 발견 —
   * coupon_discount_price 100,000원을 처음엔 안 빼서 환불액이 과다
   * 집계됐었다). */
  couponDiscount: number
  /** 참고용 — grossPayment에는 아직 포함돼 있고 paymentAmount에서만 빠지는
   * "상품 할인" 합계(카페24 관리자 "일별 매출내역"의 "할인" 컬럼, 쿠폰과
   * 별도. 3/12 매출 대조로 grossPayment=카페24 "총결제액"은 할인 반영 전이라는
   * 걸 확인해서 여기서 뺀다 — helper.ts의 combine() 주석 참고).
   * order_price_amount와 payment_amount의 차이로만 드러나고 어떤 구조화된
   * 할인 필드에도 안 잡힌다(client.ts의 itemDiscountFor 주석 참고 — 품목별
   * additional_discount_price 필드로 바꿔본 적도 있는데, 6/9·6/10 주문처럼
   * 그 필드로도 안 잡히는 할인이 있어서 역산 방식으로 되돌렸다). 처음엔
   * 스마트스토어(market_id="shopn") 채널에서만 발견했는데, 자체몰/모바일/
   * NCHECKOUT(네이버페이) 채널에서도 같은 패턴이 나와 전 채널로 넓혔다 —
   * NCHECKOUT은 네이버포인트 결제분(naver_point)만 따로 제외하고 계산한다. */
  itemDiscount: number
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
  /** cancelRefundAmount 중 적립금 환불분만 따로(initial-actual의
   * points_spent_amount 차이) — 평소엔 안 쓰고 cancelRefundAmount와 같은
   * 이유(폴백 환불)로 index.ts의 buildFallbackRefundRows가 Cafe24RefundRow.
   * pointsRefunded로 합성해 채워 넣는다. */
  cancelPointsRefund: number
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
  /** 실제 환불된 금액(actual_refund_amount + used_points + used_credits) —
   * 카페24 관리자 "일별 매출내역"의 환불합계와 맞추기 위해 적립금/예치금
   * 환불분(전액 적립금 결제 주문 취소 등)까지 합쳤다(types.ts 위 주석 참고,
   * actual_refund_amount만으로는 6월 매출 대조에서 원 단위까지 안 맞았다). */
  amount: number
  /** 이 환불 이벤트 중 적립금으로 돌려준 금액(used_points, 혹은 폴백 환불의
   * Cafe24OrderRow.cancelPointsRefund) — amount(현금+적립금+예치금 합계)에
   * 이미 포함돼 있는 값을 참고용으로 따로 뗀 것. "순 적립금 사용액"(그 기간에
   * 쓴 적립금 - 그 기간에 환불된 적립금)을 계산하는 데 쓴다. */
  pointsRefunded: number
  /** true면 카페24 /admin/refunds에 실제로 기록된 환불이 아니라, index.ts의
   * buildFallbackRefunds가 주문 금액 델타(initial-actual)로 역산해 합성한
   * 값이다(NCHECKOUT=네이버페이처럼 카페24 자체 PG가 아니라 그 채널에서
   * 환불이 처리돼 /admin/refunds에 기록이 안 남는 경우의 폴백 — index.ts
   * 주석 참고). 4월 매출 대조(9/30) 중 카페24 관리자 화면은 이 환불을 아예
   * 모른다는 걸 확인해서, helper.ts의 refundAmount/paymentAmount 계산에서는
   * isFallback 행을 제외하고 unrecordedRefundAmount로만 참고용 노출하기로
   * 했다 — "카페24 화면과 맞춘 순매출"이라는 목적과 "실제로 나간 돈은 놓치지
   * 않는다"는 목적이 서로 달라 분리했다. */
  isFallback: boolean
  /** true면 카페24에서 온 환불이 아니라 관리자가 손으로 넣은 보정
   * (adjustments.ts, cafe24Adjustments 컬렉션)이다. amount가 음수일 수 있다
   * (환불 취소 — 취소 철회 등). refundAmount와 paymentAmount에는 반영하지만
   * 환불 건수(refundCount)에는 세지 않고, manualRefundAdjustment로 따로도
   * 노출한다. */
  isAdjustment?: boolean
}

export interface Cafe24MetricsSummary {
  /** 순매출(온라인 매출 대표값) = grossPayment - itemDiscount - refundAmount -
   * unrecordedRefundAmount(배송비·적립금 포함, 실제로 나간 돈은 다 뺀 값).
   * 카페24 공식 서비스 가이드(일별/월별매출)의 "순매출 = 결제합계 -
   * 환불합계" 정의(결제합계 자체에 배송비 포함)를 따라 배송비는 안 뺀다(5/24
   * 대조 검증). 적립금도 grossPayment/refundAmount 둘 다 이미 포함
   * (Cafe24OrderRow.pointsSpent 주석 참고)이라 따로 뺄 게 없다. itemDiscount는
   * grossPayment에는 이미 안 들어있어서(grossPayment 주석 참고) 여기서 따로
   * 빼야 한다. 환불은 카페24 /admin/refunds 기록분(refundAmount)뿐 아니라
   * 폴백분(unrecordedRefundAmount, NCHECKOUT=네이버페이 등 카페24가 모르는
   * 취소)까지 둘 다 뺀다 — 한때 폴백분은 빼면 카페24 화면과 어긋난다고 보고
   * 제외했었는데(4월 매출 대조), 그 화면 자체가 이 취소를 전혀 몰라서(총
   * 결제액도 안 줄어듦) "카페24 매출액"이 실제로 가게에 남은 돈보다 부풀려
   * 보였던 거라 다시 포함시켰다. 그래서 이 필드는 카페24 관리자 화면 숫자와
   * 정확히 일치하지 않을 수 있다(폴백 환불이 있는 기간이면 그만큼 더 낮게
   * 나오는 게 맞음) — 대신 실제 순매출에는 더 가깝다. ROAS 계산용 온라인
   * 매출은 이 값에서 배송비·적립금을 별도로 더 빼서 쓴다(functions-cmip 밖
   * use-roas-view-model.ts 참고). */
  paymentAmount: number
  /** 총결제액 — 그 기간에 "결제"로 귀속된 금액 합계(배송비·적립금 포함,
   * 상품할인 반영 전). 결제일(paymentDate) 기준 본 결제금액 + 반품
   * 처리일(cancelDate) 기준 추가배송비(additionalShippingFee) 합. 서로 다른
   * 날짜 기준을 더하는 이유는 Cafe24OrderRow 주석 참고. 3/12 매출 대조로
   * 확인: 카페24 관리자 "총결제액" 컬럼이 상품할인 반영 전 금액이었다(예전엔
   * 이 필드에 상품할인을 미리 빼서 넣었었는데, 그러면 우리 "총 결제액"이
   * 실제로는 카페24의 "총매출액"(할인 반영 후) 개념과 같아지는 라벨 불일치가
   * 있었다 — client.ts의 toOrderRow 주석 참고). */
  grossPayment: number
  /** 그 기간에 "환불"로 귀속된 금액 합계(환불 완료일=refund_date 기준,
   * 적립금/예치금 환불분 포함) — 카페24 /admin/refunds에 실제로 기록된
   * 환불만(Cafe24RefundRow.isFallback=false). 폴백 환불(NCHECKOUT 등)은
   * unrecordedRefundAmount로 따로 노출하지만, paymentAmount 계산에서는 이
   * 둘을 합쳐서 뺀다(paymentAmount 주석 참고) — 이 필드 자체는 "카페24 화면에
   * 실제로 잡히는 환불이 얼마인지"를 보여주는 용도로 남겨둔다. */
  refundAmount: number
  /** 참고용 — grossPayment에 포함된 배송비 합계(기본 배송비 + 추가배송비),
   * paymentAmount(순매출)에서는 빠져있다. */
  shippingFee: number
  /** 참고용 — grossPayment(따라서 paymentAmount)에 포함된 적립금 사용액
   * 합계(Cafe24OrderRow.pointsSpent 주석 참고, 결제일 기준 — 나중에 환불되면
   * pointsRefunded로 따로 잡힌다). */
  pointsSpent: number
  /** 참고용 — refundAmount에 포함된 적립금 환불액 합계(환불 완료일 기준,
   * Cafe24RefundRow.pointsRefunded 주석 참고). 순 적립금 사용액 =
   * pointsSpent - pointsRefunded. */
  pointsRefunded: number
  /** 참고용 — grossPayment(따라서 paymentAmount)에서 이미 제외된 쿠폰 등
   * 주문 단위 할인 합계(Cafe24OrderRow.couponDiscount 주석 참고). */
  couponDiscount: number
  /** 참고용 — grossPayment에는 포함돼 있고 paymentAmount에서만 제외된
   * "상품 할인" 합계(Cafe24OrderRow.itemDiscount 주석 참고). */
  itemDiscount: number
  /** 참고용 — grossPayment/shippingFee에 포함된 반품 추가배송비 합계만 따로
   * (반품 처리일 기준). */
  additionalShippingFee: number
  /** 참고용 — refundAmount(카페24 화면 기록분)에는 안 들어있는 폴백 환불
   * (Cafe24RefundRow.isFallback 주석 참고) 합계. NCHECKOUT(네이버페이) 등
   * 카페24 자체 PG가 아닌 채널의 취소는 /admin/refunds에 기록이 안 남아
   * 카페24 관리자 화면도 이 돈이 나간 걸 모른다. paymentAmount 계산에는 이미
   * 반영돼 있고(paymentAmount 주석 참고), 이 필드는 "그중 얼마가 카페24
   * 화면엔 안 보이는 몫인지" 감사용으로 따로 노출한다. */
  unrecordedRefundAmount: number
  /** 참고용 — refundAmount에 이미 포함된 수동 보정 합계(관리자가 직접 등록,
   * Cafe24RefundRow.isAdjustment 주석 참고). 양수면 환불을 늘린 것, 음수면
   * 줄인 것. "refundAmount 중 얼마가 카페24 API가 아니라 손으로 넣은
   * 값인지" 감사용. */
  manualRefundAdjustment: number
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
