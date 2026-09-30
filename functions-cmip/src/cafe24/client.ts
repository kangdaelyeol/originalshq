// Cafe24 주문 목록 API 호출 — 인증(auth.ts)이 끝난 access_token으로 실제
// 매출(주문) 원본 데이터를 가져온다.
import {
  apiBase,
  getCafe24AccessToken,
  isCafe24InvalidTokenError,
} from './auth'
import { chunkDateRangeForCafe24 } from './utils'
import type { Cafe24OrderRow, Cafe24RefundRow } from './types'
import type { ISODate } from '../types'

// 페이지당 최대 건수(Cafe24 문서 기준 100건) — 크게 잡을수록 페이지 수가
// 줄어 호출 횟수가 적어진다.
const PAGE_SIZE = 100

interface Cafe24AmountBreakdown {
  order_price_amount: string
  shipping_fee: string
  // 적립금 사용액 — netAmount에서는 안 뺀다(카페24 관리자 "일별 매출내역"이
  // 결제/환불 양쪽 다 적립금을 포함시키는 걸 확인하고 방침을 맞췄다 — 처음엔
  // "적립금은 매출 아님"으로 뺐었는데, 6월 매출 대조 중 환불합계가 정확히
  // 적립금 환불분(예: 6/12에 3건 합계 294,000원)만큼 어긋나는 걸 발견해서
  // 카페24 화면 기준으로 전환했다). pointsSpent로 참고용 노출은 계속한다.
  points_spent_amount: string
  // 예치금 사용액 — 적립금과 같은 성격(카페24 공식 순매출 정의: "결제합계 =
  // 실결제금액+적립금+예치금+네이버포인트+배송비"에 예치금도 포함)이라
  // netAmount에서 안 뺀다. 이 매장은 지금까지 실사용 0원이라 pointsSpent처럼
  // 별도 참고용 필드로 노출하지는 않는다.
  credits_spent_amount: string
  // 쿠폰/멤버십 등 주문 단위 할인 — 전부 "실제로 돈을 받지 못한 부분"이라
  // 순액 계산에서 빼야 한다(netAmount 주석 참고). 처음엔 이 매장이 쿠폰을 안
  // 쓰는 줄 알고 뺐었는데, 실제로 쓰고 있어서(7/7 환불 건에서 발견 —
  // coupon_discount_price 100,000원을 안 빼서 그만큼 환불액이 과다
  // 집계됐었다) 다시 넣었다.
  coupon_discount_price: string
  coupon_shipping_fee_amount: string
  membership_discount_amount: string
  shipping_fee_discount_amount: string
  set_product_discount_amount: string
  app_discount_amount: string
  market_other_discount_amount: string
  payment_amount: string
  [key: string]: unknown
}

interface Cafe24RawOrder {
  order_id: string
  order_date: string
  // 실제 결제가 확인된 날짜 — 결제 안 된 주문(paid='F')은 null. 무통장입금
  // 등은 order_date와 하루 이상 벌어질 수 있다(예: 7/29 주문이 7/30 결제
  // 확인) — 카페24 관리자 일별 리포트가 이 날짜 기준으로 집계하는 걸 직접
  // 검증으로 확인했다(client.ts 밖 types.ts의 Cafe24OrderRow 주석 참고).
  payment_date: string | null
  // 취소/반품 접수 처리일 — 주문 전체가 취소된 경우에만 채워진다. 일부
  // 품목만 취소되면(canceled: "M") 이 필드는 계속 null로 남고, 대신 그
  // 품목의 items[].cancel_date에 실제 취소 완료일이 찍힌다(effectiveCancelDate
  // 주석 참고 — 5/6 매출 대조로 발견: 20260408-0000013 주문이 이 필드는
  // null인데 items 쪽엔 2026-05-06이 있었다). additionalShippingFee 귀속에만
  // 쓴다(types.ts의 Cafe24OrderRow 주석 참고, 환불 자체는 더 이상 이 필드를
  // 안 쓴다) — 직접 안 쓰고 effectiveCancelDate를 거쳐서 쓴다.
  cancel_date: string | null
  member_id: string | null
  // 판매 채널 — "self"(자체몰), "mobile"(모바일웹), "shopn"(네이버 스마트
  // 스토어), "NCHECKOUT"(네이버페이) 등. itemDiscountFor 계산에는 안
  // 쓴다(naver_point 필드로 채널 구분 없이 처리 — itemDiscountFor 주석 참고).
  market_id: string
  // 이 주문에서 네이버페이 포인트로 결제된 금액 — initial_order_amount/
  // actual_order_amount 밑이 아니라 주문 최상위 필드다(카페24 API가 그렇게
  // 내려줌). NCHECKOUT(네이버페이) 채널이 아니면 보통 null. 카페24의
  // "적립금"(points_spent_amount)과는 별개 시스템이라 거기 안 잡힌다 —
  // itemDiscountFor 주석 참고.
  naver_point: string | null
  paid: 'T' | 'F'
  /** 최초 주문 시점 금액 breakdown — 취소 여부와 무관하게 주문 당시 그대로.
   * "결제"(grossPayment)는 이 값 기준, paymentDate에 귀속한다. */
  initial_order_amount: Cafe24AmountBreakdown
  /** 반품 처리 후 현재 금액 — additionalShippingFee(반품배송비 추가결제)
   * 감지에만 쓴다: 이 shipping_fee가 initial보다 커진 만큼이 추가결제분. */
  actual_order_amount: Cafe24AmountBreakdown
  /** 품목 목록 — /admin/orders 호출에 embed=items를 붙여야 내려온다
   * (fetchOrdersForSingleRange 참고). 품목별 cancel_date만 쓴다 —
   * effectiveCancelDate 주석 참고. */
  items: Cafe24OrderItem[]
  /** 배송비 묶음(배송비 그룹)별 상세 — actualShipping 보정에만 쓴다
   * (actualShipping 계산 부분 주석 참고). 배송비가 여러 묶음으로 나뉠 수
   * 있어서 배열이다. */
  shipping_fee_detail: Cafe24ShippingFeeDetail[]
}

/** 주문 품목 하나 — /admin/orders?embed=items로 얻는 items 배열의 원소.
 * cancel_date 외 다른 필드는 안 쓴다. */
interface Cafe24OrderItem {
  cancel_date: string | null
}

/** 배송비 묶음 하나 — cancel_shipping_fee 외 다른 필드는 안 쓴다. */
interface Cafe24ShippingFeeDetail {
  cancel_shipping_fee: string
}

interface Cafe24OrdersResponse {
  orders: Cafe24RawOrder[]
}

/** 주문의 실질적인 취소일 — raw.cancel_date(주문 전체 취소일)가 있으면
 * 그대로 쓰고, 없으면(부분취소=canceled:"M") items 중 cancel_date가 찍힌
 * 품목들의 최댓값(가장 나중 취소 완료일)을 쓴다. 5/6 매출 대조로 발견:
 * 20260408-0000013 주문은 품목 10개짜리 하나만 부분취소됐는데 주문 전체
 * cancel_date는 계속 null이고, 그 품목의 items[].cancel_date에만
 * 2026-05-06 취소완료일이 찍혀 있었다 — 이 케이스를 못 잡아서
 * cancelRefundAmount(560,000원)가 있는데도 cancelDate가 null이라
 * buildFallbackRefunds(index.ts)가 통째로 건너뛰고 있었다(카페24 화면
 * 환불액과 235,000원 → 776,500원 차이로 드러남). 여러 품목이 서로 다른
 * 날짜에 취소되면 가장 나중 날짜를 쓴다 — 정확한 배분보다는 최소한
 * "완전히 놓치지 않는" 쪽을 택했다. */
function effectiveCancelDate(raw: Cafe24RawOrder): string | null {
  if (raw.cancel_date) return raw.cancel_date
  const itemCancelDates = (raw.items ?? [])
    .map((item) => item.cancel_date)
    .filter((date): date is string => date != null)
  if (itemCancelDates.length === 0) return null
  itemCancelDates.sort()
  return itemCancelDates[itemCancelDates.length - 1]
}

// 주문 단위 할인 필드들 — 전부 "적립금"과 같은 성격(실제로 돈을 받지 못한
// 부분)이라 순액 계산에서 함께 뺀다. points_spent_amount는 따로 다뤄서
// pointsSpent로 참고용으로 노출하고(사용자가 명시적으로 따로 보고 싶어함),
// 나머지는 개별 노출 없이 netAmount 안에서만 뺀다.
const OTHER_DISCOUNT_FIELDS = [
  'coupon_discount_price',
  'coupon_shipping_fee_amount',
  'membership_discount_amount',
  'shipping_fee_discount_amount',
  'set_product_discount_amount',
  'app_discount_amount',
  'market_other_discount_amount',
] as const

// "결제"(grossPayment)는 order_price_amount+shipping_fee에서 쿠폰 등 주문
// 단위 할인만 뺀 금액이다(적립금·예치금은 안 뺀다 — 위 Cafe24AmountBreakdown.
// points_spent_amount/credits_spent_amount 주석 참고). payment_amount는 결제수단에 따라 값이
// 들쭉날쭉해서 안 쓴다 — 예: 네이버페이 포인트 전액 결제 건은 payment_amount가
// 0으로 나오는데 order_price_amount는 정상적으로 상품가가 찍힘.
// initial_order_amount로 계산한 값을 paymentDate에 귀속시킨다 — types.ts의
// Cafe24OrderRow 주석 참고. 환불은 여기서 안 다루고 아래 toRefundRow가 별도
// "환불" 리소스에서 처리한다. shippingFeeOverride는 actual_order_amount 쪽
// 계산에서만 쓴다 — actual_order_amount.shipping_fee 필드가 배송비만 따로
// 취소돼도 안 줄어드는 걸 발견해서(toOrderRow의 actualShipping 계산 참고),
// 배송비 취소분을 미리 반영한 값을 대신 넣기 위해서다.
function netAmount(a: Cafe24AmountBreakdown, shippingFeeOverride?: number): number {
  const shippingFee =
    shippingFeeOverride !== undefined ? shippingFeeOverride : Number(a.shipping_fee) || 0
  let total = (Number(a.order_price_amount) || 0) + shippingFee
  for (const field of OTHER_DISCOUNT_FIELDS) {
    total -= Number(a[field]) || 0
  }
  return total
}

// OTHER_DISCOUNT_FIELDS 합계 — grossPayment 계산에서 이미 빠져있지만(netAmount),
// 사용자가 ROAS 요약에서 얼마가 할인으로 빠졌는지 참고용으로 보고 싶어해서
// pointsSpent/shippingFee와 같은 방식으로 따로 노출한다. 이 매장에서 지금까지
// 실제로 값이 찍힌 건 coupon_discount_price뿐이라 "쿠폰할인"으로 부르지만,
// 다른 주문 단위 할인이 생기면 자동으로 여기 합산된다.
function couponDiscount(a: Cafe24AmountBreakdown): number {
  let total = 0
  for (const field of OTHER_DISCOUNT_FIELDS) {
    total += Number(a[field]) || 0
  }
  return total
}

// "상품 할인" — 카페24 관리자 "일별 매출내역"의 "할인" 컬럼(쿠폰과는 별도)에
// 해당하는데, 이 금액은 OTHER_DISCOUNT_FIELDS 등 어떤 구조화된 필드에도 안
// 잡히고 (상품구매금액+배송비-적립금)과 payment_amount의 차이로만 드러난다.
// 처음엔 스마트스토어(market_id="shopn") 채널에서만 발견해서(6/10 주문:
// 상품구매금액 2,800,000 - 할인 850,000 = 실결제금액 1,950,000, 구조화된
// 할인 필드는 전부 0) "마켓할인"으로 좁게 잡았었는데, 3~5월 데이터로 다시
// 대조하다가 자체몰(self)·모바일(mobile) 채널에서도 똑같은 패턴이 나와
// 전 채널로 넓혔다.
//
// 한동안 이 값을 카페24가 품목별로 내려주는 additional_discount_price 필드
// (/admin/orders?embed=items)로 대체했었는데, 6월 매출 대조 중 이 필드가
// 모든 할인을 담아주는 게 아니라는 걸 발견했다 — 6/9·6/10 주문
// (20260609-0000018, 20260610-0000066, 둘 다 shopn/신용카드 결제, 각각
// 678,000원·850,000원 할인, 합계 1,528,000원)은 상품구매금액과 결제금액 차이가
// 뚜렷한데 additional_discount_price도 다른 구조화된 필드도 전부 0이었다 —
// 역산 말고는 잡을 방법이 없는 할인도 있다는 뜻이라 역산 방식으로 되돌렸다.
// embed=items 자체는 그대로 남겨뒀다 — items[].cancel_date를 부분취소 주문의
// 취소일 보정(effectiveCancelDate)에 쓰기 때문이다.
//
// market_id === "NCHECKOUT"(네이버페이)만 역산에서 제외하면 안 된다 — 5/1
// 주문(20260501-0000017)처럼 네이버포인트를 전혀 안 쓴 NCHECKOUT 주문의
// 진짜 할인(22,800원)도 있다는 걸 발견했다(그전엔 "NCHECKOUT이면 할인 계산
// 자체를 스킵"하는 임시방편을 썼다가 이 케이스를 통째로 놓쳤었다). 그래서
// 채널로 거르는 대신, 카페24가 네이버포인트 결제액을 담아주는 주문 최상위
// naver_point 필드(Cafe24RawOrder.naver_point 주석 참고 — points_spent_amount와는
// 별개 시스템)를 net에서 따로 빼서, 진짜 네이버포인트 결제분만 할인 계산에서
// 제외한다. net에서 적립금·예치금·네이버포인트를 따로 빼고 비교하는 이유도
// 같다 — netAmount 자체는 셋 다 안 빼지만(위 Cafe24AmountBreakdown 주석
// 참고), payment_amount는 원래도 이 세 결제수단분이 반영 안 된 금액이라, 그
// 셋으로 낸 금액을 상품 할인으로 착각하지 않으려면 이 계산에서만 별도로
// 빼야 한다.
//
// payment_amount<=0이면 무조건 할인 0으로 보던 가드가 있었는데, 5/6 주문
// (20260506-0000053)으로 이게 틀렸다는 걸 발견했다 — 이 주문은 상품구매금액
// 205,000원을 네이버포인트 184,500원 + 진짜 할인 20,500원으로 결제해서
// payment_amount는 0인데(현금/카드로 낸 잔액이 없어서), naverPoint를 뺀
// 나머지(20,500원)는 여전히 진짜 상품 할인이다. payment<=0 자체는 "할인 없음"
// 신호가 아니라 "현금 잔액 없음" 신호일 뿐이라 구분을 잘못 짚었던 것 —
// paid==='T'(실제로 결제 완료된 주문)인지로 바꿔서, 미결제 주문(파싱 실수로
// 생기는 큰 값 방지용)만 걸러내고 나머지는 naverPoint를 뺀 값을 그대로
// 쓰기로 했다.
//
// 이 변경으로 "icash"(아이캐시 등 제3자 선불수단) 전액 결제 주문(6월
// 데이터에서 발견한 13,700원·39,000원짜리 주문 등)은 다시 상품 할인으로
// 잡히게 된다 — icash 결제분을 구분할 구조화된 필드를 아직 못 찾아서다.
// naver_point처럼 별도 필드가 나오면 그때 제외하면 되고, 지금은 금액이
// 작아서 우선순위가 낮다.
function itemDiscountFor(
  a: Cafe24AmountBreakdown,
  naverPoint: number,
  net: number,
  paid: boolean,
): number {
  if (!paid) return 0
  const payment = Number(a.payment_amount) || 0
  const netExcludingNonCashPayments =
    net -
    (Number(a.points_spent_amount) || 0) -
    (Number(a.credits_spent_amount) || 0) -
    naverPoint
  return Math.max(0, netExcludingNonCashPayments - payment)
}

function toOrderRow(raw: Cafe24RawOrder): Cafe24OrderRow {
  const initialShipping = Number(raw.initial_order_amount.shipping_fee) || 0
  // actual_order_amount.shipping_fee는 배송비만 따로 취소돼도 initial 값
  // 그대로 안 줄어든다 — 5/6 매출 대조로 발견(20260506-0000019 주문: 배송비
  // 5,000원이 취소 처리(shipping_fee_detail[].cancel_shipping_fee=5,000)됐는데
  // actual_order_amount.shipping_fee는 계속 5,000). 그래서 shipping_fee_detail의
  // cancel_shipping_fee 합계를 직접 빼서 실제 남은 배송비를 구한다.
  const canceledShippingFee = (raw.shipping_fee_detail ?? []).reduce(
    (sum, detail) => sum + (Number(detail.cancel_shipping_fee) || 0),
    0,
  )
  const actualShipping = Math.max(
    0,
    (Number(raw.actual_order_amount.shipping_fee) || 0) - canceledShippingFee,
  )
  const initialNetRaw = netAmount(raw.initial_order_amount)
  const actualNetRaw = netAmount(raw.actual_order_amount, actualShipping)
  // naver_point는 initial/actual 구분 없이 주문에 하나뿐이라(위 Cafe24RawOrder
  // 주석 참고) 두 계산에 그대로 같이 쓴다.
  const naverPoint = Number(raw.naver_point) || 0
  const paid = raw.paid === 'T'
  const initialItemDiscount = itemDiscountFor(
    raw.initial_order_amount,
    naverPoint,
    initialNetRaw,
    paid,
  )
  const actualItemDiscount = itemDiscountFor(
    raw.actual_order_amount,
    naverPoint,
    actualNetRaw,
    paid,
  )
  const initialNet = initialNetRaw - initialItemDiscount
  const actualNet = actualNetRaw - actualItemDiscount
  const cancelDate = effectiveCancelDate(raw)
  return {
    orderId: raw.order_id,
    // order_date는 "2026-09-27T01:26:10+09:00" 형태 — 날짜만 잘라 쓴다.
    orderDate: raw.order_date.slice(0, 10),
    paymentDate: raw.payment_date ? raw.payment_date.slice(0, 10) : null,
    cancelDate: cancelDate ? cancelDate.slice(0, 10) : null,
    memberId: raw.member_id,
    paid,
    grossPayment: initialNet,
    shippingFee: initialShipping,
    pointsSpent: Number(raw.initial_order_amount.points_spent_amount) || 0,
    couponDiscount: couponDiscount(raw.initial_order_amount),
    itemDiscount: initialItemDiscount,
    // 반품배송비 추가결제 감지 — actual이 initial보다 커진 경우만(작아지는
    // 건 일반 취소/환불이라 여기선 무시, refunds 리소스가 이미 담당).
    additionalShippingFee: Math.max(0, actualShipping - initialShipping),
    // 이 주문 하나만으로 계산한 취소분 — /admin/refunds에 기록이 없는
    // 채널(예: NCHECKOUT=네이버페이, 8/6 조사에서 발견: 자체 PG가 아니라
    // 네이버페이 쪽에서 환불이 처리돼서 /admin/refunds에 아예 안 남음)의
    // 폴백 환불로만 쓴다 — index.ts의 buildFallbackRefundRows 참고.
    cancelRefundAmount: Math.max(0, initialNet - actualNet),
    // cancelRefundAmount 중 적립금 환불분만 따로 — initial과 actual의
    // points_spent_amount 차이(전액 취소되면 actual이 0으로 떨어짐). 폴백
    // 환불에서도 "순 적립금 사용액"(pointsSpent - 환불된 적립금)을 계산할 수
    // 있게 별도로 뗀다 — index.ts의 buildFallbackRefundRows 참고.
    cancelPointsRefund: Math.max(
      0,
      (Number(raw.initial_order_amount.points_spent_amount) || 0) -
        (Number(raw.actual_order_amount.points_spent_amount) || 0),
    ),
  }
}

/** offset을 직접 늘려가며(0, 100, 200, ...) 페이지가 PAGE_SIZE보다 작게 돌아올
 * 때까지 반복 호출해 item 배열을 전부 모은다 — 주문/환불 리소스 둘 다 이
 * 모양이라 공유한다. 예전엔 응답의 links.next(서버가 주는 다음 페이지 URL)를
 * 그대로 따라갔었는데, 5/1 주문 조사 중 주문 목록에 embed=items를 붙이면
 * 카페24가 응답에 links 필드 자체를 아예 안 내려준다는 걸 발견했다 — 그래서
 * 100건 넘는 구간을 embed=items로 조회하면(예: 5~6월 153건) links가 없어서
 * "다음 페이지 없음"으로 오판, 나머지 주문이 통째로 누락되는 심각한 버그로
 * 이어졌다(단순히 itemDiscount 하나가 아니라 주문 자체가 사라짐). links
 * 유무와 무관하게 항상 안전하도록 offset을 우리가 직접 계산하는 방식으로
 * 바꿨다 — limit(=PAGE_SIZE)만큼 요청해서 정확히 그 개수만큼 돌아오면 다음
 * 페이지가 있을 수 있다고 보고 offset을 더해 한 번 더 부르고, 그보다 적게
 * 돌아오면(마지막 페이지) 멈춘다. */
async function fetchAllPages<TRaw, TData>(
  firstUrl: string,
  headers: Record<string, string>,
  itemsOf: (data: TData) => TRaw[],
  errorLabel: string,
): Promise<TRaw[]> {
  const items: TRaw[] = []
  let offset = 0

  while (true) {
    const url = new URL(firstUrl)
    url.searchParams.set('offset', String(offset))
    const res: Response = await fetch(url, { headers })
    const data = (await res.json()) as TData & { error?: { message?: string } }
    if (!res.ok) {
      throw new Error(
        `${errorLabel}: ${data.error?.message || res.statusText} (url=${url})`,
      )
    }
    const page = itemsOf(data)
    items.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return items
}

/** 저장된 accessTokenExpiresAt이 실제 만료 시각과 어긋나 있으면(여러
 * 인스턴스가 동시에 토큰을 갱신하는 경쟁 등으로) Cafe24가 "access_token time
 * expired"를 돌려줄 수 있다 — 이 경우 저장된 값을 무시하고 강제로 새 토큰을
 * 받아 한 번만 다시 시도한다(getCafe24AccessToken의 forceRefresh 참고).
 * 주문/환불 조회 둘 다 이 패턴을 쓴다. */
async function withTokenRetry<T>(
  mallId: string,
  clientId: string,
  clientSecret: string,
  run: (accessToken: string) => Promise<T>,
): Promise<T> {
  const accessToken = await getCafe24AccessToken(mallId, clientId, clientSecret)
  try {
    return await run(accessToken)
  } catch (err) {
    if (!isCafe24InvalidTokenError(err)) throw err
    const freshToken = await getCafe24AccessToken(
      mallId,
      clientId,
      clientSecret,
      true,
    )
    return await run(freshToken)
  }
}

/** [startDate, endDate] 하나(3개월 이내로 가정)에 대해 주문을 전부 모은다.
 * dateType으로 order_date/cancel_date를 골라 쓴다 — cancel_date 조회는
 * fallback 환불 계산용(fetchCafe24OrderRowsByCancelDate 참고). embed=items로
 * 품목 목록도 같이 받는다 — 부분취소 주문의 취소일 보정(effectiveCancelDate
 * 참고)에 items[].cancel_date가 필요하다. 이 파라미터를 붙이면 카페24가
 * 응답의 links(다음 페이지 안내) 필드를 아예 안 내려주는 걸 발견했었는데
 * (6월 매출 대조), fetchAllPages를 offset 직접 계산 방식으로 바꿔서
 * (fetchAllPages 주석 참고) links 유무와 무관하게 안전하다. */
async function fetchOrdersForSingleRange(
  mallId: string,
  accessToken: string,
  startDate: ISODate,
  endDate: ISODate,
  dateType: 'order_date' | 'cancel_date',
): Promise<Cafe24RawOrder[]> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
  const params = new URLSearchParams({
    shop_no: '1',
    start_date: startDate,
    end_date: endDate,
    date_type: dateType,
    embed: 'items',
    limit: String(PAGE_SIZE),
  })
  return fetchAllPages<Cafe24RawOrder, Cafe24OrdersResponse>(
    `${apiBase(mallId)}/admin/orders?${params.toString()}`,
    headers,
    (data) => data.orders,
    'Cafe24 주문 조회 실패',
  )
}

/** dateStart~dateEnd(임의 길이) 전체의 주문을 order_date 또는 cancel_date
 * 기준으로 가져온다 — Cafe24 주문 API는 한 번 조회에 최대 3개월까지만
 * 허용해서, 그보다 긴 범위(과거 백필 등)는 chunkDateRangeForCafe24로 3개월
 * 이하 구간으로 잘라 순서대로(동시 아님 — 초당 40건 제한이라 한 구간
 * 페이지네이션이 이미 여러 호출이라 굳이 구간까지 동시에 쏠 필요는 없다)
 * 호출해 합친다. */
async function fetchOrderRowsByDateType(
  mallId: string,
  clientId: string,
  clientSecret: string,
  dateStart: ISODate,
  dateEnd: ISODate,
  dateType: 'order_date' | 'cancel_date',
): Promise<Cafe24OrderRow[]> {
  const chunks = chunkDateRangeForCafe24(dateStart, dateEnd)
  return withTokenRetry(mallId, clientId, clientSecret, async (accessToken) => {
    const rows: Cafe24OrderRow[] = []
    for (const chunk of chunks) {
      const raw = await fetchOrdersForSingleRange(
        mallId,
        accessToken,
        chunk.start,
        chunk.end,
        dateType,
      )
      rows.push(...raw.map(toOrderRow))
    }
    return rows
  })
}

/** dateStart~dateEnd(임의 길이) 전체의 주문을 order_date 기준으로 가져온다
 * — 청크/재시도 동작은 fetchOrderRowsByDateType 주석 참고. */
export async function fetchCafe24OrderRows(
  mallId: string,
  clientId: string,
  clientSecret: string,
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<Cafe24OrderRow[]> {
  return fetchOrderRowsByDateType(
    mallId,
    clientId,
    clientSecret,
    dateStart,
    dateEnd,
    'order_date',
  )
}

/** dateStart~dateEnd 구간에 취소 접수 처리된(cancel_date 기준) 주문을 가져온다
 * — order_date가 이 구간 밖이어도(몇 달 전 주문이 지금 취소되는 경우) 잡아야
 * 해서 fetchCafe24OrderRows와 별개로 필요하다. index.ts의
 * buildFallbackRefundRows가 이 결과로 /admin/refunds에 기록이 없는 채널
 * (NCHECKOUT 등)의 환불을 폴백으로 채운다. */
export async function fetchCafe24OrderRowsByCancelDate(
  mallId: string,
  clientId: string,
  clientSecret: string,
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<Cafe24OrderRow[]> {
  return fetchOrderRowsByDateType(
    mallId,
    clientId,
    clientSecret,
    dateStart,
    dateEnd,
    'cancel_date',
  )
}

interface Cafe24RawRefund {
  refund_code: string
  order_id: string
  // 실제 환불이 완료 처리된 날짜 — 반품 접수일(accepted_refund_date)과
  // 다를 수 있다(디버그 엔드포인트로 직접 확인: 접수 8/21, 실제 카드
  // 부분취소 완료 8/31). start_date/end_date 쿼리도 이 필드 기준으로
  // 걸러지는 걸 확인했다(types.ts의 Cafe24RefundRow 주석 참고).
  refund_date: string
  // 순수 현금 환불액 — 적립금/예치금으로 결제됐던 분은 여기 안 잡히고
  // used_points/used_credits로 따로 나온다(전액 적립금 결제 주문을 취소하면
  // actual_refund_amount=0, used_points>0으로 나오는 걸 6월 매출 대조로
  // 확인했다).
  actual_refund_amount: string
  used_points: string
  used_credits: string
}

interface Cafe24RefundsResponse {
  refunds: Cafe24RawRefund[]
}

// 카페24 관리자 "일별 매출내역"의 환불합계가 적립금/예치금 환불분까지
// 포함하는 걸 확인해서(결제합계가 적립금 결제분을 포함하는 것과 대칭)
// actual_refund_amount만으로는 부족하다 — used_points/used_credits를 더해야
// 카페24 화면과 원 단위까지 맞는다. used_points는 pointsRefunded로 따로도
// 남겨서 "순 적립금 사용액"(pointsSpent - pointsRefunded)을 계산할 수 있게
// 한다 — used_credits는 예치금이라 적립금과 다른 개념이라 안 섞는다.
function toRefundRow(raw: Cafe24RawRefund): Cafe24RefundRow {
  const pointsRefunded = Number(raw.used_points) || 0
  return {
    refundCode: raw.refund_code,
    orderId: raw.order_id,
    refundDate: raw.refund_date.slice(0, 10),
    amount:
      (Number(raw.actual_refund_amount) || 0) +
      pointsRefunded +
      (Number(raw.used_credits) || 0),
    pointsRefunded,
    // 카페24 /admin/refunds가 실제로 내려준 환불 이벤트 — 폴백(합성)이 아니다.
    isFallback: false,
  }
}

/** [startDate, endDate] 하나에 대해 환불 목록을 전부 모은다. limit을 명시하지
 * 않으면 기본값이 100보다 작아(직접 확인: 10건에서 끊김) 결과가 조용히
 * 잘리므로 반드시 명시한다. */
async function fetchRefundsForSingleRange(
  mallId: string,
  accessToken: string,
  startDate: ISODate,
  endDate: ISODate,
): Promise<Cafe24RawRefund[]> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
  const params = new URLSearchParams({
    shop_no: '1',
    start_date: startDate,
    end_date: endDate,
    limit: String(PAGE_SIZE),
  })
  return fetchAllPages<Cafe24RawRefund, Cafe24RefundsResponse>(
    `${apiBase(mallId)}/admin/refunds?${params.toString()}`,
    headers,
    (data) => data.refunds,
    'Cafe24 환불 조회 실패',
  )
}

/** dateStart~dateEnd 전체의 환불을 가져온다 — fetchOrderRowsByDateType과 같은
 * 구조(3개월 이하로 청크, 토큰 만료 시 강제 갱신 후 1회 재시도)를 공유한다. */
export async function fetchCafe24RefundRows(
  mallId: string,
  clientId: string,
  clientSecret: string,
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<Cafe24RefundRow[]> {
  const chunks = chunkDateRangeForCafe24(dateStart, dateEnd)
  return withTokenRetry(mallId, clientId, clientSecret, async (accessToken) => {
    const rows: Cafe24RefundRow[] = []
    for (const chunk of chunks) {
      const raw = await fetchRefundsForSingleRange(
        mallId,
        accessToken,
        chunk.start,
        chunk.end,
      )
      rows.push(...raw.map(toRefundRow))
    }
    return rows
  })
}
