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
  points_spent_amount: string
  // 쿠폰/멤버십 등 주문 단위 할인 — 전부 "실제로 돈을 받지 못한 부분"이라
  // points_spent_amount와 같은 이유로 순액 계산에서 빼야 한다(netAmount 주석
  // 참고). 처음엔 이 매장이 쿠폰을 안 쓰는 줄 알고 뺐었는데, 실제로 쓰고
  // 있어서(7/7 환불 건에서 발견 — coupon_discount_price 100,000원을 안 빼서
  // 그만큼 환불액이 과다 집계됐었다) 다시 넣었다.
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
  // 취소/반품 접수 처리일 — 없으면 null. additionalShippingFee 귀속에만
  // 쓴다(types.ts의 Cafe24OrderRow 주석 참고, 환불 자체는 더 이상 이 필드를
  // 안 쓴다).
  cancel_date: string | null
  member_id: string | null
  paid: 'T' | 'F'
  /** 최초 주문 시점 금액 breakdown — 취소 여부와 무관하게 주문 당시 그대로.
   * "결제"(grossPayment)는 이 값 기준, paymentDate에 귀속한다. */
  initial_order_amount: Cafe24AmountBreakdown
  /** 반품 처리 후 현재 금액 — additionalShippingFee(반품배송비 추가결제)
   * 감지에만 쓴다: 이 shipping_fee가 initial보다 커진 만큼이 추가결제분. */
  actual_order_amount: Cafe24AmountBreakdown
}

interface Cafe24OrdersResponse {
  orders: Cafe24RawOrder[]
  links?: { rel: string; href: string }[]
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

// "결제"(grossPayment)는 order_price_amount+shipping_fee에서 적립금·쿠폰 등
// 주문 단위 할인을 뺀 순액 기준으로 계산한다(payment_amount는 결제수단에
// 따라 값이 들쭉날쭉해서 안 쓴다 — 예: 네이버페이 포인트 전액 결제 건은
// payment_amount가 0으로 나오는데 order_price_amount는 정상적으로 상품가가
// 찍힘). initial_order_amount로 계산한 값을 paymentDate에 귀속시킨다 —
// types.ts의 Cafe24OrderRow 주석 참고. 환불은 여기서 안 다루고 아래
// toRefundRow가 별도 "환불" 리소스에서 처리한다.
function netAmount(a: Cafe24AmountBreakdown): number {
  let total =
    (Number(a.order_price_amount) || 0) +
    (Number(a.shipping_fee) || 0) -
    (Number(a.points_spent_amount) || 0)
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

function toOrderRow(raw: Cafe24RawOrder): Cafe24OrderRow {
  const initialShipping = Number(raw.initial_order_amount.shipping_fee) || 0
  const actualShipping = Number(raw.actual_order_amount.shipping_fee) || 0
  const initialNet = netAmount(raw.initial_order_amount)
  const actualNet = netAmount(raw.actual_order_amount)
  return {
    orderId: raw.order_id,
    // order_date는 "2026-09-27T01:26:10+09:00" 형태 — 날짜만 잘라 쓴다.
    orderDate: raw.order_date.slice(0, 10),
    paymentDate: raw.payment_date ? raw.payment_date.slice(0, 10) : null,
    cancelDate: raw.cancel_date ? raw.cancel_date.slice(0, 10) : null,
    memberId: raw.member_id,
    paid: raw.paid === 'T',
    grossPayment: initialNet,
    shippingFee: initialShipping,
    pointsSpent: Number(raw.initial_order_amount.points_spent_amount) || 0,
    couponDiscount: couponDiscount(raw.initial_order_amount),
    // 반품배송비 추가결제 감지 — actual이 initial보다 커진 경우만(작아지는
    // 건 일반 취소/환불이라 여기선 무시, refunds 리소스가 이미 담당).
    additionalShippingFee: Math.max(0, actualShipping - initialShipping),
    // 이 주문 하나만으로 계산한 취소분 — /admin/refunds에 기록이 없는
    // 채널(예: NCHECKOUT=네이버페이, 8/6 조사에서 발견: 자체 PG가 아니라
    // 네이버페이 쪽에서 환불이 처리돼서 /admin/refunds에 아예 안 남음)의
    // 폴백 환불로만 쓴다 — index.ts의 buildFallbackRefundRows 참고.
    cancelRefundAmount: Math.max(0, initialNet - actualNet),
  }
}

/** [startDate, endDate] 하나(3개월 이내로 가정)에 대해 limit/offset 페이지네이션을
 * 끝까지 따라가며 주문을 전부 모은다 — 응답의 links에 있는 "next" href를
 * 그대로 다시 호출한다(오프셋을 직접 계산할 필요 없음). dateType으로
 * order_date/cancel_date를 골라 쓴다 — cancel_date 조회는 fallback 환불
 * 계산용(fetchCafe24OrderRowsByCancelDate 참고). */
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

  const firstParams = new URLSearchParams({
    shop_no: '1',
    start_date: startDate,
    end_date: endDate,
    date_type: dateType,
    limit: String(PAGE_SIZE),
  })

  const orders: Cafe24RawOrder[] = []
  let url: string | null = `${apiBase(mallId)}/admin/orders?${firstParams.toString()}`

  while (url) {
    const res: Response = await fetch(url, { headers })
    const data = (await res.json()) as Cafe24OrdersResponse & {
      error?: { message?: string }
    }
    if (!res.ok) {
      throw new Error(
        `Cafe24 주문 조회 실패: ${data.error?.message || res.statusText} (url=${url})`,
      )
    }
    orders.push(...data.orders)
    url = data.links?.find((l) => l.rel === 'next')?.href ?? null
  }

  return orders
}

async function fetchAllChunks(
  mallId: string,
  accessToken: string,
  chunks: readonly { start: ISODate; end: ISODate }[],
  dateType: 'order_date' | 'cancel_date',
): Promise<Cafe24OrderRow[]> {
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
}

async function fetchOrderRowsByDateType(
  mallId: string,
  clientId: string,
  clientSecret: string,
  dateStart: ISODate,
  dateEnd: ISODate,
  dateType: 'order_date' | 'cancel_date',
): Promise<Cafe24OrderRow[]> {
  const chunks = chunkDateRangeForCafe24(dateStart, dateEnd)
  const accessToken = await getCafe24AccessToken(mallId, clientId, clientSecret)

  try {
    return await fetchAllChunks(mallId, accessToken, chunks, dateType)
  } catch (err) {
    if (!isCafe24InvalidTokenError(err)) throw err
    const freshToken = await getCafe24AccessToken(
      mallId,
      clientId,
      clientSecret,
      true,
    )
    return await fetchAllChunks(mallId, freshToken, chunks, dateType)
  }
}

/** dateStart~dateEnd(임의 길이) 전체의 주문을 가져온다(order_date 기준) —
 * Cafe24 주문 API는 한 번 조회에 최대 3개월까지만 허용해서, 그보다 긴
 * 범위(과거 백필 등)는 chunkDateRangeForCafe24로 3개월 이하 구간으로 잘라
 * 순서대로(동시 아님 — 초당 40건 제한이라 한 구간 페이지네이션이 이미 여러
 * 호출이라 굳이 구간까지 동시에 쏠 필요는 없다) 호출해 합친다.
 *
 * 저장된 accessTokenExpiresAt이 실제 만료 시각과 어긋나 있으면(여러 인스턴스가
 * 동시에 토큰을 갱신하는 경쟁 등으로) Cafe24가 "access_token time expired"를
 * 돌려줄 수 있다 — 이 경우 저장된 값을 무시하고 강제로 새 토큰을 받아 전체
 * 구간을 한 번만 다시 시도한다(getCafe24AccessToken의 forceRefresh 참고). */
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
  // 적립금/예치금 환불분은 이미 빠진 순수 현금 환불액.
  actual_refund_amount: string
}

interface Cafe24RefundsResponse {
  refunds: Cafe24RawRefund[]
  links?: { rel: string; href: string }[]
}

function toRefundRow(raw: Cafe24RawRefund): Cafe24RefundRow {
  return {
    refundCode: raw.refund_code,
    orderId: raw.order_id,
    refundDate: raw.refund_date.slice(0, 10),
    amount: Number(raw.actual_refund_amount) || 0,
  }
}

/** [startDate, endDate] 하나에 대해 환불 목록을 페이지네이션 끝까지 따라가며
 * 전부 모은다 — fetchOrdersForSingleRange와 같은 방식(links.next). limit을
 * 명시하지 않으면 기본값이 100보다 작아(직접 확인: 10건에서 끊김) 결과가
 * 조용히 잘리므로 반드시 명시한다. */
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

  const firstParams = new URLSearchParams({
    shop_no: '1',
    start_date: startDate,
    end_date: endDate,
    limit: String(PAGE_SIZE),
  })

  const refunds: Cafe24RawRefund[] = []
  let url: string | null = `${apiBase(mallId)}/admin/refunds?${firstParams.toString()}`

  while (url) {
    const res: Response = await fetch(url, { headers })
    const data = (await res.json()) as Cafe24RefundsResponse & {
      error?: { message?: string }
    }
    if (!res.ok) {
      throw new Error(
        `Cafe24 환불 조회 실패: ${data.error?.message || res.statusText} (url=${url})`,
      )
    }
    refunds.push(...data.refunds)
    url = data.links?.find((l) => l.rel === 'next')?.href ?? null
  }

  return refunds
}

async function fetchAllRefundChunks(
  mallId: string,
  accessToken: string,
  chunks: readonly { start: ISODate; end: ISODate }[],
): Promise<Cafe24RefundRow[]> {
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
}

/** dateStart~dateEnd 전체의 환불을 가져온다 — fetchCafe24OrderRows와 같은
 * 구조(3개월 이하로 청크, 토큰 만료 시 강제 갱신 후 1회 재시도)를 그대로
 * 재사용한다. */
export async function fetchCafe24RefundRows(
  mallId: string,
  clientId: string,
  clientSecret: string,
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<Cafe24RefundRow[]> {
  const chunks = chunkDateRangeForCafe24(dateStart, dateEnd)
  const accessToken = await getCafe24AccessToken(mallId, clientId, clientSecret)

  try {
    return await fetchAllRefundChunks(mallId, accessToken, chunks)
  } catch (err) {
    if (!isCafe24InvalidTokenError(err)) throw err
    const freshToken = await getCafe24AccessToken(
      mallId,
      clientId,
      clientSecret,
      true,
    )
    return await fetchAllRefundChunks(mallId, freshToken, chunks)
  }
}
