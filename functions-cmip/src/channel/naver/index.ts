import { addDays, todayISO } from '../utils'
import {
  fetchAllNaverInsightRows,
  NaverCredentials,
} from './client'
import {
  fetchNaverInsightRowsFromDb,
  upsertNaverInsightRows,
} from './firestore'
import {
  summarizeByCampaign,
  summarizeByDate,
  summarizeByDayOfWeek,
  summarizeByWeek,
  summarizeTotal,
} from './helper'
import { NaverInsight } from './types'
import * as logger from 'firebase-functions/logger'
import { recordAdEntitiesSafely, sightingsFromNaver } from '../../ad-settings/entities'

export type { NaverCredentials }

/** 최근 N일은 어트리뷰션/집계 반영 지연으로 계속 바뀔 수 있어서 라이브
 * API로, 그 이전은 Firestore 배치 동기화 값을 읽는다 — meta/index.ts의 같은
 * 상수와 동일한 이유. 네이버는 /stats가 "하루 = 요청 한 번"이라(client.ts의
 * fetchStatsForDate 주석 참고) 조회 기간이 길수록 라이브 호출이 느려지는데,
 * 이 배치 동기화로 최근 7일을 뺀 나머지는 그 비용을 안 치르게 된다. */
const LIVE_WINDOW_DAYS = 7

function summarizeNaverInsight(
  data: NaverInsight,
  startDate: string,
  endDate: string,
) {
  return {
    total: summarizeTotal(data),
    byDate: summarizeByDate(data),
    byDayOfWeek: summarizeByDayOfWeek(data),
    byGroupedWeek: summarizeByWeek(data, startDate, endDate),
    // 캠페인별(그 안의 adgroup별 포함) byDate/byDayOfWeek/byGroupedWeek — total과
    // 같은 도출 방식을 캠페인·adgroup 단위 부분집합에 그대로 적용한 것.
    byCampaign: summarizeByCampaign(data, startDate, endDate),
  }
}

/**
 * Meta의 getMetaInsight, Google의 getGoogleInsight/getGoogleAdGroupInsight와
 * 같은 자리 — dateStart~dateEnd 구간의 네이버 검색광고 실적을
 * {total, byDate, byDayOfWeek, byGroupedWeek, byCampaign} 모양으로 반환한다.
 * 이 모양이면 프론트(insight-channel-combine.ts)가 채널을 구분하지 않고 그대로
 * 합칠 수 있다. 라이브 전용 경로(getNaverInsightWithHistory가 실제 조회
 * 엔드포인트가 쓰는 함수).
 */
export const getNaverInsight = async (
  dateStart: string,
  dateEnd: string,
  credentials: NaverCredentials,
) => {
  const data = await fetchAllNaverInsightRows(dateStart, dateEnd, credentials)
  return summarizeNaverInsight(data, dateStart, dateEnd)
}

/** getAllInsights(Meta)/getGoogleCampaignInsight(Google)와 같은 자리 —
 * 조회 구간을 LIVE_WINDOW_DAYS 경계로 쪼개서, 최근 구간은 라이브 API로, 그
 * 보다 과거인 구간은 Firestore(naverInsightDaily)에서 읽은 뒤 두 배열을
 * 이어붙여 summarizeNaverInsight 하나에 그대로 넣는다 — meta/index.ts의
 * getMetaInsightWithHistory와 같은 구조. */
export const getNaverInsightWithHistory = async (
  dateStart: string,
  dateEnd: string,
  credentials: NaverCredentials,
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
      ? fetchNaverInsightRowsFromDb(dateStart, historicalEnd)
      : Promise.resolve([] as NaverInsight),
    needsLive
      ? fetchAllNaverInsightRows(liveStart, dateEnd, credentials)
      : Promise.resolve([] as NaverInsight),
  ])

  const data: NaverInsight = [...historicalRows, ...liveRows]
  return summarizeNaverInsight(data, dateStart, dateEnd)
}

/** 수동/스케줄 동기화 공용 — 라이브로 fetch해서
 * Firestore(naverInsightDaily)에 upsert한다(functions-cmip/src/index.ts의
 * syncNaverInsights/syncNaverInsightsScheduled 참고). */
export const syncNaverInsightRows = async (
  dateStart: string,
  dateEnd: string,
  credentials: NaverCredentials,
): Promise<{ upserted: number }> => {
  const rows = await fetchAllNaverInsightRows(dateStart, dateEnd, credentials)
  const result = await upsertNaverInsightRows(rows)
  // 캠페인·광고그룹 목록(광고 설정 화면)도 같이 넓힌다.
  await recordAdEntitiesSafely(sightingsFromNaver(rows), logger.warn)
  return result
}
