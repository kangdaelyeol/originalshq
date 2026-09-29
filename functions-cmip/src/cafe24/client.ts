// Cafe24 주문 목록 API 호출 — 인증(auth.ts)이 끝난 access_token으로 실제
// 매출(주문) 원본 데이터를 가져온다.
import {
  apiBase,
  getCafe24AccessToken,
  isCafe24InvalidTokenError,
} from './auth'
import { chunkDateRangeForCafe24 } from './utils'
import type { Cafe24OrderRow } from './types'
import type { ISODate } from '../types'

// 페이지당 최대 건수(Cafe24 문서 기준 100건) — 크게 잡을수록 페이지 수가
// 줄어 호출 횟수가 적어진다.
const PAGE_SIZE = 100

interface Cafe24AmountBreakdown {
  order_price_amount: string
  payment_amount: string
  [key: string]: unknown
}

interface Cafe24RawOrder {
  order_id: string
  order_date: string
  member_id: string | null
  paid: 'T' | 'F'
  // 'M'은 부분취소(주문 일부 품목만 취소) — actual_order_amount.payment_amount가
  // 이미 그 부분취소를 반영한 순액이라, 'T'(전체취소)만 아니면 매출로 센다.
  canceled: 'T' | 'F' | 'M'
  /** 부분취소/환불까지 반영된 실제 결제 금액 — initial_order_amount(최초
   * 주문 시점)와 달리 이 값을 매출로 쓴다. */
  actual_order_amount: Cafe24AmountBreakdown
  /** 네이버페이 포인트(선불금)로 결제한 금액 — actual_order_amount.payment_amount에
   * 전혀 반영되지 않는 별도 필드다(포인트로 전액 결제하면 payment_amount가
   * 0으로 나온다). 실제 결제된 매출이라(내부 적립금 사용과 달리 할인이
   * 아님) payment_amount에 더해서 매출로 센다. */
  naver_point: string | null
}

interface Cafe24OrdersResponse {
  orders: Cafe24RawOrder[]
  links?: { rel: string; href: string }[]
}

function toOrderRow(raw: Cafe24RawOrder): Cafe24OrderRow {
  return {
    orderId: raw.order_id,
    // order_date는 "2026-09-27T01:26:10+09:00" 형태 — 날짜만 잘라 쓴다.
    orderDate: raw.order_date.slice(0, 10),
    memberId: raw.member_id,
    paid: raw.paid === 'T',
    canceled: raw.canceled === 'T',
    // naver_point(네이버페이 포인트 결제액)는 payment_amount에 전혀 안 잡혀서
    // 따로 더한다 — 전액 포인트 결제 건은 payment_amount가 0으로 나와도
    // 이걸 더하면 실제 결제금액이 복원된다.
    paymentAmount:
      (Number(raw.actual_order_amount.payment_amount) || 0) +
      (Number(raw.naver_point) || 0),
  }
}

/** [startDate, endDate] 하나(3개월 이내로 가정)에 대해 limit/offset 페이지네이션을
 * 끝까지 따라가며 주문을 전부 모은다 — 응답의 links에 있는 "next" href를
 * 그대로 다시 호출한다(오프셋을 직접 계산할 필요 없음). */
async function fetchOrdersForSingleRange(
  mallId: string,
  accessToken: string,
  startDate: ISODate,
  endDate: ISODate,
): Promise<Cafe24RawOrder[]> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  const firstParams = new URLSearchParams({
    shop_no: '1',
    start_date: startDate,
    end_date: endDate,
    date_type: 'order_date',
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
        `Cafe24 주문 조회 실패: ${data.error?.message || res.statusText}`,
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
): Promise<Cafe24OrderRow[]> {
  const rows: Cafe24OrderRow[] = []
  for (const chunk of chunks) {
    const raw = await fetchOrdersForSingleRange(
      mallId,
      accessToken,
      chunk.start,
      chunk.end,
    )
    rows.push(...raw.map(toOrderRow))
  }
  return rows
}

/** dateStart~dateEnd(임의 길이) 전체의 주문을 가져온다 — Cafe24 주문 API는
 * 한 번 조회에 최대 3개월까지만 허용해서, 그보다 긴 범위(과거 백필 등)는
 * chunkDateRangeForCafe24로 3개월 이하 구간으로 잘라 순서대로(동시 아님 —
 * 초당 40건 제한이라 한 구간 페이지네이션이 이미 여러 호출이라 굳이 구간까지
 * 동시에 쏠 필요는 없다) 호출해 합친다.
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
  const chunks = chunkDateRangeForCafe24(dateStart, dateEnd)
  const accessToken = await getCafe24AccessToken(mallId, clientId, clientSecret)

  try {
    return await fetchAllChunks(mallId, accessToken, chunks)
  } catch (err) {
    if (!isCafe24InvalidTokenError(err)) throw err
    const freshToken = await getCafe24AccessToken(
      mallId,
      clientId,
      clientSecret,
      true,
    )
    return await fetchAllChunks(mallId, freshToken, chunks)
  }
}
