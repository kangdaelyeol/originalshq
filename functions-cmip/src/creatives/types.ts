// 광고 소재(adCreatives) — 매체(Meta·당근)에서 가져온(앞으로는 직접 올린)
// 이미지·영상 한 개. 문서 하나가 파일 하나다: 같은 영상을 여러 광고에 썼으면
// 문서는 하나고 ads에 광고가 모인다. 원본과 분석용 프레임은 Storage(adCreatives/{id}/…)에 둔다.

export const AD_CREATIVES = 'adCreatives'

export type CreativeKind = 'video' | 'image'

export type CreativeChannel = 'meta' | 'daangn'

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

/** 매체에서 찾은 소재 하나 — 문서 id 기준으로 광고를 모은 것. */
export interface FoundCreative {
  /** '{채널}_{kind}_{mediaId}' — 예: 'meta_video_123', 'daangn_video_ab12'. */
  id: string
  channel: CreativeChannel
  kind: CreativeKind
  /** 매체의 파일 ID — Meta는 영상 ID·이미지 hash, 당근은 영상 스트림 ID·이미지
   * 주소의 해시. */
  mediaId: string
  /** 파일을 받을 때 필요한 것 — Meta 이미지는 광고 계정(adimages), Meta 영상은
   * 페이지 토큰. 당근은 광고 계정 ID만(주소가 sourceUrl에 있다). */
  accountId: string
  pageId: string | null
  /** 찾을 때 이미 아는 파일 주소(당근) — Meta는 받을 때마다 새로 묻는다(임시
   * 주소라). */
  sourceUrl?: string | null
  /** 이 소재를 쓴 광고(광고·소재 ID → 이름·광고셋·캠페인). */
  ads: Record<string, CreativeAd>
}

export interface AdCreative extends FoundCreative {
  /** 광고셋별로 찾으려고 — '{채널}:adset:{ID}'(광고 설정의 entityKey와 같은 꼴). */
  adsetKeys: string[]
  firstSeenAt: number
  /** 마지막으로 집행 중인 광고에서 본 날(KST). */
  lastSeenDate: string
  status: CreativeStatus
  attempts: number
  error: string | null
  media: CreativeMedia | null
}
