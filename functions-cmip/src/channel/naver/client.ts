// 네이버 검색광고 API 호출 — 라이브 조회(index.ts의 getNaverInsight)와
// Firestore 배치 동기화(syncNaverInsightRows) 둘 다 이 파일의
// fetchAllNaverInsightRows 하나를 공유한다(meta/client.ts, google/client.ts와
// 같은 이유 — API 호출/행 가공 로직을 한 곳에서만 관리).
import { API_BASE_URL, STAT_FIELDS } from './constants'
import {
  NaverAdgroup,
  NaverCampaign,
  NaverInsight,
  NaverInsightRow,
  NaverStatRow,
} from './types'
import { buildNaverHeaders, dateRange, mapSequential, sleep } from './utils'

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
 * 최대 그 횟수만큼 재시도한다. debugFetchNaverRaw(index.ts)도 원본 응답
 * 확인용으로 이 함수를 그대로 쓴다. */
export async function fetchNaver<T>(
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
 * 그 하루로 좁히면 응답이 그 날짜의 합계라는 것만은 확실하다. 이게 바로 조회
 * 기간이 길수록 라이브 조회가 느려지는 이유이자, Firestore 배치 동기화가
 * 특히 네이버 쪽에서 유효한 핵심 근거다(index.ts의 LIVE_WINDOW_DAYS 주석
 * 참고). 실제 키로 붙여보고 나서, 한 번에 여러 날짜를 받을 수 있는 게
 * 확인되면 이 함수를 dateRange 전체를 한 번에 요청하는 방식으로 바꿔 호출
 * 수를 줄일 것.
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
        campaign_id: adgroup.nccCampaignId,
        campaign_name: campaignNameById.get(adgroup.nccCampaignId) ?? '',
        adgroup_id: adgroup.nccAdgroupId,
        adgroup_name: adgroup.name,
        impressions: Number(row.impCnt || 0),
        clicks: Number(row.clkCnt || 0),
        spend: Number(row.salesAmt || 0),
        conversions: Number(row.ccnt || 0),
        revenue: Number(row.convAmt || 0),
        date_start: date,
      }
      insight.push(insightRow)
    }
  }

  return insight
}

/** [dateStart, dateEnd] 구간의 인사이트 행을 전부 모은다 — 캠페인/adgroup
 * 목록 조회 후 날짜별 stat을 순회 호출해 합치는, 예전 getNaverInsight
 * 본문 그대로(요약 없이 행 배열까지만). 라이브 조회와 동기화 둘 다 이 함수
 * 하나를 공유한다. */
export async function fetchAllNaverInsightRows(
  dateStart: string,
  dateEnd: string,
  credentials: NaverCredentials,
): Promise<NaverInsight> {
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

  return buildNaverInsight(statsByDate, campaigns, adgroups)
}
