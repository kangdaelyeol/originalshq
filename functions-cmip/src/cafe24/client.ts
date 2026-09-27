// Cafe24 주문 목록 API 호출 — 인증(auth.ts)이 끝난 access_token으로 실제
// 매출(주문) 원본 데이터를 가져온다.
import { apiBase, getCafe24AccessToken } from './auth'
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
  canceled: 'T' | 'F'
  /** 부분취소/환불까지 반영된 실제 결제 금액 — initial_order_amount(최초
   * 주문 시점)와 달리 이 값을 매출로 쓴다. */
  actual_order_amount: Cafe24AmountBreakdown
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
    paymentAmount: Number(raw.actual_order_amount.payment_amount) || 0,
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

/** dateStart~dateEnd(임의 길이) 전체의 주문을 가져온다 — Cafe24 주문 API는
 * 한 번 조회에 최대 3개월까지만 허용해서, 그보다 긴 범위(과거 백필 등)는
 * chunkDateRangeForCafe24로 3개월 이하 구간으로 잘라 순서대로(동시 아님 —
 * 초당 40건 제한이라 한 구간 페이지네이션이 이미 여러 호출이라 굳이 구간까지
 * 동시에 쏠 필요는 없다) 호출해 합친다. */
export async function fetchCafe24OrderRows(
  mallId: string,
  clientId: string,
  clientSecret: string,
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<Cafe24OrderRow[]> {
  const accessToken = await getCafe24AccessToken(mallId, clientId, clientSecret)
  const chunks = chunkDateRangeForCafe24(dateStart, dateEnd)

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
