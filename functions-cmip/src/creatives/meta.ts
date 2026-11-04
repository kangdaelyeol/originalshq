// Meta 광고 소재 찾기 — 집행 중인 광고마다 소재(creative)에 걸린 영상 ID·이미지
// hash를 모으고, 파일 다운로드 주소를 얻는다. 조회만 한다.
//
// 확인한 것(2026-11-03, 집행 중 광고 17개 표본):
//   · 이미지: adimages(hash)가 원본 크기(1440px 등) 주소를 준다. 소재의
//     thumbnail_url은 64px라 못 쓴다.
//   · 영상: 광고 토큰으로는 source(mp4 주소)가 안 오고, 영상을 올린 페이지의
//     토큰으로 물어야 온다(me/accounts에서 받는다).
import { META_AD_ACCOUNT_IDS } from '../channel/meta'
import { graphGet } from '../channel/meta/creatives'
import type { CreativeKind, FoundCreative } from './types'

interface RawCreative {
  image_hash?: string
  video_id?: string
  object_story_spec?: {
    page_id?: string
    video_data?: { video_id?: string; image_hash?: string }
    link_data?: { image_hash?: string }
    photo_data?: { image_hash?: string }
  }
  asset_feed_spec?: {
    images?: { hash?: string }[]
    videos?: { video_id?: string }[]
  }
}

interface RawAd {
  id: string
  name?: string
  adset_id?: string
  campaign_id?: string
  creative?: RawCreative
}

export const creativeId = (kind: CreativeKind, mediaId: string) =>
  `meta_${kind}_${mediaId}`

/** 소재 하나에 걸린 파일들 — 일반 광고는 하나, 다이내믹 소재(asset_feed_spec)는
 * 여럿. 영상 광고의 표지 이미지(video_data.image_hash)는 빼고 영상만 센다. */
const mediaOf = (c: RawCreative): { kind: CreativeKind; mediaId: string }[] => {
  const videos = [
    c.video_id,
    c.object_story_spec?.video_data?.video_id,
    ...(c.asset_feed_spec?.videos ?? []).map((v) => v.video_id),
  ]
  const images = videos.some(Boolean)
    ? []
    : [
        c.image_hash,
        c.object_story_spec?.link_data?.image_hash,
        c.object_story_spec?.photo_data?.image_hash,
        ...(c.asset_feed_spec?.images ?? []).map((i) => i.hash),
      ]
  const out = new Map<string, { kind: CreativeKind; mediaId: string }>()
  for (const id of videos)
    if (id) out.set(`video:${id}`, { kind: 'video', mediaId: id })
  for (const hash of images)
    if (hash) out.set(`image:${hash}`, { kind: 'image', mediaId: hash })
  return [...out.values()]
}

/** 페이지를 끝까지 따라가며 받는다(paging.next는 토큰이 붙은 전체 주소). */
export async function listAll<T>(
  path: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<T[]> {
  const first = await graphGet<{ data: T[]; paging?: { next?: string } }>(
    path,
    params,
    accessToken,
  )
  if (!first.ok) throw new Error(`Meta 조회 실패(${path}) — ${first.error}`)
  const out = [...first.data.data]
  let next = first.data.paging?.next
  while (next) {
    const res = await fetch(next)
    const body = (await res.json().catch(() => ({}))) as {
      data?: T[]
      paging?: { next?: string }
      error?: { message?: string }
    }
    if (!res.ok || body.error)
      throw new Error(
        `Meta 조회 실패(${path}) — ${body.error?.message ?? res.status}`,
      )
    out.push(...(body.data ?? []))
    next = body.paging?.next
  }
  return out
}

/** 집행 중인 광고의 소재 전부 — 문서 id별로 묶는다. */
export async function findActiveMetaCreatives(
  accessToken: string,
): Promise<{ ads: number; creatives: FoundCreative[] }> {
  const byId = new Map<string, FoundCreative>()
  let adCount = 0
  for (const accountId of META_AD_ACCOUNT_IDS) {
    const ads = await listAll<RawAd>(
      `act_${accountId}/ads`,
      {
        fields:
          'id,name,adset_id,campaign_id,creative{image_hash,video_id,object_story_spec,asset_feed_spec}',
        effective_status: JSON.stringify(['ACTIVE']),
        limit: '100',
      },
      accessToken,
    )
    adCount += ads.length
    for (const ad of ads) {
      if (!ad.creative || !ad.adset_id || !ad.campaign_id) continue
      for (const { kind, mediaId } of mediaOf(ad.creative)) {
        const id = creativeId(kind, mediaId)
        const found: FoundCreative = byId.get(id) ?? {
          id,
          channel: 'meta',
          kind,
          mediaId,
          accountId,
          pageId: ad.creative.object_story_spec?.page_id ?? null,
          ads: {},
        }
        found.ads[ad.id] = {
          name: ad.name ?? '',
          adsetId: ad.adset_id,
          campaignId: ad.campaign_id,
        }
        byId.set(id, found)
      }
    }
  }
  return { ads: adCount, creatives: [...byId.values()] }
}

/** 이 토큰으로 받을 수 있는 페이지 토큰(페이지 ID → 토큰). */
export async function pageTokensOf(
  accessToken: string,
): Promise<Map<string, string>> {
  const pages = await listAll<{ id: string; access_token?: string }>(
    'me/accounts',
    { fields: 'id,access_token', limit: '100' },
    accessToken,
  )
  const out = new Map<string, string>()
  for (const p of pages) if (p.access_token) out.set(p.id, p.access_token)
  return out
}

/** 파일 다운로드 주소(서명된 임시 주소 — 받자마자 내려받는다). */
export async function mediaUrlOf(
  creative: Pick<FoundCreative, 'kind' | 'mediaId' | 'accountId' | 'pageId'>,
  accessToken: string,
  pageTokens: ReadonlyMap<string, string>,
): Promise<{ url: string; lengthSec: number | null }> {
  if (creative.kind === 'image') {
    const res = await graphGet<{ data: { url?: string }[] }>(
      `act_${creative.accountId}/adimages`,
      {
        hashes: JSON.stringify([creative.mediaId]),
        fields: 'url',
      },
      accessToken,
    )
    if (!res.ok) throw new Error(`이미지 주소 조회 실패 — ${res.error}`)
    const url = res.data.data[0]?.url
    if (!url) throw new Error('이미지 주소가 없습니다(adimages)')
    return { url, lengthSec: null }
  }

  // 영상 — 주인 페이지를 알아내 그 페이지 토큰으로 source를 묻는다.
  const meta = await graphGet<{ length?: number; from?: { id?: string } }>(
    creative.mediaId,
    { fields: 'length,from' },
    accessToken,
  )
  const lengthSec = meta.ok ? (meta.data.length ?? null) : null
  const ownerId = (meta.ok && meta.data.from?.id) || creative.pageId
  const pageToken = ownerId ? pageTokens.get(ownerId) : undefined
  for (const token of [pageToken, accessToken]) {
    if (!token) continue
    const res = await graphGet<{ source?: string }>(
      creative.mediaId,
      { fields: 'source' },
      token,
    )
    if (res.ok && res.data.source) return { url: res.data.source, lengthSec }
  }
  throw new Error(
    pageToken
      ? '영상 파일 주소(source)를 받지 못했습니다'
      : `영상 주인 페이지(${ownerId ?? '알 수 없음'})의 토큰이 없어 파일 주소를 받을 수 없습니다`,
  )
}
