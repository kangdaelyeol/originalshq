import type {
  PivotView,
  ResultTab,
} from '../../view-model/use-channel-insight-page-view-model'
import type { ChannelKey } from '../channels'

// 전체 캠페인/adset 표의 채널 필터 버튼 chip 색 — 지표 토글 버튼과 같은
// --chip-color 방식(켜졌을 때만 이 색으로 옅게 물듦)을 그대로 재사용한다.
export const CHANNEL_CHIP_COLOR: Record<ChannelKey, string> = {
  meta: '#1877f2',
  google: '#4285f4',
  naver: '#03c75a',
  openai: '#10a37f',
}

/** 보기 단위(결과 탭) — 화면 맨 위 줄 가운데의 탭(screens/cmip/index.tsx). */
export const RESULT_TAB_LABEL: Record<ResultTab, string> = {
  total: '전체 요약',
  campaignAdset: '캠페인·광고셋',
  periodTest: '매체별 테스트',
  roas: 'ROAS',
  adPerformance: '광고 성과',
}

export const PIVOT_VIEW_OPTIONS: readonly {
  value: PivotView
  label: string
}[] = [
  { value: 'byDate', label: '날짜별' },
  { value: 'byDayOfWeek', label: '요일별' },
  { value: 'byGroupedWeek', label: '주차별' },
]
