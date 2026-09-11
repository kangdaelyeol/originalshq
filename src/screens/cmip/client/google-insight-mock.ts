/**
 * 구글 인사이트 API 목업 — 토큰 발급이 끝나기 전까지, getAllInsights와 동일한 모양
 * (MetaInsightSummary, byCampaign 포함)의 테스트 데이터를 프론트에서 만들어 대신
 * 쓴다. Functions 쪽은 건드리지 않는다 — 나중에 실제 연동이 끝나면 이 파일 호출부만
 * 진짜 API로 바꾸면 된다.
 *
 * byDate/byDayOfWeek/byGroupedWeek 집계, 지표 합산 규칙은 ./insight-aggregate의
 * 표준 함수를 그대로 쓴다 — Meta+Google을 나중에 합칠 때(insight-channel-combine)
 * 서로 다른 집계 방식 때문에 어긋나지 않도록.
 */
import { dateRange } from '../utils'
import type { ISODate } from '../types'
import {
  aggregateMetrics,
  deriveMetrics,
  seriesFromByDate,
} from './insight-aggregate'
import type {
  AdsetSummary,
  CampaignSummary,
  DateSummary,
  MetaInsightSummary,
  MetricsSummary,
} from './insight-client'

// "구글 광고 연동" 시점을 흉내낸 목업 데이터 보유 범위 — 이 밖의 날짜는 데이터가 없다.
const MOCK_MIN_DATE: ISODate = '2026-08-13'
const MOCK_MAX_DATE: ISODate = '2026-09-11'

// 캠페인/adset 구조를 흉내낸 고정 목업 트리 — 실제 계정 구조를 반영한 건 아니다.
const MOCK_CAMPAIGNS: readonly { name: string; adsets: readonly string[] }[] = [
  { name: 'Search_브랜드', adsets: ['브랜드_PC', '브랜드_Mobile'] },
  { name: 'PMax_전환', adsets: ['PMax_전체상품', 'PMax_신상품'] },
  { name: 'Display_리타겟팅', adsets: ['리타겟팅_7일', '리타겟팅_30일'] },
]

/** 날짜 문자열을 시드로 매번 같은 값을 내는 간단한 PRNG(mulberry32) — 같은 기간을
 * 다시 조회해도 값이 안 흔들리게 한다. */
function seededRandom(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const range = (rand: () => number, min: number, max: number) =>
  min + rand() * (max - min)

/** 하루치 계정 전체 지표를 만든다 — impressions/ctr/cpc/cvr을 먼저 정하고 나머지
 * (clicks/spend/conversions/cpa/cpm)를 그로부터 계산해 서로 어긋나지 않게 한다. */
function mockDailyMetrics(date: ISODate): MetricsSummary {
  const rand = seededRandom(`google:${date}`)
  const impressions = Math.round(range(rand, 6000, 22000))
  const ctr = range(rand, 1.2, 4.5)
  const clicks = Math.round((impressions * ctr) / 100)
  const cpc = range(rand, 180, 520)
  const spend = Math.round(clicks * cpc)
  const cvr = range(rand, 2.5, 9)
  const conversions = Math.round((clicks * cvr) / 100)
  return deriveMetrics({
    impressions,
    clicks,
    spend,
    conversions,
    weightedFrequency: range(rand, 1.05, 2.8) * impressions,
  })
}

/** 합이 1이 되는 n개의 비중 — 한쪽으로 너무 쏠리지 않게 최소치를 둔다. */
function splitWeights(rand: () => number, n: number): number[] {
  const raw = Array.from({ length: n }, () => 0.4 + rand() * 0.6)
  const total = raw.reduce((s, v) => s + v, 0)
  return raw.map((v) => v / total)
}

/** 상위 지표를 weight 비율만큼 잘라낸 부분 지표 — 원본 카운트를 비례 배분하고
 * 비율/도수는 그로부터 다시 계산(도수는 상위 값에 근접하게 유지). */
function splitMetrics(base: MetricsSummary, weight: number): MetricsSummary {
  const impressions = Math.round(base.impressions * weight)
  const clicks = Math.round(base.clicks * weight)
  const spend = Math.round(base.spend * weight)
  const conversions = Math.round(base.conversions * weight)
  return deriveMetrics({
    impressions,
    clicks,
    spend,
    conversions,
    weightedFrequency: base.frequency * impressions,
  })
}

/** 날짜별 계정 전체 지표를 캠페인 → adset 순으로 비례 배분해 목업 트리를 만든다. */
function mockCampaigns(dates: readonly ISODate[]): CampaignSummary[] {
  const campaignRows = new Map<string, DateSummary[]>(
    MOCK_CAMPAIGNS.map((c) => [c.name, []]),
  )
  const adsetRows = new Map<string, DateSummary[]>()

  for (const date of dates) {
    const dayMetrics = mockDailyMetrics(date)
    const campaignWeights = splitWeights(
      seededRandom(`google:campaign-weight:${date}`),
      MOCK_CAMPAIGNS.length,
    )

    MOCK_CAMPAIGNS.forEach((campaign, ci) => {
      const campaignMetrics = splitMetrics(dayMetrics, campaignWeights[ci])
      campaignRows.get(campaign.name)?.push({ date, ...campaignMetrics })

      const adsetWeights = splitWeights(
        seededRandom(`google:adset-weight:${date}:${campaign.name}`),
        campaign.adsets.length,
      )
      campaign.adsets.forEach((adsetName, ai) => {
        const key = `${campaign.name}::${adsetName}`
        const adsetMetrics = splitMetrics(campaignMetrics, adsetWeights[ai])
        const rows = adsetRows.get(key)
        if (rows) rows.push({ date, ...adsetMetrics })
        else adsetRows.set(key, [{ date, ...adsetMetrics }])
      })
    })
  }

  return MOCK_CAMPAIGNS.map((campaign) => {
    const adsets: AdsetSummary[] = campaign.adsets.map((adsetName) => ({
      adsetName,
      ...seriesFromByDate(
        adsetRows.get(`${campaign.name}::${adsetName}`) ?? [],
      ),
    }))
    return {
      campaignName: campaign.name,
      ...seriesFromByDate(campaignRows.get(campaign.name) ?? []),
      adsets,
    }
  })
}

/**
 * getAllInsights와 같은 모양(MetaInsightSummary, byCampaign 포함)의 구글 인사이트
 * 목업. 조회 범위와 목업 보유 범위(MOCK_MIN_DATE~MOCK_MAX_DATE)가 겹치는 구간만
 * 데이터를 만든다 — 실제 API도 연동 시작일 이전은 데이터가 없을 것이기 때문.
 */
export async function getGoogleInsightsMock(
  dateStart: ISODate,
  dateEnd: ISODate,
): Promise<MetaInsightSummary> {
  const from = dateStart < MOCK_MIN_DATE ? MOCK_MIN_DATE : dateStart
  const to = dateEnd > MOCK_MAX_DATE ? MOCK_MAX_DATE : dateEnd

  if (from > to) {
    return {
      total: aggregateMetrics([]),
      byDate: [],
      byDayOfWeek: [],
      byGroupedWeek: [],
      byCampaign: [],
    }
  }

  const dates = dateRange(from, to)
  const byDate: DateSummary[] = dates.map((date) => ({
    date,
    ...mockDailyMetrics(date),
  }))

  return {
    total: aggregateMetrics(byDate),
    ...seriesFromByDate(byDate),
    byCampaign: mockCampaigns(dates),
  }
}
