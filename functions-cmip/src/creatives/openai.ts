// OpenAI(ChatGPT) 광고 소재 찾기 — 집행 중인 광고(chat_card)의 이미지를 모은다.
// 조회만 한다.
//
// 확인한 것(2026-11-03, 광고 7개): 모두 chat_card(제목·본문·이미지 한 장)였다.
// 목록(GET /ads)에는 이미지 주소가 없고 file_id만 오며, 광고 하나를 물어야
// (GET /ads/{id}) image_url(1440px PNG)이 온다. 같은 이미지를 여러 광고에 썼으면
// file_id가 같아 한 문서로 묶는다.
import { fetchOpenai, type OpenaiCredentials } from '../channel/openai/client'
import type { OpenaiListResponse } from '../channel/openai/types'
import type { FoundCreative } from './types'

interface OpenaiObject {
  id: string
  name?: string
  status?: string
}

interface OpenaiAd extends OpenaiObject {
  creative?: {
    type?: string
    title?: string
    file_id?: string
    image_url?: string
  }
}

const isActive = (o: OpenaiObject) => o.status === 'active'

/** 목록을 끝까지 — has_more면 last_id를 after로 넘긴다. */
async function listAll<T>(
  path: string,
  query: Record<string, string>,
  credentials: OpenaiCredentials,
): Promise<T[]> {
  const out: T[] = []
  let after: string | null = null
  do {
    const page: OpenaiListResponse<T> = await fetchOpenai<
      OpenaiListResponse<T>
    >(path, after ? { ...query, after } : query, credentials)
    out.push(...page.data)
    after = page.has_more ? page.last_id : null
  } while (after)
  return out
}

/** 문서 id에 쓸 수 있는 글자만(분석 엔드포인트가 받는 꼴). */
const safeId = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_')

/** 집행 중인(캠페인·광고그룹·광고가 다 active) 광고의 이미지 전부 — 파일
 * (문서 id)별로 묶는다. 광고그룹 ID는 광고에 없어서 목록을 따라 내려가며 붙인다. */
export async function findActiveOpenaiCreatives(
  credentials: OpenaiCredentials,
): Promise<{ ads: number; creatives: FoundCreative[] }> {
  const byId = new Map<string, FoundCreative>()
  let adCount = 0
  const campaigns = await listAll<OpenaiObject>('/campaigns', {}, credentials)
  for (const campaign of campaigns.filter(isActive)) {
    const groups = await listAll<OpenaiObject>(
      '/ad_groups',
      { campaign_id: campaign.id },
      credentials,
    )
    for (const group of groups.filter(isActive)) {
      const ads = await listAll<OpenaiAd>(
        '/ads',
        { ad_group_id: group.id, limit: '100' },
        credentials,
      )
      for (const ad of ads.filter(isActive)) {
        adCount += 1
        const fileId = ad.creative?.file_id
        if (!fileId) continue
        const mediaId = safeId(fileId)
        const id = `openai_image_${mediaId}`
        const found: FoundCreative = byId.get(id) ?? {
          id,
          channel: 'openai',
          kind: 'image',
          mediaId,
          accountId: '',
          pageId: null,
          ads: {},
        }
        found.ads[ad.id] = {
          name: ad.name || ad.creative?.title || '',
          adsetId: group.id,
          campaignId: campaign.id,
        }
        byId.set(id, found)
      }
    }
  }
  return { ads: adCount, creatives: [...byId.values()] }
}

/** 파일 주소 — 이 소재를 쓴 광고를 하나씩 물어 image_url을 받는다(받자마자
 * 내려받는다). */
export async function openaiImageUrlOf(
  creative: Pick<FoundCreative, 'ads'>,
  credentials: OpenaiCredentials,
): Promise<string> {
  for (const adId of Object.keys(creative.ads)) {
    const ad = await fetchOpenai<OpenaiAd>(`/ads/${adId}`, {}, credentials)
    if (ad.creative?.image_url) return ad.creative.image_url
  }
  throw new Error('이미지 주소가 없습니다(GET /ads/{id})')
}
