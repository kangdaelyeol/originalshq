// 궤도 모양 — 단위는 영상 px(장면 720×395). 카드 열 장의 이름 글자 가운데를 228프레임 내내 따라가
// 한 번 조화(cos·sin 한 쌍)로 맞추니 오차 0.45px: 원근 없는 기운 타원 위를 같은 각속도로 돈다.

const DEG = Math.PI / 180

export interface Ellipse {
  cx: number
  cy: number
  rx: number
  ry: number
  /** 기울기(라디안, 시계 반대 방향이 -) */
  tilt: number
}

/** 바깥 궤도(카드·입자) — 가운데는 칩 가운데(359.75, 188.75), 280 × 122.4, -6.05° */
export const D13_ORBIT: Ellipse = { cx: 359.75, cy: 188.75, rx: 280, ry: 122.4, tilt: -6.05 * DEG }

/** 안쪽 점선 타원 — 중앙값 영상에서 맞춤: 180.9 × 78.7, -5.9° */
export const D13_INNER: Ellipse = { cx: 359.75, cy: 188.75, rx: 180.9, ry: 78.7, tilt: -5.9 * DEG }

/** 장면 크기(영상 px) — 영상 UI의 위쪽 0~395 */
export const SCENE_W = 720
export const SCENE_H = 395

/** 카드가 도는 빠르기 — 57프레임마다 옆 카드 자리로(36°) → 19초에 한 바퀴, 시계 방향 */
export const ORBIT_SPEED = (2 * Math.PI) / 19

/** 타원 위 θ(0 = 큰 축 오른쪽, 90° = 아래) · ρ(1 = 타원 위)의 화면 자리 */
export function ellipsePoint(e: Ellipse, theta: number, rho = 1): [number, number] {
  const u = e.rx * rho * Math.cos(theta)
  const v = e.ry * rho * Math.sin(theta)
  const c = Math.cos(e.tilt)
  const s = Math.sin(e.tilt)
  return [e.cx + u * c - v * s, e.cy + u * s + v * c]
}

/** 깊이(0 = 맨 뒤 위쪽, 1 = 맨 앞 아래쪽) */
export const depthOf = (theta: number) => (1 + Math.sin(theta)) / 2

/** 카드 크기 — 이름 글자 폭이 위에서 0.778배, 아래에서 1배(1 + 0.125 sin θ에 맞춤, 오차 0.57px) */
export const cardScaleOf = (theta: number) => (1 + 0.125 * Math.sin(theta)) / 1.125

/** n장 중 i번째 카드의 각 — F0에 0번이 맨 위(-90°), 사이 360°/n */
export const cardThetaAt = (i: number, n: number, t: number) => -Math.PI / 2 + (2 * Math.PI * i) / n + ORBIT_SPEED * t
