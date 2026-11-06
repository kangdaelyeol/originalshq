import { useSyncExternalStore } from 'react'

// D16 움직임 값 — 영상(30fps) 프레임에서 잰 것. F는 영상 프레임, t는 초.
// GSAP 없이: 영상 코드의 back.out(2)는 같은 식을 CSS linear()로 펴서 WAAPI에 넘긴다.

// ── 이징 ─────────────────────────────────────────────────────────────────
export const clamp01 = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u)
/** GSAP back.out(s) — 1 + (s+1)(u−1)³ + s(u−1)² (s=2면 13% 넘었다 돌아온다) */
export const backOut = (s: number) => (u: number) => {
  const v = clamp01(u) - 1
  return 1 + (s + 1) * v * v * v + s * v * v
}
export const quadOut = (u: number) => 1 - (1 - clamp01(u)) ** 2
export const quartOut = (u: number) => 1 - (1 - clamp01(u)) ** 4
export const expoOut = (u: number) => (u >= 1 ? 1 : 1 - 2 ** (-10 * clamp01(u)))

/** 함수를 CSS linear()로 — n칸으로 나눠 점을 찍는다 */
export function cssLinear(fn: (u: number) => number, n = 40) {
  const pts: string[] = []
  for (let i = 0; i <= n; i++) pts.push(String(Math.round(fn(i / n) * 10000) / 10000))
  return `linear(${pts.join(', ')})`
}

export const EASE = {
  /** 유령 카드 기울기·키움(영상 코드 그대로) · 사이드바 표시가 처음 들어올 때 */
  backOut2: cssLinear(backOut(2)),
  /** 토스트 올라옴 — F163 +6 · F164 +3.3 · F167 −0.8(넘침) */
  backOut17: cssLinear(backOut(1.7)),
  /** 표시 앞 모서리 — easeOutQuad */
  quadOut: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  /** 표시 뒤 모서리·선 그리기 — easeInOutQuad(power2.inOut) */
  quadInOut: 'cubic-bezier(0.455, 0.03, 0.515, 0.955)',
  cubicOut: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
  quartOut: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
  /** 칸반 카드 자리 바꿈(FLIP) — 한 프레임마다 남은 거리 0.63배(2^(−10/15)) */
  expoOut: cssLinear(expoOut, 60),
  in: 'cubic-bezier(0.55, 0, 1, 0.45)',
}

// ── 시간(초) ─────────────────────────────────────────────────────────────
export const D16_T = {
  /** 앱을 연 뒤 영상 F0까지 — 숫자 오르기($244)가 F−12.4에 시작, 끝이 F19.3이라 거꾸로 맞췄다 */
  videoZero: 0.45,

  // 사이드바(앱을 열 때)
  /** 줄마다 0.022초씩 차례로 — Finances F−0.5 · Settings F5 · Dark mode F5.6, 왼쪽 3px에서 들어온다 */
  navStagger: 0.022,
  navDelay: 0.24,
  navFade: 0.2,
  /** 표시: Customers에서 Dashboard로 back.out(2) 0.53초(F−1.3 시작 · F7.5 13% 넘침 · F14.5 제자리) */
  navIndicatorDelay: 0.41,
  navIndicatorIn: 0.53,

  // 늘어나는 표시(사이드바 F72.8~F85 · 기간 F31.2~F45)
  /** 앞 모서리 easeOutQuad 7프레임 */
  stretchLead: 0.233,
  /** 뒤 모서리는 0.1초 늦게 easeInOutQuad 10프레임 */
  stretchTailDelay: 0.1,
  stretchTail: 0.33,

  // 대시보드(페이지를 열 때)
  /** 위 카드 셋 — F0에 이미 다 섰다 */
  cardRise: 0.4,
  topCardDelays: [0, 0.05, 0.1],
  /** 아래 카드 셋 — F1 · F2.5 · F4에 16px 아래에서 */
  bottomCardDelays: [0.48, 0.53, 0.58],
  /** 카드 안 줄 — 카드보다 0.2초 늦게 */
  rowDelay: 0.2,
  /** 숫자 오르기 quartOut 1.06초 — 끝이 F19.3 · F22.0 · F23.7(세 칸이 조금씩 늦다) */
  countDelays: [0.03, 0.12, 0.18],
  count: 1.06,
  /** 선 그리기 power2.inOut 0.833초(호 길이로 잰 비율이 F35 0.5% · F48 54% · F58 97%) */
  chartDelay: 0.2,
  chartDraw: 0.833,
  /** 기간을 누르면 축은 바로 바뀌고 선은 0.12초 뒤 그리기 시작(F31.5 → F35) */
  chartRedrawDelay: 0.12,
  /** 점선(지난 기간)은 F46~F52에 펼쳐진다 — 선 시작 0.35초 뒤 0.25초 */
  compareDelay: 0.35,
  compareDraw: 0.25,
  /** 면은 선이 70% 그려졌을 때부터 0.4초 */
  areaAt: 0.7,
  areaFade: 0.4,

  // 페이지 넘김(F73 클릭)
  /** 클릭 0.01초 뒤 0.1초 동안 사라진다 — 새 페이지가 클릭 0.12~0.15초 뒤 붙는다(F73.3 → F77.7 · F105.4 → F108.9) */
  exitDelay: 0.01,
  exit: 0.1,

  // Orders 페이지(F77.7에 붙는다)
  /** 제목 글자 — 가림 아래에서 quartOut 0.5초, 0.035초씩 */
  titleDelay: 0.05,
  titleRise: 0.5,
  titleStagger: 0.035,
  /** 탭 밑줄 — +12px에서 cubicOut 0.36초(F78 11.4 → F88 0) */
  underlineFrom: 12,
  underline: 0.36,
  /** 표 카드 — 10px 아래에서 0.45초(윗변 F81 +8 → F90 0) */
  tableDelay: 0.07,
  table: 0.45,
  /** 표 줄 — F88부터 0.025초씩 */
  rowsDelay: 0.33,
  rowsStagger: 0.025,
  rows: 0.25,
  /** 칸반 레인 — 12px 아래에서 0.05초씩(F110.5 · 111.5 · 113 · 114.5) */
  laneDelay: 0.05,
  laneStagger: 0.05,
  lane: 0.36,
  /** 칸반 카드 — 막이 F118.5(To pack) · F121(Packed) · F125.5(Shipped)부터 보인다(번호 글자는 3~4프레임 늦게) */
  cardsDelay: 0.3,
  cardsLaneStagger: 0.1,
  cardsStagger: 0.02,
  cardsFade: 0.2,

  // 끌어 놓기(영상 코드 + F141~F170)
  /** 영상 코드: gsap.fromTo(ghost, {scale:1, rotation:0}, {scale:1.04, rotation:-2, duration:0.25, ease:'back.out(2)'}) */
  ghostLift: 0.25,
  ghostScale: 1.04,
  ghostRotate: -2,
  /** 놓은 뒤 유령은 그 자리에 0.17초 있다가 0.07초에 사라지고 진짜 카드가 같이 나타난다(F161~F167.5) */
  ghostHold: 0.17,
  ghostFade: 0.07,
  /** 나머지 카드 자리 바꿈 expo.out 0.5초 — F161 시작(KL-49958 239 → 207 → 179 → 168 → 162 …) */
  flip: 0.5,
  /** 토스트 — 놓은 0.03초 뒤 12px 아래에서 back.out(1.7) 0.4초 */
  toastDelay: 0.03,
  toastRise: 0.4,
  toastFrom: 12,
  toastStay: 4,
}

/** 끌기 시작 문턱(영상 코드: Math.hypot(dx, dy) < 6) */
export const DRAG_THRESHOLD = 6

// ── 움직임 줄이기 ────────────────────────────────────────────────────────
const REDUCE = '(prefers-reduced-motion: reduce)'
const subscribe = (cb: () => void) => {
  const mq = matchMedia(REDUCE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const snapshot = () => matchMedia(REDUCE).matches

export const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia(REDUCE).matches

/** "움직임 줄이기"면 true — 들어오기·그리기를 건너뛰고 둘러보기가 저절로 시작하지 않는다 */
export function useD16ReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}

/**
 * WAAPI 한 번 — 초 단위로 받고, 움직임 줄이기면 시간을 0으로 한다.
 * 기본 fill은 backwards — 기다리는 동안 첫 모습을 걸고, 끝나면 CSS 모습으로 돌아간다(끝 모습을 붙잡지 않아야
 * 나중에 is-lifted 같은 클래스가 이긴다). 나가는 움직임처럼 끝 모습을 지켜야 하면 fill: 'both'.
 */
export function play(
  el: Element | null | undefined,
  keyframes: Keyframe[],
  opts: { duration: number; delay?: number; easing?: string; fill?: FillMode },
) {
  if (!el) return null
  const reduced = prefersReducedMotion()
  return el.animate(keyframes, {
    duration: reduced ? 0 : opts.duration * 1000,
    delay: reduced ? 0 : (opts.delay ?? 0) * 1000,
    easing: opts.easing ?? 'linear',
    fill: opts.fill ?? 'backwards',
  })
}
