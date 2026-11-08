import { partsKpis as count } from '@xtool-core/board-kpis/parts'
import { withIcons } from './kpi-icons'

// 부품 마스터 숫자 카드 — 보드 화면(대시보드·물)과 Monday 표 요약 줄이 같은 것을 그린다(registry). 세는 법은 앱과 같이
// 쓴다(@xtool-core/board-kpis/parts) — 여기서는 아이콘만 붙인다.

export { LOW_STOCK, isLow, isOut } from '@xtool-core/board-kpis/parts'
export const partsKpis = withIcons(count)
