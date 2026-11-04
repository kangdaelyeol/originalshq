// 네이버 검색광고 소재 찾기 — 집행 중인 광고그룹의 이미지 소재(쇼핑 상품·콘텐츠·
// 브랜드검색 광고의 이미지, 파워링크 이미지 등 이미지 확장소재)를 모은다. 조회만
// 한다.
//
// 확인한 것(2026-11-03, 광고그룹 13개 표본의 광고 28개·확장소재 14개): 광고는
// 문구 광고(TEXT_45)·쇼핑 상품(SHOPPING_PRODUCT_AD, imagePath)·콘텐츠
// (CONTENTS_AD_INFORMATION, imagePath)·브랜드검색(BRAND_SEARCH_AD, thumbnail)이고,
// 확장소재는 추가 제목·설명·홍보 문구와 파워링크 이미지(POWER_LINK_IMAGE,
// imagePath)였다. 문구뿐인 광고·확장소재는 이미지·영상이 아니라 모으지 않는다.
// 광고의 이미지는 전체 주소로 오지만 확장소재의 imagePath는 경로만 와서 이미지
// 서버(IMAGE_HOST)를 앞에 붙인다 — 공식 문서로는 확인하지 못한 주소다(틀리면
// 소재 처리가 "내려받기 실패"로 남는다).
import { createHash } from 'node:crypto'
import { fetchNaver, type NaverCredentials } from '../channel/naver/client'
import { mapSequential } from '../channel/naver/utils'
import type { FoundCreative } from './types'

const IMAGE_HOST = 'https://searchad-phinf.pstatic.net'

/** 이미지가 들어 있는 칸 — 광고(ad)와 확장소재(adExtension) 안에서 찾는다. */
const IMAGE_KEYS = new Set(['imagePath', 'thumbnail'])

const TYPE_LABEL: Record<string, string> = {
  SHOPPING_PRODUCT_AD: '쇼핑 상품',
  CONTENTS_AD_INFORMATION: '콘텐츠',
  BRAND_SEARCH_AD: '브랜드검색',
  POWER_LINK_IMAGE: '파워링크 이미지',
}

interface NaverItem {
  status?: string
  userLock?: boolean
  delFlag?: boolean
}

interface NaverCampaignRaw extends NaverItem {
  nccCampaignId: string
}

interface NaverAdgroupRaw extends NaverItem {
  nccAdgroupId: string
  nccCampaignId: string
  name?: string
}

interface NaverAdRaw extends NaverItem {
  nccAdId?: string
  type?: string
  ad?: Record<string, unknown>
}

interface NaverExtensionRaw extends NaverItem {
  nccAdExtensionId?: string
  type?: string
  adExtension?: Record<string, unknown>
}

/** 켜져 있고(잠그지 않았고) 노출 가능한 것 — 광고·확장소재는 상태 칸이 없으면
 * 잠금만 본다. */
const isLive = (item: NaverItem) =>
  !item.userLock &&
  !item.delFlag &&
  (item.status === undefined || item.status === 'ELIGIBLE')

/** 객체 안의 이미지 경로들(IMAGE_KEYS 칸, 한 단계씩 내려가며). */
const imagePathsOf = (o: unknown): string[] => {
  if (!o || typeof o !== 'object') return []
  return Object.entries(o as Record<string, unknown>).flatMap(([key, value]) =>
    typeof value === 'string'
      ? IMAGE_KEYS.has(key) && value
        ? [value]
        : []
      : imagePathsOf(value),
  )
}

const urlOf = (path: string) =>
  /^https?:\/\//.test(path)
    ? path
    : `${IMAGE_HOST}${path.startsWith('/') ? '' : '/'}${path}`

/** 같은 이미지를 여러 광고에 썼으면 한 문서로 — 주소의 해시(당근과 같은 방식). */
const mediaIdOf = (url: string) =>
  createHash('sha1').update(url).digest('hex').slice(0, 20)

/** 광고 이름이 따로 없어서 — 제목·상품명, 없으면 종류와 광고그룹 이름. */
const nameOf = (
  type: string | undefined,
  body: Record<string, unknown> | undefined,
  adgroup: NaverAdgroupRaw,
) => {
  const text = [body?.headline, body?.productName].find(
    (v): v is string => typeof v === 'string' && v.trim() !== '',
  )
  return (
    text ??
    [TYPE_LABEL[type ?? ''] ?? type, adgroup.name].filter(Boolean).join(' · ')
  )
}

/** 집행 중인(캠페인·광고그룹·광고가 다 켜진) 이미지 소재 전부 — 문서 id별로
 * 묶는다. 광고·확장소재는 광고그룹마다 물어야 해서, 요청 제한에 걸리지 않게
 * 하나씩 사이를 두고 묻는다(client.ts의 fetchAdgroups와 같은 이유). */
export async function findActiveNaverCreatives(
  credentials: NaverCredentials,
): Promise<{ ads: number; creatives: FoundCreative[] }> {
  const campaigns = await fetchNaver<NaverCampaignRaw[]>(
    '/ncc/campaigns',
    {},
    credentials,
  )
  const liveCampaigns = new Set(
    campaigns.filter(isLive).map((c) => c.nccCampaignId),
  )
  const adgroups = (
    await fetchNaver<NaverAdgroupRaw[]>('/ncc/adgroups', {}, credentials)
  ).filter((g) => isLive(g) && liveCampaigns.has(g.nccCampaignId))

  const byId = new Map<string, FoundCreative>()
  let adCount = 0
  const add = (
    adgroup: NaverAdgroupRaw,
    adId: string,
    name: string,
    paths: string[],
  ) => {
    for (const path of paths) {
      const url = urlOf(path)
      const mediaId = mediaIdOf(url)
      const id = `naver_image_${mediaId}`
      const found: FoundCreative = byId.get(id) ?? {
        id,
        channel: 'naver',
        kind: 'image',
        mediaId,
        accountId: credentials.customerId,
        pageId: null,
        sourceUrl: url,
        ads: {},
      }
      found.ads[adId] = {
        name,
        adsetId: adgroup.nccAdgroupId,
        campaignId: adgroup.nccCampaignId,
      }
      byId.set(id, found)
    }
  }

  await mapSequential(adgroups, async (adgroup) => {
    const ads = await fetchNaver<NaverAdRaw[]>(
      '/ncc/ads',
      { nccAdgroupId: adgroup.nccAdgroupId },
      credentials,
    )
    const extensions = await fetchNaver<NaverExtensionRaw[]>(
      '/ncc/ad-extensions',
      { ownerId: adgroup.nccAdgroupId },
      credentials,
    )
    for (const ad of ads.filter(isLive)) {
      adCount += 1
      if (!ad.nccAdId) continue
      add(
        adgroup,
        ad.nccAdId,
        nameOf(ad.type, ad.ad, adgroup),
        imagePathsOf(ad.ad),
      )
    }
    for (const ext of extensions.filter(isLive)) {
      const paths = imagePathsOf(ext.adExtension)
      if (!ext.nccAdExtensionId || paths.length === 0) continue
      add(
        adgroup,
        ext.nccAdExtensionId,
        nameOf(ext.type, undefined, adgroup),
        paths,
      )
    }
  })
  return { ads: adCount, creatives: [...byId.values()] }
}
