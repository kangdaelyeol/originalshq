/**
 * 매체(채널) 감지 — functions-cmip `src/csv/channel.ts` 이관.
 * RawDetectedChannel / DetectedChannel 타입은 `../types`에 정의돼 있어 재사용한다.
 */
import { FILENAME_HINTS } from '../types'
import type { Channel, RawDetectedChannel } from '../types'

export function guessChannelFromName(name: string): Channel | null {
  const low = name.toLowerCase()
  for (const [ch, keys] of FILENAME_HINTS) {
    if (keys.some((k) => low.includes(k))) return ch
  }
  return null
}

export function detectChannel(
  header: readonly string[],
  filename: string,
): RawDetectedChannel {
  const hdr = header.map((h) => String(h).toLowerCase()).join(' ')

  // 네이버 계정 집계형(애드부스트/GFA/쇼핑부스트업) — 계정명 + 총비용, 캠페인/광고그룹 없음
  if (
    hdr.includes('광고 계정 이름') &&
    (hdr.includes('총비용') || hdr.includes('총 비용'))
  ) {
    return 'naver_other'
  }
  if (
    hdr.includes('일별') &&
    (hdr.includes('총비용') || hdr.includes('평균클릭비용'))
  ) {
    return 'naver'
  }
  if (
    [
      '디맨드젠',
      'demand gen',
      '캠페인 상태',
      '입찰 전략',
      '최적화 점수',
      '상호작용수',
      'pmax',
      'p-max',
    ].some((k) => hdr.includes(k))
  ) {
    return 'google'
  }
  if (
    (hdr.includes('광고 세트') || hdr.includes('광고세트')) &&
    (hdr.includes('지출 금액') || hdr.includes('링크 클릭'))
  ) {
    return 'meta'
  }
  if (hdr.includes('결과 유형') || hdr.includes('결과유형')) return 'meta'
  if (
    hdr.includes('기간') &&
    (hdr.includes('캠페인 id') ||
      hdr.includes('비용 (vat 포함)') ||
      hdr.includes('비용(vat 포함)'))
  ) {
    return 'daangn'
  }

  return guessChannelFromName(filename) ?? 'generic'
}
