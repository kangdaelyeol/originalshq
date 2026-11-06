import { CAMERA_D, SPHERE_R } from './design14-data'

// 두뇌 지도 3D 계산 — 회전축이 세로인 궤도 카메라. 좌표는 w(design14-data.ts), y 위가 +.

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** 카메라 자세 — theta는 카메라 방위각(rad), zoom은 확대, look은 테두리 가운데에서 코어까지 세로(R 배수) */
export interface CameraPose {
  theta: number
  zoom: number
  look: number
}

/** 화면 — cx·cy는 테두리 가운데(CSS px), k는 확대 1일 때 1w가 몇 CSS px인지 */
export interface Viewport {
  cx: number
  cy: number
  k: number
}

/** 투영 결과 — x·y는 CSS px, s는 원근 × 확대(부품 크기 배율), depth는 카메라 쪽 깊이(w) */
export interface Projected {
  x: number
  y: number
  s: number
  depth: number
}

export const rad = (deg: number) => (deg * Math.PI) / 180

/** (−π, π]로 접기 — 가장 짧은 쪽으로 돌게 */
export function wrapPi(a: number) {
  const t = (a + Math.PI) % (2 * Math.PI)
  return (t < 0 ? t + 2 * Math.PI : t) - Math.PI
}

/** 지수 감쇠로 다가가기 — 프레임 빠르기와 상관없이 같은 곡선(시간 상수 tau초) */
export function approach(cur: number, target: number, dt: number, tau: number) {
  if (tau <= 0) return target
  return target + (cur - target) * Math.exp(-dt / tau)
}

/** 방위각(도)·회전축 거리·높이 → 3D 점 */
export function placeAt(azDeg: number, rho: number, h: number): Vec3 {
  const a = rad(azDeg)
  return { x: rho * Math.sin(a), y: h, z: rho * Math.cos(a) }
}

/** 점 하나를 화면에 — out을 다시 써서 매 프레임 새 객체를 만들지 않는다 */
export function project(p: Vec3, pose: CameraPose, vp: Viewport, out: Projected): Projected {
  const c = Math.cos(pose.theta)
  const sn = Math.sin(pose.theta)
  const x = p.x * c - p.z * sn
  const z = p.x * sn + p.z * c
  const s = (CAMERA_D / (CAMERA_D - z)) * pose.zoom
  out.x = vp.cx + x * s * vp.k
  out.y = vp.cy + (pose.look * SPHERE_R * pose.zoom - p.y * s) * vp.k
  out.s = s
  out.depth = z
  return out
}

/**
 * 부서(또는 YOU) 자리의 바탕 평면 — 구의 접평면, 머리 쪽(v)은 북극을 향한다.
 * 그래서 전체 보기에서 옆에 있는 부서의 머리가 화면 가운데 쪽으로 기운다(t=47.8 ADMIN 머리 −70°, MARKETING −117°).
 */
export interface LocalFrame {
  origin: Vec3
  right: Vec3
  up: Vec3
}

export function localFrame(azDeg: number, rho: number, h: number): LocalFrame {
  const a = rad(azDeg)
  const e = Math.atan2(h, rho)
  return {
    origin: placeAt(azDeg, rho, h),
    right: { x: Math.cos(a), y: 0, z: -Math.sin(a) },
    up: { x: -Math.sin(a) * Math.sin(e), y: Math.cos(e), z: -Math.cos(a) * Math.sin(e) },
  }
}

export const onFrame = (f: LocalFrame, u: number, v: number): Vec3 => ({
  x: f.origin.x + f.right.x * u + f.up.x * v,
  y: f.origin.y + f.right.y * u + f.up.y * v,
  z: f.origin.z + f.right.z * u + f.up.z * v,
})

/**
 * 초점 화면에서 잰 자리 위치(화면 w, x 오른쪽·y 아래)를 접평면 좌표(u, v)로 되돌린다.
 * 초점 자세(그 부서가 정면, 확대 1)에서 투영하면 잰 자리에 그대로 놓이게 — 다른 자세에서는 3D로 기울어 보인다.
 */
export function solveLocal(f: LocalFrame, at: readonly [number, number]): [number, number] {
  const rho = Math.hypot(f.origin.x, f.origin.z)
  const h = f.origin.y
  const e = Math.atan2(h, rho)
  const D = CAMERA_D
  const hubY = (h * D) / (D - rho)
  // 화면 아래 dy = hubY − (h + v cos e)·D/(D − ρ + v sin e) — v에 대해 단조, 뉴턴 몇 번
  const target = hubY - at[1]
  let v = -at[1]
  for (let i = 0; i < 8; i++) {
    const den = D - rho + v * Math.sin(e)
    const y = ((h + v * Math.cos(e)) * D) / den
    const dy = (D * (Math.cos(e) * den - (h + v * Math.cos(e)) * Math.sin(e))) / (den * den)
    v -= (y - target) / dy
  }
  const u = (at[0] * (D - rho + v * Math.sin(e))) / D
  return [u, v]
}

/** 같은 시드면 같은 수열 — 먼지·별 자리가 새로 열 때마다 같게 */
export function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
