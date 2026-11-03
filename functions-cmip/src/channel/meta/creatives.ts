// Meta 광고 소재 읽기(조회만) — 소재 분석(AI)에 쓸 광고 하나의 문구·CTA·
// 링크·영상·타겟팅과, 분석할 광고를 고르는 목록. 쓰기는 없다.
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
