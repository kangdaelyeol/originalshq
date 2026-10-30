import { addDays, todayISO } from '../utils'
import {
  fetchAllOpenaiInsightRows,
  fetchOpenai,
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

/** 디버그 전용 — 가공까지 마친(집계는 안 된) 인사이트 행 배열을 그대로
 * 반환한다(debugFetchNaverInsightRows와 같은 목적 — Ads Manager 숫자와 대조). */
export async function debugFetchOpenaiInsightRows(
  dateStart: string,
  dateEnd: string,
  credentials: OpenaiCredentials,
): Promise<{ rows: OpenaiInsight; count: number }> {
  const rows = await fetchAllOpenaiInsightRows(dateStart, dateEnd, credentials)
  return { rows, count: rows.length }
}

/** KST 자정의 Unix 초 — 계정 시간대(Asia/Seoul) 하루 경계. */
const kstMidnightUnix = (date: string): string =>
  String(Date.parse(`${date}T00:00:00+09:00`) / 1000)

/**
 * 디버그 전용(조회만) — 전환이 왜 0인지 보려고. GET insights의 conversions는
 * 캠페인에 붙인(attached) 전환 이벤트만 "목표 전환"으로 센다(공식 문서: Goal
 * reporting applies going forward from attachment). 그래서
 *   · eventSettings — 계정의 전환 이벤트 설정과 각각이 붙은 캠페인
 *   · conversions — 같은 기간 목표 전환 합계와, 목표 여부와 상관없이 잡힌
 *     이벤트별 건수(attributed_events)
 * 를 같이 돌려준다. 이벤트는 잡히는데 목표 전환이 0이면 캠페인에 안 붙은 것.
 */
export async function debugFetchOpenaiConversions(
  dateStart: string,
  dateEnd: string,
  credentials: OpenaiCredentials,
): Promise<{ eventSettings: unknown; conversions: unknown }> {
  const [eventSettings, conversions] = await Promise.all([
    fetchOpenai<unknown>('/conversions/event_settings', { limit: '100' }, credentials),
    fetchOpenai<unknown>('/conversions/insights', {}, credentials, {
      aggregation_level: 'campaign',
      time_granularity: 'none',
      group_by_entity: false,
      time_ranges: [
        JSON.stringify({
          type: 'unix_range',
          start: kstMidnightUnix(dateStart),
          // 끝은 포함하지 않는다 — dateEnd 다음 날 자정.
          end: kstMidnightUnix(addDays(dateEnd, 1)),
        }),
      ],
      include: ['attributed_events'],
    }),
  ])
  return { eventSettings, conversions }
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
