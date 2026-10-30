// 유리(glassy) 대시보드 부품 — 사용법·원칙은 README.md.
import './styles/base.scss'

// 페이지 셸 — 테마, 맨 위 줄, 화면 전환.
export { GLASS_THEMES, useGlassTheme, type GlassThemeId } from './themes'
export { ThemePicker } from './theme-picker'
export { GlassHeader } from './glass-header'
export { startGlassTransition } from './transition'

// 고르기·펼치기.
export { Segmented } from './segmented'
export { Select, type SelectOption } from './select'
export { AutoHeight } from './auto-height'
export { Spinner, LoadingPanel } from './spinner'
export { useDismiss } from './use-dismiss'

// 숫자·그래프.
export { StatTile } from './stat-tile'
export { Ring } from './ring'
export { StackedBars, type StackRow, type StackSegment } from './stacked-bars'
export {
  TrendList,
  type TrendListColumns,
  type TrendListRow,
} from './trend-list'
export { GlassLine } from './glass-line'
export { smoothPath } from './smooth-path'
export { useElementSize } from './use-element-size'
