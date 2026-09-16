/**
 * 실제 Google Ads 연동 클라이언트 — functions-cmip의 getGoogleCampaignInsight
 * (캠페인 단위, 실제 frequency 포함)와 getGoogleAdsInsight(adGroup=adset 단위,
 * Google 정책상 frequency 미제공이라 0 고정) 두 엔드포인트를 합쳐 getAllInsights와
 * 동일한 모양(MetaInsightSummary, byCampaign 포함)으로 변환한다.
 *
 * google-insight-mock.ts를 대체한다 — byDate/byDayOfWeek/byGroupedWeek 집계는
 * 그 파일과 똑같이 ./insight-aggregate 표준 함수를 그대로 써서, Meta와 합칠 때
 * (insight-channel-combine) 집계 방식이 어긋나지 않는다.
 */
import type { ISODate } from '../types'
import { callFunction } from './csv-client'
import {
  aggregateMetrics,
  deriveMetrics,
  seriesFromByDate,
  sumMetrics,
} from './insight-aggregate'
import type {
  AdsetSummary,
  CampaignSummary,
  DateSummary,
  MetaInsightSummary,
  MetricsSummary,
} from './insight-client'

// 이 화면은 Meta 쪽(getAllInsights)도 그렇듯 브랜드 선택 UI가 없는 단일 계정
// 화면이다 — 실제로 OAuth 연동을 마친 이 하나의 Google Ads 계정으로 고정한다.
// 여러 계정/브랜드를 다루게 되면 이 세 값을 설정 화면 등에서 선택 가능하게
// 바꾸면 된다.
const GOOGLE_ADS_BRAND_ID = '10'
const GOOGLE_ADS_CUSTOMER_ID = '2771515076'
const GOOGLE_ADS_LOGIN_CUSTOMER_ID = '7421390798'

interface GoogleInsightRequestBody {
  brandId: string
  dateStart: ISODate
  dateEnd: ISODate
  customerId: string
  loginCustomerId: string
}

// 두 엔드포인트가 공통으로 갖는 원본 지표 필드 — campaignName/adGroupName은
// GAQL이 값이 없으면 빈 문자열로 채워 보낸다(백엔드 구현 참고).
interface GoogleRawMetrics {
  date: string
  campaignName: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
  frequency: number
}

interface GoogleCampaignInsightRow extends GoogleRawMetrics {
  campaignId: string
}

interface GoogleCampaignInsightResult {
  rows: GoogleCampaignInsightRow[]
}

interface GoogleAdGroupInsightRow extends GoogleRawMetrics {
  campaignId: string
  adGroupId: string
  adGroupName: string
}

interface GoogleAdGroupInsightResult {
  rows: GoogleAdGroupInsightRow[]
}

function buildRequestBody(
  dateStart: ISODate,
  dateEnd: ISODate,
): GoogleInsightRequestBody {
  return {
    brandId: GOOGLE_ADS_BRAND_ID,
    dateStart,
    dateEnd,
    customerId: GOOGLE_ADS_CUSTOMER_ID,
    loginCustomerId: GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  }
}

const fetchGoogleCampaignInsight = (
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<GoogleCampaignInsightResult> =>
  callFunction('getGoogleCampaignInsight', buildRequestBody(dateStart, dateEnd))

const fetchGoogleAdGroupInsight = (
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<GoogleAdGroupInsightResult> =>
  callFunction('getGoogleAdsInsight', buildRequestBody(dateStart, dateEnd))

/** 원본 행(캠페인/adGroup 공통 지표) → 내부 표준 MetricsSummary. API가 이미 계산해
 * 보내는 ctr/cpc/cpa/cvr/cpm은 그대로 합산할 수 없는 비율값이라 버리고, 원본
 * 카운트(impressions/clicks/cost/conversions)로부터 deriveMetrics로 다시
 * 계산한다 — 나중에 날짜/캠페인 단위로 합칠 때도 항상 이 방식이라 서로 어긋나지
 * 않는다. frequency는 캠페인 단위 응답에선 "조회 기간 전체 평균"이 모든 날짜
 * 행에 동일하게 채워져 있어(functions-cmip 구현) 그 자체로는 날짜별 값이
 * 아니지만, impressions 가중 평균으로 다시 묶으면(deriveMetrics의 weightedFrequency)
 * 근사치로는 무리 없이 합산된다. adGroup 단위는 Google 정책상 항상 0.
 */
function toMetrics(row: GoogleRawMetrics): MetricsSummary {
  return deriveMetrics({
    impressions: row.impressions,
    clicks: row.clicks,
    spend: row.cost,
    conversions: row.conversions,
    weightedFrequency: row.frequency * row.impressions,
  })
}

/**
 * getAllInsights(Meta)와 같은 모양(MetaInsightSummary, byCampaign 포함)의 실제
 * Google 인사이트. dateStart/dateEnd는 조회 범위(byGroupedWeek 경계 기준)로,
 * Meta capi와 항상 같은 방식으로 잘라야 채널 간 주차 경계가 어긋나지 않는다.
 */
export async function getGoogleInsights(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<MetaInsightSummary> {
  const [campaignResult, adGroupResult] = await Promise.all([
    fetchGoogleCampaignInsight(dateStart, dateEnd),
    fetchGoogleAdGroupInsight(dateStart, dateEnd),
  ])

  // 계정 전체 byDate — 캠페인 단위 원본 행을 날짜로 묶어 합산한다.
  const byDateMap = new Map<ISODate, MetricsSummary>()
  for (const row of campaignResult.rows) {
    const metrics = toMetrics(row)
    const existing = byDateMap.get(row.date)
    byDateMap.set(row.date, existing ? sumMetrics(existing, metrics) : metrics)
  }
  const byDate: DateSummary[] = Array.from(byDateMap.entries())
    .map(([date, metrics]) => ({ date, ...metrics }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // 캠페인별 byDate.
  const campaignDateRows = new Map<string, DateSummary[]>()
  const campaignOrder: string[] = []
  for (const row of campaignResult.rows) {
    if (!campaignDateRows.has(row.campaignName)) {
      campaignDateRows.set(row.campaignName, [])
      campaignOrder.push(row.campaignName)
    }
    campaignDateRows.get(row.campaignName)?.push({
      date: row.date,
      ...toMetrics(row),
    })
  }

  // adset(ad group)별 byDate — "campaignName::adGroupName" 키로 묶는다.
  const adsetDateRows = new Map<string, DateSummary[]>()
  const adsetNamesByCampaign = new Map<string, string[]>()
  for (const row of adGroupResult.rows) {
    const key = `${row.campaignName}::${row.adGroupName}`
    if (!adsetDateRows.has(key)) {
      adsetDateRows.set(key, [])
      const names = adsetNamesByCampaign.get(row.campaignName) ?? []
      names.push(row.adGroupName)
      adsetNamesByCampaign.set(row.campaignName, names)
    }
    adsetDateRows.get(key)?.push({ date: row.date, ...toMetrics(row) })
  }

  const byCampaign: CampaignSummary[] = campaignOrder.map((campaignName) => {
    const adsets: AdsetSummary[] = (
      adsetNamesByCampaign.get(campaignName) ?? []
    ).map((adsetName) => ({
      adsetName,
      ...seriesFromByDate(
        adsetDateRows.get(`${campaignName}::${adsetName}`) ?? [],
        dateStart,
        dateEnd,
      ),
    }))
    return {
      campaignName,
      ...seriesFromByDate(
        campaignDateRows.get(campaignName) ?? [],
        dateStart,
        dateEnd,
      ),
      adsets,
    }
  })

  return {
    total: aggregateMetrics(byDate),
    ...seriesFromByDate(byDate, dateStart, dateEnd),
    byCampaign,
  }
}
