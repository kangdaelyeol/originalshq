import { addDays, todayISO } from '../utils'
import { fetchAllDaangnInsightRows, type DaangnCredentials } from './client'
import {
  fetchDaangnInsightRowsFromDb,
  upsertDaangnInsightRows,
} from './firestore'
// 행 모양이 NaverInsightRow와 같아서 집계는 네이버 것을 그대로 쓴다(openai와
// 같은 이유 — 채널마다 주차 경계·지표 공식이 같아야 "종합" 합산이 맞는다).
import {
  summarizeByCampaign,
  summarizeByDate,
  summarizeByDayOfWeek,
  summarizeByWeek,
  summarizeTotal,
} from '../naver/helper'
import type { DaangnInsight } from './types'

export type { DaangnCredentials }

/** 최근 N일은 라이브 API, 그 이전은 Firestore — openai/index.ts와 같은 이유
 * (전환은 늦게 확정될 수 있다). */
const LIVE_WINDOW_DAYS = 7

function summarizeDaangnInsight(
  data: DaangnInsight,
  startDate: string,
  endDate: string,
) {
  return {
    total: summarizeTotal(data),
    byDate: summarizeByDate(data),
    byDayOfWeek: summarizeByDayOfWeek(data),
    byGroupedWeek: summarizeByWeek(data, startDate, endDate),
    byCampaign: summarizeByCampaign(data, startDate, endDate),
  }
}

/** getOpenaiInsightWithHistory와 같은 구조 — 조회 구간을 LIVE_WINDOW_DAYS
 * 경계로 쪼개 최근은 라이브 API, 과거는 Firestore(daangnInsightDaily)에서
 * 읽어 이어붙인다. */
export const getDaangnInsightWithHistory = async (
  dateStart: string,
  dateEnd: string,
  credentials: DaangnCredentials,
) => {
  const today = todayISO()
  const liveStartBoundary = addDays(today, -(LIVE_WINDOW_DAYS - 1))
  const historicalEnd =
    dateEnd < liveStartBoundary ? dateEnd : addDays(liveStartBoundary, -1)
  const liveStart =
    dateStart > liveStartBoundary ? dateStart : liveStartBoundary

  const needsHistorical = dateStart <= historicalEnd
  const needsLive = liveStart <= dateEnd

  const [historicalRows, liveRows] = await Promise.all([
    needsHistorical
      ? fetchDaangnInsightRowsFromDb(dateStart, historicalEnd)
      : Promise.resolve([] as DaangnInsight),
    needsLive
      ? fetchAllDaangnInsightRows(liveStart, dateEnd, credentials)
      : Promise.resolve([] as DaangnInsight),
  ])

  return summarizeDaangnInsight(
    [...historicalRows, ...liveRows],
    dateStart,
    dateEnd,
  )
}

/** 수동/예약 동기화 공용 — 라이브로 받아 daangnInsightDaily에 upsert한다.
 * 광고 설정 목록(adEntities)에는 화면이 당근을 그릴 수 있게 된 뒤에 넣는다. */
export const syncDaangnInsightRows = async (
  dateStart: string,
  dateEnd: string,
  credentials: DaangnCredentials,
): Promise<{ upserted: number }> => {
  const rows = await fetchAllDaangnInsightRows(dateStart, dateEnd, credentials)
  return upsertDaangnInsightRows(rows)
}
