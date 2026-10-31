// Meta 광고 소재 읽기 확인(디버그·조회만) — 소재 분석(AI)에 쓸 영상을 Graph
// API로 가져올 수 있는지 본다. 광고 → 소재(creative) → 영상 ID → 영상 파일
// 주소(source)까지 따라가고, 단계마다 무엇이 막히는지 돌려준다. 쓰기는 없다.
import { META_AD_ACCOUNT_IDS } from './index'

const GRAPH = 'https://graph.facebook.com/v25.0'

interface GraphError {
  error?: { message?: string; type?: string; code?: number }
}

export async function graphGet<T>(
  path: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const qs = new URLSearchParams({ ...params, access_token: accessToken })
  const res = await fetch(`${GRAPH}/${path}?${qs.toString()}`)
  const body = (await res.json().catch(() => ({}))) as T & GraphError
  if (!res.ok || body.error) {
    const e = body.error
    return {
      ok: false,
      error:
        `${res.status} ${e?.type ?? ''} ${e?.code ?? ''} ${e?.message ?? ''}`.trim(),
    }
  }
  return { ok: true, data: body }
}

interface AdNode {
  id: string
  name: string
  effective_status?: string
  creative?: {
    id: string
    name?: string
    object_type?: string
    video_id?: string
    thumbnail_url?: string
    object_story_spec?: { video_data?: { video_id?: string } }
    asset_feed_spec?: { videos?: { video_id?: string }[] }
  }
}

/** 소재에 걸린 영상 ID들 — 일반 영상 광고(video_id·object_story_spec)와
 * 다이내믹·Advantage+ 소재(asset_feed_spec.videos) 둘 다. */
const videoIdsOf = (ad: AdNode): string[] => {
  const c = ad.creative
  if (!c) return []
  return [
    ...new Set(
      [
        c.video_id,
        c.object_story_spec?.video_data?.video_id,
        ...(c.asset_feed_spec?.videos ?? []).map((v) => v.video_id),
      ].filter((v): v is string => !!v),
    ),
  ]
}

export interface MetaCreativeCheck {
  /** 토큰에 허가된 권한(받을 수 있으면). */
  permissions: string[] | string
  accounts: {
    adAccountId: string
    ads: number
    adsWithVideo: number
    error?: string
    sample: {
      adId: string
      adName: string
      creativeType: string | null
      videoIds: string[]
    }[]
  }[]
  /** 영상 파일까지 받아지는지 — 영상마다 source(다운로드 주소)가 오는지. */
  videos: {
    videoId: string
    sourceAvailable: boolean
    /** 주소 자체는 서명된 임시 주소라 호스트만. */
    sourceHost: string | null
    lengthSec: number | null
    /** 영상 주인(페이지) — 페이지 소유 영상은 페이지 토큰이 있어야 파일 주소가 온다. */
    owner?: string
    /** 그 페이지 토큰으로 다시 물었을 때 파일 주소가 오는지. */
    sourceWithPageToken?: boolean | string
    error?: string
  }[]
  /** 광고 계정 영상 목록(advideos)에서 파일 주소가 오는지 — 계정마다 5개. */
  advideos: {
    adAccountId: string
    withSource: number
    total: number
    error?: string
  }[]
  /** 이 토큰으로 받을 수 있는 페이지 토큰 수. */
  pageTokens: number | string
}

/**
 * 최근 집행 중인 광고에서 영상 소재를 찾아 영상 파일 주소까지 받아 보는 확인 —
 * 계정마다 광고 최대 50개, 영상은 최대 6개만 확인한다.
 */
export async function debugFetchMetaCreatives(
  accessToken: string,
): Promise<MetaCreativeCheck> {
  const perms = await graphGet<{
    data: { permission: string; status: string }[]
  }>('me/permissions', {}, accessToken)
  const accounts: MetaCreativeCheck['accounts'] = []
  const videoIds: string[] = []
  for (const adAccountId of META_AD_ACCOUNT_IDS) {
    const res = await graphGet<{ data: AdNode[] }>(
      `act_${adAccountId}/ads`,
      {
        fields:
          'id,name,effective_status,creative{id,name,object_type,video_id,thumbnail_url,object_story_spec,asset_feed_spec}',
        effective_status: JSON.stringify(['ACTIVE']),
        limit: '50',
      },
      accessToken,
    )
    if (!res.ok) {
      accounts.push({
        adAccountId,
        ads: 0,
        adsWithVideo: 0,
        error: res.error,
        sample: [],
      })
      continue
    }
    const ads = res.data.data
    const withVideo = ads.filter((ad) => videoIdsOf(ad).length > 0)
    for (const ad of withVideo) videoIds.push(...videoIdsOf(ad))
    accounts.push({
      adAccountId,
      ads: ads.length,
      adsWithVideo: withVideo.length,
      sample: ads.slice(0, 8).map((ad) => ({
        adId: ad.id,
        adName: ad.name,
        creativeType: ad.creative?.object_type ?? null,
        videoIds: videoIdsOf(ad),
      })),
    })
  }

  // 페이지 토큰 — 페이지가 올린 영상은 페이지 토큰으로만 파일 주소가 오는 경우가 많다.
  const pages = await graphGet<{
    data: { id: string; name: string; access_token?: string }[]
  }>(
    'me/accounts',
    { fields: 'id,name,access_token', limit: '100' },
    accessToken,
  )
  const pageToken = new Map(
    pages.ok
      ? pages.data.data
          .filter((p) => p.access_token)
          .map((p) => [p.id, p.access_token!])
      : [],
  )

  const videos: MetaCreativeCheck['videos'] = []
  for (const videoId of [...new Set(videoIds)].slice(0, 6)) {
    const res = await graphGet<{
      source?: string
      length?: number
      from?: { id: string; name?: string }
    }>(videoId, { fields: 'id,source,length,from' }, accessToken)
    if (!res.ok) {
      videos.push({
        videoId,
        sourceAvailable: false,
        sourceHost: null,
        lengthSec: null,
        error: res.error,
      })
      continue
    }
    const ownerId = res.data.from?.id
    let withPage: boolean | string | undefined
    if (!res.data.source && ownerId) {
      const token = pageToken.get(ownerId)
      if (!token) withPage = '그 페이지 토큰 없음'
      else {
        const again = await graphGet<{ source?: string }>(
          videoId,
          { fields: 'id,source' },
          token,
        )
        withPage = again.ok ? !!again.data.source : again.error
      }
    }
    videos.push({
      videoId,
      sourceAvailable: !!res.data.source,
      sourceHost: res.data.source ? new URL(res.data.source).host : null,
      lengthSec: res.data.length ?? null,
      owner: res.data.from
        ? `${res.data.from.name ?? ''} (${res.data.from.id})`
        : undefined,
      sourceWithPageToken: withPage,
    })
  }

  const advideos: MetaCreativeCheck['advideos'] = []
  for (const adAccountId of META_AD_ACCOUNT_IDS) {
    const res = await graphGet<{ data: { id: string; source?: string }[] }>(
      `act_${adAccountId}/advideos`,
      { fields: 'id,source,length', limit: '5' },
      accessToken,
    )
    advideos.push(
      res.ok
        ? {
            adAccountId,
            total: res.data.data.length,
            withSource: res.data.data.filter((v) => v.source).length,
          }
        : { adAccountId, total: 0, withSource: 0, error: res.error },
    )
  }

  return {
    permissions: perms.ok
      ? perms.data.data
          .filter((p) => p.status === 'granted')
          .map((p) => p.permission)
      : perms.error,
    accounts,
    videos,
    advideos,
    pageTokens: pages.ok ? pageToken.size : pages.error,
  }
}

// ── 소재 분석용 조회(쓰기 없음) ─────────────────────────────────────────

/** 소재 분석에 쓰는 광고 하나 — 문구·CTA·링크와 영상(길이·크기). */
export interface MetaAdForAnalysis {
  adId: string
  adName: string
  adsetId: string
  campaignId: string
  accountId: string
  creativeType: string | null
  thumbnailUrl: string | null
  /** 본문·제목·CTA·링크 — 일반 소재와 다이내믹(asset_feed) 소재 둘 다에서. */
  body: string
  title: string
  cta: string
  link: string
  video: {
    id: string
    lengthSec: number | null
    width: number | null
    height: number | null
  } | null
  /** 광고셋 타겟팅 요약. */
  targeting: {
    countries: string[]
    ageMin: number | null
    ageMax: number | null
    /** 관심사·맞춤 타겟을 좁혀 걸었는지(없으면 broad). */
    narrowed: boolean
    excluded: string[]
  } | null
}

interface CreativeDetail {
  id: string
  object_type?: string
  body?: string
  title?: string
  call_to_action_type?: string
  link_url?: string
  thumbnail_url?: string
  video_id?: string
  object_story_spec?: {
    video_data?: {
      video_id?: string
      message?: string
      title?: string
      call_to_action?: { type?: string; value?: { link?: string } }
    }
    link_data?: {
      link?: string
      message?: string
      name?: string
      call_to_action?: { type?: string }
    }
  }
  asset_feed_spec?: {
    videos?: { video_id?: string }[]
    bodies?: { text?: string }[]
    titles?: { text?: string }[]
    link_urls?: { website_url?: string }[]
    call_to_action_types?: string[]
  }
}

interface AdSetTargeting {
  geo_locations?: { countries?: string[] }
  age_min?: number
  age_max?: number
  flexible_spec?: unknown[]
  custom_audiences?: { name?: string }[]
  excluded_custom_audiences?: { name?: string }[]
}

/** 광고 하나를 소재 분석에 쓸 모양으로 — 광고·소재·영상·광고셋 타겟팅을 읽는다. */
export async function fetchMetaAdForAnalysis(
  adId: string,
  accessToken: string,
): Promise<MetaAdForAnalysis> {
  const ad = await graphGet<{
    id: string
    name: string
    adset_id: string
    campaign_id: string
    account_id: string
    creative?: CreativeDetail
  }>(
    adId,
    {
      fields:
        'id,name,adset_id,campaign_id,account_id,creative{id,object_type,body,title,call_to_action_type,link_url,thumbnail_url,video_id,object_story_spec,asset_feed_spec}',
    },
    accessToken,
  )
  if (!ad.ok) throw new Error(`광고 ${adId}를 읽지 못했습니다 — ${ad.error}`)
  const c = ad.data.creative ?? ({ id: '' } as CreativeDetail)
  const vd = c.object_story_spec?.video_data
  const ld = c.object_story_spec?.link_data
  const feed = c.asset_feed_spec
  const videoId =
    c.video_id ??
    vd?.video_id ??
    feed?.videos?.find((v) => v.video_id)?.video_id

  let video: MetaAdForAnalysis['video'] = null
  if (videoId) {
    const v = await graphGet<{
      length?: number
      format?: { width?: number; height?: number }[]
    }>(videoId, { fields: 'id,length,format' }, accessToken)
    // 가장 큰 인코딩의 크기 — 비율과 프레임 토큰을 셈한다.
    const biggest = v.ok
      ? (v.data.format ?? []).reduce<{ width?: number; height?: number }>(
          (best, f) =>
            (f.width ?? 0) * (f.height ?? 0) >
            (best.width ?? 0) * (best.height ?? 0)
              ? f
              : best,
          {},
        )
      : {}
    video = {
      id: videoId,
      lengthSec: v.ok ? (v.data.length ?? null) : null,
      width: biggest.width ?? null,
      height: biggest.height ?? null,
    }
  }

  const adset = await graphGet<{ targeting?: AdSetTargeting }>(
    ad.data.adset_id,
    { fields: 'id,targeting' },
    accessToken,
  )
  const t = adset.ok ? adset.data.targeting : undefined

  return {
    adId: ad.data.id,
    adName: ad.data.name,
    adsetId: ad.data.adset_id,
    campaignId: ad.data.campaign_id,
    accountId: ad.data.account_id,
    creativeType: c.object_type ?? null,
    thumbnailUrl: c.thumbnail_url ?? null,
    body: c.body ?? vd?.message ?? ld?.message ?? feed?.bodies?.[0]?.text ?? '',
    title: c.title ?? vd?.title ?? ld?.name ?? feed?.titles?.[0]?.text ?? '',
    cta:
      c.call_to_action_type ??
      vd?.call_to_action?.type ??
      ld?.call_to_action?.type ??
      feed?.call_to_action_types?.[0] ??
      '',
    link:
      c.link_url ??
      vd?.call_to_action?.value?.link ??
      ld?.link ??
      feed?.link_urls?.[0]?.website_url ??
      '',
    video,
    targeting: t
      ? {
          countries: t.geo_locations?.countries ?? [],
          ageMin: t.age_min ?? null,
          ageMax: t.age_max ?? null,
          narrowed:
            (t.flexible_spec?.length ?? 0) > 0 ||
            (t.custom_audiences?.length ?? 0) > 0,
          excluded: (t.excluded_custom_audiences ?? [])
            .map((a) => a.name ?? '')
            .filter(Boolean),
        }
      : null,
  }
}

/** 소재 분석 고르기 목록 — 집행 중인 광고(계정마다 최대 50개). */
export interface MetaAdListItem {
  adId: string
  adName: string
  adsetName: string
  accountId: string
  thumbnailUrl: string | null
  hasVideo: boolean
}

export async function listMetaAdsForAnalysis(
  accessToken: string,
): Promise<MetaAdListItem[]> {
  const out: MetaAdListItem[] = []
  for (const accountId of META_AD_ACCOUNT_IDS) {
    const res = await graphGet<{
      data: (AdNode & { adset?: { name?: string } })[]
    }>(
      `act_${accountId}/ads`,
      {
        fields:
          'id,name,adset{name},creative{id,object_type,video_id,thumbnail_url,object_story_spec,asset_feed_spec}',
        effective_status: JSON.stringify(['ACTIVE']),
        limit: '50',
      },
      accessToken,
    )
    if (!res.ok) throw new Error(`광고 목록을 읽지 못했습니다 — ${res.error}`)
    for (const ad of res.data.data) {
      out.push({
        adId: ad.id,
        adName: ad.name,
        adsetName: ad.adset?.name ?? '',
        accountId,
        thumbnailUrl: ad.creative?.thumbnail_url ?? null,
        hasVideo: videoIdsOf(ad).length > 0,
      })
    }
  }
  return out
}
