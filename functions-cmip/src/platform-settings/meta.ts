// Meta 캠페인·광고셋 설정 읽기 — 예산(캠페인 예산이면 캠페인에), 입찰·최적화,
// 광고셋 타기팅. 집행 중인 것만, 조회만 한다. 금액은 계정 통화(원) 그대로다.
import { adEntityKey } from '../ad-settings/types'
import { META_AD_ACCOUNT_IDS } from '../channel/meta'
import { listAll } from '../creatives/meta'
import type { AdBudget, AdLevel } from '../ad-settings/types'
import {
  budgetOf,
  join,
  kstDate,
  plain,
  positiveOrNull,
  reading,
  won,
} from './format'
import type { PastChangeReading, PlatformReading } from './types'

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

// ── 지난 변경(활동 기록) ─────────────────────────────────────────────────
//
// 확인한 것(2026-11-04, 지난 30일): category로 거르면 예산(update_ad_set_budget
// 12건)·입찰(update_ad_set_bid_strategy 8건)·타기팅(update_ad_set_target_spec
// 19건)만 온다(거르지 않으면 광고 켜기·끄기가 4시간에 200건). 활동 기록은
// 광고셋을 CAMPAIGN, 캠페인을 CAMPAIGN_GROUP이라 부른다. extra_data는 JSON 글:
//   · 예산 — old_value.old_value / new_value.new_value(원), additional_value(기준 글)
//   · 입찰 전략 — old_value / new_value(코드), additional_value.old_value/new_value(금액)
//   · 타기팅 — old_value / new_value가 [{ content: "연령:", children: [...] }] 목록

interface RawActivity {
  event_type?: string
  event_time?: string
  object_id?: string
  object_type?: string
  object_name?: string
  extra_data?: string
}

type Obj = Record<string, unknown>

const PAST_CATEGORIES = ['BUDGET', 'BID', 'TARGETING'] as const

/** 활동 기록의 입찰 전략 코드 — API(bid_strategy)와 이름이 달라 글자로 가린다. */
const bidStrategyLabel = (code: unknown): string => {
  const text = plain(code)
  if (!text) return ''
  if (/COST_CAP/.test(text)) return '비용 한도'
  if (/BID_CAP/.test(text)) return '입찰가 한도'
  if (/ROAS/.test(text)) return '최소 ROAS'
  if (/LOWEST_COST/.test(text)) return '최저 비용'
  return text
}

const inner = (value: unknown, key: string): unknown =>
  value !== null && typeof value === 'object' ? (value as Obj)[key] : value

/** 타기팅 목록 → "연령" → "25세 - 54세" 같은 줄들. */
const targetLines = (value: unknown): Map<string, string> => {
  const out = new Map<string, string>()
  if (!Array.isArray(value)) return out
  for (const line of value as Obj[]) {
    const key = plain(line?.content).replace(/[:：]\s*$/, '')
    if (key) out.set(key, plain(line?.children))
  }
  return out
}

/** 활동 하나 → 지난 변경(모르는 모양이면 null). */
const pastChangeOf = (a: RawActivity): PastChangeReading | null => {
  const level: AdLevel | null =
    a.object_type === 'CAMPAIGN'
      ? 'adset'
      : a.object_type === 'CAMPAIGN_GROUP'
        ? 'campaign'
        : null
  if (!level || !a.object_id || !a.event_type || !a.event_time) return null
  let extra: Obj
  try {
    extra = JSON.parse(a.extra_data ?? '') as Obj
  } catch {
    return null
  }
  // "+0000" 꼴 시간대를 "+00:00"으로.
  const at = Date.parse(a.event_time.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
  if (!Number.isFinite(at)) return null
  const base = {
    entityKey: adEntityKey('meta', level, a.object_id),
    channel: 'meta' as const,
    level,
    platformId: a.object_id,
    name: a.object_name ?? '',
  }
  const change = (
    field: PastChangeReading['change']['field'],
    before: PastChangeReading['change']['before'],
    after: PastChangeReading['change']['after'],
  ): PastChangeReading => ({
    ...base,
    change: {
      id: `meta:${a.event_type}:${a.object_id}:${at}`,
      at,
      date: kstDate(at),
      field,
      before,
      after,
      summary: false,
    },
  })

  if (/^update_(ad_set|campaign)_budget$/.test(a.event_type)) {
    const basis = `${plain(inner(extra.old_value, 'additional_value'))} ${plain(
      inner(extra.new_value, 'additional_value'),
    )}`
    const period: AdBudget['period'] = /총|평생|lifetime/i.test(basis)
      ? 'lifetime'
      : 'daily'
    return change(
      'budget',
      budgetOf(inner(extra.old_value, 'old_value') as number, period),
      budgetOf(inner(extra.new_value, 'new_value') as number, period),
    )
  }
  if (a.event_type === 'update_ad_set_bid_strategy') {
    const amount = (key: string) =>
      positiveOrNull(inner(extra.additional_value, key) as number)
    const label = (code: unknown, key: string) => {
      const n = amount(key)
      return join([bidStrategyLabel(code), n !== null && won(n)])
    }
    return change(
      'bidding',
      label(extra.old_value, 'old_value'),
      label(extra.new_value, 'new_value'),
    )
  }
  if (/^update_ad(_set)?_targets?_spec$/.test(a.event_type)) {
    const before = targetLines(extra.old_value)
    const after = targetLines(extra.new_value)
    const keys = [...new Set([...before.keys(), ...after.keys()])].filter(
      (k) => before.get(k) !== after.get(k),
    )
    if (keys.length === 0) return null
    const side = (lines: Map<string, string>) =>
      keys.map((k) => `${k} ${lines.get(k) || '없음'}`).join(' · ')
    return change('audience', side(before), side(after))
  }
  return null
}

/** 지난 30일 예산·입찰·타기팅 변경 — 계정 두 개 모두. */
export async function readMetaPastChanges(
  accessToken: string,
): Promise<PastChangeReading[]> {
  const since = String(Math.floor(Date.now() / 1000) - 30 * 86400)
  const out: PastChangeReading[] = []
  for (const accountId of META_AD_ACCOUNT_IDS)
    for (const category of PAST_CATEGORIES) {
      const activities = await listAll<RawActivity>(
        `act_${accountId}/activities`,
        {
          fields:
            'event_type,event_time,object_id,object_type,object_name,extra_data',
          category,
          since,
          limit: '200',
        },
        accessToken,
      )
      for (const a of activities) {
        const found = pastChangeOf(a)
        if (found) out.push(found)
      }
    }
  return out
}
