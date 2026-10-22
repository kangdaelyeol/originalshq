/**
 * 캠페인·광고셋 탭 맨 위의 요약 카드(순수 함수) — 광고셋 단위로 조회 기간
 * 합계를 내서, 지표마다 양쪽 끝 TOP 5를 고른다(8개).
 *
 *   · 광고비 — 광고비를 쓴 광고셋 중 많은 순 / 적은 순, 전체 대비 비중.
 *   · 문의 단가 — 전환 목표가 문의인 Meta 광고셋 중 문의 3건 이상, 낮은 순 /
 *     높은 순.
 *   · 클릭 단가(CPC) — 클릭 50회 이상, 낮은 순 / 높은 순(모든 매체).
 *   · CPM — 노출 1,000회 이상, 낮은 순 / 높은 순(모든 매체).
 *
 * 전환 목표(결과 유형)는 Meta 캠페인에만 있어서, 문의 단가는 Meta 광고셋만
 * 본다(Google·네이버 전환은 무엇을 센 것인지 알 수 없다). 캠페인마다 전환
 * 목표가 달라(문의·장바구니·랜딩 조회) 목표가 다른 전환끼리 단가를 비교하지
 * 않기 위해서다. 건수가 너무 적은 광고셋은 단가가 우연히 튀어서 뺀다.
 */
import { aggregateMetrics } from './insight-aggregate'
import type { CombinedCampaign } from './insight-channel-combine'
import type { MetricsSummary } from './insight-client'

export interface CampaignHighlightRow {
  campaignName: string
  adsetName: string
  value: string
  note: string
}

export type CampaignHighlightKey =
  | 'spendHigh'
  | 'spendLow'
  | 'cpaLow'
  | 'cpaHigh'
  | 'cpcLow'
  | 'cpcHigh'
  | 'cpmLow'
  | 'cpmHigh'

export type CampaignHighlights = Record<
  CampaignHighlightKey,
  CampaignHighlightRow[]
>

const LIMIT = 5
/** 문의 단가를 매기는 최소 문의 수 — 1~2건은 우연이 커서 뺀다. */
const MIN_INQUIRIES = 3
/** 클릭 단가를 매기는 최소 클릭 수. */
const MIN_CLICKS = 50
/** CPM을 매기는 최소 노출 수. */
const MIN_IMPRESSIONS = 1000

const won = (v: number) => `${Math.round(v).toLocaleString()}원`
const count = (v: number) => Math.round(v).toLocaleString()

/** 전환 목표가 문의인지 — Meta 결과 유형("conversions:contact_website",
 * "lead" 등)으로 판단한다. */
export const isInquiryGoal = (resultType: string | null | undefined) =>
  !!resultType && /contact|lead/i.test(resultType)

interface AdsetFacts {
  campaignName: string
  adsetName: string
  inquiryGoal: boolean
  metrics: MetricsSummary
}

/** 한 지표로 매긴 광고셋 묶음 — 같은 묶음에서 앞(낮은 순)·뒤(높은 순) 5개씩. */
const rankBoth = (
  adsets: readonly AdsetFacts[],
  include: (a: AdsetFacts) => boolean,
  valueOf: (a: AdsetFacts) => number,
  format: (a: AdsetFacts, value: number) => { value: string; note: string },
): { low: CampaignHighlightRow[]; high: CampaignHighlightRow[] } => {
  const ranked = adsets
    .filter(include)
    .map((a) => ({ a, value: valueOf(a) }))
    .sort((x, y) => x.value - y.value)
  const toRow = ({ a, value }: { a: AdsetFacts; value: number }) => ({
    campaignName: a.campaignName,
    adsetName: a.adsetName,
    ...format(a, value),
  })
  return {
    low: ranked.slice(0, LIMIT).map(toRow),
    high: ranked.slice(-LIMIT).reverse().map(toRow),
  }
}

export function buildCampaignHighlights(
  campaigns: readonly CombinedCampaign[],
): CampaignHighlights {
  const adsets: AdsetFacts[] = campaigns.flatMap((c) =>
    c.adsets.map((a) => ({
      campaignName: c.campaignName,
      adsetName: a.adsetName,
      inquiryGoal: isInquiryGoal(c.resultType),
      metrics: aggregateMetrics(a.combined.byDate),
    })),
  )
  const totalSpend = adsets.reduce((sum, a) => sum + a.metrics.spend, 0)
  const share = (spend: number) => {
    if (totalSpend <= 0) return ''
    const pct = (spend / totalSpend) * 100
    return pct < 0.1 ? '전체의 0.1% 미만' : `전체의 ${pct.toFixed(1)}%`
  }

  const spend = rankBoth(
    adsets,
    (a) => a.metrics.spend > 0,
    (a) => a.metrics.spend,
    (_, v) => ({ value: won(v), note: share(v) }),
  )
  const cpa = rankBoth(
    adsets,
    (a) => a.inquiryGoal && a.metrics.conversions >= MIN_INQUIRIES,
    (a) => a.metrics.spend / a.metrics.conversions,
    (a, v) => ({
      value: won(v),
      note: `문의 ${count(a.metrics.conversions)}건`,
    }),
  )
  const cpc = rankBoth(
    adsets,
    (a) => a.metrics.clicks >= MIN_CLICKS && a.metrics.spend > 0,
    (a) => a.metrics.spend / a.metrics.clicks,
    (a, v) => ({ value: won(v), note: `클릭 ${count(a.metrics.clicks)}회` }),
  )
  const cpm = rankBoth(
    adsets,
    (a) => a.metrics.impressions >= MIN_IMPRESSIONS && a.metrics.spend > 0,
    (a) => (a.metrics.spend / a.metrics.impressions) * 1000,
    (a, v) => ({
      value: won(v),
      note: `노출 ${count(a.metrics.impressions)}회`,
    }),
  )

  return {
    spendHigh: spend.high,
    spendLow: spend.low,
    cpaLow: cpa.low,
    cpaHigh: cpa.high,
    cpcLow: cpc.low,
    cpcHigh: cpc.high,
    cpmLow: cpm.low,
    cpmHigh: cpm.high,
  }
}
