// 물 레이아웃 묶음 — load.ts가 lazy로 받는다(설정 > 레이아웃 "물"을 고른 사람만). 공용 물 부품(ohq-ui/water —
// 스타일도 같이)과 tech 물 부품(components/water), 화면 틀(셸·사이드바·상단바)을 한 묶음으로. 레이아웃 부품
// (components/layout-parts)이 꺼내 쓰는 이름은 지금 부품과 같은 props다.
// 스타일 순서 — 공용 물 부품 → tech 물 부품 → 화면 틀(뒤에 올수록 같은 우선순위에서 이긴다)
import '@/ohq-ui/water/styles/index.scss'
import '../components/water/styles/index.scss'
import './styles/index.scss'

export {
  WaterAvatar,
  WaterBarList,
  WaterButton,
  WaterCard,
  WaterSegmented,
  WaterStatCard,
  WaterStatusPill,
} from '@/ohq-ui/water'
export {
  WaterAssignees,
  WaterChipPicker,
  WaterDateTimeInput,
  WaterDrawerList,
  WaterDrawerShell,
  WaterLocationInput,
  WaterMultiSelect,
  WaterPhoneLink,
  WaterRecordDrawer,
  WaterRecordTable,
  WaterStagePill,
} from '../components/water/board'
export { WaterAttentionRow } from '../components/water/overview/water-attention-row'
export { WaterKingCard } from '../components/water/overview/water-king-card'
export { WaterMiniList } from '../components/water/overview/water-mini-list'
export { WaterTeamCard } from '../components/water/overview/water-team-card'
export { WaterUpcomingList } from '../components/water/overview/water-upcoming-list'
export { WaterShell } from './water-shell'
export { WaterAccentCard, WaterEffectCard, WaterWallCard } from '../components/water/settings/water-settings-cards'
