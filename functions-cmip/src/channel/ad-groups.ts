// 광고그룹 단위 인사이트 — "광고 성과" 탭(주간 매체 성과표)의 Google·네이버·OpenAI·당근.
//
// Meta는 상담의 utm_campaign이 광고 이름이라 광고 단위(meta/ads.ts)로 맞추지만, 나머지 매체는 광고비가
// 광고그룹 × 일까지만 있다(광고 단위 광고비는 받지 않는다). 그래서 광고그룹(ID·이름·캠페인)과 그 하루치
// 광고비를 주고, 상담의 utm_campaign이 소재 이름일 때 광고그룹으로 이을 수 있게 소재 동기화
// (adCreatives)가 찾은 광고 이름 → 광고그룹 대응도 같이 준다. 저장된 값만 읽는다(예약 동기화가 최근
// 14일을 하루 6번 다시 받는다).
import * as logger from 'firebase-functions/logger'
import { db } from '../data'
import { AD_CREATIVES, type AdCreative } from '../creatives/types'
import { fetchDaangnInsightRowsFromDb } from './daangn/firestore'
import { fetchGoogleAdGroupInsightRowsFromDb, fetchGoogleCampaignInsightRowsFromDb } from './google/firestore'
import { fetchNaverInsightRowsFromDb } from './naver/firestore'
import { fetchOpenaiInsightRowsFromDb } from './openai/firestore'

export const AD_GROUP_CHANNELS = ['google', 'naver', 'openai', 'daangn'] as const
export type AdGroupChannel = (typeof AD_GROUP_CHANNELS)[number]

export interface ChannelAdGroups {
  /** 광고그룹 — 이름은 구간 안 가장 최근 날짜 값. Google은 광고그룹이 없는 캠페인(실적 최대화 등)의 광고비를
   * 캠페인마다 '(광고그룹 없음)' 줄 하나로 둔다(id = 'campaign:{캠페인 id}'). */
  adGroups: { id: string; name: string; campaignId: string; campaignName: string }[]
  /** [광고그룹 순번, 날짜, 광고비, 노출, 클릭] — 셋 다 0인 날은 뺀다. */
  daily: [number, string, number, number, number][]
  /** 소재 동기화가 찾은 광고(소재) 이름과 그 광고그룹 id — 집행 중일 때 본 이미지·영상 소재만이다(텍스트·검색
   * 광고와 소재 동기화 전에 끝난 광고는 없다). */
  ads: { name: string; adGroupId: string }[]
}

export interface AdGroupInsights {
  /** 매체마다 — 못 읽은 매체는 빠진다(errors에 이유). 매체 하나가 실패해도 나머지는 준다. */
  channels: Partial<Record<AdGroupChannel, ChannelAdGroups>>
  /** 못 읽은 매체, 또는 소재 이름 대응('creatives' — 못 읽으면 ads가 비어 소재 이름으로는 찾지 않는다)과 그
   * 이유. */
  errors: Partial<Record<AdGroupChannel | 'creatives', string>>
}

/** 매체마다 모양이 다른 저장 행을 맞춘 하루치. */
interface DayRow {
  adGroupId: string
  adGroupName: string
  campaignId: string
  campaignName: string
  date: string
  spend: number
  impressions: number
  clicks: number
}

/** 하루치 행을 화면용 모양으로 — 광고그룹 정보는 한 번만, 날짜별 값은 순번으로. */
const toChannel = (rows: DayRow[]): Omit<ChannelAdGroups, 'ads'> => {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const latest = new Map<string, DayRow>()
  for (const row of sorted) latest.set(row.adGroupId, row)
  // 매체가 이름을 비워 보낸 줄(null)도 화면이 깨지지 않게 ''로.
  const adGroups = [...latest.values()].map((row) => ({
    id: row.adGroupId,
    name: row.adGroupName ?? '',
    campaignId: row.campaignId,
    campaignName: row.campaignName ?? '',
  }))
  const index = new Map(adGroups.map((group, i) => [group.id, i]))
  const daily: ChannelAdGroups['daily'] = sorted
    .filter((row) => row.spend > 0 || row.impressions > 0 || row.clicks > 0)
    .map((row) => [index.get(row.adGroupId) as number, row.date, row.spend, row.impressions, row.clicks])
  return { adGroups, daily }
}

/** Google — 광고그룹 하루치에, 캠페인 하루치 중 광고그룹으로 나뉘지 않은 몫(실적 최대화처럼 광고그룹이 없는
 * 캠페인)을 '(광고그룹 없음)' 줄로 더한다. 그래야 캠페인 합계가 캠페인 광고비와 같다. 차이는 원 단위로 반올림하기
 * 전 값(costMicros)으로 낸다 — 줄마다 반올림한 원 단위로 빼면 광고그룹이 다 있는 캠페인에도 1~2원짜리 줄이
 * 생긴다. */
const googleDayRows = async (dateStart: string, dateEnd: string): Promise<DayRow[]> => {
  const [campaigns, adGroups] = await Promise.all([
    fetchGoogleCampaignInsightRowsFromDb(dateStart, dateEnd),
    fetchGoogleAdGroupInsightRowsFromDb(dateStart, dateEnd),
  ])
  const rows: DayRow[] = adGroups.map((row) => ({
    adGroupId: row.adGroupId,
    adGroupName: row.adGroupName,
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    date: row.date,
    spend: row.cost,
    impressions: row.impressions,
    clicks: row.clicks,
  }))
  const micros = (row: { costMicros?: number; cost: number }) => row.costMicros ?? row.cost * 1e6
  const grouped = new Map<string, { micros: number; impressions: number; clicks: number }>()
  for (const row of adGroups) {
    const key = `${row.campaignId}_${row.date}`
    const sum = grouped.get(key) ?? { micros: 0, impressions: 0, clicks: 0 }
    sum.micros += micros(row)
    sum.impressions += row.impressions
    sum.clicks += row.clicks
    grouped.set(key, sum)
  }
  for (const campaign of campaigns) {
    const sum = grouped.get(`${campaign.campaignId}_${campaign.date}`)
    const rest = {
      spend: Math.round((micros(campaign) - (sum?.micros ?? 0)) / 1e6),
      impressions: Math.max(0, campaign.impressions - (sum?.impressions ?? 0)),
      clicks: Math.max(0, campaign.clicks - (sum?.clicks ?? 0)),
    }
    // 남은 몫이 1원도 안 되면(반올림 차이) 버린다.
    if (rest.spend < 1 && rest.impressions === 0 && rest.clicks === 0) continue
    rows.push({
      adGroupId: `campaign:${campaign.campaignId}`,
      adGroupName: '(광고그룹 없음)',
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      date: campaign.date,
      spend: Math.max(0, rest.spend),
      impressions: rest.impressions,
      clicks: rest.clicks,
    })
  }
  return rows
}

/** 네이버·OpenAI·당근 — 저장 행 모양이 같다(광고그룹 하루치). 당근 광고비는 VAT를 뺀 값이다. */
const adGroupDayRows = (
  rows: {
    adgroup_id: string
    adgroup_name: string
    campaign_id: string
    campaign_name: string
    date_start: string
    spend: number
    impressions: number
    clicks: number
  }[],
): DayRow[] =>
  rows.map((row) => ({
    adGroupId: row.adgroup_id,
    adGroupName: row.adgroup_name,
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    date: row.date_start,
    spend: row.spend,
    impressions: row.impressions,
    clicks: row.clicks,
  }))

/** 소재 동기화가 찾은 광고 이름 → 광고그룹 — 매체별로, 같은 광고는 한 번만. 소재 문서는 파일 하나라 같은
 * 광고가 여러 문서에 나올 수 있다. 분석 결과 같은 큰 필드는 읽지 않는다. */
const creativeAds = async (): Promise<Record<AdGroupChannel, ChannelAdGroups['ads']>> => {
  const snap = await db
    .collection(AD_CREATIVES)
    .where('channel', 'in', [...AD_GROUP_CHANNELS])
    .select('channel', 'ads')
    .get()
  const out: Record<AdGroupChannel, ChannelAdGroups['ads']> = { google: [], naver: [], openai: [], daangn: [] }
  const seen = new Set<string>()
  for (const doc of snap.docs) {
    const { channel, ads } = doc.data() as Pick<AdCreative, 'channel' | 'ads'>
    if (!(AD_GROUP_CHANNELS as readonly string[]).includes(channel)) continue
    for (const [adId, ad] of Object.entries(ads ?? {})) {
      const key = `${channel}:${adId}`
      if (seen.has(key) || !ad.name || !ad.adsetId) continue
      seen.add(key)
      out[channel as AdGroupChannel].push({ name: ad.name, adGroupId: ad.adsetId })
    }
  }
  return out
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** [dateStart, dateEnd] 구간의 네 매체 광고그룹 하루치와 소재 이름 대응. 매체마다 따로 읽어, 하나가 실패해도
 * 나머지는 준다(실패한 매체와 이유는 errors에). */
export const readAdGroupInsights = async (dateStart: string, dateEnd: string): Promise<AdGroupInsights> => {
  const readers: Record<AdGroupChannel, () => Promise<DayRow[]>> = {
    google: () => googleDayRows(dateStart, dateEnd),
    naver: () => fetchNaverInsightRowsFromDb(dateStart, dateEnd).then(adGroupDayRows),
    openai: () => fetchOpenaiInsightRowsFromDb(dateStart, dateEnd).then(adGroupDayRows),
    daangn: () => fetchDaangnInsightRowsFromDb(dateStart, dateEnd).then(adGroupDayRows),
  }
  const [rows, ads] = await Promise.all([
    Promise.allSettled(AD_GROUP_CHANNELS.map((channel) => readers[channel]())),
    Promise.allSettled([creativeAds()]).then(([result]) => result),
  ])
  const out: AdGroupInsights = { channels: {}, errors: {} }
  if (ads.status === 'rejected') {
    logger.error('광고 성과: 소재 이름 대응을 읽지 못했습니다', ads.reason)
    out.errors.creatives = messageOf(ads.reason)
  }
  AD_GROUP_CHANNELS.forEach((channel, index) => {
    const result = rows[index]
    if (result.status === 'rejected') {
      logger.error(`광고 성과: ${channel} 광고그룹 하루치를 읽지 못했습니다`, result.reason)
      out.errors[channel] = messageOf(result.reason)
      return
    }
    out.channels[channel] = {
      ...toChannel(result.value),
      ads: ads.status === 'fulfilled' ? ads.value[channel] : [],
    }
  })
  return out
}
