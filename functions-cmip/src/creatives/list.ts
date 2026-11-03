// 광고 설정 화면의 소재 목록 — 캠페인·광고셋 하나에서 쓰인 저장 소재
// (adCreatives). 광고셋은 adsetKeys로 바로, 캠페인은 광고 설정 목록
// (adEntities)에서 그 캠페인의 광고셋을 찾아 모은다(소재 문서는 광고셋 키만
// 가진다). 화면이 썸네일을 그릴 수 있게 주소가 없는 소재는 여기서 채운다.
import { adEntitiesCol, type AdEntityKey } from '../ad-settings'
import { todayISO } from '../channel/utils/dates'
import { db } from '../data'
import { withDownloadUrls } from './media'
import { AD_CREATIVES, type AdCreative } from './types'

export interface AdCreativeView {
  id: string
  channel: AdCreative['channel']
  kind: AdCreative['kind']
  status: AdCreative['status']
  error: string | null
  /** 오늘 집행 중인 광고에서 봤는지 — 새 장을 열 때 미리 체크한다. */
  active: boolean
  lastSeenDate: string
  /** 이 소재를 쓴 광고(이 캠페인·광고셋 안의 것만). */
  ads: { id: string; name: string; adsetId: string }[]
  media: {
    width: number | null
    height: number | null
    lengthSec: number | null
    thumbnailUrl: string | null
    originalUrl: string | null
    contentType: string
    frames: { t: number; url: string | null }[]
  } | null
}

/** array-contains-any는 값 30개까지라 나눠 묻는다. */
const IN_LIMIT = 30
/** 주소를 채울 때 동시에 처리할 소재 수(소재 하나에 파일이 최대 31개). */
const FILL_CONCURRENCY = 6

/** items를 limit개씩 동시에 돌린다. */
export async function mapLimit<T>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < items.length) await run(items[next++])
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  )
}

const adsetKeysOf = async (entityKey: AdEntityKey): Promise<string[]> => {
  const [channel, level, platformId] = entityKey.split(':')
  if (level === 'adset') return [entityKey]
  const snap = await adEntitiesCol()
    .where('channel', '==', channel)
    .where('level', '==', 'adset')
    .where('campaignId', '==', platformId)
    .get()
  return snap.docs.map((d) => d.id)
}

export async function listAdCreatives(
  entityKey: AdEntityKey,
): Promise<AdCreativeView[]> {
  const keys = await adsetKeysOf(entityKey)
  const byId = new Map<string, AdCreative>()
  for (let i = 0; i < keys.length; i += IN_LIMIT) {
    const snap = await db
      .collection(AD_CREATIVES)
      .where('adsetKeys', 'array-contains-any', keys.slice(i, i + IN_LIMIT))
      .get()
    for (const d of snap.docs) byId.set(d.id, d.data() as AdCreative)
  }

  const today = todayISO()
  const adsetIds = new Set(keys.map((k) => k.split(':')[2]))
  // 토큰을 붙이기 전에 저장한 소재 — 주소를 채우고 저장해 둔다(예약 동기화가
  // 미리 채우므로 보통은 없다). 소재 여러 개를 동시에.
  const creatives = [...byId.values()]
  const filledMedia = new Map<string, AdCreative['media']>()
  await mapLimit(
    creatives.filter((c) => c.status === 'ready'),
    FILL_CONCURRENCY,
    async (creative) => {
      if (!creative.media) return
      const filled = await withDownloadUrls(creative.media)
      if (!filled) return
      await db
        .collection(AD_CREATIVES)
        .doc(creative.id)
        .update({ media: filled })
      filledMedia.set(creative.id, filled)
    },
  )

  const views: AdCreativeView[] = []
  for (const creative of creatives) {
    const media = filledMedia.get(creative.id) ?? creative.media
    views.push({
      id: creative.id,
      channel: creative.channel,
      kind: creative.kind,
      status: creative.status,
      error: creative.error,
      active: creative.lastSeenDate === today,
      lastSeenDate: creative.lastSeenDate,
      ads: Object.entries(creative.ads)
        .filter(([, ad]) => adsetIds.has(ad.adsetId))
        .map(([id, ad]) => ({ id, name: ad.name, adsetId: ad.adsetId })),
      media: media
        ? {
            width: media.width,
            height: media.height,
            lengthSec: media.lengthSec,
            thumbnailUrl: media.frames[0]?.url ?? null,
            originalUrl: media.originalUrl ?? null,
            contentType: media.contentType,
            frames: media.frames.map((f) => ({ t: f.t, url: f.url ?? null })),
          }
        : null,
    })
  }
  // 집행 중인 것 먼저, 그다음 최근에 본 순.
  return views.sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      b.lastSeenDate.localeCompare(a.lastSeenDate) ||
      a.id.localeCompare(b.id),
  )
}
