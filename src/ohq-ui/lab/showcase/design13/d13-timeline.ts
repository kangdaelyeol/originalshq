// D13 시간표 — 영상(30fps)에서 잰 값. t = 장면을 연 뒤 초(영상 F0 = 0초, 한 프레임 = 1/30초).
// 영상은 7.75초에서 끝나지만 규칙은 그대로 끝없이 돈다: 사건(선 하나)은 0.2975초마다, 사건 열 개·판정 열두 줄이
// 한 바퀴, 카드는 19초에 한 바퀴. 처음 6~7초의 숫자 오르기·막대 차오르기는 영상처럼 장면을 열 때(다시 재생) 한 번.

/** 사건 간격 — TAPE 새 글·칩 번호가 F10·19·28 … F224에 바뀐다. 25번이 모두 (F-1, F] 안에 들게 맞추니 8.9245프레임 */
export const EVENT_PERIOD = 0.29748
/** 첫 사건(drone) — F0.29. F0은 그 직전(카운터 #001, TAPE 빈 칸) */
export const EVENT_FIRST = 0.0097

/** t에 진행 중인 사건 번호(첫 사건 전이면 -1) */
export const eventIndexAt = (t: number) => Math.floor((t - EVENT_FIRST) / EVENT_PERIOD)
export const eventStartAt = (k: number) => EVENT_FIRST + k * EVENT_PERIOD

// ── 사건 하나 안(u = 사건 시작부터 초) ─────────────────────────────────────────
// 25번을 겹쳐 평균: 선 끝이 F+1에 0.56, F+2에 0.89, F+3에 1(easeOutQuad 0.1초) → F+4.5까지 그대로 →
// F+9 전에 사라진다. 카드는 F+3.5에 번쩍(선이 닿을 때), 초록 판정표는 F+4.6~F+8.4.

/** 선이 뻗기 시작 — 사건 시작 0.01초 뒤(25번 평균: 선이 처음 보이는 프레임이 사건 시작 + 1.3프레임) */
export const LINK_DELAY = 0.01
/** 선이 카드까지 뻗는 시간(easeOutQuad) */
export const LINK_GROW = 0.1
/** 다 뻗은 뒤 그대로 있다가 이때부터 흐려진다 */
export const LINK_FADE_FROM = 0.14
export const LINK_FADE_TO = 0.29
/** 선 끝이 카드에 닿는 순간 — 카드·숫자 칸 번쩍 */
export const LINK_ARRIVE = 0.117
/** 초록 판정표가 떠 있는 동안 */
export const BADGE_FROM = 0.153
export const BADGE_TO = 0.28

/** 카드 불빛 — 사건마다 한 칸씩 식는다(F+9·18·27·36에 계단: 테두리 분홍 85→50→31→21→18) */
export const HEAT_STEPS = [1, 0.48, 0.2, 0.06] as const

/** 숫자 칸 번쩍 — F+4에 켜져 2프레임 그대로, 3프레임에 꺼진다 */
export const STAT_FLASH_HOLD = 0.06
export const STAT_FLASH_FADE = 0.11

/** TAPE 치기 — 글 길이와 상관없이 0.095초(약 3프레임)에 다 친다(30자 글 F+1 9자 · F+2 19자 · F+3 다,
 * 39자 글 F+1 5자 · F+2 17자 · F+3 33자). 사건 시작 0.008초 뒤부터. */
export const TAPE_DELAY = 0.008
export const TAPE_TYPE = 0.095
/** 깜빡이 — 장면 시계로 0.2113초마다(켜짐 절반), 치는 동안은 늘 켜짐. 228프레임 켜짐/꺼짐과 96.9% 일치 */
export const CARET_PERIOD = 0.2113
export const CARET_PHASE = 0.04

/** 판정 줄이 한 칸 내려오는 시간(F+0→F+2) */
export const VERDICT_SLIDE = 0.07

// ── 숫자 오르기·출렁임 ───────────────────────────────────────────────────────
/** 오르기 시작 — F0.6 */
export const COUNT_DELAY = 0.02
/** CURATE 출렁임이 붙기 시작하는 구간(F25에는 아직 없고 F30에는 다 있다) */
export const RISE_WAVE_FROM = 0.83
export const RISE_WAVE_TO = 1

/** 막대 출렁임 주기 — 셋 다 24.99프레임 */
export const LANDS_PERIOD = 0.833
/** 막대 차오르기(easeOutCubic) */
export const LANDS_FILL = 0.42

/** 꼬마 선 출렁임 — 다섯 칸 모두 0.231rad/프레임(0.906초 주기) */
export const SPARK_PERIOD = 0.906

/** 움직임 줄이기에서 보여 줄 한 장면 — 숫자가 다 오르고 막대가 다 찬 뒤 */
export const STILL_T = 7.6

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const easeOutCubic = (u: number) => 1 - (1 - clamp01(u)) ** 3
export const easeOutQuad = (u: number) => 1 - (1 - clamp01(u)) ** 2
export const smoothstep = (a: number, b: number, v: number) => {
  const u = clamp01((v - a) / (b - a))
  return u * u * (3 - 2 * u)
}

/** 오르기 값(easeOutCubic, COUNT_DELAY 뒤 시작) */
export const countAt = (t: number, from: number, to: number, duration: number) =>
  from + (to - from) * easeOutCubic((t - COUNT_DELAY) / duration)

/** 빨리 오른 뒤 출렁이는 값(CURATE) */
export function riseAt(
  t: number,
  spec: { from: number; to: number; duration: number; wave: number; period: number; phase: number },
) {
  const base = countAt(t, spec.from, spec.to, spec.duration)
  const wave = spec.wave * Math.cos((2 * Math.PI * t) / spec.period + spec.phase)
  return base + wave * smoothstep(RISE_WAVE_FROM, RISE_WAVE_TO, t)
}

/** 막대 값(0~1) — 차오른 뒤 가운데 값 ± 출렁임 */
export function landsAt(t: number, bar: { value: number; wobble: number; phase: number; delay: number }) {
  const wobble = bar.value + bar.wobble * Math.cos((2 * Math.PI * t) / LANDS_PERIOD + bar.phase)
  return wobble * easeOutCubic((t - bar.delay) / LANDS_FILL)
}

/** 선 끝 위치(0~1)와 선 불투명도 */
export function linkAt(u: number) {
  const head = easeOutQuad((u - LINK_DELAY) / LINK_GROW)
  const alpha = u < 0 ? 0 : u < LINK_FADE_FROM ? 1 : 1 - clamp01((u - LINK_FADE_FROM) / (LINK_FADE_TO - LINK_FADE_FROM))
  return { head, alpha }
}

/** 숫자 칸 번쩍 세기(0~1) */
export function flashAt(u: number) {
  const v = u - LINK_ARRIVE
  if (v < 0) return 0
  if (v < STAT_FLASH_HOLD) return 1
  return 1 - clamp01((v - STAT_FLASH_HOLD) / STAT_FLASH_FADE)
}

const NUMBER = new Intl.NumberFormat('en-US')
export const formatInt = (v: number) => NUMBER.format(Math.round(v))
