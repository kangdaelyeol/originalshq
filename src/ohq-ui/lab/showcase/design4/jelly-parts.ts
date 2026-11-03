// 견본 패널에 늘어놓을 장면·부품 — 영상 프레임 번호로 정한다.
import type { JellyLayers } from './jelly-renderer'

/** 영상 장면 넷 — 쉼 · 끝까지 끔 · 되돌아옴 · 가장 왼쪽 */
export const JELLY_SCENES = [
  { frame: 36, caption: 'F36 · 48%에 멈춤' },
  { frame: 53, caption: 'F53 · 끝까지 끌어 늘어남' },
  { frame: 66, caption: 'F66 · 되돌아오며 솟음' },
  { frame: 74, caption: 'F74 · 가장 왼쪽(34%)' },
] as const

const NONE: JellyLayers = { jelly: false, shadow: false, caustics: false, bounce: false, digits: false }

/** 부품을 하나씩 더해 가며(같은 F36 장면) — 객체를 여기서 한 번만 만들어 다시 그리지 않게 */
export const JELLY_LAYER_STEPS = [
  { layers: NONE, caption: '판 · 홈', prop: 'layers: 없음' },
  { layers: { ...NONE, digits: true }, caption: '+ 바닥 숫자', prop: 'digits' },
  { layers: { ...NONE, digits: true, jelly: true }, caption: '+ 젤리 몸통', prop: 'jelly' },
  {
    layers: { jelly: true, digits: true, shadow: true, caustics: true, bounce: true },
    caption: '+ 색 그림자 · 빛 모임 · 반사광',
    prop: 'shadow · caustics · bounce',
  },
] as const

/** 뼈대 그림 — 늘어남 · 쉼 · 솟음 */
export const JELLY_SKELETONS = [
  { frame: 53, caption: 'F53 늘어남' },
  { frame: 36, caption: 'F36 쉼' },
  { frame: 74, caption: 'F74 솟음' },
] as const
