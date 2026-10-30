import type { ChannelKey } from '../channels'
import type { MetricKey } from '../metric-fields'

// cmip 표 대신 보는 그래프들(기간별 성과, 광고 성과 효율)이 같이 쓰는 값.

/** 채널 색 — 그래프에서 채널을 구분한다(범례·툴팁에 이름이 같이 붙는다).
 * Meta 파랑, Google 노랑, Naver 초록, OpenAI 청록(Naver 초록과 겹치지 않게
 * 푸른 쪽으로 옮김) — 각 브랜드 색 계열에서 어두운·밝은
 * 테마 둘 다 바탕과 구분되는 밝기로. */
export const CHART_CHANNEL_COLOR: Record<ChannelKey, string> = {
  meta: '#4f8df9',
  google: '#f5a524',
  naver: '#2fbf71',
  openai: '#22b8cf',
}

/** 축 눈금용 짧은 표기 — 1.2억, 3,400만, 그 아래는 그대로. */
export const compactNumber = (value: number): string => {
  const abs = Math.abs(value)
  if (abs >= 1e8) return `${(value / 1e8).toFixed(abs >= 1e9 ? 0 : 1)}억`
  if (abs >= 1e4) return `${Math.round(value / 1e4).toLocaleString('ko-KR')}만`
  if (abs >= 100) return Math.round(value).toLocaleString('ko-KR')
  return Number(value.toFixed(2)).toLocaleString('ko-KR')
}

/** 위 끝이 둥근 막대(바닥은 각지게). */
export const roundTopBar = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(5, w / 2, h)
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`
}

/** 더해지는 지표 — 채널 값을 쌓으면 전체가 된다(막대로 쌓아 그리고, 채널
 * 몫 %를 보여 준다). 나머지는 비율이라(ROAS·CTR·CPA 등) 더할 수 없다. */
export const ADDITIVE_METRIC_KEYS: ReadonlySet<MetricKey> = new Set([
  'spend',
  'impressions',
  'clicks',
  'conversions',
  'onlineRevenue',
  'offlineRevenue',
  'totalRevenue',
])

/** 값을 모르는 칸(NaN — 신규 고객 ROAS 등)은 그래프에서 0 자리에. */
export const finiteOr0 = (value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) ? value : 0
