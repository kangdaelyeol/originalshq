/**
 * 캠페인·광고셋 탭 맨 위의 요약 카드(순수 함수) — 광고셋 단위로 조회 기간
 * 합계를 내서 네 가지 TOP 5를 고른다.
 *
 *   · 광고비 TOP — 광고비 큰 순, 전체 광고비 대비 비중.
 *   · 문의 단가 — 전환 목표가 문의인 광고셋 중 문의 3건 이상, 문의당 비용 낮은 순.
 *   · 클릭 단가 — 클릭 50회 이상인 광고셋, 클릭당 비용 낮은 순(모든 매체).
 *   · 문의 없이 광고비만 — 전환 목표가 문의인데 문의 0건, 광고비 큰 순.
 *
 * 전환 목표(결과 유형)는 Meta 캠페인에만 있어서, 문의 기준 두 카드는 Meta
 * 광고셋만 본다(Google·네이버 전환은 무엇을 센 것인지 알 수 없다). 캠페인마다
 * 전환 목표가 달라(문의·장바구니·랜딩 조회) 목표가 다른 전환끼리 단가를
 * 비교하지 않기 위해서다.
 */
import { aggregateMetrics } from './insight-aggregate'
import type { CombinedCampaign } from './insight-channel-combine'
import type { MetricsSummary } from './insight-client'

export interface CampaignHighlightRow {
  /** 목록 표의 캠페인 줄 key(펼치기용)와 광고셋 선택 키. */
  campaignName: string
  adsetName: string
  value: string
  note: string
}

export interface CampaignHighlights {
  topSpend: CampaignHighlightRow[]
  lowestCpa: CampaignHighlightRow[]
  lowestCpc: CampaignHighlightRow[]
  noInquirySpend: CampaignHighlightRow[]
}

const LIMIT = 5
/** 문의 단가를 매기는 최소 문의 수 — 1~2건은 우연이 커서 뺀다. */
const MIN_INQUIRIES = 3
/** 클릭 단가를 매기는 최소 클릭 수. */
const MIN_CLICKS = 50

const won = (v: number) => `${Math.round(v).toLocaleString()}원`

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
  const row = (a: AdsetFacts, value: string, note: string) => ({
    campaignName: a.campaignName,
    adsetName: a.adsetName,
    value,
    note,
  })

  const topSpend = adsets
    .filter((a) => a.metrics.spend > 0)
    .sort((a, b) => b.metrics.spend - a.metrics.spend)
    .slice(0, LIMIT)
    .map((a) =>
      row(
        a,
        won(a.metrics.spend),
        totalSpend > 0
          ? `전체의 ${((a.metrics.spend / totalSpend) * 100).toFixed(1)}%`
          : '',
      ),
    )

  const lowestCpa = adsets
    .filter((a) => a.inquiryGoal && a.metrics.conversions >= MIN_INQUIRIES)
    .map((a) => ({ a, cpa: a.metrics.spend / a.metrics.conversions }))
    .sort((x, y) => x.cpa - y.cpa)
    .slice(0, LIMIT)
    .map(({ a, cpa }) =>
      row(a, won(cpa), `문의 ${Math.round(a.metrics.conversions)}건`),
    )

  const lowestCpc = adsets
    .filter((a) => a.metrics.clicks >= MIN_CLICKS && a.metrics.spend > 0)
    .map((a) => ({ a, cpc: a.metrics.spend / a.metrics.clicks }))
    .sort((x, y) => x.cpc - y.cpc)
    .slice(0, LIMIT)
    .map(({ a, cpc }) =>
      row(a, won(cpc), `클릭 ${a.metrics.clicks.toLocaleString()}회`),
    )

  const noInquirySpend = adsets
    .filter(
      (a) =>
        a.inquiryGoal && a.metrics.conversions === 0 && a.metrics.spend > 0,
    )
    .sort((a, b) => b.metrics.spend - a.metrics.spend)
    .slice(0, LIMIT)
    .map((a) =>
      row(
        a,
        won(a.metrics.spend),
        `클릭 ${a.metrics.clicks.toLocaleString()}회`,
      ),
    )

  return { topSpend, lowestCpa, lowestCpc, noInquirySpend }
}
