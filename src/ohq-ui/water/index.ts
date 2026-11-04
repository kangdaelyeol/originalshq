// 물 디자인(D7 — sample/design7.mp4) 부품 — 연회색 유리 벽 위의 물·유리 부품과 그 움직임(스프링·늘어남·
// 물방울·물결). 스타일도 같이 받는다(이 파일을 가져오는 화면에서만).
import './styles/index.scss'

// 움직임 — 시계·스프링(since·springAt·springArrival·springSettle)·D7 상수(WATER_*)·animate
export * from './motion'
export { WaterIndicatorEngine, type IndicatorPose, type IndicatorTarget, type WaterIndicatorOptions } from './indicator'
export { WATER_DROP, WaterFxEngine, type WaterDropEffect, type WaterDropOptions } from './fx'
export {
  WATER_RIPPLE,
  WaterRipple,
  createRippleLayer,
  drawRipple,
  pressPoint,
  rippleAt,
  sizeRipple,
  type RippleClip,
  type RippleLayer,
  type RippleOptions,
} from './ripple'
export { revealStagger } from './reveal'
export { runSpring, type SpringRun, type SpringRunOptions } from './spring-run'
export { WaterGlide, type GlidePart } from './glide'
export { focusablesIn, trapTab } from './focus'
export { WaterBead, WaterGlassFilter, WaterGooShapeFilter, WaterGrooveFilter, type WaterFilterRegion } from './glass'
export { useReducedMotion, useWaterDpx, useWaterFx, useWaterIndicator, useWaterRipple } from './hooks'
export { WaterStage } from './stage'
export * from './controls'
export * from './surfaces'
export * from './charts'
