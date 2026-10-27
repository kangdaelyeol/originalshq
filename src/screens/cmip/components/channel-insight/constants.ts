import type {
  PivotView,
} from '../../view-model/use-channel-insight-page-view-model'
import type { ChannelKey } from '../channels'

// 전체 캠페인/adset 표의 채널 필터 버튼 chip 색 — 지표 토글 버튼과 같은
// --chip-color 방식(켜졌을 때만 이 색으로 옅게 물듦)을 그대로 재사용한다.
export const CHANNEL_CHIP_COLOR: Record<ChannelKey, string> = {
  meta: '#1877f2',
  google: '#4285f4',
  naver: '#03c75a',
}

export const PIVOT_VIEW_OPTIONS: readonly { value: PivotView; label: string }[] = [
  { value: 'byDate', label: '날짜별' },
  { value: 'byDayOfWeek', label: '요일별' },
  { value: 'byGroupedWeek', label: '주차별' },
]
