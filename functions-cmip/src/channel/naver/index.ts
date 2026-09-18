import { API_BASE_URL, STAT_FIELDS } from './constants'
import {
  summarizeByCampaign,
  summarizeByDate,
  summarizeByDayOfWeek,
  summarizeByWeek,
  summarizeTotal,
} from './helper'
import {
  NaverAdgroup,
  NaverCampaign,
  NaverInsight,
  NaverInsightRow,
  NaverStatRow,
} from './types'
import { buildNaverHeaders, dateRange, mapSequential, sleep } from './utils'

/** Firebase Secret으로 관리할 세 값 — Meta의 accessToken, Google의
 * clientId/clientSecret/refreshToken에 대응하는 네이버 쪽 인증 정보. */
export interface NaverCredentials {
  apiKey: string
  secretKey: string
  customerId: string
}

// 429(Too Many Requests)를 만나면 이만큼 쉬었다가 다시 시도한다 — 매번 호출
// 사이에 mapSequential로 이미 간격을 두고 있지만, 계정이 이전 호출들로 이미
// 쿨다운 상태였다면 순차 호출의 첫 요청부터도 걸릴 수 있어 별도로 둔다.
const RATE_LIMIT_RETRY_DELAYS_MS = [1000, 3000, 6000]

/** 인증 헤더를 붙여 GET 요청하고 JSON으로 파싱한다 — 네이버 API 호출부가
 * 전부 이 한 함수를 거친다. 429는 RATE_LIMIT_RETRY_DELAYS_MS만큼 쉬어가며
 * 최대 그 횟수만큼 재시도한다. */
async function fetchNaver<T>(
  uri: string,
  query: Record<string, string>,
  credentials: NaverCredentials,
): Promise<T> {
  const qs = new URLSearchParams(query).toString()
  const url = qs ? `${API_BASE_URL}${uri}?${qs}` : `${API_BASE_URL}${uri}`

  for (let attempt = 0; ; attempt++) {
    // 재시도로 시간이 흐르면 서명의 X-Timestamp도 낡아지므로(네이버가 일정
    // 범위를 벗어난 타임스탬프는 거부할 수 있다), 매 시도마다 새로 만든다.
    // 서명 대상 uri는 쿼리스트링을 빼고 "경로만" 넣어야 한다(buildNaverHeaders 참고).
    const headers = buildNaverHeaders(
      'GET',
      uri,
      credentials.apiKey,
      credentials.secretKey,
      credentials.customerId,
    )
    const response = await fetch(url, { headers })
    if (response.ok) return (await response.json()) as T

    const errorText = await response.text()
    if (response.status === 429 && attempt < RATE_LIMIT_RETRY_DELAYS_MS.length) {
      await sleep(RATE_LIMIT_RETRY_DELAYS_MS[attempt])
      continue
    }
    throw new Error(`네이버 검색광고 API 호출 실패(${uri}): ${errorText}`)
  }
}

async function fetchCampaigns(
  credentials: NaverCredentials,
): Promise<NaverCampaign[]> {
  return fetchNaver<NaverCampaign[]>('/ncc/campaigns', {}, credentials)
}

/** adgroup은 계정 전체를 한 번에 리스팅하는 엔드포인트가 문서에서 확인되지
 * 않아, 캠페인마다(nccCampaignId 필터로) 따로 조회해 합친다.
 *
 * ⚠️ 캠페인 수만큼(계정에 따라 수십 개) Promise.all로 동시에 쏘면 네이버 API의
 * 초당 요청 제한에 걸려 429가 난다 — mapSequential로 하나씩, 사이를 두고 호출한다. */
async function fetchAdgroups(
  campaigns: NaverCampaign[],
  credentials: NaverCredentials,
): Promise<NaverAdgroup[]> {
  const results = await mapSequential(campaigns, (campaign) =>
    fetchNaver<NaverAdgroup[]>(
      '/ncc/adgroups',
      { nccCampaignId: campaign.nccCampaignId },
      credentials,
    ),
  )
  return results.flat()
}

/**
 * 특정 하루치 stat을 모든 adgroup에 대해 한 번에 받아온다.
 *
 * ⚠️ 미검증 구간: 네이버 /stats가 timeIncrement(또는 breakdown)로 "여러 날짜를
 * 한 번에" 내려줄 수 있는지, 된다면 그 응답에서 날짜를 어느 필드로 구분하는지
 * 공식 문서(JS 렌더링이라 자동 확인 불가)로 100% 확인하지 못했다. 그래서
 * 지금은 가장 안전하게 "하루 = 요청 한 번"으로 구현했다 — 느리지만 timeRange를
 * 그 하루로 좁히면 응답이 그 날짜의 합계라는 것만은 확실하다. 실제 키로
 * 붙여보고 나서, 한 번에 여러 날짜를 받을 수 있는 게 확인되면 이 함수를
 * dateRange 전체를 한 번에 요청하는 방식으로 바꿔 호출 수를 줄일 것.
 */
async function fetchStatsForDate(
  ids: string[],
  date: string,
  credentials: NaverCredentials,
): Promise<NaverStatRow[]> {
  if (ids.length === 0) return []

  // NOTE: ids가 많으면(광고그룹 수가 매우 많은 계정) 한 번에 못 받을 수 있다
  // (요청 URL 길이·API 자체 제한). 지금은 통짜로 보내고, 문제가 확인되면 여기서
  // chunk 단위로 나눠 여러 번 호출하도록 바꾸면 된다.
  const result = await fetchNaver<NaverStatRow[] | { data: NaverStatRow[] }>(
    '/stats',
    {
      ids: ids.join(','),
      fields: JSON.stringify(STAT_FIELDS),
      timeRange: JSON.stringify({ since: date, until: date }),
    },
    credentials,
  )

  return Array.isArray(result) ? result : (result.data ?? [])
}

/** 날짜별 stat 응답(adgroup id 기준) + 캠페인/adgroup 이름 매핑을 합쳐,
 * helper.ts가 바로 쓸 수 있는 "날짜 × adgroup" 행 배열로 펼친다. */
function buildNaverInsight(
  statsByDate: { date: string; rows: NaverStatRow[] }[],
  campaigns: NaverCampaign[],
  adgroups: NaverAdgroup[],
): NaverInsight {
  const campaignNameById = new Map(
    campaigns.map((c) => [c.nccCampaignId, c.name]),
  )
  const adgroupById = new Map(adgroups.map((a) => [a.nccAdgroupId, a]))

  const insight: NaverInsight = []

  for (const { date, rows } of statsByDate) {
    for (const row of rows) {
      const adgroup = adgroupById.get(row.id)
      if (!adgroup) continue // 캠페인/adgroup 목록 조회 이후 삭제된 경우 등.

      const insightRow: NaverInsightRow = {
        campaign_name: campaignNameById.get(adgroup.nccCampaignId) ?? '',
        adgroup_name: adgroup.name,
        impressions: Number(row.impCnt || 0),
        clicks: Number(row.clkCnt || 0),
        spend: Number(row.salesAmt || 0),
        conversions: Number(row.ccnt || 0),
        date_start: date,
      }
      insight.push(insightRow)
    }
  }

  return insight
}

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

/**
 * Meta의 getMetaInsight, Google의 getGoogleInsight/getGoogleAdGroupInsight와
 * 같은 자리 — dateStart~dateEnd 구간의 네이버 검색광고 실적을
 * {total, byDate, byDayOfWeek, byGroupedWeek, byCampaign} 모양으로 반환한다.
 * 이 모양이면 프론트(insight-channel-combine.ts)가 채널을 구분하지 않고 그대로
 * 합칠 수 있다.
 */
export const getNaverInsight = async (
  dateStart: string,
  dateEnd: string,
  credentials: NaverCredentials,
) => {
  const campaigns = await fetchCampaigns(credentials)
  const adgroups = await fetchAdgroups(campaigns, credentials)
  const adgroupIds = adgroups.map((a) => a.nccAdgroupId)

  // 날짜 수만큼(조회 기간이 길면 그만큼) 동시에 쏘지 않도록 여기도
  // mapSequential — fetchAdgroups와 같은 이유(429 방지).
  const dates = dateRange(dateStart, dateEnd)
  const statsByDate = await mapSequential(dates, async (date) => ({
    date,
    rows: await fetchStatsForDate(adgroupIds, date, credentials),
  }))

  const data = buildNaverInsight(statsByDate, campaigns, adgroups)
  return summarizeNaverInsight(data, dateStart, dateEnd)
}
