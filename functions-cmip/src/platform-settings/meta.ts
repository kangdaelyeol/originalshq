// Meta 캠페인·광고셋 설정 읽기 — 예산(캠페인 예산이면 캠페인에), 입찰·최적화,
// 광고셋 타기팅. 집행 중인 것만, 조회만 한다. 금액은 계정 통화(원) 그대로다.
import { adEntityKey } from '../ad-settings/types'
import { META_AD_ACCOUNT_IDS } from '../channel/meta'
import { listAll } from '../creatives/meta'
import { budgetOf, join, positiveOrNull, reading, won } from './format'
import type { PlatformReading } from './types'

interface Named {
  id?: string
  name?: string
}

interface MetaTargeting {
  geo_locations?: {
    countries?: string[]
    regions?: Named[]
    cities?: Named[]
  }
  age_min?: number
  age_max?: number
  /** 1 남성 · 2 여성 — 없으면 전체. */
  genders?: number[]
  custom_audiences?: Named[]
  excluded_custom_audiences?: Named[]
  /** 상세 타기팅 — 묶음 안은 "또는", 묶음끼리는 "그리고". */
  flexible_spec?: Record<string, Named[]>[]
  publisher_platforms?: string[]
  targeting_automation?: { advantage_audience?: number }
}

interface RawCampaign {
  id: string
  name?: string
  daily_budget?: string
  lifetime_budget?: string
  bid_strategy?: string
}

interface RawAdset extends RawCampaign {
  campaign_id?: string
  bid_amount?: string
  optimization_goal?: string
  targeting?: MetaTargeting
}

const BID_STRATEGY: Record<string, string> = {
  LOWEST_COST_WITHOUT_CAP: '최저 비용',
  LOWEST_COST_WITH_BID_CAP: '입찰가 한도',
  COST_CAP: '비용 한도',
  LOWEST_COST_WITH_MIN_ROAS: '최소 ROAS',
}

const OPTIMIZATION: Record<string, string> = {
  OFFSITE_CONVERSIONS: '전환',
  VALUE: '전환 가치',
  LINK_CLICKS: '링크 클릭',
  LANDING_PAGE_VIEWS: '랜딩 페이지 조회',
  LEAD_GENERATION: '잠재 고객',
  QUALITY_LEAD: '우수 잠재 고객',
  IMPRESSIONS: '노출',
  REACH: '도달',
  THRUPLAY: 'ThruPlay',
  POST_ENGAGEMENT: '참여',
  APP_INSTALLS: '앱 설치',
}

const names = (items: Named[] | undefined) =>
  (items ?? [])
    .map((i) => i.name || i.id || '')
    .filter(Boolean)
    .sort()

const budgetOfRaw = (c: RawCampaign) =>
  budgetOf(c.daily_budget, 'daily') ?? budgetOf(c.lifetime_budget, 'lifetime')

/** 타기팅 한 줄 — 지역 · 연령 · 성별 · 맞춤 타겟 · 제외 · 상세 타기팅 ·
 * Advantage+ · 노출 위치. */
export const metaAudience = (t: MetaTargeting | undefined): string => {
  if (!t) return ''
  const geo = [
    ...(t.geo_locations?.countries ?? []).slice().sort(),
    ...names(t.geo_locations?.regions),
    ...names(t.geo_locations?.cities),
  ]
  const age =
    t.age_min || t.age_max
      ? `${t.age_min ?? 18}–${t.age_max && t.age_max < 65 ? t.age_max : '65+'}세`
      : ''
  const genders = [...(t.genders ?? [])].sort()
  const gender =
    genders.length === 1 ? (genders[0] === 1 ? '남성' : '여성') : ''
  const detailed = (t.flexible_spec ?? [])
    .map((group) =>
      Object.values(group)
        .flatMap((items) => names(items))
        .sort()
        .join(' 또는 '),
    )
    .filter(Boolean)
  return join([
    geo.length > 0 && geo.join(', '),
    age,
    gender,
    names(t.custom_audiences).length > 0 &&
      `맞춤 타겟 ${names(t.custom_audiences).join(', ')}`,
    names(t.excluded_custom_audiences).length > 0 &&
      `제외 ${names(t.excluded_custom_audiences).join(', ')}`,
    detailed.length > 0 && `상세 타기팅 ${detailed.join(' 그리고 ')}`,
    t.targeting_automation?.advantage_audience === 1 && 'Advantage+ 오디언스',
    (t.publisher_platforms?.length ?? 0) > 0 &&
      `노출 ${[...(t.publisher_platforms ?? [])].sort().join(', ')}`,
  ])
}

/** 집행 중인 캠페인·광고셋의 설정 — 계정 두 개 모두. */
export async function readMetaSettings(
  accessToken: string,
): Promise<PlatformReading[]> {
  const out: PlatformReading[] = []
  const active = { effective_status: JSON.stringify(['ACTIVE']), limit: '100' }
  for (const accountId of META_AD_ACCOUNT_IDS) {
    const campaigns = await listAll<RawCampaign>(
      `act_${accountId}/campaigns`,
      {
        ...active,
        fields: 'id,name,daily_budget,lifetime_budget,bid_strategy',
      },
      accessToken,
    )
    for (const c of campaigns)
      out.push(
        reading(
          {
            entityKey: adEntityKey('meta', 'campaign', c.id),
            channel: 'meta',
            level: 'campaign',
            platformId: c.id,
            name: c.name ?? '',
          },
          {
            budget: budgetOfRaw(c),
            bidding: c.bid_strategy
              ? (BID_STRATEGY[c.bid_strategy] ?? c.bid_strategy)
              : '',
          },
        ),
      )

    const adsets = await listAll<RawAdset>(
      `act_${accountId}/adsets`,
      {
        ...active,
        fields:
          'id,name,campaign_id,daily_budget,lifetime_budget,bid_strategy,bid_amount,optimization_goal,targeting',
      },
      accessToken,
    )
    for (const a of adsets) {
      const bidAmount = positiveOrNull(a.bid_amount)
      out.push(
        reading(
          {
            entityKey: adEntityKey('meta', 'adset', a.id),
            channel: 'meta',
            level: 'adset',
            platformId: a.id,
            name: a.name ?? '',
          },
          {
            budget: budgetOfRaw(a),
            bidding: join([
              a.optimization_goal &&
                `${OPTIMIZATION[a.optimization_goal] ?? a.optimization_goal} 최적화`,
              a.bid_strategy &&
                (BID_STRATEGY[a.bid_strategy] ?? a.bid_strategy),
              bidAmount !== null && won(bidAmount),
            ]),
            // 비용 한도의 금액이 곧 목표 전환 단가다.
            targetCpa: a.bid_strategy === 'COST_CAP' ? bidAmount : null,
            audience: metaAudience(a.targeting),
          },
        ),
      )
    }
  }
  return out
}
