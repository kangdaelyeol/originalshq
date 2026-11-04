import type { AdCreativeView } from '../../client'

// 소재 카드·창의 글자 — 광고 설정의 소재 칸(creative-picker.tsx)과 매체별
// 테스트(ad-test/test-creatives.tsx)가 같이 쓴다.

export const lengthLabel = (c: AdCreativeView) =>
  c.kind === 'image'
    ? '이미지'
    : c.media?.lengthSec != null
      ? `영상 ${Math.round(c.media.lengthSec)}초`
      : '영상'

export const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  return `${m}/${d}`
}

export const errorText = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

/** 카드·창의 집행 표시 — 직접 올린 것은 올린 날. */
export const seenLabel = (c: AdCreativeView) =>
  c.upload
    ? `직접 올림 ${shortDate(c.lastSeenDate)}`
    : c.active
      ? '집행 중'
      : `~${shortDate(c.lastSeenDate)}`

export const STRENGTH_LABEL: Record<string, string> = {
  strong: '강함',
  medium: '보통',
  weak: '약함',
}
