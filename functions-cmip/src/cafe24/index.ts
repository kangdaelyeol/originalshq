// Cafe24 — 온라인 스토어 매출(주문) 데이터 연동.
//
// monday-crm/와 같은 이유로 channel/ 아래가 아니라 src/ 바로 밑 형제
// 디렉터리다: channel/*은 광고비/노출·클릭 같은 매체 인사이트를 다루는 반면,
// 이건 Cafe24 쇼핑몰의 주문(매출) 데이터를 다룬다.
//
// 계층 구조(monday-crm과 동일): auth.ts(OAuth 토큰)·client.ts(주문 API
// 호출)·firestore.ts(저장/조회)·helper.ts(집계)를 이 파일이 조합한다.
// OAuth 관련 함수는 그대로 재노출해서, index.ts(functions-cmip)의 기존
// import 구문이 안 바뀌어도 되게 한다.
export {
  buildCafe24AuthUrl,
  checkCafe24AuthStatus,
  debugFetchCafe24OrdersRaw,
  exchangeAndSaveCafe24Tokens,
  getCafe24AccessToken,
} from './auth'

import { fetchCafe24OrderRows } from './client'
import { fetchCafe24OrderRowsFromDb, upsertCafe24Orders } from './firestore'
import {
  summarizeByDate,
  summarizeByDayOfWeek,
  summarizeByMonth,
  summarizeByWeek,
  summarizeTotal,
} from './helper'
import type { Cafe24RevenueSummary } from './types'
import type { ISODate } from '../types'

/** dateStart~dateEnd 구간의 Cafe24 주문을 가져와 Firestore(cafe24Orders)에
 * upsert한다 — Monday CRM처럼 전체 삭제 후 재삽입이 아니라 덮어쓰기만
 * 한다(firestore.ts 주석 참고). 과거 백필(넓은 범위)과 최근 N일 롤링
 * 재동기화(좁은 범위) 둘 다 이 함수 하나로 처리한다 — 범위 크기만 다르다.
 */
export async function syncCafe24Orders(
  mallId: string,
  clientId: string,
  clientSecret: string,
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<{ upserted: number }> {
  const rows = await fetchCafe24OrderRows(
    mallId,
    clientId,
    clientSecret,
    dateStart,
    dateEnd,
  )
  return upsertCafe24Orders(rows)
}

/** Meta의 getMetaInsight, Monday CRM의 getOfflineRevenue와 같은 자리 —
 * dateStart~dateEnd 구간의 Cafe24 매출을 {total, byDate, byDayOfWeek,
 * byGroupedWeek, byMonth} 모양으로 반환한다. Cafe24를 실시간으로 부르지
 * 않고 syncCafe24Orders로 미리 동기화해둔 Firestore에서 읽는다. */
export async function getCafe24Revenue(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<Cafe24RevenueSummary> {
  const rows = await fetchCafe24OrderRowsFromDb(dateStart, dateEnd)

  return {
    total: summarizeTotal(rows),
    byDate: summarizeByDate(rows),
    byDayOfWeek: summarizeByDayOfWeek(rows),
    byGroupedWeek: summarizeByWeek(rows, dateStart, dateEnd),
    byMonth: summarizeByMonth(rows),
  }
}
