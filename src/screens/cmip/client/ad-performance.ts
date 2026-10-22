/**
 * "광고 성과" 탭 계산(순수 함수) — Monday 고객의 utm_campaign(Meta 광고
 * 이름)을 Meta 광고 단위 데이터와 맞춰, 광고 → 광고셋 → 캠페인별로 문의
 * 고객·구매 고객·귀속 매출을 광고비와 나란히 놓는다.
 *
 * 귀속 규칙은 ROAS 탭의 하한(attributedFirstPurchase)과 같다: UTM 상담 접수일
 * 이후 90일 안의 첫 구매만, 그 결제일이 조회 기간 안이면 센다. 그래서 이
 * 탭의 귀속 매출 합계(이름을 못 찾은 것 포함)는 하한의 Meta 매출과 같다.
 */
import type { ISODate } from '../types'
import {
  attributedFirstPurchase,
  type AttributionRow,
} from './attribution-client'
import type { MetaAdInsights } from './meta-ads-client'

export interface AdPerformanceMetrics {
  spend: number
  impressions: number
  clicks: number
  /** 조회 기간에 UTM 상담이 접수된 고객 수. 같은 이름의 광고가 여럿이면
   * 나눠 가져서 소수일 수 있다. */
  leads: number
  /** 조회 기간에 귀속 첫 구매를 한 고객 수(소수일 수 있다). */
  buyers: number
  revenue: number
}

export interface AdPerformanceNode extends AdPerformanceMetrics {
  id: string
  name: string
  children: AdPerformanceNode[]
}

/** Meta 광고 이름으로 찾지 못한 utm_campaign 값 — 광고 이름이 바뀌었거나,
 * 수집 기간 밖에서만 돌았거나, utm에 다른 값을 넣은 경우다. */
export interface UnmatchedUtm {
  utmCampaign: string
  leads: number
  buyers: number
  revenue: number
}

export interface AdPerformance {
  campaigns: AdPerformanceNode[]
  total: AdPerformanceMetrics
  unmatched: UnmatchedUtm[]
  unmatchedTotal: Omit<UnmatchedUtm, 'utmCampaign'>
}

/** 광고 이름 비교용 — 대소문자·공백 차이는 같은 이름으로 본다. */
const normalizeName = (name: string): string =>
  name.toLowerCase().replace(/\s+/g, '')

const minusDays = (date: ISODate, days: number): ISODate =>
  new Date(Date.parse(date) - days * 86_400_000).toISOString().slice(0, 10)

const emptyMetrics = (): AdPerformanceMetrics => ({
  spend: 0,
  impressions: 0,
  clicks: 0,
  leads: 0,
  buyers: 0,
  revenue: 0,
})

const addInto = (
  target: AdPerformanceMetrics,
  source: AdPerformanceMetrics,
): void => {
  target.spend += source.spend
  target.impressions += source.impressions
  target.clicks += source.clicks
  target.leads += source.leads
  target.buyers += source.buyers
  target.revenue += source.revenue
}

const isActive = (m: AdPerformanceMetrics) =>
  m.spend > 0 || m.leads > 0 || m.buyers > 0

const byRevenueThenSpend = (a: AdPerformanceNode, b: AdPerformanceNode) =>
  b.revenue - a.revenue || b.spend - a.spend || a.name.localeCompare(b.name)

/**
 * @param ads 조회 시작 89일 전부터 끝까지의 광고 단위 데이터 — 기간 앞쪽의
 *   구매는 그 전에 접수된 상담에서 왔을 수 있어서, 상담일 무렵 어느 광고가
 *   돌았는지 보려면 그만큼 앞까지 필요하다. 광고비는 [start, end]만 센다.
 */
export function buildAdPerformance(
  rows: readonly AttributionRow[],
  ads: MetaAdInsights,
  start: ISODate,
  end: ISODate,
): AdPerformance {
  const metrics = ads.ads.map(emptyMetrics)
  // 광고별 날짜별 광고비 — 같은 이름의 광고가 여럿일 때 나눌 비율로 쓴다.
  const spendByDay = ads.ads.map(() => new Map<ISODate, number>())
  for (const [index, date, spend, impressions, clicks] of ads.daily) {
    spendByDay[index].set(date, spend)
    if (date < start || date > end) continue
    metrics[index].spend += spend
    metrics[index].impressions += impressions
    metrics[index].clicks += clicks
  }

  const adsByName = new Map<string, number[]>()
  ads.ads.forEach((ad, index) => {
    const key = normalizeName(ad.name)
    adsByName.set(key, [...(adsByName.get(key) ?? []), index])
  })

  /** 상담일에 광고비를 쓴 광고의 비율로 나눈다. 그날 쓴 곳이 없으면 그 전
   * 7일, 그래도 없으면 전체 기간 광고비, 그마저 없으면 똑같이 나눈다. */
  const weightsFor = (candidates: number[], day: ISODate): number[] => {
    const spendIn = (from: ISODate, to: ISODate) =>
      candidates.map((index) =>
        [...spendByDay[index]].reduce(
          (sum, [date, spend]) =>
            date >= from && date <= to ? sum + spend : sum,
          0,
        ),
      )
    for (const spends of [
      spendIn(day, day),
      spendIn(minusDays(day, 7), day),
      spendIn('0000-00-00', '9999-99-99'),
    ]) {
      const total = spends.reduce((a, b) => a + b, 0)
      if (total > 0) return spends.map((spend) => spend / total)
    }
    return candidates.map(() => 1 / candidates.length)
  }

  const unmatched = new Map<string, UnmatchedUtm>()
  for (const row of rows) {
    if (row[1] !== 'meta') continue
    const utmAt = row[4] || row[0]
    const lead = utmAt >= start && utmAt <= end ? 1 : 0
    const first = attributedFirstPurchase(row)
    const bought = first !== null && first[0] >= start && first[0] <= end
    if (!lead && !bought) continue
    const revenue = bought ? first[1] : 0
    const buyer = bought ? 1 : 0

    const utmCampaign = row[5] ?? ''
    const candidates = utmCampaign
      ? adsByName.get(normalizeName(utmCampaign))
      : undefined
    if (!candidates) {
      const key = utmCampaign || '(utm_campaign 없음)'
      const entry = unmatched.get(key) ?? {
        utmCampaign: key,
        leads: 0,
        buyers: 0,
        revenue: 0,
      }
      entry.leads += lead
      entry.buyers += buyer
      entry.revenue += revenue
      unmatched.set(key, entry)
      continue
    }
    weightsFor(candidates, utmAt).forEach((weight, i) => {
      const target = metrics[candidates[i]]
      target.leads += lead * weight
      target.buyers += buyer * weight
      target.revenue += revenue * weight
    })
  }

  // 광고 → 광고셋 → 캠페인으로 묶는다.
  const campaigns = new Map<string, AdPerformanceNode>()
  const adsets = new Map<string, AdPerformanceNode>()
  ads.ads.forEach((ad, index) => {
    const m = metrics[index]
    if (!isActive(m)) return
    let campaign = campaigns.get(ad.campaignId)
    if (!campaign) {
      campaign = {
        id: ad.campaignId,
        name: ad.campaignName,
        children: [],
        ...emptyMetrics(),
      }
      campaigns.set(ad.campaignId, campaign)
    }
    let adset = adsets.get(ad.adsetId)
    if (!adset) {
      adset = {
        id: ad.adsetId,
        name: ad.adsetName,
        children: [],
        ...emptyMetrics(),
      }
      adsets.set(ad.adsetId, adset)
      campaign.children.push(adset)
    }
    adset.children.push({ id: ad.id, name: ad.name, children: [], ...m })
    addInto(adset, m)
    addInto(campaign, m)
  })

  const sorted = [...campaigns.values()].sort(byRevenueThenSpend)
  for (const campaign of sorted) {
    campaign.children.sort(byRevenueThenSpend)
    for (const adset of campaign.children)
      adset.children.sort(byRevenueThenSpend)
  }

  const total = emptyMetrics()
  for (const campaign of sorted) addInto(total, campaign)
  const unmatchedList = [...unmatched.values()].sort(
    (a, b) => b.revenue - a.revenue || b.leads - a.leads,
  )
  return {
    campaigns: sorted,
    total,
    unmatched: unmatchedList,
    unmatchedTotal: {
      leads: unmatchedList.reduce((s, u) => s + u.leads, 0),
      buyers: unmatchedList.reduce((s, u) => s + u.buyers, 0),
      revenue: unmatchedList.reduce((s, u) => s + u.revenue, 0),
    },
  }
}
