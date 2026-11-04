// 네이버 검색광고 캠페인·광고그룹 설정 읽기 — 하루 예산(쓸 때만), 기본
// 입찰가와 PC·모바일 입찰 가중치, 노출 대상 요약(targetSummary). 노출 가능한
// (ELIGIBLE) 것만, 조회만 한다. 검색광고라 연령·관심사 같은 타기팅은 이 목록에
// 오지 않는다.
import { adEntityKey } from '../ad-settings/types'
import { fetchNaver, type NaverCredentials } from '../channel/naver/client'
import { budgetOf, join, plain, positiveOrNull, reading, won } from './format'
import type { PlatformReading } from './types'

interface NaverBudgeted {
  status?: string
  name?: string
  useDailyBudget?: boolean
  dailyBudget?: number
}

interface RawCampaign extends NaverBudgeted {
  nccCampaignId: string
}

interface RawAdgroup extends NaverBudgeted {
  nccAdgroupId: string
  nccCampaignId: string
  bidAmt?: number
  useCntsNetworkBidAmt?: boolean
  contentsNetworkBidAmt?: number
  pcNetworkBidWeight?: number
  mobileNetworkBidWeight?: number
  targetSummary?: Record<string, unknown>
}

const SUMMARY_LABEL: Record<string, string> = {
  pcMobile: 'PC·모바일',
  media: '노출 매체',
}

const budgetOfRaw = (o: NaverBudgeted) =>
  o.useDailyBudget ? budgetOf(o.dailyBudget, 'daily') : null

/** 노출 가능한 캠페인과 그 광고그룹의 설정. */
export async function readNaverSettings(
  credentials: NaverCredentials,
): Promise<PlatformReading[]> {
  const campaigns = (
    await fetchNaver<RawCampaign[]>('/ncc/campaigns', {}, credentials)
  ).filter((c) => c.status === 'ELIGIBLE')
  const live = new Set(campaigns.map((c) => c.nccCampaignId))
  const adgroups = (
    await fetchNaver<RawAdgroup[]>('/ncc/adgroups', {}, credentials)
  ).filter((g) => g.status === 'ELIGIBLE' && live.has(g.nccCampaignId))

  return [
    ...campaigns.map((c) =>
      reading(
        {
          entityKey: adEntityKey('naver', 'campaign', c.nccCampaignId),
          channel: 'naver',
          level: 'campaign',
          platformId: c.nccCampaignId,
          name: c.name ?? '',
        },
        { budget: budgetOfRaw(c) },
      ),
    ),
    ...adgroups.map((g) => {
      const bid = positiveOrNull(g.bidAmt)
      const contents = positiveOrNull(g.contentsNetworkBidAmt)
      const summary = Object.entries(g.targetSummary ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => {
          const text = plain(value)
          return text ? `${SUMMARY_LABEL[key] ?? key} ${text}` : ''
        })
      return reading(
        {
          entityKey: adEntityKey('naver', 'adset', g.nccAdgroupId),
          channel: 'naver',
          level: 'adset',
          platformId: g.nccAdgroupId,
          name: g.name ?? '',
        },
        {
          budget: budgetOfRaw(g),
          bidding: join([
            bid !== null && `기본 입찰가 ${won(bid)}`,
            g.useCntsNetworkBidAmt &&
              contents !== null &&
              `콘텐츠 매체 ${won(contents)}`,
            g.pcNetworkBidWeight !== undefined && `PC ${g.pcNetworkBidWeight}%`,
            g.mobileNetworkBidWeight !== undefined &&
              `모바일 ${g.mobileNetworkBidWeight}%`,
          ]),
          audience: join(summary),
        },
      )
    }),
  ]
}
