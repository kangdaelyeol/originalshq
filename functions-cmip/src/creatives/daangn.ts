// 당근 광고 소재 찾기 — 집행 중인 소재(GET /v1/materials)의 영상·이미지 주소를
// 모은다. 조회만 한다.
//
// 확인한 것(2026-11-03, 소재 26개): 모두 영상 소재(OUT_LINK_VIDEO)였고,
// playbackUrl은 키 없이 열리는 HLS 목록(.m3u8), displayImageUrl은 표지 이미지
// (1080×1920 JPEG)다. 영상이 없는 소재는 표지 이미지를 소재로 쓴다.
import { createHash } from 'node:crypto'
import { fetchDaangn, type DaangnCredentials } from '../channel/daangn/client'
import { ADVERTISER_ID, PAGE_SIZE } from '../channel/daangn/constants'
import type { DaangnPagination } from '../channel/daangn/types'
import type { CreativeKind, FoundCreative } from './types'

interface DaangnMaterialApi {
  id: string
  title?: string
  groupId?: string
  campaignId?: string
  materialData?: {
    displayImageUrl?: string
    playbackUrl?: string
    displayTitle?: string
  }
}

/** 같은 영상을 여러 소재에 썼으면 한 문서로 묶으려고 — 재생 주소의 스트림 ID
 * (…/stream/{ID}/playback). 꼴이 다르면 주소의 해시. */
const mediaIdOf = (kind: CreativeKind, url: string) => {
  const stream =
    kind === 'video' ? url.match(/\/stream\/([0-9a-zA-Z]+)\//)?.[1] : null
  return stream ?? createHash('sha1').update(url).digest('hex').slice(0, 20)
}

/** 집행 중인 소재 전부 — 문서 id별로 묶는다. */
export async function findActiveDaangnCreatives(
  credentials: DaangnCredentials,
): Promise<{ ads: number; creatives: FoundCreative[] }> {
  const materials: DaangnMaterialApi[] = []
  for (let page = 1; ; page++) {
    const res = await fetchDaangn<{
      materials?: DaangnMaterialApi[]
      pagination?: DaangnPagination
    }>(
      `/v1/materials?pageNumber=${page}&pageSize=${PAGE_SIZE}&liveStatuses=ON`,
      credentials,
    )
    materials.push(...(res.materials ?? []))
    if (!res.pagination || page >= res.pagination.totalPageCount) break
  }

  const byId = new Map<string, FoundCreative>()
  for (const m of materials) {
    if (!m.groupId || !m.campaignId) continue
    const video = m.materialData?.playbackUrl
    const image = m.materialData?.displayImageUrl
    const url = video || image
    if (!url) continue
    const kind: CreativeKind = video ? 'video' : 'image'
    const mediaId = mediaIdOf(kind, url)
    const id = `daangn_${kind}_${mediaId}`
    const found: FoundCreative = byId.get(id) ?? {
      id,
      channel: 'daangn',
      kind,
      mediaId,
      accountId: ADVERTISER_ID,
      pageId: null,
      sourceUrl: url,
      ads: {},
    }
    found.ads[m.id] = {
      name: m.title ?? m.materialData?.displayTitle ?? '',
      adsetId: m.groupId,
      campaignId: m.campaignId,
    }
    byId.set(id, found)
  }
  return { ads: materials.length, creatives: [...byId.values()] }
}
