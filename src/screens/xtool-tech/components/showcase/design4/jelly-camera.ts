// 카메라·구도 — 원점을 바라보는 세로 시야각 45° 카메라. 원본 예제(TypeGPU)는 눈이 (0.024, 2.7, 1.9)
// (높이각 54.9°)인데, 영상의 홈 테두리(위·아래·양 끝)를 재서 맞춰 보니 같은 거리(3.30)에서
// 높이각 50.0°였다 — 그만큼 판을 더 비스듬히 본다. 화면에 어디까지 보일지는 "화면 창"으로 정한다:
// 창 좌표는 tan(시야각/2) 단위(1 = 화면 중심에서 위쪽 끝까지)라 캔버스 크기와 상관없이 같은 구도.

export interface Vec3 {
  x: number
  y: number
  z: number
}

const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
const sub = (a: Vec3, b: Vec3) => vec(a.x - b.x, a.y - b.y, a.z - b.z)
const cross = (a: Vec3, b: Vec3) => vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
const norm = (a: Vec3) => {
  const l = Math.hypot(a.x, a.y, a.z)
  return vec(a.x / l, a.y / l, a.z / l)
}

const EYE_DISTANCE = Math.hypot(2.7, 1.9)
const EYE_ELEVATION = (50 * Math.PI) / 180
const EYE = vec(0.024, EYE_DISTANCE * Math.sin(EYE_ELEVATION), EYE_DISTANCE * Math.cos(EYE_ELEVATION))
const FORWARD = norm(sub(vec(0, 0, 0), EYE))
const RIGHT = norm(cross(FORWARD, vec(0, 1, 0)))
const UP = cross(RIGHT, FORWARD)

export const JELLY_CAMERA = {
  eye: EYE,
  forward: FORWARD,
  right: RIGHT,
  up: UP,
  tanHalf: Math.tan(Math.PI / 8),
} as const

/**
 * 영상(720×540) 구도 — 홈 테두리 왼쪽·오른쪽 끝(x 125.5 · 584.5px)과 x 440~540px의 위·아래 테두리
 * (y 243 · 316px)를 재서, 원점이 (354.5, 282.5)px · tan 1단위 = 308.6px인 창으로 맞췄다(원본 캔버스의
 * 세로 87%쯤을 잘라 낸 크기). 4:3이 아닌 캔버스는 세로 범위를 두고 가로를 늘린다.
 */
const VIDEO_SCALE = 308.61
const VIDEO_CX = 354.49
const VIDEO_CY = 282.51
export const VIDEO_VIEW = {
  left: -VIDEO_CX / VIDEO_SCALE,
  right: (720 - VIDEO_CX) / VIDEO_SCALE,
  bottom: -(540 - VIDEO_CY) / VIDEO_SCALE,
  top: VIDEO_CY / VIDEO_SCALE,
} as const

export interface ViewWindow {
  left: number
  right: number
  bottom: number
  top: number
}

/** 캔버스 비율에 맞춘 화면 창 — 좁으면(4:3보다) 홈이 잘리지 않게 가로 폭을 지키고 세로를 늘린다 */
export function viewWindowFor(aspect: number): ViewWindow {
  const v = VIDEO_VIEW
  const cx = (v.left + v.right) / 2
  const cy = (v.bottom + v.top) / 2
  const minHalfW = (v.right - v.left) / 2
  let halfH = (v.top - v.bottom) / 2
  let halfW = halfH * aspect
  if (halfW < minHalfW) {
    halfW = minHalfW
    halfH = halfW / aspect
  }
  return { left: cx - halfW, right: cx + halfW, bottom: cy - halfH, top: cy + halfH }
}

/** 캔버스 위 한 점(왼쪽 위 기준 비율 0~1) → 바닥판 높이(y = 0)에서의 세계 x */
export function trackXAt(u: number, v: number, view: ViewWindow): number {
  const sx = view.left + u * (view.right - view.left)
  const sy = view.top - v * (view.top - view.bottom)
  const c = JELLY_CAMERA
  const dx = c.forward.x + c.right.x * sx * c.tanHalf + c.up.x * sy * c.tanHalf
  const dy = c.forward.y + c.right.y * sx * c.tanHalf + c.up.y * sy * c.tanHalf
  const t = -c.eye.y / dy
  return c.eye.x + dx * t
}

/** 세계 좌표 → 캔버스 위 비율(왼쪽 위 기준 0~1) */
export function projectToCanvas(p: Vec3, view: ViewWindow): { u: number; v: number } {
  const c = JELLY_CAMERA
  const d = sub(p, c.eye)
  const z = d.x * c.forward.x + d.y * c.forward.y + d.z * c.forward.z
  const sx = (d.x * c.right.x + d.y * c.right.y + d.z * c.right.z) / z / c.tanHalf
  const sy = (d.x * c.up.x + d.y * c.up.y + d.z * c.up.z) / z / c.tanHalf
  return { u: (sx - view.left) / (view.right - view.left), v: (view.top - sy) / (view.top - view.bottom) }
}
