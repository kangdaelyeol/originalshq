import { asRequestsKpis as count } from '@xtool-core/board-kpis/as-requests'
import { withIcons } from './kpi-icons'

// AS 신청서 숫자 카드 — 보드 화면(대시보드·물)과 Monday 표 요약 줄이 같은 것을 그린다(registry). 세는 법은 앱과 같이
// 쓴다(@xtool-core/board-kpis/as-requests) — 여기서는 아이콘만 붙인다.

export const asRequestsKpis = withIcons(count)
