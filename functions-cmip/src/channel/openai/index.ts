import { addDays, todayISO } from '../utils'
import {
  fetchAllOpenaiInsightRows,
  OpenaiCredentials,
} from './client'
import {
  fetchOpenaiInsightRowsFromDb,
  upsertOpenaiInsightRows,
} from './firestore'
// 행 모양이 NaverInsightRow와 같아서 집계는 네이버 것을 그대로 쓴다 — 채널마다
// 주차 경계·지표 공식이 같아야 "종합" 합산이 어긋나지 않는다(naver/helper.ts 참고).
import {
  summarizeByCampaign,
  summarizeByDate,
  summarizeByDayOfWeek,
  summarizeByWeek,
  summarizeTotal,
} from '../naver/helper'
import { OpenaiInsight } from './types'
import * as logger from 'firebase-functions/logger'
import { recordAdEntitiesSafely, sightingsFromOpenai } from '../../ad-settings/entities'

export type { OpenaiCredentials }

/** 최근 N일은 라이브 API, 그 이전은 Firestore — naver/index.ts의 같은 상수와
 * 동일한 이유. 전환은 하루 이상 늦게 확정된다(공식 문서: "Allow at least one
 * day for conversion data to appear"). */
const LIVE_WINDOW_DAYS = 7

function summarizeOpenaiInsight(
  data: OpenaiInsight,
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

/** getNaverInsightWithHistory와 같은 구조 — 조회 구간을 LIVE_WINDOW_DAYS
 * 경계로 쪼개 최근은 라이브 API, 과거는 Firestore(openaiInsightDaily)에서
 * 읽어 이어붙인다. */
export const getOpenaiInsightWithHistory = async (
  dateStart: string,
  dateEnd: string,
  credentials: OpenaiCredentials,
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
      ? fetchOpenaiInsightRowsFromDb(dateStart, historicalEnd)
      : Promise.resolve([] as OpenaiInsight),
    needsLive
      ? fetchAllOpenaiInsightRows(liveStart, dateEnd, credentials)
      : Promise.resolve([] as OpenaiInsight),
  ])

  const data: OpenaiInsight = [...historicalRows, ...liveRows]
  return summarizeOpenaiInsight(data, dateStart, dateEnd)
}

/** 수동/스케줄 동기화 공용 — 라이브로 fetch해서 openaiInsightDaily에
 * upsert한다(functions-cmip/src/index.ts의 syncOpenaiInsights 참고). */
export const syncOpenaiInsightRows = async (
  dateStart: string,
  dateEnd: string,
  credentials: OpenaiCredentials,
): Promise<{ upserted: number }> => {
  const rows = await fetchAllOpenaiInsightRows(dateStart, dateEnd, credentials)
  const result = await upsertOpenaiInsightRows(rows)
  await recordAdEntitiesSafely(sightingsFromOpenai(rows), logger.warn)
  return result
}
