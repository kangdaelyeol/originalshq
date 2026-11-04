// OpenAI(ChatGPT) 캠페인·광고그룹 설정 읽기 — 캠페인 일 예산
// (budget.daily_spend_limit_micros)·입찰 방식·지역 타기팅, 광고그룹 입찰 설정과
// 맥락 힌트(context_hints). 집행 중인(active) 것만, 조회만 한다.
// 확인한 것(2026-11-03): 필드 이름은 실제 응답에서 봤지만 값의 모양(지역·입찰
// 설정·힌트가 글자인지 객체인지)은 확인하지 못해서 plain()으로 글자로 만든다.
import { adEntityKey, type AdLevel } from '../ad-settings/types'
import type { OpenaiCredentials } from '../channel/openai/client'
import { listAll } from '../creatives/openai'
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

interface RawCampaign {
  id: string
  name?: string
  status?: string
  objective?: string
  bidding_type?: string
  billing_event_type?: string
  budget?: { daily_spend_limit_micros?: number | string }
  targeting?: { locations?: unknown }
}

interface RawAdGroup {
  id: string
  name?: string
  status?: string
  bidding_config?: unknown
  context_hints?: unknown
}

const isActive = (o: { status?: string }) => o.status === 'active'

const STRATEGY: Record<string, string> = {
  maximize_clicks: '클릭 최대화',
  fixed_bid: '고정 입찰',
}
const BILLING: Record<string, string> = {
  click: '클릭당 과금',
  impression: '노출당 과금',
}

/** 광고그룹 입찰 설정 한 줄 — { strategy: { type }, max_bid: { amount }(micros),
 * billing_event_type }(2026-11-04 audit_logs에서 본 모양). 모르는 모양이면
 * 글자로 펼친다. */
const biddingOf = (config: unknown): string => {
  if (!config || typeof config !== 'object') return plain(config)
  const c = config as {
    strategy?: { type?: string }
    max_bid?: { amount?: number | string } | null
    billing_event_type?: string
  }
  const type = c.strategy?.type
  const maxBid = positiveOrNull(c.max_bid?.amount)
  const text = join([
    type && (STRATEGY[type] ?? type),
    maxBid !== null && `최대 ${won(maxBid / 1_000_000)}`,
    c.billing_event_type &&
      (BILLING[c.billing_event_type] ?? c.billing_event_type),
  ])
  return text || plain(config)
}

/** 집행 중인 캠페인과 그 광고그룹의 설정. */
export async function readOpenaiSettings(
  credentials: OpenaiCredentials,
): Promise<PlatformReading[]> {
  const out: PlatformReading[] = []
  const campaigns = await listAll<RawCampaign>('/campaigns', {}, credentials)
  for (const c of campaigns.filter(isActive)) {
    const limit = Number(c.budget?.daily_spend_limit_micros ?? 0)
    out.push(
      reading(
        {
          entityKey: adEntityKey('openai', 'campaign', c.id),
          channel: 'openai',
          level: 'campaign',
          platformId: c.id,
          name: c.name ?? '',
        },
        {
          budget: budgetOf(limit / 1_000_000, 'daily'),
          bidding: join([c.objective, c.bidding_type, c.billing_event_type]),
          audience: join([
            plain(c.targeting?.locations) &&
              `지역 ${plain(c.targeting?.locations)}`,
          ]),
        },
      ),
    )
    const groups = await listAll<RawAdGroup>(
      '/ad_groups',
      { campaign_id: c.id },
      credentials,
    )
    for (const g of groups.filter(isActive))
      out.push(
        reading(
          {
            entityKey: adEntityKey('openai', 'adset', g.id),
            channel: 'openai',
            level: 'adset',
            platformId: g.id,
            name: g.name ?? '',
          },
          {
            bidding: biddingOf(g.bidding_config),
            audience: join([
              plain(g.context_hints) && `맥락 힌트 ${plain(g.context_hints)}`,
            ]),
          },
        ),
      )
  }
  return out
}

// ── 지난 변경(audit_logs) ────────────────────────────────────────────────
//
// 확인한 것(2026-11-04, 59건 · 10/12~): update_campaign·update_ad_group의
// changes는 모든 칸을 나열하고, 바뀐 칸만 { before, after }(안 바뀐 칸은 null)다.
// daily_budget_micros는 캠페인 일 예산(micros), bidding_config는 광고그룹 입찰
// 설정 객체(지금 읽는 것과 같은 모양이라 biddingOf로 같은 글자를 만든다), ts는 초.

interface RawAuditLog {
  id: string
  ts?: number
  audit_log_type?: string
  obj_id?: string
  obj_type?: string
  item_name?: string
  changes?: Record<string, { before?: unknown; after?: unknown } | null>
}

/** 지난 변경 — 캠페인 일 예산, 광고그룹 입찰 설정·맥락 힌트. */
export async function readOpenaiPastChanges(
  credentials: OpenaiCredentials,
): Promise<PastChangeReading[]> {
  const logs = await listAll<RawAuditLog>(
    '/audit_logs',
    { limit: '100' },
    credentials,
  )
  const out: PastChangeReading[] = []
  for (const log of logs) {
    const level: AdLevel | null =
      log.audit_log_type === 'update_campaign'
        ? 'campaign'
        : log.audit_log_type === 'update_ad_group'
          ? 'adset'
          : null
    if (!level || !log.obj_id || !log.ts || !log.changes) continue
    const time = log.ts * 1000
    const base = {
      entityKey: adEntityKey('openai', level, log.obj_id),
      channel: 'openai' as const,
      level,
      platformId: log.obj_id,
      name: log.item_name ?? '',
    }
    const push = (
      field: PastChangeReading['change']['field'],
      before: PastChangeReading['change']['before'],
      after: PastChangeReading['change']['after'],
    ) =>
      out.push({
        ...base,
        change: {
          id: `openai:${log.id}:${field}`,
          at: time,
          date: kstDate(time),
          field,
          before,
          after,
          summary: false,
        },
      })
    const budget = log.changes.daily_budget_micros
    if (budget)
      push(
        'budget',
        budgetOf(Number(budget.before ?? 0) / 1_000_000, 'daily'),
        budgetOf(Number(budget.after ?? 0) / 1_000_000, 'daily'),
      )
    const bidding = log.changes.bidding_config
    if (bidding)
      push('bidding', biddingOf(bidding.before), biddingOf(bidding.after))
    const hints = log.changes.context_hints
    if (hints) {
      const text = (v: unknown) => join([plain(v) && `맥락 힌트 ${plain(v)}`])
      push('audience', text(hints.before), text(hints.after))
    }
  }
  return out
}
