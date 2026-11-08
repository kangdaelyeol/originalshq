import { rentalsKpis as count } from '@xtool-core/board-kpis/rentals'
import { withIcons } from './kpi-icons'

// 대여품 관리 숫자 카드 — 보드 화면(대시보드·물)과 Monday 표 요약 줄이 같은 것을 그린다(registry). 세는 법은 앱과 같이
// 쓴다(@xtool-core/board-kpis/rentals) — 여기서는 아이콘만 붙인다.

export { PHASE, phaseOf, type Phase } from '@xtool-core/board-kpis/rentals'
export const rentalsKpis = withIcons(count)
