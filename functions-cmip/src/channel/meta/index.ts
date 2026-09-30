import { addDays, todayISO } from '../utils'
import { fetchAllMetaInsightRows } from './client'
import { fetchMetaInsightRowsFromDb, upsertMetaInsightRows } from './firestore'
import {
  summarizeByCampaign,
  summarizeByDate,
  summarizeByDayOfWeek,
  summarizeByWeek,
  summarizeTotal,
} from './helper'
import { DataSetInsight, MetaInsight } from './types'

export const xTool_MAIN_ADS_ID = '763627086023164'
export const xTool_SUB_ADS_ID = '1093841806220768'
export const META_AD_ACCOUNT_IDS = [xTool_MAIN_ADS_ID, xTool_SUB_ADS_ID] as const

/** 최근 N일은 계속 소급 수정될 수 있어서(어트리뷰션 지연) 라이브 API로,
 * 그 이전은 Firestore 배치 동기화 값을 읽는다 — getMetaInsightWithHistory
 * 주석 참고. syncMetaInsightsScheduled(functions-cmip/src/index.ts)의 롤링
 * 동기화 기간과는 별개 값이다(그쪽은 이 경계보다 넉넉하게 잡아서, 데이터가
 * 이 경계를 넘어 "과거"로 취급될 때는 이미 충분히 안정된 값으로 동기화돼
 * 있게 한다). */
const LIVE_WINDOW_DAYS = 7

/** 두 광고계정에서 fetchAllMetaInsightRows(페이지네이션 포함)로 병렬 fetch만
 * 한다(요약 안 함) — 라이브 조회(getMetaInsight)와 Firestore 동기화
 * (syncMetaInsightRows) 둘 다 이 함수를 공유한다. 계정별로 묶어서 돌려주는
 * 이유는 동기화 쪽이 각 행에 adAccountId를 붙여서 저장해야 해서다(요약만
 * 하면 되는 쪽은 그냥 flatMap으로 풀어서 쓴다). */
async function fetchLiveMetaInsightRowsByAccount(
  dateStart: string,
  dateEnd: string,
  accessToken: string,
): Promise<{ adAccountId: string; rows: DataSetInsight[] }[]> {
  return Promise.all(
    META_AD_ACCOUNT_IDS.map(async (adAccountId) => ({
      adAccountId,
      rows: await fetchAllMetaInsightRows(
        dateStart,
        dateEnd,
        adAccountId,
        accessToken,
      ),
    })),
  )
}

/** DataSetInsight[] 하나만 있으면 되는 순수 함수라, 이 행들이 라이브
 * API에서 왔는지 Firestore 배치 동기화에서 왔는지 전혀 안 가린다 — sync/
 * index.ts의 getAllInsights가 "최근 7일은 라이브로 fetch + 8일 이상 전은
 * Firestore에서 읽어서 이어붙인 배열"을 그대로 이 함수에 넣을 수 있는 이유
 * (Meta 배치 동기화 파일럿 설계의 핵심 — 병합 로직을 따로 안 짜도 된다). */
export function summarizeMetaInsight(
  data: MetaInsight,
  startDate: string,
  endDate: string,
) {
  return {
    total: summarizeTotal(data),
    byDate: summarizeByDate(data),
    byDayOfWeek: summarizeByDayOfWeek(data),
    byGroupedWeek: summarizeByWeek(data, startDate, endDate),
    // 캠페인별(그 안의 adset별 포함) byDate/byDayOfWeek/byGroupedWeek — total과
    // 같은 도출 방식을 캠페인·adset 단위 부분집합에 그대로 적용한 것.
    byCampaign: summarizeByCampaign(data, startDate, endDate),
  }
}

/** 라이브 조회 전용 — 메인/서브 두 광고계정을 라이브 API로 fetch한 뒤 합쳐서
 * 요약한다. 디버그용/getMetaInsightWithHistory 내부에서 "최근 구간"을 뜰 때
 * 쓴다(전체 화면 조회는 이제 getMetaInsightWithHistory를 쓴다 —
 * functions-cmip/src/index.ts의 getAllInsights 참고). */
export const getMetaInsight = async (
  dateStart: string,
  dateEnd: string,
  accessToken: string,
) => {
  const rowsByAccount = await fetchLiveMetaInsightRowsByAccount(
    dateStart,
    dateEnd,
    accessToken,
  )
  const data: MetaInsight = rowsByAccount.flatMap((a) => a.rows)
  return summarizeMetaInsight(data, dateStart, dateEnd)
}

/** getAllInsights가 실제로 쓰는 함수 — 조회 구간을 LIVE_WINDOW_DAYS 경계로
 * 쪼개서, 최근 구간은 라이브 API로, 그보다 과거인 구간은 Firestore
 * (metaInsightDaily)에서 읽은 뒤 두 배열을 이어붙여 summarizeMetaInsight
 * 하나에 그대로 넣는다 — summarizeMetaInsight는 DataSetInsight[]가 어디서
 * 왔는지 안 가리는 순수 함수라(위 주석 참고) 이 두 줄(fetch, concat)만
 * 새로 필요했다. 경계를 걸치지 않는 조회(전부 최근/전부 과거)는 안 쓰는
 * 쪽 fetch를 생략한다. */
export const getMetaInsightWithHistory = async (
  dateStart: string,
  dateEnd: string,
  accessToken: string,
) => {
  const today = todayISO()
  const liveStartBoundary = addDays(today, -(LIVE_WINDOW_DAYS - 1))
  const historicalEnd =
    dateEnd < liveStartBoundary ? dateEnd : addDays(liveStartBoundary, -1)
  const liveStart =
    dateStart > liveStartBoundary ? dateStart : liveStartBoundary

  const needsHistorical = dateStart <= historicalEnd
  const needsLive = liveStart <= dateEnd

  const [historicalRows, liveRowsByAccount] = await Promise.all([
    needsHistorical
      ? fetchMetaInsightRowsFromDb(dateStart, historicalEnd)
      : Promise.resolve([] as DataSetInsight[]),
    needsLive
      ? fetchLiveMetaInsightRowsByAccount(liveStart, dateEnd, accessToken)
      : Promise.resolve([] as { adAccountId: string; rows: DataSetInsight[] }[]),
  ])

  const data: MetaInsight = [
    ...historicalRows,
    ...liveRowsByAccount.flatMap((a) => a.rows),
  ]
  return summarizeMetaInsight(data, dateStart, dateEnd)
}

/** 수동/스케줄 동기화 공용 — 두 광고계정을 라이브로 fetch해서 각 행에
 * adAccountId를 붙여 Firestore(metaInsightDaily)에 upsert한다
 * (functions-cmip/src/index.ts의 syncMetaInsights/syncMetaInsightsScheduled
 * 참고). */
export const syncMetaInsightRows = async (
  dateStart: string,
  dateEnd: string,
  accessToken: string,
): Promise<{ upserted: number }> => {
  const rowsByAccount = await fetchLiveMetaInsightRowsByAccount(
    dateStart,
    dateEnd,
    accessToken,
  )
  const taggedRows = rowsByAccount.flatMap((a) =>
    a.rows.map((row) => ({ ...row, adAccountId: a.adAccountId })),
  )
  return upsertMetaInsightRows(taggedRows)
}

/** 디버그 전용 — 실제 Graph API 원본 행을 눈으로 확인/대조하는 용도
 * (cafe24/auth.ts의 debugFetchCafe24OrdersRaw와 같은 목적). 계정별로 몇 건
 * 나왔는지도 같이 보여준다. */
export const debugFetchMetaInsightRaw = async (
  dateStart: string,
  dateEnd: string,
  accessToken: string,
): Promise<{
  rows: DataSetInsight[]
  count: number
  countByAccount: Record<string, number>
}> => {
  const rowsByAccount = await fetchLiveMetaInsightRowsByAccount(
    dateStart,
    dateEnd,
    accessToken,
  )
  const rows = rowsByAccount.flatMap((a) => a.rows)
  const countByAccount = Object.fromEntries(
    rowsByAccount.map((a) => [a.adAccountId, a.rows.length]),
  )
  return { rows, count: rows.length, countByAccount }
}
