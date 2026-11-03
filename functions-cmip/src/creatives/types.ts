// 광고 소재(adCreatives) — 매체에서 가져온(앞으로는 직접 올린) 이미지·영상 한
// 개. 문서 하나가 파일 하나다: 같은 영상을 여러 광고에 썼으면 문서는 하나고
// ads에 광고가 모인다. 원본과 분석용 프레임은 Storage(adCreatives/{id}/…)에 둔다.

export const AD_CREATIVES = 'adCreatives'

export type CreativeKind = 'video' | 'image'

/** 처리 상태 — 새로 발견하면 pending, 내려받아 프레임까지 뽑으면 ready. 실패하면
 * 다음 실행에 다시 시도하고, MAX_ATTEMPTS번 실패하면 failed로 멈춘다. */
export type CreativeStatus = 'pending' | 'ready' | 'failed'

export interface CreativeAd {
  name: string
  adsetId: string
  campaignId: string
}

export interface CreativeFrame {
  /** 영상 속 시점(초) — 이미지는 0. */
  t: number
  path: string
  width: number
  height: number
}

export interface CreativeMedia {
  /** 원본 파일(Storage 경로). */
  originalPath: string
  contentType: string
  bytes: number
  width: number | null
  height: number | null
  lengthSec: number | null
  /** 분석용 프레임 — 긴 변 FRAME_LONG_SIDE, 영상은 framePlan 시점마다. */
  frames: CreativeFrame[]
  processedAt: number
}

export interface AdCreative {
  /** 'meta_video_{영상 ID}' · 'meta_image_{이미지 hash}'. */
  id: string
  channel: 'meta'
  kind: CreativeKind
  /** 매체의 파일 ID — 영상 ID 또는 이미지 hash. */
  mediaId: string
  /** 파일을 받을 때 필요한 것 — 이미지는 광고 계정(adimages), 영상은 페이지 토큰. */
  accountId: string
  pageId: string | null
  /** 이 소재를 쓴 광고(광고 ID → 이름·광고셋·캠페인). */
  ads: Record<string, CreativeAd>
  /** 광고셋별로 찾으려고 — 'meta:adset:{ID}'(광고 설정의 entityKey와 같은 꼴). */
  adsetKeys: string[]
  firstSeenAt: number
  /** 마지막으로 집행 중인 광고에서 본 날(KST). */
  lastSeenDate: string
  status: CreativeStatus
  attempts: number
  error: string | null
  media: CreativeMedia | null
}
