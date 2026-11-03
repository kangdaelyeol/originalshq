import type { ComponentType, SVGProps } from 'react'

// Design 7(sample/design7.mp4) "Liquid Expand Hamburger Menu"의 치수·움직임.
// 좌표는 전부 영상 px(1em = 10px), 원점 O = 접힌 버튼의 가운데(영상 356.7, 647).
// 주석의 F는 30fps 영상 프레임 번호, t는 누른 순간부터 흐른 초.

export type LiquidEffect = 'bounce' | 'splash'

export interface LiquidMenuItem {
  key: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

// ── 크기 ─────────────────────────────────────────────────────────────────────
/** 접힌 버튼 반지름 — F49: 왼쪽 테두리 296.5, 위 586.5 */
export const CLOSED_R = 60.5
/** 펼친 뒤 버튼 반지름 — F1: 5% 작아진다(왼쪽 28.5, 위 589) */
export const OPEN_R = 57.5
/** 펼친 뒤 버튼 가운데 — F1: 86.2 */
export const OPEN_CX = -270.5
/** 알약 반높이 — F1: 위 603.5, 아래 690.5 */
export const PILL_HALF_H = 43.5
/** 버튼 가운데 → 알약 왼끝 — F1: 186.5(어두운 테두리 187~188 바깥) */
export const PILL_LEFT_REL = 100.3
/** 아이콘 간격 — F1: 235.5, 333.5, 431, 528.5, 626 */
export const ICON_STEP = 97.5
/** 알약 왼끝 → 첫 아이콘 가운데 */
export const ICON_INSET = 49.3
/** 아이콘 줄 높이(가운데 y) — F1: 630.5 */
export const ICON_Y = -16.5
/** 홈(알약 아래 오목한 줄) — F1: x 228~632, y 660~683, 양끝이 알약 끝에서 41 안쪽 */
export const TRACK_TOP = 13
export const TRACK_H = 23
export const TRACK_INSET = 41
/** 표시 알약 — F1: 71×50.5, 가운데 y 631 */
export const INDICATOR_W = 71
export const INDICATOR_H = 50.5
export const INDICATOR_Y = -16
/** 라벨 — 알약 가운데가 아니라 x 440에 맞춰 있다(F1·F140·F170 모두 440) */
export const LABEL_X = 83.3
export const LABEL_BASELINE = 113.5

export interface LiquidGeometry {
  count: number
  /** 알약 길이 */
  pillLen: number
  /** 버튼 가운데 → 알약 오른끝 */
  pillExt: number
  iconX: (index: number) => number
}

/** 항목 수에 맞춘 펼친 모양 — 5개일 때 알약 485.8(F1: 186.5~672.3) */
export function liquidGeometry(count: number): LiquidGeometry {
  const pillLen = ICON_INSET * 2 + ICON_STEP * Math.max(0, count - 1) - 2.8
  return {
    count,
    pillLen,
    pillExt: PILL_LEFT_REL + pillLen,
    iconX: (index) => OPEN_CX + PILL_LEFT_REL + ICON_INSET + ICON_STEP * index,
  }
}

// ── 스프링 ────────────────────────────────────────────────────────────────────
/** 멈춘 상태에서 출발하는 감쇠 스프링(0 → 1). zeta 감쇠비, omega 고유진동수(rad/s) */
export function spring(t: number, zeta: number, omega: number): number {
  if (t <= 0) return 0
  if (zeta >= 1) return 1 - Math.exp(-omega * t) * (1 + omega * t)
  const root = Math.sqrt(1 - zeta * zeta)
  const wd = omega * root
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta / root) * Math.sin(wd * t))
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => {
  const c = clamp01(v)
  return c * c * (3 - 2 * c)
}

// ── 펼침·접힘 장면 ────────────────────────────────────────────────────────────
/** 한 순간의 모양 — 엔진이 이 값을 SVG·HTML에 그대로 옮긴다 */
export interface LiquidPose {
  /** 버튼(원) 가운데 x와 반지름 */
  cx: number
  r: number
  /** 알약 양 끝 x */
  pillL: number
  pillR: number
  /** 알약이 물 모양에 보태는 정도(0이면 알약 없음) */
  pillOn: number
  /**
   * 버튼 속을 채우는 불투명 유리 — 따로 서 있을 때만 켜진다. 알약과 한 덩어리일 때는 투명해서
   * 뒤 격자선이 비친다(F24~F80 x125 선 보임, F81·F23 안 보임 — 한 프레임에 바뀐다).
   */
  solid: number
  /** 홈 길이 비율 */
  track: number
  indicator: number
  indicatorScale: number
  icons: number[]
  label: number
}

export function restPose(open: boolean, geo: LiquidGeometry): LiquidPose {
  return open
    ? {
        cx: OPEN_CX,
        r: OPEN_R,
        pillL: OPEN_CX + PILL_LEFT_REL,
        pillR: OPEN_CX + geo.pillExt,
        pillOn: 1,
        solid: 1,
        track: 1,
        indicator: 1,
        indicatorScale: 1,
        icons: Array.from({ length: geo.count }, () => 1),
        label: 1,
      }
    : {
        cx: 0,
        r: CLOSED_R,
        pillL: 0,
        pillR: 0,
        pillOn: 0,
        solid: 1,
        track: 0,
        indicator: 0,
        indicatorScale: 1,
        icons: Array.from({ length: geo.count }, () => 0),
        label: 0,
      }
}

/** 펼침이 끝나는 시간(s) — 가장 느린 스프링(알약 왼끝, 0.165s 출발)이 0.1px 안쪽으로 들어온다 */
export const OPEN_SETTLE = 0.75
export const CLOSE_SETTLE = 0.8

/**
 * 펼침(F74 클릭 → F90). 셋이 따로 움직인다.
 * - 버튼: 가운데에서 왼쪽으로 — 스프링 ζ0.72·ω26(F75 11.6% → F78 97.6% → F80 103%)
 * - 알약 오른끝: 버튼 기준으로 뻗는다 — ζ0.5·ω34, 화면 밖까지 15% 넘쳤다 돌아온다(F76 692 → F80 651 → F84 674)
 * - 알약 왼끝: 0.165s 늦게 버튼에서 떨어져 나간다 — ζ0.45·ω36(F81 목 → F82 200 → F83 207 → F86 183 → 187.5)
 * 떨어지는 순간(F82) 버튼이 60.5 → 57.5로 출렁이며 줄고(F84 56 → F88 58), 그 뒤 내용이 차례로 나타난다.
 */
export function openPose(t: number, geo: LiquidGeometry): LiquidPose {
  const cx = OPEN_CX * spring(t, 0.72, 26)
  const ext = CLOSED_R + (geo.pillExt - CLOSED_R) * spring(t, 0.5, 34)
  const lRel = t < 0.165 ? -10 : -10 + (PILL_LEFT_REL + 10) * spring(t - 0.165, 0.45, 36)
  const r = t < 0.236 ? CLOSED_R : OPEN_R + (CLOSED_R - OPEN_R) * (1 - spring(t - 0.236, 0.3, 46))
  // 홈: 알약 가운데에서 양쪽으로 자란다 — 1차 지연 τ 67ms(F80 0.40 → F82 0.74 → F85 0.98)
  const track = t < 0.153 ? 0 : 1 - Math.exp(-(t - 0.153) / 0.0667)
  // 표시 알약: 제자리에서 진해지기만 한다(F82 29% → F83 83% → F85 100%)
  const ind = clamp01((t - 0.235) / 0.1)
  return {
    cx,
    r,
    pillL: cx + lRel,
    pillR: cx + ext,
    pillOn: 1,
    solid: t < 0.203 ? 0 : 1,
    track,
    indicator: 1 - (1 - ind) * (1 - ind),
    indicatorScale: 1,
    // 아이콘: 왼쪽부터 20ms 간격으로 55ms 동안(F82 Activity 20% → F86 Voice 100%)
    icons: Array.from({ length: geo.count }, (_, i) => clamp01((t - 0.247 - i * 0.021) / 0.055)),
    label: clamp01((t - 0.28) / 0.075),
  }
}

/** 접힘 1단계 길이 — 알약이 버튼에 다시 붙고 버튼이 부푸는 동안(F22.5 클릭 → F28.3 이동 시작) */
const CLOSE_GATHER = 0.188

/**
 * 접힘(F22 클릭 → F38).
 * 1단계(0~0.188s): 알약 왼끝이 버튼을 뚫고 왼쪽으로 삐져나오고(F25 16 → F28 24),
 *   버튼은 물을 받아 57.5 → 63.5까지 부푼다(F27). 내용은 곧바로 사라진다(F24).
 * 2단계: 버튼은 펼칠 때와 같은 스프링으로 가운데로, 알약 오른끝은 버튼 쪽으로 빨려 들어가고,
 *   왼끝은 뒤처져 꼬리처럼 끌려온다(F31 버튼 왼쪽 85px, F32 81px). 마지막에 오른쪽이 살짝 불룩(F34·F35)했다 가라앉는다.
 */
export function closePose(t: number, geo: LiquidGeometry): LiquidPose {
  // 목표 -55: 더한 장이라 겹친 자리가 5px쯤 더 불룩해서, 보이는 왼끝은 F25 16 → F28 24가 된다
  const lRelA = (u: number) => PILL_LEFT_REL + (-55 - PILL_LEFT_REL) * spring(u, 0.6, 47)
  // 부풂: F24 60 → F27 63.5(꼭대기) → F29 60.5
  const rA = (u: number) => OPEN_R + 4.6 * spring(u, 0.35, 20)
  const fade = clamp01((t - 0.015) / 0.03)
  const base = {
    pillOn: 1,
    // 알약이 다시 붙는 순간(F24) 투명해졌다가, 다 빨려 들어간 뒤 다시 채운다
    solid: t < 0.033 || t > 0.5 ? 1 : 0,
    track: Math.exp(-t / 0.053), // F23 0.72 → F25 0.22 → F27 0.05
    indicator: 1 - fade,
    indicatorScale: 1 - 0.5 * fade, // F23: 0.75배로 줄며 흐려진다
    icons: Array.from({ length: geo.count }, () => 1 - fade),
    label: clamp01(1 - (t - 0.002) / 0.107), // F24 55% → F25 24% → F26 0
  }
  if (t < CLOSE_GATHER) {
    return { ...base, cx: OPEN_CX, r: rA(t), pillL: OPEN_CX + lRelA(t), pillR: OPEN_CX + geo.pillExt }
  }
  const tb = t - CLOSE_GATHER
  const cx = OPEN_CX - OPEN_CX * spring(tb, 0.72, 26)
  const ext = geo.pillExt + (60 - geo.pillExt) * spring(tb, 0.5, 34)
  const l0 = OPEN_CX + lRelA(CLOSE_GATHER)
  const lAbs = l0 + (-10 - l0) * spring(tb, 1, 24)
  const r0 = rA(CLOSE_GATHER)
  return {
    ...base,
    cx,
    r: CLOSED_R + (r0 - CLOSED_R) * (1 - spring(tb, 0.3, 30)),
    pillL: lAbs,
    pillR: cx + ext,
    pillOn: 1 - smooth((tb - 0.17) / 0.13),
  }
}

/** 두 모양을 섞는다 — 움직이는 도중에 다시 누르면 지금 모양에서 새 움직임으로 0.15초 동안 넘어간다 */
export function mixPose(a: LiquidPose, b: LiquidPose, k: number): LiquidPose {
  const m = (x: number, y: number) => x + (y - x) * k
  return {
    cx: m(a.cx, b.cx),
    r: m(a.r, b.r),
    pillL: m(a.pillL, b.pillL),
    pillR: m(a.pillR, b.pillR),
    pillOn: m(a.pillOn, b.pillOn),
    solid: m(a.solid, b.solid),
    track: m(a.track, b.track),
    indicator: m(a.indicator, b.indicator),
    indicatorScale: m(a.indicatorScale, b.indicatorScale),
    icons: b.icons.map((v, i) => m(a.icons[i] ?? v, v)),
    label: m(a.label, b.label),
  }
}

// ── 표시 알약 ─────────────────────────────────────────────────────────────────
/**
 * 표시 알약 이동 — 거리와 상관없이 같은 모양으로 움직인다(7번의 이동을 맞춘 결과 ζ0.65·ω30.5,
 * 7% 넘쳤다가 F+7에 제자리). 늘어남은 진행 속도에 비례하고 최대 28%(F109~F111 폭 91, 높이 41.5).
 */
export const INDICATOR_SPRING = { zeta: 0.65, omega: 30.5 }
export const INDICATOR_STRETCH = { max: 0.28, perSpeed: 0.134, squash: 0.64, lag: 0.015 }

// ── 물방울 ────────────────────────────────────────────────────────────────────
/**
 * 고른 뒤 물방울이 나오기까지 — 한 칸 이동은 F+4.5(150ms), 네 칸은 F+7.4(246ms).
 * Bounce: 표시 알약 윗변(y -42)에서 튀어 올라 31px 위(F119·F242)까지 갔다 떨어져 아이콘 위에서 두 번 통통 튄다.
 * Splash: 위(y -87)에서 떨어져 아이콘에 부딪혀 작은 방울 여덟 개로 흩어진다(F425~F430).
 * 둘 다 부딪힐 때 유리에 물결이 두 겹 퍼진다(초속 525px, 0.27초).
 */
export const DROP_DELAY = { base: 0.15, perStep: 0.032 }
export const DROP_GRAVITY = 4600
export const BOUNCE_DROP = { top: -42, rest: -23, launch: 534, rebound: 300, rebound2: 100 }
/** Splash 방울은 거의 같은 빠르기로 떨어진다(F397 -74.6 → F398 -61.1 → F399 -47, 한 프레임 13.5~14px) */
export const SPLASH_DROP = { spawn: -87, speed: 400, gravity: 600, top: -42, impact: -20, lead: 0.03 }
export const RIPPLE = { r0: 22, speed: 525, gap: 22, life: 0.3, y: -16 }

/** 튀는 방울 하나(각도 °, 0 = 오른쪽·-90 = 위, 거리 px, 반지름, 수명 s) — F402~F407: 아이콘 둘레로 퍼져 몇 알은 알약 밖까지 */
export interface SplashParticle {
  angle: number
  dist: number
  size: number
  life: number
}

export const SPLASH_PARTICLES: readonly SplashParticle[] = [
  { angle: -162, dist: 40, size: 2.4, life: 0.3 },
  { angle: -128, dist: 32, size: 2.6, life: 0.22 },
  { angle: -100, dist: 28, size: 2.3, life: 0.2 },
  { angle: -72, dist: 30, size: 2.8, life: 0.24 },
  { angle: -44, dist: 34, size: 2.5, life: 0.21 },
  { angle: -14, dist: 42, size: 2.7, life: 0.26 },
  { angle: 22, dist: 36, size: 2.3, life: 0.3 },
  { angle: 150, dist: 28, size: 2.1, life: 0.19 },
  { angle: 178, dist: 38, size: 2.2, life: 0.23 },
]

// ── 바탕 ──────────────────────────────────────────────────────────────────────
/**
 * 바탕 타일 — 465×196 격자(세로줄 x 125·590, 가로줄 y 549·745), 버튼이 가운데 타일 한복판(F49).
 * 전체는 왼쪽 위가 밝은 사선 그러데이션(G = 197.6 - 0.038x - 0.036y), 타일마다 밝기 차가 있다(G 채널, 3×3).
 */
export const TILE_W = 465
export const TILE_H = 196
export const TILE_SHADE: readonly (readonly number[])[] = [
  [-1, 0, -7],
  [-12.5, 0, -7],
  [-12, -6.6, -10.4],
]

// ── 영상 순서 ─────────────────────────────────────────────────────────────────
export type LiquidScriptStep =
  | { at: number; open: boolean }
  | { at: number; select: string }
  | { at: number; effect: LiquidEffect }

/** 영상의 조작 순서(초) — F 번호에서 (F-1)/30 */
export const LIQUID_SCRIPT: readonly LiquidScriptStep[] = [
  { at: 0.717, open: false },
  { at: 2.447, open: true },
  { at: 3.569, select: 'activity' },
  { at: 4.9, select: 'cards' },
  { at: 5.848, select: 'work' },
  { at: 6.816, select: 'voice' },
  { at: 7.791, select: 'profile' },
  { at: 9.783, open: false },
  { at: 10.713, open: true },
  { at: 11.85, effect: 'splash' },
  { at: 12.95, select: 'activity' },
  { at: 13.85, select: 'cards' },
  { at: 14.683, select: 'work' },
  { at: 15.547, select: 'voice' },
  { at: 16.427, select: 'profile' },
  { at: 17.817, open: false },
]
export const LIQUID_SCRIPT_END = 19.5
