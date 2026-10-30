// 차트 색 — 어두운 유리 표면(#1b1c1f) 기준으로 dataviz validate_palette.js
// (--mode dark --pairs all)를 통과한 값이다. 상태 색(초록·주황·빨강 배지)과는 섞지 않는다.

/** 점 둘레 2px 테두리 — 카드 표면과 같은 톤이라 선이 겹쳐도 점이 또렷하다. */
export const CHART_SURFACE = '#17181b'

/** 단일 계열 · 현재 기간 */
export const SERIES_PRIMARY = '#3a9ae6'
/** 비교 계열(직전 기간) */
export const SERIES_COMPARE = '#df5f9c'

/** 범주 색 — 정해진 순서대로만 쓴다(1 파랑 · 2 주황 · 3 청록). 넷째부터는 "기타"로 묶는다. */
export const CATEGORICAL = ['#3a9ae6', '#de6a30', '#1fa878'] as const
export const OTHER_GRAY = '#6b6f78'

/** 목표 초과처럼 "의미"가 있는 막대에만 — 라벨(목표 초과)과 함께 쓴다. */
export const STATUS_WARN = '#fbbf24'
