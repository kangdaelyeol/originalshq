// 광고 성과 탭의 표·그래프가 같이 쓰는 이름 — 줄 종류, 매체 이름.
import type { AdPerformanceKind, AdPerformanceNode, MediaChannel } from '../client'
import { CHANNELS } from './channels'

/** 줄 종류 이름 — 이름 앞 작은 표. */
export const KIND_LABEL: Record<AdPerformanceKind, string> = {
  channel: '매체',
  campaign: '캠페인',
  adset: '광고셋',
  adgroup: '광고그룹',
  ad: '광고',
}

export const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((channel) => [channel.key, channel.label])) as Record<
  MediaChannel,
  string
>

/** 줄 이름 — 매체 줄은 매체 이름을 붙인다(계산 쪽은 매체 키만 둔다). */
export const nodeName = (node: AdPerformanceNode): string =>
  node.kind === 'channel' ? (CHANNEL_LABEL[node.id as MediaChannel] ?? node.id) : node.name
