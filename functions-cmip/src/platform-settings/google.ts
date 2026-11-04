// Google Ads 캠페인·광고그룹 설정 읽기 — 예산은 캠페인에만 있고(광고그룹은
// null), 입찰 전략·목표 CPA/ROAS는 캠페인(광고그룹에는 덮어쓴 값만),
// 타기팅은 조건(criterion) 종류별 개수와 연령·성별. 집행 중인 것만, 조회만 한다.
// 필드는 v26 참조 문서로 확인했다(campaign.start_date·end_date는 없어졌다 —
// 2026-11-03 조회가 그 때문에 400이었다).
import { adEntityKey } from '../ad-settings/types'
import { searchGoogleAds } from '../channel/google/client'
import type { GoogleAdsAccount } from '../channel/google/types'
import { budgetOf, join, positiveOrNull, reading, won } from './format'
import type { PlatformReading } from './types'

interface CampaignRow {
  campaign?: {
    id?: string
    name?: string
    biddingStrategyType?: string
    maximizeConversions?: { targetCpaMicros?: string }
    maximizeConversionValue?: { targetRoas?: number }
    targetCpa?: { targetCpaMicros?: string }
    targetRoas?: { targetRoas?: number }
  }
  campaignBudget?: {
    amountMicros?: string
    period?: string
    totalAmountMicros?: string
  }
}

interface AdGroupRow {
  campaign?: { id?: string }
  adGroup?: {
    id?: string
    name?: string
    cpcBidMicros?: string
    targetCpaMicros?: string
    targetRoas?: number
  }
}

interface CriterionRow {
  campaign?: { id?: string }
  adGroup?: { id?: string }
  adGroupCriterion?: Criterion
  campaignCriterion?: Criterion
}

interface Criterion {
  type?: string
  negative?: boolean
  ageRange?: { type?: string }
  gender?: { type?: string }
}

const BIDDING: Record<string, string> = {
  MAXIMIZE_CONVERSIONS: '전환수 최대화',
  MAXIMIZE_CONVERSION_VALUE: '전환 가치 극대화',
  TARGET_CPA: '타깃 CPA',
  TARGET_ROAS: '타깃 ROAS',
  TARGET_SPEND: '클릭수 최대화',
  MANUAL_CPC: '수동 CPC',
  ENHANCED_CPC: '향상된 CPC',
  MANUAL_CPM: '수동 CPM',
  MANUAL_CPV: '수동 CPV',
  TARGET_CPM: '타깃 CPM',
  TARGET_CPV: '타깃 CPV',
  TARGET_IMPRESSION_SHARE: '타깃 노출 점유율',
}

/** 조건 종류 — 이 순서로 보인다(없는 것은 이름 그대로 뒤에). */
const CRITERIA: [string, string][] = [
  ['LOCATION', '지역'],
  ['PROXIMITY', '반경'],
  ['LANGUAGE', '언어'],
  ['KEYWORD', '키워드'],
  ['AUDIENCE', '오디언스'],
  ['USER_LIST', '사용자 목록'],
  ['USER_INTEREST', '관심사'],
  ['CUSTOM_AUDIENCE', '맞춤 세그먼트'],
  ['LIFE_EVENT', '생애 이벤트'],
  ['PARENTAL_STATUS', '자녀 여부'],
  ['INCOME_RANGE', '가구 소득'],
  ['PLACEMENT', '게재위치'],
  ['TOPIC', '주제'],
  ['YOUTUBE_CHANNEL', 'YouTube 채널'],
  ['YOUTUBE_VIDEO', 'YouTube 동영상'],
  ['AD_SCHEDULE', '시간대'],
  ['DEVICE', '기기'],
]
const CRITERION_LABEL = new Map(CRITERIA)
const CRITERION_ORDER = new Map(CRITERIA.map(([type], i) => [type, i]))

const AGE: Record<string, string> = {
  AGE_RANGE_18_24: '18–24',
  AGE_RANGE_25_34: '25–34',
  AGE_RANGE_35_44: '35–44',
  AGE_RANGE_45_54: '45–54',
  AGE_RANGE_55_64: '55–64',
  AGE_RANGE_65_UP: '65+',
  AGE_RANGE_UNDETERMINED: '알 수 없음',
}
const GENDER: Record<string, string> = {
  FEMALE: '여성',
  MALE: '남성',
  UNDETERMINED: '알 수 없음',
}

const micros = (value: string | undefined) => {
  const n = positiveOrNull(value)
  return n === null ? null : Math.round(n / 1_000_000)
}

/** 목표 ROAS는 배수(3.5 = 350%)로 온다. */
const roasPercent = (value: number | undefined) =>
  value && value > 0 ? Math.round(value * 100) : null

/** 연령·성별 — 고른 것이 전부가 아니면 고른 것을, 뺀 것이 있으면 그것을. */
const demographic = (
  label: string,
  table: Record<string, string>,
  included: string[],
  excluded: string[],
) => {
  const all = Object.keys(table)
  const inc = all.filter((k) => included.includes(k))
  const exc = all.filter((k) => excluded.includes(k))
  return join([
    inc.length > 0 &&
      inc.length < all.length &&
      `${label} ${inc.map((k) => table[k]).join(', ')}`,
    exc.length > 0 && `${label} 제외 ${exc.map((k) => table[k]).join(', ')}`,
  ])
}

/** 조건 목록 → 한 줄. 연령·성별은 값을, 나머지는 종류별 개수(제외 따로). */
export const googleAudience = (criteria: readonly Criterion[]): string => {
  const ages = { inc: [] as string[], exc: [] as string[] }
  const genders = { inc: [] as string[], exc: [] as string[] }
  const counts = new Map<string, { inc: number; exc: number }>()
  for (const c of criteria) {
    if (!c.type) continue
    if (c.type === 'AGE_RANGE' && c.ageRange?.type) {
      ;(c.negative ? ages.exc : ages.inc).push(c.ageRange.type)
      continue
    }
    if (c.type === 'GENDER' && c.gender?.type) {
      ;(c.negative ? genders.exc : genders.inc).push(c.gender.type)
      continue
    }
    const count = counts.get(c.type) ?? { inc: 0, exc: 0 }
    count[c.negative ? 'exc' : 'inc'] += 1
    counts.set(c.type, count)
  }
  const types = [...counts.keys()].sort(
    (a, b) =>
      (CRITERION_ORDER.get(a) ?? 99) - (CRITERION_ORDER.get(b) ?? 99) ||
      a.localeCompare(b),
  )
  return join([
    demographic('연령', AGE, ages.inc, ages.exc),
    demographic('성별', GENDER, genders.inc, genders.exc),
    ...types.map((type) => {
      const { inc, exc } = counts.get(type)!
      const label = CRITERION_LABEL.get(type) ?? type
      return join([
        inc > 0 && `${label} ${inc}`,
        exc > 0 && `${label} 제외 ${exc}`,
      ])
    }),
  ])
}

const groupBy = (
  rows: readonly CriterionRow[],
  key: (row: CriterionRow) => string | undefined,
  pick: (row: CriterionRow) => Criterion | undefined,
) => {
  const out = new Map<string, Criterion[]>()
  for (const row of rows) {
    const k = key(row)
    const c = pick(row)
    if (!k || !c) continue
    out.set(k, [...(out.get(k) ?? []), c])
  }
  return out
}

/** 집행 중인(사용 설정이고 실제로 도는) 캠페인과 그 광고그룹의 설정. */
export async function readGoogleSettings(
  account: GoogleAdsAccount,
  refreshToken: string,
): Promise<PlatformReading[]> {
  const search = <Row>(query: string) =>
    searchGoogleAds<Row>(query, account, refreshToken)
  const serving = `campaign.status = 'ENABLED' AND campaign.serving_status = 'SERVING'`
  const [campaigns, adGroups, groupCriteria, campaignCriteria] =
    await Promise.all([
      search<CampaignRow>(`
        SELECT campaign.id, campaign.name, campaign.bidding_strategy_type,
          campaign.maximize_conversions.target_cpa_micros,
          campaign.maximize_conversion_value.target_roas,
          campaign.target_cpa.target_cpa_micros, campaign.target_roas.target_roas,
          campaign_budget.amount_micros, campaign_budget.period,
          campaign_budget.total_amount_micros
        FROM campaign
        WHERE ${serving}`),
      search<AdGroupRow>(`
        SELECT campaign.id, ad_group.id, ad_group.name, ad_group.cpc_bid_micros,
          ad_group.target_cpa_micros, ad_group.target_roas
        FROM ad_group
        WHERE ad_group.status = 'ENABLED' AND ${serving}`),
      search<CriterionRow>(`
        SELECT ad_group.id, ad_group_criterion.type, ad_group_criterion.negative,
          ad_group_criterion.age_range.type, ad_group_criterion.gender.type
        FROM ad_group_criterion
        WHERE ad_group_criterion.status = 'ENABLED'
          AND ad_group.status = 'ENABLED' AND ${serving}`),
      search<CriterionRow>(`
        SELECT campaign.id, campaign_criterion.type, campaign_criterion.negative,
          campaign_criterion.age_range.type, campaign_criterion.gender.type
        FROM campaign_criterion
        WHERE campaign_criterion.status = 'ENABLED' AND ${serving}`),
    ])
  const byGroup = groupBy(
    groupCriteria,
    (r) => r.adGroup?.id,
    (r) => r.adGroupCriterion,
  )
  const byCampaign = groupBy(
    campaignCriteria,
    (r) => r.campaign?.id,
    (r) => r.campaignCriterion,
  )

  const out: PlatformReading[] = []
  for (const row of campaigns) {
    const c = row.campaign
    if (!c?.id) continue
    const b = row.campaignBudget
    const bidding = c.biddingStrategyType
      ? (BIDDING[c.biddingStrategyType] ?? c.biddingStrategyType)
      : ''
    out.push(
      reading(
        {
          entityKey: adEntityKey('google', 'campaign', c.id),
          channel: 'google',
          level: 'campaign',
          platformId: c.id,
          name: c.name ?? '',
        },
        {
          budget:
            b?.period === 'CUSTOM_PERIOD'
              ? budgetOf(micros(b.totalAmountMicros), 'lifetime')
              : budgetOf(micros(b?.amountMicros), 'daily'),
          bidding,
          targetCpa:
            micros(c.maximizeConversions?.targetCpaMicros) ??
            micros(c.targetCpa?.targetCpaMicros),
          targetRoas:
            roasPercent(c.maximizeConversionValue?.targetRoas) ??
            roasPercent(c.targetRoas?.targetRoas),
          audience: googleAudience(byCampaign.get(c.id) ?? []),
        },
      ),
    )
  }
  for (const row of adGroups) {
    const g = row.adGroup
    if (!g?.id) continue
    const cpc = micros(g.cpcBidMicros)
    out.push(
      reading(
        {
          entityKey: adEntityKey('google', 'adset', g.id),
          channel: 'google',
          level: 'adset',
          platformId: g.id,
          name: g.name ?? '',
        },
        {
          // 광고그룹이 덮어쓴 입찰만 — 없으면 캠페인 입찰을 따른다(캠페인 전략을
          // 여기에도 적으면 캠페인이 바꿀 때 광고그룹도 바뀐 것으로 잡힌다).
          bidding: cpc !== null ? `최대 CPC ${won(cpc)}` : '',
          targetCpa: micros(g.targetCpaMicros),
          targetRoas: roasPercent(g.targetRoas),
          audience: googleAudience(byGroup.get(g.id) ?? []),
        },
      ),
    )
  }
  return out
}
