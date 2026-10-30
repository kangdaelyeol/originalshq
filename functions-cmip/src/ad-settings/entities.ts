import type {
  CollectionReference,
  DocumentData,
} from 'firebase-admin/firestore'
import { db } from '../data'
import type { ISODate } from '../types'
import type { DataSetInsight } from '../channel/meta/types'
import { getResultType } from '../channel/meta/utils'
import type {
  GoogleAdGroupInsightRow,
  GoogleCampaignInsightRow,
} from '../channel/google/types'
import type { NaverInsightRow } from '../channel/naver/types'
import type { OpenaiInsightRow } from '../channel/openai/types'
import {
  adEntityKey,
  type AdChannel,
  type AdEntity,
  type AdEntityDoc,
  type AdLevel,
} from './types'

export const adEntitiesCol = (): CollectionReference<DocumentData> =>
  db.collection('adEntities')

/** 일별 행 하나에서 본 캠페인·광고셋 하나("이 날 이 이름으로 돌았다"). */
export interface AdEntitySighting {
  channel: AdChannel
  level: AdLevel
  platformId: string
  name: string
  campaignId: string
  campaignName: string
  date: ISODate
  platformResultType: string | null
}

const both = (
  channel: AdChannel,
  row: {
    campaignId: string
    campaignName: string
    adsetId: string | null
    adsetName: string | null
    date: ISODate
    resultType: string | null
  },
): AdEntitySighting[] => {
  const campaign: AdEntitySighting = {
    channel,
    level: 'campaign',
    platformId: row.campaignId,
    name: row.campaignName,
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    date: row.date,
    platformResultType: row.resultType,
  }
  if (!row.adsetId) return [campaign]
  return [
    campaign,
    {
      ...campaign,
      level: 'adset',
      platformId: row.adsetId,
      name: row.adsetName ?? '',
    },
  ]
}

export const sightingsFromMeta = (
  rows: readonly DataSetInsight[],
): AdEntitySighting[] =>
  rows.flatMap((r) =>
    both('meta', {
      campaignId: r.campaign_id,
      campaignName: r.campaign_name,
      adsetId: r.adset_id,
      adsetName: r.adset_name,
      date: r.date_start,
      resultType: getResultType(r),
    }),
  )

export const sightingsFromGoogleCampaigns = (
  rows: readonly GoogleCampaignInsightRow[],
): AdEntitySighting[] =>
  rows.flatMap((r) =>
    both('google', {
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      adsetId: null,
      adsetName: null,
      date: r.date,
      resultType: null,
    }),
  )

export const sightingsFromGoogleAdGroups = (
  rows: readonly GoogleAdGroupInsightRow[],
): AdEntitySighting[] =>
  rows.flatMap((r) =>
    both('google', {
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      adsetId: r.adGroupId,
      adsetName: r.adGroupName,
      date: r.date,
      resultType: null,
    }),
  )

export const sightingsFromNaver = (
  rows: readonly NaverInsightRow[],
): AdEntitySighting[] =>
  rows.flatMap((r) =>
    both('naver', {
      campaignId: r.campaign_id,
      campaignName: r.campaign_name,
      adsetId: r.adgroup_id,
      adsetName: r.adgroup_name,
      date: r.date_start,
      resultType: null,
    }),
  )

export const sightingsFromOpenai = (
  rows: readonly OpenaiInsightRow[],
): AdEntitySighting[] =>
  rows.flatMap((r) =>
    both('openai', {
      campaignId: r.campaign_id,
      campaignName: r.campaign_name,
      adsetId: r.adgroup_id,
      adsetName: r.adgroup_name,
      date: r.date_start,
      resultType: null,
    }),
  )

/**
 * 본 것들을 adEntities에 반영한다 — 처음 본 날·마지막 본 날을 넓히고, 이름은
 * 가장 최근 날의 이름으로(플랫폼에서 이름을 바꾸면 따라간다). 동기화가 지난
 * 날짜를 다시 받아도 날짜 범위가 줄지 않게 기존 문서와 합친다.
 */
export async function recordAdEntities(
  sightings: readonly AdEntitySighting[],
): Promise<{ recorded: number }> {
  const merged = new Map<string, AdEntitySighting & { first: ISODate }>()
  for (const s of sightings) {
    if (!s.platformId) continue
    const key = adEntityKey(s.channel, s.level, s.platformId)
    const prev = merged.get(key)
    if (!prev) {
      merged.set(key, { ...s, first: s.date })
      continue
    }
    const newer = s.date >= prev.date
    merged.set(key, {
      ...(newer ? s : prev),
      first: s.date < prev.first ? s.date : prev.first,
      date: newer ? s.date : prev.date,
      platformResultType:
        (newer ? s.platformResultType : prev.platformResultType) ??
        prev.platformResultType ??
        s.platformResultType,
    })
  }
  if (merged.size === 0) return { recorded: 0 }

  const col = adEntitiesCol()
  const keys = [...merged.keys()]
  const existing = new Map<string, AdEntityDoc>()
  // getAll은 한 번에 너무 많이 넘기지 않는다.
  for (let i = 0; i < keys.length; i += 300) {
    const snaps = await db.getAll(
      ...keys.slice(i, i + 300).map((key) => col.doc(key)),
    )
    for (const snap of snaps) {
      if (snap.exists) existing.set(snap.id, snap.data() as AdEntityDoc)
    }
  }

  const now = Date.now()
  const writer = db.bulkWriter()
  for (const [key, s] of merged) {
    const old = existing.get(key)
    const keepOldName = old !== undefined && old.lastSeenDate > s.date
    const doc: AdEntityDoc = {
      channel: s.channel,
      level: s.level,
      platformId: s.platformId,
      name: keepOldName ? old.name : s.name,
      campaignId: s.campaignId,
      campaignName: keepOldName ? old.campaignName : s.campaignName,
      firstSeenDate:
        old && old.firstSeenDate < s.first ? old.firstSeenDate : s.first,
      lastSeenDate:
        old && old.lastSeenDate > s.date ? old.lastSeenDate : s.date,
      platformResultType:
        (keepOldName ? old.platformResultType : s.platformResultType) ??
        old?.platformResultType ??
        null,
      updatedAt: now,
    }
    writer.set(col.doc(key), doc)
  }
  await writer.close()
  return { recorded: merged.size }
}

/** 동기화 끝에 붙이는 반영 — 목록 반영이 실패해도 동기화(성과 저장)는 성공으로
 * 둔다(목록은 다음 동기화나 backfillAdEntities로 다시 채워진다). */
export async function recordAdEntitiesSafely(
  sightings: readonly AdEntitySighting[],
  log: (message: string, error: unknown) => void,
): Promise<void> {
  try {
    await recordAdEntities(sightings)
  } catch (error) {
    log('adEntities 반영 실패(동기화는 계속):', error)
  }
}

export async function listAdEntities(): Promise<AdEntity[]> {
  const snap = await adEntitiesCol().get()
  return snap.docs.map((d) => ({ key: d.id, ...(d.data() as AdEntityDoc) }))
}

/**
 * 이미 쌓인 일별 행 전부에서 목록을 다시 만든다 — 처음 한 번(이 기능 전에
 * 동기화된 기간)과, 목록이 어긋났을 때. 필요한 칸만 읽는다.
 */
export async function backfillAdEntities(): Promise<{
  recorded: number
  scanned: Record<string, number>
}> {
  const [meta, googleCampaigns, googleAdGroups, naver, openai] =
    await Promise.all([
      db
        .collection('metaInsightDaily')
        .select(
          'campaign_id',
          'campaign_name',
          'adset_id',
          'adset_name',
          'date_start',
          'results',
        )
        .get(),
      db
        .collection('googleCampaignInsightDaily')
        .select('campaignId', 'campaignName', 'date')
        .get(),
      db
        .collection('googleAdGroupInsightDaily')
        .select(
          'campaignId',
          'campaignName',
          'adGroupId',
          'adGroupName',
          'date',
        )
        .get(),
      db
        .collection('naverInsightDaily')
        .select(
          'campaign_id',
          'campaign_name',
          'adgroup_id',
          'adgroup_name',
          'date_start',
        )
        .get(),
      db
        .collection('openaiInsightDaily')
        .select(
          'campaign_id',
          'campaign_name',
          'adgroup_id',
          'adgroup_name',
          'date_start',
        )
        .get(),
    ])
  const sightings = [
    ...sightingsFromMeta(meta.docs.map((d) => d.data() as DataSetInsight)),
    ...sightingsFromGoogleCampaigns(
      googleCampaigns.docs.map((d) => d.data() as GoogleCampaignInsightRow),
    ),
    ...sightingsFromGoogleAdGroups(
      googleAdGroups.docs.map((d) => d.data() as GoogleAdGroupInsightRow),
    ),
    ...sightingsFromNaver(naver.docs.map((d) => d.data() as NaverInsightRow)),
    ...sightingsFromOpenai(
      openai.docs.map((d) => d.data() as OpenaiInsightRow),
    ),
  ]
  const { recorded } = await recordAdEntities(sightings)
  return {
    recorded,
    scanned: {
      metaInsightDaily: meta.size,
      googleCampaignInsightDaily: googleCampaigns.size,
      googleAdGroupInsightDaily: googleAdGroups.size,
      naverInsightDaily: naver.size,
      openaiInsightDaily: openai.size,
    },
  }
}
