// OpenAI(ChatGPT) 캠페인·광고그룹 설정 읽기 — 캠페인 일 예산
// (budget.daily_spend_limit_micros)·입찰 방식·지역 타기팅, 광고그룹 입찰 설정과
// 맥락 힌트(context_hints). 집행 중인(active) 것만, 조회만 한다.
// 확인한 것(2026-11-03): 필드 이름은 실제 응답에서 봤지만 값의 모양(지역·입찰
// 설정·힌트가 글자인지 객체인지)은 확인하지 못해서 plain()으로 글자로 만든다.
import { adEntityKey } from '../ad-settings/types'
import type { OpenaiCredentials } from '../channel/openai/client'
import { listAll } from '../creatives/openai'
import { budgetOf, join, plain, reading } from './format'
import type { PlatformReading } from './types'

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
            bidding: plain(g.bidding_config),
            audience: join([
              plain(g.context_hints) && `맥락 힌트 ${plain(g.context_hints)}`,
            ]),
          },
        ),
      )
  }
  return out
}
