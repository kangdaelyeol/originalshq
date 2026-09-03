/**
 * 매체(채널) 감지 — Python `_guess_channel_from_name`, `_detect_channel` 이관.
 */
import { Channel } from '../types'
import { FILENAME_HINTS } from './aliases'

/**
 * detectChannel()이 반환할 수 있는 값. 'naver_other'는 네이버 기타매체(애드부스트/GFA)
 * 집계형 CSV를 가리키는 임시 신호값으로, parser.ts에서 최종적으로 'naver'로 정규화된다.
 */
export type RawDetectedChannel = Channel | 'naver_other' | 'generic'

/** 정규화 후 ParseResult/DB에 실제로 저장되는 채널 값. */
export type DetectedChannel = Channel | 'generic'

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
