// Monday CRM — 오프라인 매출 동기화/집계.
//
// channel/(Meta·Google·Naver)과 나란한 자리지만 성격이 달라 그 아래가 아니라
// src/ 바로 밑 형제 디렉터리다: channel/*은 광고비/노출·클릭 같은 "매체
// 인사이트"를 그때그때 실시간으로 불러오는 반면, 이건 Monday CRM 보드에
// 쌓인 오프라인 매출 원장을 Firestore로 동기화해두고 그걸 읽어 집계한다.
import { fetchOfflineSalesFromMonday } from './client'
export { debugFetchOfflineSalesRaw } from './client'
import { fetchOfflineSaleRows, resyncOfflineSales } from './firestore'
import {
  summarizeByDate,
  summarizeByDayOfWeek,
  summarizeByMonth,
  summarizeByWeek,
  summarizeTotal,
} from './helper'
import type { OfflineRevenueSummary } from './types'

/** Monday 오프라인 매출 보드를 지금 상태로 통째로 받아와 Firestore를 그
 * 값으로 재동기화한다 — 자동 주기는 아직 없고, 엔드포인트(syncOfflineSales)
 * 수동 호출로만 실행된다. */
export const syncOfflineSalesFromMonday = async (
  apiKey: string,
): Promise<{ inserted: number; deleted: number }> => {
  const rows = await fetchOfflineSalesFromMonday(apiKey)
  return resyncOfflineSales(rows)
}

/** Meta의 getMetaInsight, Naver의 getNaverInsight와 같은 자리 — dateStart~
 * dateEnd 구간의 오프라인 매출을 {total, byDate, byDayOfWeek, byGroupedWeek,
 * byMonth} 모양으로 반환한다. Monday를 실시간으로 부르지 않고
 * syncOfflineSalesFromMonday로 미리 동기화해둔 Firestore에서 읽는다. */
export const getOfflineRevenue = async (
  dateStart: string,
  dateEnd: string,
): Promise<OfflineRevenueSummary> => {
  const rows = await fetchOfflineSaleRows(dateStart, dateEnd)

  return {
    total: summarizeTotal(rows),
    byDate: summarizeByDate(rows),
    byDayOfWeek: summarizeByDayOfWeek(rows),
    byGroupedWeek: summarizeByWeek(rows, dateStart, dateEnd),
    byMonth: summarizeByMonth(rows),
  }
}
