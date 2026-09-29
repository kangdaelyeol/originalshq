// Cafe24 — 온라인 스토어 매출(주문) 데이터 연동.
//
// monday-crm/와 같은 이유로 channel/ 아래가 아니라 src/ 바로 밑 형제
// 디렉터리다: channel/*은 광고비/노출·클릭 같은 매체 인사이트를 다루는 반면,
// 이건 Cafe24 쇼핑몰의 주문(매출) 데이터를 다룬다.
//
// 계층 구조(monday-crm과 동일): auth.ts(OAuth 토큰)·client.ts(주문/환불 API
// 호출)·firestore.ts(저장/조회)·helper.ts(집계)를 이 파일이 조합한다.
// OAuth 관련 함수는 그대로 재노출해서, index.ts(functions-cmip)의 기존
// import 구문이 안 바뀌어도 되게 한다.
export {
  buildCafe24AuthUrl,
  checkCafe24AuthStatus,
  debugFetchCafe24OrdersRaw,
  debugFetchCafe24RefundsRaw,
  exchangeAndSaveCafe24Tokens,
  getCafe24AccessToken,
} from './auth'

import {
  fetchCafe24OrderRows,
  fetchCafe24OrderRowsByCancelDate,
  fetchCafe24RefundRows,
} from './client'
import {
  fetchCafe24OrderRowsFromDb,
  fetchCafe24RefundRowsFromDb,
  upsertCafe24Orders,
  upsertCafe24Refunds,
} from './firestore'
import {
  summarizeByDate,
  summarizeByDayOfWeek,
  summarizeByMonth,
  summarizeByWeek,
  summarizeTotal,
} from './helper'
import type { Cafe24OrderRow, Cafe24RefundRow, Cafe24RevenueSummary } from './types'
import type { ISODate } from '../types'

/** /admin/refunds에 기록이 없는 채널의 환불을 채운다 — 8/6 조사에서 발견:
 * market_id가 NCHECKOUT(네이버페이)인 주문은 카페24 자체 PG가 아니라
 * 네이버페이 쪽에서 환불이 처리돼서 /admin/refunds에 아예 안 남는다(6~9월
 * 데이터로 검증: NCHECKOUT 취소 7건 전부 누락, 합계 26,163,000원 — 무시하기엔
 * 너무 크다). realRefundOrderIds에 없는 주문(=실제 환불 목록에 안 잡힌 주문)
 * 중 cancelRefundAmount가 있는 것만 Cafe24RefundRow로 합성한다 — refundCode를
 * `ORDER-{orderId}`로 고정해서 재동기화할 때마다 같은 문서를 덮어쓰게 한다
 * (실제 refund_code와 겹칠 일 없음, 전부 "C..." 형태). */
function buildFallbackRefundRows(
  orderRows: readonly Cafe24OrderRow[],
  realRefundOrderIds: ReadonlySet<string>,
): Cafe24RefundRow[] {
  const fallback: Cafe24RefundRow[] = []
  for (const row of orderRows) {
    if (row.cancelRefundAmount <= 0) continue
    if (row.cancelDate == null) continue
    if (realRefundOrderIds.has(row.orderId)) continue
    fallback.push({
      refundCode: `ORDER-${row.orderId}`,
      orderId: row.orderId,
      refundDate: row.cancelDate,
      amount: row.cancelRefundAmount,
    })
  }
  return fallback
}

/** dateStart~dateEnd 구간의 Cafe24 주문과 환불을 둘 다 가져와 Firestore
 * (cafe24Orders/cafe24Refunds)에 upsert한다 — Monday CRM처럼 전체 삭제 후
 * 재삽입이 아니라 덮어쓰기만 한다(firestore.ts 주석 참고). 과거 백필(넓은
 * 범위)과 최근 N일 롤링 재동기화(좁은 범위) 둘 다 이 함수 하나로 처리한다 —
 * 범위 크기만 다르다. 환불은 주문과 별도 리소스라(types.ts의 Cafe24OrderRow
 * 주석 참고) 항상 같이 동기화해야 getCafe24Revenue가 최신 상태를 본다.
 *
 * 주문은 order_date와 cancel_date 두 기준으로 각각 조회한다 — order_date만
 * 보면 몇 달 전 주문이 이번 구간에 취소된 경우(NCHECKOUT 폴백 환불 대상)를
 * 놓친다. 모든 조회는 순서대로(Promise.all 아님) 호출한다 — 전부 페이지네이션
 * 여러 번을 포함하는 호출인데, 동시에 쏘면 카페24의 초당 호출 제한(40건/초,
 * client.ts 주석 참고)을 나눠 쓰다가 한쪽이 잘려서 조용히 일부만 가져와지는 걸
 * 실제로 겪었다(주문 375건이 197건으로 잘림, 에러 없이). */
export async function syncCafe24Orders(
  mallId: string,
  clientId: string,
  clientSecret: string,
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<{ upsertedOrders: number; upsertedRefunds: number }> {
  const orderRowsByOrderDate = await fetchCafe24OrderRows(
    mallId,
    clientId,
    clientSecret,
    dateStart,
    dateEnd,
  )
  const orderRowsByCancelDate = await fetchCafe24OrderRowsByCancelDate(
    mallId,
    clientId,
    clientSecret,
    dateStart,
    dateEnd,
  )
  const refundRows = await fetchCafe24RefundRows(
    mallId,
    clientId,
    clientSecret,
    dateStart,
    dateEnd,
  )

  const orderRowsById = new Map<string, Cafe24OrderRow>()
  for (const row of orderRowsByOrderDate) orderRowsById.set(row.orderId, row)
  for (const row of orderRowsByCancelDate) orderRowsById.set(row.orderId, row)
  const orderRows = Array.from(orderRowsById.values())

  const realRefundOrderIds = new Set(refundRows.map((r) => r.orderId))
  const fallbackRefundRows = buildFallbackRefundRows(
    orderRows,
    realRefundOrderIds,
  )

  const orders = await upsertCafe24Orders(orderRows)
  const refunds = await upsertCafe24Refunds([
    ...refundRows,
    ...fallbackRefundRows,
  ])
  return { upsertedOrders: orders.upserted, upsertedRefunds: refunds.upserted }
}

/** Meta의 getMetaInsight, Monday CRM의 getOfflineRevenue와 같은 자리 —
 * dateStart~dateEnd 구간의 Cafe24 매출을 {total, byDate, byDayOfWeek,
 * byGroupedWeek, byMonth} 모양으로 반환한다. Cafe24를 실시간으로 부르지
 * 않고 syncCafe24Orders로 미리 동기화해둔 Firestore에서 읽는다. */
export async function getCafe24Revenue(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<Cafe24RevenueSummary> {
  const [orderRows, refundRows] = await Promise.all([
    fetchCafe24OrderRowsFromDb(dateStart, dateEnd),
    fetchCafe24RefundRowsFromDb(dateStart, dateEnd),
  ])

  return {
    total: summarizeTotal(orderRows, refundRows, dateStart, dateEnd),
    byDate: summarizeByDate(orderRows, refundRows, dateStart, dateEnd),
    byDayOfWeek: summarizeByDayOfWeek(orderRows, refundRows, dateStart, dateEnd),
    byGroupedWeek: summarizeByWeek(orderRows, refundRows, dateStart, dateEnd),
    byMonth: summarizeByMonth(orderRows, refundRows, dateStart, dateEnd),
  }
}
