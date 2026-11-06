// 궤도 입자 — 캔버스에 그린다. 영상에서 잰 것:
// · 빠르기: 알갱이마다 다르고(1.45~4.1°/프레임 고르게 = 43~123°/초) 늘 같은 빠르기로 시계 방향. 카드(0.63°/프레임)보다 빠르다.
//   (3프레임 내내 같은 각속도로 이어지는 알갱이 7,763개를 모아 잼 — 위치에 상관없이 같은 분포)
// · 자리: 카드 궤도와 같은 타원, 반지름 방향으로 ±2.1%(원 위에서 흩어진 뒤 눌려 옆에서 6px, 위아래 2.5px). 숨쉬기 없음
//   (프레임마다 평균 반지름 표준편차 0.005).
// · 크기·밝기: 앞(아래)에서 크고 밝다 — 지름 2~5px, 뒤(위)는 작고 흐려서 안 보일 만큼(검출 수 1/13).
// · 색: 보라 32% · 흰빛 27% · 분홍 19% · 진분홍 12% · 청록 10%(앞쪽 큰 알갱이 4,000여 개의 색을 나눠 셈).
import { depthOf, ellipsePoint, type Ellipse } from './orbit-geometry'

export interface ParticleField {
  theta: Float32Array
  speed: Float32Array
  rho: Float32Array
  radius: Float32Array
  color: Uint8Array
}

export const PARTICLE_COLORS = ['#c39bff', '#fff3fb', '#ff7db6', '#ff4f8b', '#72e6e2'] as const
const COLOR_WEIGHTS = [0.32, 0.27, 0.19, 0.12, 0.1]

/** 같은 씨앗이면 늘 같은 입자(다시 열어도 같은 모양) */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface ParticleOptions {
  count: number
  /** 각속도 범위(°/초) */
  speed?: readonly [number, number]
  /** 반지름 흩어짐(표준편차, 궤도 비율) */
  spread?: number
  seed?: number
}

export function createParticleField({
  count,
  speed = [43.5, 123],
  spread = 0.021,
  seed = 13,
}: ParticleOptions): ParticleField {
  const rand = mulberry32(seed)
  const field: ParticleField = {
    theta: new Float32Array(count),
    speed: new Float32Array(count),
    rho: new Float32Array(count),
    radius: new Float32Array(count),
    color: new Uint8Array(count),
  }
  const [lo, hi] = speed
  for (let i = 0; i < count; i++) {
    field.theta[i] = rand() * Math.PI * 2
    field.speed[i] = ((lo + (hi - lo) * rand()) * Math.PI) / 180
    // 정규분포(박스-뮬러)
    const g = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
    field.rho[i] = 1 + spread * Math.max(-2.5, Math.min(2.5, g))
    // 작은 알갱이가 많다 — 반지름 0.95~2.9px(앞에서)
    field.radius[i] = 0.95 + 1.95 * rand() ** 1.6
    let pick = rand()
    let c = 0
    while (c < COLOR_WEIGHTS.length - 1 && pick > COLOR_WEIGHTS[c]) pick -= COLOR_WEIGHTS[c++]
    field.color[i] = c
  }
  return field
}

/** 색마다 한 번 그려 두는 빛 점(가운데 꽉 찬 원 + 옅은 번짐) — 매 프레임 drawImage로 찍기만 한다 */
export function createParticleSprites(colors: readonly string[] = PARTICLE_COLORS, size = 48): HTMLCanvasElement[] {
  return colors.map((color) => {
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')
    if (!ctx) return c
    const r = size / 2
    const halo = ctx.createRadialGradient(r, r, 0, r, r, r)
    halo.addColorStop(0, color)
    halo.addColorStop(0.36, color)
    halo.addColorStop(0.46, withAlpha(color, 0.38))
    halo.addColorStop(0.7, withAlpha(color, 0.1))
    halo.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, size, size)
    return c
  })
}

function withAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** 빛 점 반지름 대비 스프라이트 반지름(번짐까지) */
const SPRITE_SPAN = 1 / 0.4

/** 입자를 그린다 — ctx는 영상 px 좌표로 맞춰 둔 상태 */
export function drawParticleField(
  ctx: CanvasRenderingContext2D,
  field: ParticleField,
  sprites: readonly HTMLCanvasElement[],
  orbit: Ellipse,
  t: number,
) {
  const n = field.theta.length
  for (let i = 0; i < n; i++) {
    const theta = field.theta[i] + field.speed[i] * t
    const d = depthOf(theta)
    const [x, y] = ellipsePoint(orbit, theta, field.rho[i])
    // 앞 1배 → 뒤 0.45배, 밝기 1 → 0.28
    const r = field.radius[i] * (0.45 + 0.55 * d) * SPRITE_SPAN
    ctx.globalAlpha = 0.28 + 0.72 * d
    ctx.drawImage(sprites[field.color[i]], x - r, y - r, r * 2, r * 2)
  }
  ctx.globalAlpha = 1
}

/** 캔버스를 요소 크기 × 기기 배율로 맞추고, 영상 px → 캔버스 px 배율을 돌려준다 */
export function fitCanvas(canvas: HTMLCanvasElement, videoW: number) {
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(rect.width * dpr))
  const h = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  return w / videoW
}
