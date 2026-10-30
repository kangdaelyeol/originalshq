/**
 * 캠페인·광고셋 탭 맨 위의 요약 카드(순수 함수) — 캠페인 또는 광고셋 단위로
 * 조회 기간 합계를 내서, 지표마다 양쪽 끝 TOP 5와 분포(매긴 값 전부·중앙값)를
 * 낸다.
 *
 *   · 광고비 — 광고비를 쓴 광고셋 중 많은 순 / 적은 순, 전체 대비 비중.
 *   · 문의 단가 — 전환 목표가 문의인 Meta 광고셋 중 문의 3건 이상, 낮은 순 /
 *     높은 순.
 *   · 클릭 단가(CPC) — 클릭 50회 이상, 낮은 순 / 높은 순(모든 매체).
 *   · CPM — 노출 1,000회 이상, 낮은 순 / 높은 순(모든 매체).
 *
 * 전환 목표(결과 유형)는 Meta 캠페인에만 있어서, 문의 단가는 Meta 캠페인·광고셋만
 * 본다(Google·네이버 전환은 무엇을 센 것인지 알 수 없다). 캠페인마다 전환
 * 목표가 달라(문의·장바구니·랜딩 조회) 목표가 다른 전환끼리 단가를 비교하지
 * 않기 위해서다. 건수가 너무 적은 광고셋은 단가가 우연히 튀어서 뺀다.
 */
import { aggregateMetrics } from './insight-aggregate'
import type { CombinedCampaign } from './insight-channel-combine'
import type { MetricsSummary } from './insight-client'

export type CampaignHighlightLevel = 'campaign' | 'adset'

/** 캠페인·광고셋 탭의 선택 키 — 캠페인은 "c:캠페인", 광고셋은
 * "a:캠페인::광고셋". 이름이 같은 광고셋이 여러 캠페인에 있어서 광고셋은
 * 캠페인까지 붙여 구분한다. */
export const campaignKey = (campaignName: string) => `c:${campaignName}`
export const adsetKey = (campaignName: string, adsetName: string) =>
  `a:${campaignName}::${adsetName}`

export interface CampaignHighlightRow {
  /** 목록 표의 선택 키(campaignKey/adsetKey 모양) — 누르면 이 줄을 체크한다. */
  selectKey: string
  campaignName: string
  /** 광고셋 단위일 때만 있다. */
  adsetName: string | null
  /** 이름 아래 작은 줄 — 광고셋이면 소속 캠페인, 캠페인이면 광고셋 수. */
  name: string
  sub: string
  /** 매긴 값(막대 길이) — value는 그 값을 단위까지 붙여 쓴 것. */
  amount: number
  value: string
  note: string
}

/** 요약의 지표 네 개 — 광고비, 문의 단가, CPC, CPM. */
export type CampaignHighlightMetric = 'spend' | 'cpa' | 'cpc' | 'cpm'

/** 한 지표로 매긴 결과 — 양쪽 끝 TOP 5와, 분포를 그릴 매긴 값 전부. */
export interface CampaignHighlightGroup {
  low: CampaignHighlightRow[]
  high: CampaignHighlightRow[]
  /** 매긴 값 전부(작은 순) — 분포 띠. */
  values: number[]
  median: number
}

export type CampaignHighlights = Record<
  CampaignHighlightMetric,
  CampaignHighlightGroup
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

interface EntityFacts {
  selectKey: string
  campaignName: string
  adsetName: string | null
  name: string
  sub: string
  inquiryGoal: boolean
  metrics: MetricsSummary
}

/** 한 지표로 매긴 광고셋 묶음 — 같은 묶음에서 앞(낮은 순)·뒤(높은 순) 5개씩. */
const rankBoth = (
  adsets: readonly EntityFacts[],
  include: (a: EntityFacts) => boolean,
  valueOf: (a: EntityFacts) => number,
  format: (a: EntityFacts, value: number) => { value: string; note: string },
): CampaignHighlightGroup => {
  const ranked = adsets
    .filter(include)
    .map((a) => ({ a, value: valueOf(a) }))
    .sort((x, y) => x.value - y.value)
  const toRow = ({ a, value }: { a: EntityFacts; value: number }) => ({
    selectKey: a.selectKey,
    campaignName: a.campaignName,
    adsetName: a.adsetName,
    name: a.name,
    sub: a.sub,
    amount: value,
    ...format(a, value),
  })
  const values = ranked.map((r) => r.value)
  const mid = values.length >> 1
  return {
    low: ranked.slice(0, LIMIT).map(toRow),
    high: ranked.slice(-LIMIT).reverse().map(toRow),
    values,
    median: values.length
      ? values.length % 2
        ? values[mid]
        : (values[mid - 1] + values[mid]) / 2
      : 0,
  }
}

export function buildCampaignHighlights(
  campaigns: readonly CombinedCampaign[],
  level: CampaignHighlightLevel,
): CampaignHighlights {
  const adsets: EntityFacts[] =
    level === 'campaign'
      ? campaigns.map((c) => ({
          selectKey: campaignKey(c.campaignName),
          campaignName: c.campaignName,
          adsetName: null,
          name: c.campaignName,
          sub: `광고셋 ${c.adsets.length}개`,
          inquiryGoal: isInquiryGoal(c.resultType),
          metrics: aggregateMetrics(c.combined.byDate),
        }))
      : campaigns.flatMap((c) =>
          c.adsets.map((a) => ({
            selectKey: adsetKey(c.campaignName, a.adsetName),
            campaignName: c.campaignName,
            adsetName: a.adsetName,
            name: a.adsetName,
            sub: c.campaignName,
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

  return { spend, cpa, cpc, cpm }
}
