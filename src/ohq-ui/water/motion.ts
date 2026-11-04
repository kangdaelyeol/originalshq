// 물 디자인(Design 7 — sample/design7.mp4)의 움직임. 영상 프레임에서 잰 감쇠 스프링·시간표를 모든 물 부품이
// 같이 쓴다(값의 출처는 lab/showcase/design7/liquid-menu-data.ts — F는 30fps 영상 프레임 번호).
// 시계는 document.timeline(rAF 시각)이라, 개발 도구에서 애니메이션을 느리게 돌리면 CSS와 같이 느려져
// 프레임 단위로 견줄 수 있다.

/** 지금 시각(초) — rAF 시각과 같은 시계 */
export const waterClock = (): number => {
  const t = document.timeline?.currentTime
  return (typeof t === 'number' ? t : performance.now()) / 1000
}

/**
 * 누른 시각 → 움직임 시작 시각(D7 since) — 누른 시각부터 재되, 너무 옛날이면(느린 기기·늦게 돈 효과) 0.12초까지만
 * 거슬러 간다. at이 없으면 지금
 */
export const since = (at: number | undefined, now: number = waterClock()): number =>
  at === undefined ? now : Math.min(now, Math.max(at, now - 0.12))

/** 감쇠 스프링 — zeta 감쇠비(1 이상이면 넘치지 않는다), omega 고유진동수(rad/s) */
export interface SpringSpec {
  zeta: number
  omega: number
}

/**
 * 스프링이 처음 목표에 닿는 시각(초) — 감쇠 진동의 상승 시간 (π − acos ζ) / (ω√(1−ζ²)).
 * extend 0.071s · move 0.132s(F75 → F78 97.6%와 맞다) · gather 0.059s. 임계 감쇠 이상은 닿지 않는다(Infinity)
 */
export function springArrival({ zeta, omega }: SpringSpec): number {
  if (zeta >= 1) return Infinity
  return (Math.PI - Math.acos(zeta)) / (omega * Math.sqrt(1 - zeta * zeta))
}

/**
 * 스프링이 제자리에 드는 시간(초) — 감쇠 포락선 e^(−ζωt)가 처음 거리의 1/2000(0.05%) 아래로 줄 때까지
 * (extend 0.45s · indicator 0.38s · move 0.41s). SCSS w-spring()의 길이와 같은 기준
 */
export const springSettle = ({ zeta, omega }: SpringSpec): number => Math.log(2000) / (Math.min(1, zeta) * omega)

/** 멈춘 상태에서 출발하는 감쇠 스프링(0 → 1) */
export function spring(t: number, { zeta, omega }: SpringSpec): number {
  if (t <= 0) return 0
  if (zeta >= 1) return 1 - Math.exp(-omega * t) * (1 + omega * t)
  const root = Math.sqrt(1 - zeta * zeta)
  const wd = omega * root
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta / root) * Math.sin(wd * t))
}

/**
 * 처음 위치·속도에서 target으로 가는 스프링의 위치·속도 — 움직이는 도중 목표가 바뀌어도 지금 위치·속도에서
 * 이어 가서 끊기지 않는다(D7 표시 알약).
 */
export function springAt(x0: number, v0: number, target: number, t: number, { zeta, omega }: SpringSpec) {
  const a = x0 - target
  if (zeta >= 1) {
    // 임계 감쇠
    const e = Math.exp(-omega * t)
    const b = v0 + omega * a
    return { x: target + e * (a + b * t), v: e * (b - omega * (a + b * t)) }
  }
  const root = Math.sqrt(1 - zeta * zeta)
  const wd = omega * root
  const b = (v0 + zeta * omega * a) / wd
  const e = Math.exp(-zeta * omega * t)
  const c = Math.cos(wd * t)
  const s = Math.sin(wd * t)
  return {
    x: target + e * (a * c + b * s),
    v: e * ((-zeta * omega * a + wd * b) * c + (-zeta * omega * b - wd * a) * s),
  }
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
/** 부드러운 계단(smoothstep) */
export const smooth = (v: number): number => {
  const c = clamp01(v)
  return c * c * (3 - 2 * c)
}
export const mix = (a: number, b: number, k: number): number => a + (b - a) * k
/** 소수 셋째 자리까지 — style 문자열이 프레임마다 미세하게 흔들리지 않게 */
export const round3 = (v: number): number => Math.round(v * 1000) / 1000

/** D7에서 잰 스프링 */
export const WATER_SPRING = {
  /** 자리를 옮김 — 버튼이 왼쪽으로 간다(F75 11.6% → F78 97.6% → F80 103%) */
  move: { zeta: 0.72, omega: 26 },
  /** 뻗어 나감 — 알약 끝이 15% 넘쳤다 돌아온다(F76 692 → F80 651 → F84 674) */
  extend: { zeta: 0.5, omega: 34 },
  /** 떨어져 나감 — 알약 왼끝이 0.165s 늦게 버튼에서 떨어진다(F81 목 → F86 183) */
  detach: { zeta: 0.45, omega: 36 },
  /** 출렁임 — 떨어진 뒤 버튼 반지름이 60.5 → 57.5로 출렁이며 준다(F84 56 → F88 58) */
  wobble: { zeta: 0.3, omega: 46 },
  /** 다시 붙음 — 접힐 때 알약 왼끝이 버튼을 뚫고 나온다(F25 16 → F28 24) */
  gather: { zeta: 0.6, omega: 47 },
  /** 부풂 — 물을 받아 버튼이 57.5 → 63.5까지(F27) */
  swell: { zeta: 0.35, omega: 20 },
  /** 꼬리 — 접힐 때 왼끝이 넘치지 않고 끌려온다(임계 감쇠) */
  trail: { zeta: 1, omega: 24 },
  /** 고른 표시 알약 — 거리와 상관없이 같은 모양, 7% 넘쳤다가 F+7에 제자리(ζ0.65·ω30.5) */
  indicator: { zeta: 0.65, omega: 30.5 },
} as const satisfies Record<string, SpringSpec>

/** 표시 알약이 달릴 때 늘어남 — 진행 빠르기에 비례, 가로 최대 28%·세로는 그 0.64배만큼 준다, 15ms 늦게 따라간다 */
export const WATER_STRETCH = { max: 0.28, perSpeed: 0.134, squash: 0.64, lag: 0.015 } as const

/**
 * 내용이 차례로 나타나는 시간표(펼침) — 표시 알약은 0.1s 동안 진해지고(F82 29% → F85 100%), 아이콘은 왼쪽부터
 * 21ms 간격으로 55ms 동안(F82 Activity 20% → F86 Voice 100%), 글자는 75ms. 사라질 때는 30ms.
 */
export const WATER_REVEAL = { indicator: 0.1, fade: 0.055, stagger: 0.021, label: 0.075, out: 0.03 } as const

/** 펼침이 끝나는 시간 — 가장 느린 스프링이 0.1px 안쪽으로 들어온다(접힘은 0.8s) */
export const WATER_SETTLE = { open: 0.75, close: 0.8 } as const

/** 사용자가 "동작 줄이기"를 켰는지 */
export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * rAF로 그리기 — draw(지난 초)가 true를 돌려주는 동안 매 프레임 부른다. 멈추는 함수를 돌려준다.
 * from에 누른 시각을 넘기면 그때부터 잰다(React가 효과를 늦게 돌려도 시간표가 어긋나지 않게).
 */
export function animate(draw: (t: number) => boolean, from: number = waterClock()): () => void {
  let raf = 0
  const tick = () => {
    raf = draw(waterClock() - from) ? requestAnimationFrame(tick) : 0
  }
  raf = requestAnimationFrame(tick)
  return () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }
}
