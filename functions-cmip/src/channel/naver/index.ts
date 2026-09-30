import { STAT_FIELDS } from './constants'
import { addDays, todayISO } from '../utils'
import {
  fetchAllNaverInsightRows,
  fetchNaver,
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
 * 디버그 전용 — /ncc/campaigns, /ncc/adgroups, /stats 세 응답의 "원본"을 그대로
 * 반환한다. getNaverInsight가 빈 데이터를 돌려줄 때, 세 응답 중 어디서부터
 * 내 가정(배열인지/필드명이 nccCampaignId·name 등인지)이 틀렸는지 눈으로
 * 확인하기 위한 용도 — 문제 확인되면 이 함수와 index.ts의 호출부(엔드포인트)는
 * 지워도 된다. campaigns가 비어 있으면 그 뒤(adgroups/stats)는 아예 안 부른다.
 *
 * NOTE: 캠페인/광고그룹은 "아무거나 첫 번째"가 아니라 status가 ELIGIBLE(운영
 * 중)인 것 중에서 고른다 — PAUSED인 캠페인을 집으면 stats.data가 원래도 비어
 * 있어서, 필드명 검증이 안 된다.
 */
export async function debugFetchNaverRaw(
  dateStart: string,
  dateEnd: string,
  credentials: NaverCredentials,
): Promise<{
  pickedCampaign: unknown
  pickedAdgroup: unknown
  statsRaw: unknown
}> {
  const campaignsRaw = await fetchNaver<unknown>(
    '/ncc/campaigns',
    {},
    credentials,
  )

  const pickEligible = (
    list: unknown,
  ): Record<string, unknown> | undefined => {
    if (!Array.isArray(list)) return undefined
    const rows = list as Record<string, unknown>[]
    return rows.find((row) => row.status === 'ELIGIBLE') ?? rows[0]
  }

  const campaign = pickEligible(campaignsRaw)
  const campaignId = campaign?.nccCampaignId as string | undefined

  const adgroupsRaw = campaignId
    ? await fetchNaver<unknown>(
        '/ncc/adgroups',
        { nccCampaignId: campaignId },
        credentials,
      )
    : null

  const adgroup = pickEligible(adgroupsRaw)
  const adgroupId = adgroup?.nccAdgroupId as string | undefined

  // 요청한 기간 전체를 한 번에 넣어봐서, /stats가 여러 날짜를 한 번에 내려줄 수
  // 있는지(그리고 된다면 날짜 필드명이 뭔지)도 같이 확인한다.
  const statsRaw = adgroupId
    ? await fetchNaver<unknown>(
        '/stats',
        {
          ids: adgroupId,
          fields: JSON.stringify(STAT_FIELDS),
          timeRange: JSON.stringify({ since: dateStart, until: dateEnd }),
        },
        credentials,
      )
    : null

  return { pickedCampaign: campaign, pickedAdgroup: adgroup, statsRaw }
}

/** 디버그 전용 — client.ts가 가공까지 마친(집계는 안 된) 인사이트 행 배열을
 * 그대로 반환한다(meta의 debugFetchMetaInsightRaw와 같은 목적 — DB 백필 후
 * 같은 기간 결과를 직접 합산해 대조하는 용도). */
export async function debugFetchNaverInsightRows(
  dateStart: string,
  dateEnd: string,
  credentials: NaverCredentials,
): Promise<{ rows: NaverInsight; count: number }> {
  const rows = await fetchAllNaverInsightRows(dateStart, dateEnd, credentials)
  return { rows, count: rows.length }
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
  return upsertNaverInsightRows(rows)
}
