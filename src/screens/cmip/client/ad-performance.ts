/**
 * "광고 성과" 탭 계산(순수 함수) — Monday 고객의 utm_campaign(Meta 광고
 * 이름)을 Meta 광고 단위 데이터와 맞춰, 광고 → 광고셋 → 캠페인별로 유효
 * 리드·오기입·방문체험 예약·결제 전환·귀속 매출을 광고비와 나란히 놓는다
 * (주간 매체 성과표 R2 — 공통 정의 D1~D4).
 *
 * 귀속 매출은 ROAS 탭의 하한(attributedFirstPurchase)과 같다: UTM 상담 접수일
 * 이후 90일 안의 첫 구매만, 그 결제일이 조회 기간 안이면 센다. 그래서 이
 * 탭의 귀속 매출 합계(이름을 못 찾은 것 포함)는 하한의 Meta 매출과 같다.
 * 방문체험 예약·결제 전환은 리드 쪽에서 센다 — 조회 기간에 들어온 유효 리드
 * 중 리드일부터 90일 안에 예약·첫 구매를 한 사람.
 */
import type { ISODate } from '../types'
import {
  AD_ATTRIBUTION_DAYS,
  attributedFirstPurchase,
  convertedWithin,
  visitBookedWithin,
  type AttributionRow,
  type PurchaseScope,
} from './attribution-client'
import type { LeadQualityRow } from './lead-quality-client'
import type { MetaAdInsights } from './meta-ads-client'

export interface AdPerformanceMetrics {
  spend: number
  impressions: number
  clicks: number
  /** 유효 리드(공통 정의 D1) — 조회 기간에 처음 UTM 상담이 접수된 고객 수
   * (오기입 고객 제외). 같은 이름의 광고가 여럿이면 나눠 가져서 소수일 수
   * 있다. */
  leads: number
  /** 조회 기간에 귀속 첫 구매를 한 고객 수(소수일 수 있다). */
  buyers: number
  revenue: number
  /** 유효 리드 중 리드일부터 90일 안에 방문체험을 예약한 사람. */
  visitBooked: number
  /** 유효 리드 중 리드일부터 90일 안에 (구매 범위의) 첫 구매를 한 사람 —
   * 결제 전환(공통 정의 D3·D4). */
  converted: number
  /** 조회 기간에 접수된 UTM 상담 수(오기입·재문의 포함), 그중 판정이 끝난
   * 상담, 그중 오기입 — 오기입률(공통 정의 D2)의 재료. */
  consultations: number
  decided: number
  misentry: number
}

export interface AdPerformanceNode extends AdPerformanceMetrics {
  id: string
  name: string
  children: AdPerformanceNode[]
}

/** Meta 광고 이름으로 찾지 못한 utm_campaign 값 — 광고 이름이 바뀌었거나,
 * 수집 기간 밖에서만 돌았거나, utm에 다른 값을 넣은 경우다. */
export interface UnmatchedUtm extends Omit<
  AdPerformanceMetrics,
  'spend' | 'impressions' | 'clicks'
> {
  utmCampaign: string
}

/** 하루치 합계 — 광고비는 그날 쓴 돈, 문의는 그날 접수된 상담, 구매·매출은
 * 그날 결제된 귀속 첫 구매(합계 total과 같은 기준, 광고를 찾은 것만). */
export interface AdPerformanceDay {
  date: ISODate
  spend: number
  leads: number
  buyers: number
  revenue: number
}

export interface AdPerformance {
  campaigns: AdPerformanceNode[]
  total: AdPerformanceMetrics
  /** 조회 기간의 날짜마다(빈 날은 0) — 위 숫자 칸의 작은 추이 그래프. */
  daily: AdPerformanceDay[]
  unmatched: UnmatchedUtm[]
  unmatchedTotal: Omit<UnmatchedUtm, 'utmCampaign'>
}

/** 광고 이름 비교용 — 대소문자·공백 차이는 같은 이름으로 본다. */
const normalizeName = (name: string): string =>
  name.toLowerCase().replace(/\s+/g, '')

const minusDays = (date: ISODate, days: number): ISODate =>
  new Date(Date.parse(date) - days * 86_400_000).toISOString().slice(0, 10)

/** start ~ end 날짜 목록. */
const daysBetween = (start: ISODate, end: ISODate): ISODate[] => {
  const out: ISODate[] = []
  for (let day = start; day <= end; day = minusDays(day, -1)) out.push(day)
  return out
}

/** 리드 쪽 숫자(광고비·노출·클릭 빼고 전부) — 나눠 더할 때 쓴다. */
type LeadCounts = Omit<UnmatchedUtm, 'utmCampaign'>

const emptyLeadCounts = (): LeadCounts => ({
  leads: 0,
  buyers: 0,
  revenue: 0,
  visitBooked: 0,
  converted: 0,
  consultations: 0,
  decided: 0,
  misentry: 0,
})

const emptyMetrics = (): AdPerformanceMetrics => ({
  spend: 0,
  impressions: 0,
  clicks: 0,
  ...emptyLeadCounts(),
})

const LEAD_KEYS: readonly (keyof LeadCounts)[] = [
  'leads',
  'buyers',
  'revenue',
  'visitBooked',
  'converted',
  'consultations',
  'decided',
  'misentry',
]

/** source의 리드 쪽 숫자에 weight를 곱해 target에 더한다. */
const addLeadCounts = (
  target: LeadCounts,
  source: Partial<LeadCounts>,
  weight = 1,
): void => {
  for (const key of LEAD_KEYS) target[key] += (source[key] ?? 0) * weight
}

const addInto = (
  target: AdPerformanceMetrics,
  source: AdPerformanceMetrics,
): void => {
  target.spend += source.spend
  target.impressions += source.impressions
  target.clicks += source.clicks
  addLeadCounts(target, source)
}

const isActive = (m: AdPerformanceMetrics) =>
  m.spend > 0 || m.leads > 0 || m.buyers > 0 || m.consultations > 0

const byRevenueThenSpend = (a: AdPerformanceNode, b: AdPerformanceNode) =>
  b.revenue - a.revenue || b.spend - a.spend || a.name.localeCompare(b.name)

/**
 * @param ads 조회 시작 89일 전부터 끝까지의 광고 단위 데이터 — 기간 앞쪽의
 *   구매는 그 전에 접수된 상담에서 왔을 수 있어서, 상담일 무렵 어느 광고가
 *   돌았는지 보려면 그만큼 앞까지 필요하다. 광고비는 [start, end]만 센다.
 * @param quality 상담 접수일이 [start, end]인 UTM 상담 수(오기입률 재료) —
 *   아직 못 받았으면 null(오기입률 칸이 0건으로 남는다).
 * @param scope 결제 전환을 셀 구매 범위.
 */
export function buildAdPerformance(
  rows: readonly AttributionRow[],
  ads: MetaAdInsights,
  start: ISODate,
  end: ISODate,
  quality: readonly LeadQualityRow[] | null = null,
  scope: PurchaseScope = 'all',
): AdPerformance {
  const metrics = ads.ads.map(emptyMetrics)
  const daily = new Map<ISODate, AdPerformanceDay>(
    daysBetween(start, end).map((date) => [
      date,
      { date, spend: 0, leads: 0, buyers: 0, revenue: 0 },
    ]),
  )
  // 광고별 날짜별 광고비 — 같은 이름의 광고가 여럿일 때 나눌 비율로 쓴다.
  const spendByDay = ads.ads.map(() => new Map<ISODate, number>())
  for (const [index, date, spend, impressions, clicks] of ads.daily) {
    spendByDay[index].set(date, spend)
    if (date < start || date > end) continue
    metrics[index].spend += spend
    const day = daily.get(date)
    if (day) day.spend += spend
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

  // 광고 이름으로 못 찾은 utm_campaign — 대소문자·공백만 다른 값은 한 줄로.
  const unmatched = new Map<string, UnmatchedUtm>()
  const addUnmatched = (utmCampaign: string, counts: Partial<LeadCounts>) => {
    const name = utmCampaign.trim() || '(utm_campaign 없음)'
    const key = normalizeName(name)
    const entry = unmatched.get(key) ?? {
      utmCampaign: name,
      ...emptyLeadCounts(),
    }
    addLeadCounts(entry, counts)
    unmatched.set(key, entry)
  }

  for (const row of rows) {
    if (row[1] !== 'meta') continue
    const utmAt = row[4] || row[0]
    const lead = utmAt >= start && utmAt <= end ? 1 : 0
    const first = attributedFirstPurchase(row)
    const bought = first !== null && first[0] >= start && first[0] <= end
    if (!lead && !bought) continue
    const counts: Partial<LeadCounts> = {
      leads: lead,
      buyers: bought ? 1 : 0,
      revenue: bought ? first[1] : 0,
      // 리드 쪽 — 이 기간에 들어온 리드만.
      visitBooked: lead && visitBookedWithin(row, AD_ATTRIBUTION_DAYS) ? 1 : 0,
      converted:
        lead && convertedWithin(row, scope, AD_ATTRIBUTION_DAYS) ? 1 : 0,
    }

    const utmCampaign = row[5] ?? ''
    const candidates = utmCampaign
      ? adsByName.get(normalizeName(utmCampaign))
      : undefined
    if (!candidates) {
      addUnmatched(utmCampaign, counts)
      continue
    }
    // 광고를 찾은 것만 하루치에 — 합계(total)와 같은 기준.
    const leadDay = lead ? daily.get(utmAt) : undefined
    if (leadDay) leadDay.leads += lead
    const buyDay = bought ? daily.get(first[0]) : undefined
    if (buyDay) {
      buyDay.buyers += counts.buyers ?? 0
      buyDay.revenue += counts.revenue ?? 0
    }
    weightsFor(candidates, utmAt).forEach((weight, i) =>
      addLeadCounts(metrics[candidates[i]], counts, weight),
    )
  }

  // 오기입률 재료 — 상담 한 건 단위(번호를 못 읽은 상담 포함)라 고객 단위인
  // 위와 따로 센다. 광고는 같은 방법(이름, 상담일 광고비 비율)으로 찾는다.
  for (const [
    date,
    channel,
    utmCampaign,
    total,
    decided,
    misentry,
  ] of quality ?? []) {
    if (channel !== 'meta' || date < start || date > end) continue
    const counts: Partial<LeadCounts> = {
      consultations: total,
      decided,
      misentry,
    }
    const candidates = utmCampaign
      ? adsByName.get(normalizeName(utmCampaign))
      : undefined
    if (!candidates) {
      addUnmatched(utmCampaign, counts)
      continue
    }
    weightsFor(candidates, date).forEach((weight, i) =>
      addLeadCounts(metrics[candidates[i]], counts, weight),
    )
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
    (a, b) =>
      b.revenue - a.revenue ||
      b.leads - a.leads ||
      b.consultations - a.consultations,
  )
  const unmatchedTotal = emptyLeadCounts()
  for (const entry of unmatchedList) addLeadCounts(unmatchedTotal, entry)
  return {
    campaigns: sorted,
    total,
    daily: [...daily.values()],
    unmatched: unmatchedList,
    unmatchedTotal,
  }
}
