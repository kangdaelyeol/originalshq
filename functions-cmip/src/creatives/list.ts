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
  const views: AdCreativeView[] = []
  for (const creative of byId.values()) {
    let media = creative.media
    if (creative.status === 'ready' && media) {
      // 토큰을 붙이기 전에 저장한 소재 — 한 번만 채우고 저장해 둔다.
      const filled = await withDownloadUrls(media)
      if (filled) {
        await db
          .collection(AD_CREATIVES)
          .doc(creative.id)
          .update({ media: filled })
        media = filled
      }
    }
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
