/**
 * "광고 성과" 탭 계산(순수 함수) — Monday 고객의 utm_campaign을 매체마다
 * 광고비 데이터의 이름과 맞춰, 매체 → 캠페인 → 광고셋·광고그룹 → 광고별로
 * 유효 리드·오기입·방문체험 예약·결제 전환·귀속 매출을 광고비와 나란히
 * 놓는다(주간 매체 성과표 R2 — 공통 정의 D1~D4).
 *
 * 광고비가 있는 가장 작은 단위(잎)는 Meta는 광고, Google·네이버·OpenAI·당근은
 * 광고그룹이다. utm_campaign은 소재(광고) 이름 → 광고셋·광고그룹 이름 →
 * 캠페인 이름 순으로 찾는다 — Meta는 광고 이름이 들어오고, 다른 매체는 무엇이
 * 들어오는지 정해져 있지 않아 셋 다 본다(어느 이름으로 찾았는지 matches에
 * 센다). 여러 잎이 맞으면 상담일 광고비 비율로 나눈다.
 *
 * 귀속 매출은 ROAS 탭의 하한(attributedFirstPurchase)과 같다: UTM 상담 접수일
 * 이후 90일 안의 첫 구매만, 그 결제일이 조회 기간 안이면 센다. 방문체험
 * 예약·결제 전환은 리드 쪽에서 센다 — 조회 기간에 들어온 유효 리드 중
 * 리드일부터 90일 안에 예약·첫 구매를 한 사람.
 */
import type { ISODate } from '../types'
import type { ChannelAdGroups } from './ad-group-insights-client'
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

/** 광고비가 있는 매체 — 표의 맨 위 줄 순서. */
export const MEDIA_CHANNELS = [
  'meta',
  'google',
  'naver',
  'openai',
  'daangn',
] as const
export type MediaChannel = (typeof MEDIA_CHANNELS)[number]

export interface AdPerformanceMetrics {
  spend: number
  impressions: number
  clicks: number
  /** 유효 리드(공통 정의 D1) — 조회 기간에 처음 UTM 상담이 접수된 고객 수
   * (오기입 고객 제외). 여러 줄이 맞으면 나눠 가져서 소수일 수 있다. */
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

/** 표의 줄 종류 — 매체 > 캠페인 > 광고셋(Meta)·광고그룹(나머지) > 광고(Meta). */
export type AdPerformanceKind =
  'channel' | 'campaign' | 'adset' | 'adgroup' | 'ad'

export interface AdPerformanceNode extends AdPerformanceMetrics {
  /** 표 안에서 겹치지 않는 키 — 매체 줄은 매체 키 그대로. */
  id: string
  /** 매체 줄은 매체 키(이름은 화면이 붙인다). */
  name: string
  kind: AdPerformanceKind
  children: AdPerformanceNode[]
}

/** 리드 쪽 숫자(광고비·노출·클릭 빼고 전부). */
export type LeadCounts = Omit<
  AdPerformanceMetrics,
  'spend' | 'impressions' | 'clicks'
>

/** 그 매체의 이름으로 찾지 못한 utm_campaign 값 — 이름이 바뀌었거나, 수집
 * 기간 밖에서만 돌았거나, utm에 이름이 아닌 값이 들어간 경우다. */
export interface UnmatchedUtm extends LeadCounts {
  channel: MediaChannel
  utmCampaign: string
}

/** utm_campaign을 어느 이름으로 찾았는지 — 소재(광고), 광고셋·광고그룹,
 * 캠페인, 못 찾음. */
export type MatchLevel = 'ad' | 'group' | 'campaign' | 'none'
export const MATCH_LEVELS: readonly MatchLevel[] = [
  'ad',
  'group',
  'campaign',
  'none',
]

/** 매체 하나에서 찾은 방법별 유효 리드·UTM 상담 수 — utm_campaign에 무엇이
 * 들어오는지 보는 진단. */
export interface ChannelMatch {
  leads: Record<MatchLevel, number>
  consultations: Record<MatchLevel, number>
}

/** 하루치 합계 — 광고비는 그날 쓴 돈, 리드는 그날 접수된 상담, 구매·매출은
 * 그날 결제된 귀속 첫 구매(합계 total과 같은 기준, 광고를 찾은 것만). */
export interface AdPerformanceDay {
  date: ISODate
  spend: number
  leads: number
  buyers: number
  revenue: number
}

export interface AdPerformance {
  /** 매체 줄(맨 위) — 광고비 데이터가 있고 숫자가 있는 매체만, MEDIA_CHANNELS
   * 순서. */
  channels: AdPerformanceNode[]
  total: AdPerformanceMetrics
  /** 조회 기간의 날짜마다(빈 날은 0) — 위 숫자 칸의 작은 추이 그래프. */
  daily: AdPerformanceDay[]
  unmatched: UnmatchedUtm[]
  unmatchedTotal: LeadCounts
  /** 광고비 데이터를 받은 매체마다. */
  matches: Partial<Record<MediaChannel, ChannelMatch>>
}

/** 광고비가 있는 가장 작은 단위(잎) — Meta는 광고(group = 광고셋), 나머지는
 * 광고그룹(group = 잎 자신). */
interface SpendLeaf {
  id: string
  name: string
  groupId: string
  groupName: string
  campaignId: string
  campaignName: string
}

/** 매체 하나의 광고비 데이터 — 잎과 그 하루치, 소재(광고) 이름 → 잎. */
export interface ChannelSpend {
  /** 잎의 줄 종류 — Meta는 광고(광고셋 아래), 나머지는 광고그룹. */
  leafKind: 'ad' | 'adgroup'
  leaves: SpendLeaf[]
  /** [leaves의 순번, 날짜, 광고비, 노출, 클릭]. */
  daily: [number, ISODate, number, number, number][]
  adNames: { name: string; leafId: string }[]
}

/** Meta 광고 단위 데이터 — 잎은 광고, 광고 이름이 곧 소재 이름이다. */
export const metaSpendOf = (ads: MetaAdInsights): ChannelSpend => {
  const leaves = ads.ads.map((ad) => ({
    id: ad.id,
    name: ad.name,
    groupId: ad.adsetId,
    groupName: ad.adsetName,
    campaignId: ad.campaignId,
    campaignName: ad.campaignName,
  }))
  return {
    leafKind: 'ad',
    leaves,
    daily: ads.daily,
    adNames: leaves.map((leaf) => ({ name: leaf.name, leafId: leaf.id })),
  }
}

/** 광고그룹 단위 데이터(Google·네이버·OpenAI·당근) — 잎은 광고그룹, 소재
 * 이름은 소재 동기화가 찾은 광고 이름. */
export const adGroupSpendOf = (data: ChannelAdGroups): ChannelSpend => ({
  leafKind: 'adgroup',
  leaves: data.adGroups.map((group) => ({
    id: group.id,
    name: group.name,
    groupId: group.id,
    groupName: group.name,
    campaignId: group.campaignId,
    campaignName: group.campaignName,
  })),
  daily: data.daily,
  adNames: data.ads.map((ad) => ({ name: ad.name, leafId: ad.adGroupId })),
})

/** 이름 비교용 — 대소문자·공백 차이는 같은 이름으로 본다. 매체가 이름을
 * 비워 보낸 줄(null)도 깨지지 않게 빈 이름으로 본다. */
const normalizeName = (name: string | null | undefined): string =>
  String(name ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')

const minusDays = (date: ISODate, days: number): ISODate =>
  new Date(Date.parse(date) - days * 86_400_000).toISOString().slice(0, 10)

/** start ~ end 날짜 목록. */
const daysBetween = (start: ISODate, end: ISODate): ISODate[] => {
  const out: ISODate[] = []
  for (let day = start; day <= end; day = minusDays(day, -1)) out.push(day)
  return out
}

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
  b.revenue - a.revenue ||
  b.spend - a.spend ||
  (a.name ?? '').localeCompare(b.name ?? '')

const sortTree = (nodes: AdPerformanceNode[]): void => {
  nodes.sort(byRevenueThenSpend)
  for (const node of nodes) sortTree(node.children)
}

const emptyMatch = (): ChannelMatch => ({
  leads: { ad: 0, group: 0, campaign: 0, none: 0 },
  consultations: { ad: 0, group: 0, campaign: 0, none: 0 },
})

/** 매체 하나를 함께 셀 때 넘겨받는 곳 — 하루치 합계, 못 찾은 utm, 찾은 방법. */
interface ChannelSinks {
  daily: Map<ISODate, AdPerformanceDay>
  addUnmatched: (utmCampaign: string, counts: Partial<LeadCounts>) => void
  match: ChannelMatch
}

/** 매체 하나 — 잎마다 숫자를 모아 캠페인 → (광고셋) → 잎으로 묶은 매체 줄. */
function buildChannel(
  channel: MediaChannel,
  spend: ChannelSpend,
  rows: readonly AttributionRow[],
  quality: readonly LeadQualityRow[],
  start: ISODate,
  end: ISODate,
  scope: PurchaseScope,
  { daily, addUnmatched, match }: ChannelSinks,
): AdPerformanceNode {
  const metrics = spend.leaves.map(emptyMetrics)
  // 잎별 날짜별 광고비 — 여러 잎이 맞을 때 나눌 비율로 쓴다.
  const spendByDay = spend.leaves.map(() => new Map<ISODate, number>())
  for (const [index, date, amount, impressions, clicks] of spend.daily) {
    spendByDay[index].set(date, amount)
    if (date < start || date > end) continue
    metrics[index].spend += amount
    metrics[index].impressions += impressions
    metrics[index].clicks += clicks
    const day = daily.get(date)
    if (day) day.spend += amount
  }

  // 이름 → 잎. 찾을 때 소재(광고) 이름 → 광고셋·광고그룹 이름 → 캠페인 이름
  // 순으로 보고, 처음 맞은 단계의 잎들을 쓴다.
  const leafIndex = new Map(spend.leaves.map((leaf, index) => [leaf.id, index]))
  const indexOf = (pairs: [string, number][]): Map<string, number[]> => {
    const map = new Map<string, number[]>()
    for (const [name, index] of pairs) {
      const key = normalizeName(name)
      if (!key) continue
      const list = map.get(key) ?? []
      if (!list.includes(index)) list.push(index)
      map.set(key, list)
    }
    return map
  }
  const levels: [MatchLevel, Map<string, number[]>][] = [
    [
      'ad',
      indexOf(
        spend.adNames.flatMap(({ name, leafId }): [string, number][] => {
          const index = leafIndex.get(leafId)
          // 조회 구간에 광고비가 없는 광고그룹의 소재는 이을 곳이 없다.
          return index === undefined ? [] : [[name, index]]
        }),
      ),
    ],
    ['group', indexOf(spend.leaves.map((leaf, i) => [leaf.groupName, i]))],
    [
      'campaign',
      indexOf(spend.leaves.map((leaf, i) => [leaf.campaignName, i])),
    ],
  ]
  const find = (utmCampaign: string): [MatchLevel, number[]] => {
    const key = normalizeName(utmCampaign)
    for (const [level, map] of levels) {
      const leaves = key ? map.get(key) : undefined
      if (leaves) return [level, leaves]
    }
    return ['none', []]
  }

  // 잎마다 받아 둔 기간 전체의 광고비 — 그날·그 전 7일에 쓴 곳이 없을 때.
  const totalSpend = spendByDay.map((byDay) =>
    [...byDay.values()].reduce((sum, amount) => sum + amount, 0),
  )
  // 날짜마다 그날과 그 전 7일(8일) — 리드·상담마다 다시 만들지 않게.
  const weekOf = new Map<ISODate, ISODate[]>()
  const weekDays = (day: ISODate): ISODate[] => {
    let days = weekOf.get(day)
    if (!days) {
      days = Array.from({ length: 8 }, (_, back) => minusDays(day, back))
      weekOf.set(day, days)
    }
    return days
  }
  /** 비율 — 합이 0이면 null. */
  const shares = (amounts: number[]): number[] | null => {
    const total = amounts.reduce((sum, amount) => sum + amount, 0)
    return total > 0 ? amounts.map((amount) => amount / total) : null
  }

  /** 상담일에 광고비를 쓴 잎의 비율로 나눈다. 그날 쓴 곳이 없으면 그 전
   * 7일, 그래도 없으면 전체 기간 광고비, 그마저 없으면 똑같이 나눈다. 앞
   * 단계에서 정해지면 뒤 단계는 세지 않는다(리드 수천 × 후보 수백이라). */
  const weightsFor = (candidates: number[], day: ISODate): number[] => {
    if (candidates.length === 1) return [1]
    return (
      shares(candidates.map((index) => spendByDay[index].get(day) ?? 0)) ??
      shares(
        candidates.map((index) =>
          weekDays(day).reduce(
            (sum, date) => sum + (spendByDay[index].get(date) ?? 0),
            0,
          ),
        ),
      ) ??
      shares(candidates.map((index) => totalSpend[index])) ??
      candidates.map(() => 1 / candidates.length)
    )
  }

  for (const row of rows) {
    if (row[1] !== channel) continue
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
    const [level, candidates] = find(utmCampaign)
    if (lead) match.leads[level] += 1
    if (level === 'none') {
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
  // 위와 따로 센다. 잎은 같은 방법(이름, 상담일 광고비 비율)으로 찾는다.
  for (const [
    date,
    rowChannel,
    utmCampaign,
    total,
    decided,
    misentry,
  ] of quality) {
    if (rowChannel !== channel || date < start || date > end) continue
    const counts: Partial<LeadCounts> = {
      consultations: total,
      decided,
      misentry,
    }
    const [level, candidates] = find(utmCampaign)
    match.consultations[level] += total
    if (level === 'none') {
      addUnmatched(utmCampaign, counts)
      continue
    }
    weightsFor(candidates, date).forEach((weight, i) =>
      addLeadCounts(metrics[candidates[i]], counts, weight),
    )
  }

  // 잎 → (광고셋) → 캠페인 → 매체로 묶는다. id는 매체·종류를 붙여 표 전체에서
  // 겹치지 않게.
  const channelNode: AdPerformanceNode = {
    id: channel,
    name: channel,
    kind: 'channel',
    children: [],
    ...emptyMetrics(),
  }
  const campaigns = new Map<string, AdPerformanceNode>()
  const groups = new Map<string, AdPerformanceNode>()
  spend.leaves.forEach((leaf, index) => {
    const m = metrics[index]
    if (!isActive(m)) return
    let campaign = campaigns.get(leaf.campaignId)
    if (!campaign) {
      campaign = {
        id: `${channel}:campaign:${leaf.campaignId}`,
        name: leaf.campaignName ?? '',
        kind: 'campaign',
        children: [],
        ...emptyMetrics(),
      }
      campaigns.set(leaf.campaignId, campaign)
      channelNode.children.push(campaign)
    }
    let parent = campaign
    if (spend.leafKind === 'ad') {
      let group = groups.get(leaf.groupId)
      if (!group) {
        group = {
          id: `${channel}:adset:${leaf.groupId}`,
          name: leaf.groupName ?? '',
          kind: 'adset',
          children: [],
          ...emptyMetrics(),
        }
        groups.set(leaf.groupId, group)
        campaign.children.push(group)
      }
      addInto(group, m)
      parent = group
    }
    parent.children.push({
      id: `${channel}:${spend.leafKind}:${leaf.id}`,
      name: leaf.name ?? '',
      kind: spend.leafKind,
      children: [],
      ...m,
    })
    addInto(campaign, m)
    addInto(channelNode, m)
  })
  sortTree(channelNode.children)
  return channelNode
}

/**
 * @param spends 매체마다 조회 시작 89일 전부터 끝까지의 광고비 데이터 — 기간
 *   앞쪽의 구매는 그 전에 접수된 상담에서 왔을 수 있어서, 상담일 무렵 어느
 *   광고가 돌았는지 보려면 그만큼 앞까지 필요하다. 광고비는 [start, end]만
 *   센다. 데이터가 없는(못 받은) 매체는 빼고, 그 매체의 리드도 세지 않는다.
 * @param quality 상담 접수일이 [start, end]인 UTM 상담 수(오기입률 재료) —
 *   아직 못 받았으면 null(오기입률 칸이 0건으로 남는다).
 * @param scope 결제 전환을 셀 구매 범위.
 */
export function buildAdPerformance(
  rows: readonly AttributionRow[],
  spends: Partial<Record<MediaChannel, ChannelSpend>>,
  start: ISODate,
  end: ISODate,
  quality: readonly LeadQualityRow[] | null = null,
  scope: PurchaseScope = 'all',
): AdPerformance {
  const daily = new Map<ISODate, AdPerformanceDay>(
    daysBetween(start, end).map((date) => [
      date,
      { date, spend: 0, leads: 0, buyers: 0, revenue: 0 },
    ]),
  )
  // 이름으로 못 찾은 utm_campaign — 매체별로, 대소문자·공백만 다른 값은 한 줄로.
  const unmatched = new Map<string, UnmatchedUtm>()
  const matches: AdPerformance['matches'] = {}
  const channels: AdPerformanceNode[] = []
  for (const channel of MEDIA_CHANNELS) {
    const spend = spends[channel]
    if (!spend) continue
    const match = emptyMatch()
    matches[channel] = match
    const addUnmatched = (utmCampaign: string, counts: Partial<LeadCounts>) => {
      const name = String(utmCampaign ?? '').trim() || '(utm_campaign 없음)'
      const key = `${channel}\n${normalizeName(name)}`
      const entry = unmatched.get(key) ?? {
        channel,
        utmCampaign: name,
        ...emptyLeadCounts(),
      }
      addLeadCounts(entry, counts)
      unmatched.set(key, entry)
    }
    const node = buildChannel(
      channel,
      spend,
      rows,
      quality ?? [],
      start,
      end,
      scope,
      { daily, addUnmatched, match },
    )
    if (node.children.length > 0) channels.push(node)
  }

  const total = emptyMetrics()
  for (const channel of channels) addInto(total, channel)
  const unmatchedList = [...unmatched.values()].sort(
    (a, b) =>
      MEDIA_CHANNELS.indexOf(a.channel) - MEDIA_CHANNELS.indexOf(b.channel) ||
      b.revenue - a.revenue ||
      b.leads - a.leads ||
      b.consultations - a.consultations,
  )
  const unmatchedTotal = emptyLeadCounts()
  for (const entry of unmatchedList) addLeadCounts(unmatchedTotal, entry)
  return {
    channels,
    total,
    daily: [...daily.values()],
    unmatched: unmatchedList,
    unmatchedTotal,
    matches,
  }
}
