/**
 * meta-insight.tsx와 excel-writer.ts(엑셀 다운로드) 양쪽에서 같이 쓰는 채널 키/
 * 목록 — 예전엔 excel-export-modal.tsx가 lazy import(meta-insight.tsx →
 * excel-export-modal.tsx 방향)라 반대 방향 정적 import를 걸면 순환 참조가
 * 생겨서 이 목록을 그 파일 안에 그대로 복제해뒀었다. excel 쓰기 로직이 순수
 * 모듈(excel-writer.ts)로 빠지면서 그 순환 우려가 없어져 한 곳으로 합친다.
 */
import type { ChannelSplitSeries } from '../client'

export type ChannelKey = 'meta' | 'google' | 'naver'

// 지금은 Meta/Google/Naver — 당근이 붙으면 이 목록만 늘리면 된다
// (CombinedInsight.total/series가 그 채널 키를 갖게 되는 시점에 맞춰).
export const CHANNELS: readonly { key: ChannelKey; label: string }[] = [
  { key: 'meta', label: 'Meta' },
  { key: 'google', label: 'Google' },
  { key: 'naver', label: 'Naver' },
]

/** CombinedCampaign/CombinedAdset(둘 다 ChannelSplitSeries 모양)에서 실제로
 * 데이터가 있는 채널만 뽑는다 — 화면의 "자세히 보기" 채널 카드, 채널 필터와
 * 같은 기준(byDate가 비어있지 않은 채널만). */
export function channelsOf(entity: ChannelSplitSeries): ChannelKey[] {
  return CHANNELS.filter((c) => entity[c.key].byDate.length > 0).map(
    (c) => c.key,
  )
}
