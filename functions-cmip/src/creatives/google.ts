// Google Ads 광고 소재 찾기 — 집행 중인 광고에 붙은 이미지 에셋을 모은다.
// 조회만 한다.
//
// 확인한 것(2026-11-03, 광고 214개): Demand Gen 영상 광고 136개·이미지(멀티
// 에셋) 광고 74개·검색 광고 4개. 이미지 에셋은 full_size 주소로 원본이 받아진다.
// 영상은 YouTube에 올린 것이라 API가 파일을 주지 않아 여기서 모으지 않는다(광고
// 설정 화면에서 직접 올린다). 로고는 광고마다 같은 브랜드 표시라 소재로 치지
// 않고, 검색 광고는 문구뿐이라 모으지 않는다.
import { searchGoogleAds } from '../channel/google/client'
import type { GoogleAdsAccount } from '../channel/google/types'
import type { FoundCreative } from './types'

/** 소재로 치는 이미지 자리(ad_group_ad_asset_view.field_type). */
const IMAGE_FIELDS = [
  'MARKETING_IMAGE',
  'SQUARE_MARKETING_IMAGE',
  'PORTRAIT_MARKETING_IMAGE',
  'TALL_PORTRAIT_MARKETING_IMAGE',
]

interface AssetRow {
  campaign?: { id?: string }
  adGroup?: { id?: string }
  adGroupAd?: { ad?: { id?: string; name?: string } }
  asset?: {
    id?: string
    name?: string
    imageAsset?: { fullSize?: { url?: string } }
  }
}

/** 집행 중인 광고의 이미지 전부 — 에셋(문서 id)별로 묶는다. 같은 이미지를
 * 여러 광고에 썼으면 에셋 ID가 같다. */
export async function findActiveGoogleCreatives(
  account: GoogleAdsAccount,
  refreshToken: string,
): Promise<{ ads: number; creatives: FoundCreative[] }> {
  // 광고·광고그룹·캠페인이 다 켜져 있고 캠페인이 실제로 도는(끝나지 않은) 것만.
  const rows = await searchGoogleAds<AssetRow>(
    `
    SELECT campaign.id, ad_group.id, ad_group_ad.ad.id, ad_group_ad.ad.name,
      asset.id, asset.name, asset.image_asset.full_size.url
    FROM ad_group_ad_asset_view
    WHERE ad_group_ad_asset_view.enabled = TRUE
      AND ad_group_ad_asset_view.field_type IN (${IMAGE_FIELDS.map((f) => `'${f}'`).join(', ')})
      AND ad_group_ad.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND campaign.status = 'ENABLED'
      AND campaign.serving_status = 'SERVING'
    `,
    account,
    refreshToken,
  )

  const accountId = account.customerId.trim().replace(/-/g, '')
  const byId = new Map<string, FoundCreative>()
  const adIds = new Set<string>()
  for (const row of rows) {
    const assetId = row.asset?.id
    const url = row.asset?.imageAsset?.fullSize?.url
    const ad = row.adGroupAd?.ad
    const adsetId = row.adGroup?.id
    const campaignId = row.campaign?.id
    if (!assetId || !url || !ad?.id || !adsetId || !campaignId) continue
    adIds.add(ad.id)
    const id = `google_image_${assetId}`
    const found: FoundCreative = byId.get(id) ?? {
      id,
      channel: 'google',
      kind: 'image',
      mediaId: assetId,
      accountId,
      pageId: null,
      sourceUrl: url,
      ads: {},
    }
    found.ads[ad.id] = {
      name: ad.name || row.asset?.name || '',
      adsetId,
      campaignId,
    }
    byId.set(id, found)
  }
  return { ads: adIds.size, creatives: [...byId.values()] }
}
